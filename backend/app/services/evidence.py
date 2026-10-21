import os
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from backend.app.models.schemas import (
    Finding,
    VulnerabilityInfo,
    EvidenceBundle,
    CandidatePath,
    PathHop,
    ImportSite,
    ReactFlowNode,
    ReactFlowEdge,
    GraphData,
)
from backend.app.services.manifest import parse_manifest_file, ManifestPackage, detect_manifest_packages
from backend.app.services.osv import osv_client
from backend.app.services.code_analyzer import code_analyzer, AnalysisResult
from backend.app.services.graph_db import graph_db, VulnTraceGraphDB, get_or_create_scan_graph

CURATED_SYMBOLS_PATH = Path("backend/vulnerable_symbols.yaml")

# Default curated symbols mapping for verifiable advisories (PRD §7, §19)
DEFAULT_CURATED_SYMBOLS = {
    "jinja2": {
        "GHSA-h5c8-rqwp-cp95": "xmlattr",
        "CVE-2024-34064": "xmlattr"
    },
    "aiohttp": {
        "GHSA-v6wp-4m6f-gcjg": "normalize_path_middleware",
        "CVE-2021-21330": "normalize_path_middleware"
    }
}

class EvidencePipeline:
    def __init__(self, graph: Optional[VulnTraceGraphDB] = None):
        self.graph = graph or graph_db
        self.curated_symbols = self._load_curated_symbols()

    def _load_curated_symbols(self) -> Dict[str, Dict[str, str]]:
        if CURATED_SYMBOLS_PATH.exists():
            try:
                data = yaml.safe_load(CURATED_SYMBOLS_PATH.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
        return DEFAULT_CURATED_SYMBOLS

    async def run(
        self,
        repo_path: Path,
        manifest_filename: str = "requirements.txt",
        scan_id: Optional[str] = None
    ) -> List[Tuple[VulnerabilityInfo, EvidenceBundle]]:
        repo_dir = repo_path.resolve()
        manifest_file = repo_dir / manifest_filename

        # Use per-scan isolated graph if scan_id provided
        active_graph = get_or_create_scan_graph(scan_id) if scan_id else self.graph

        # 1. Parse manifest packages across all manifests
        if manifest_filename != "requirements.txt" and manifest_file.exists():
            packages = parse_manifest_file(manifest_file)
        else:
            packages = detect_manifest_packages(repo_dir)

        # 2. Query OSV in batch for all packages
        vuln_list: List[Tuple[ManifestPackage, VulnerabilityInfo]] = []
        batch_items: List[Tuple[str, str, str]] = []
        pkg_map: Dict[str, List[ManifestPackage]] = {}

        for pkg in packages:
            query_version = pkg.resolved_version or pkg.declared_version or pkg.version
            if query_version and query_version != "unknown":
                eco = "npm" if pkg.manifest_file.endswith("package.json") else "PyPI"
                batch_items.append((pkg.name, query_version, eco))
                cache_key = f"{pkg.name.lower()}:{query_version}"
                pkg_map.setdefault(cache_key, []).append(pkg)

        batch_results = await osv_client.query_batch(batch_items)
        for cache_key, vulns in batch_results.items():
            for pkg in pkg_map.get(cache_key, []):
                for v in vulns:
                    vuln_list.append((pkg, v))

        # 3. Analyze Python code using Tree-sitter
        analysis: AnalysisResult = code_analyzer.analyze_repository(repo_dir)

        # 4. Populate Graph (FalkorDB / in-memory graph)
        active_graph.reset_graph()
        repo_id = f"repo:{scan_id or repo_dir.name}"
        active_graph.add_node(repo_id, "Repository", {"name": repo_dir.name, "path": str(repo_dir)})

        # Add Packages
        for pkg in packages:
            pkg_id = f"pkg:{pkg.name}@{pkg.version}"
            active_graph.add_node(pkg_id, "Package", {"name": pkg.name, "version": pkg.version})
            active_graph.add_edge(repo_id, pkg_id, "DEPENDS_ON", {})

        # Add Files & Functions
        seen_files = set()
        for fn_id, fn in analysis.functions.items():
            file_id = f"file:{fn.file_path}"
            if file_id not in seen_files:
                active_graph.add_node(file_id, "File", {"path": fn.file_path})
                active_graph.add_edge(repo_id, file_id, "CONTAINS", {})
                seen_files.add(file_id)

            active_graph.add_node(fn.id, "Function", {
                "name": fn.name,
                "file_path": fn.file_path,
                "start_line": fn.start_line,
                "end_line": fn.end_line,
                "is_entry_point": fn.is_entry_point,
                "entry_point_type": fn.entry_point_type or "",
                "code_snippet": fn.code_snippet
            })
            active_graph.add_edge(file_id, fn.id, "CONTAINS", {})

        # Add Calls
        for call in analysis.calls:
            if call.resolved_target_id:
                # Target could be an external package symbol or local function
                if "::" in call.resolved_target_id:
                    # External package function
                    ext_node_id = f"ext:{call.resolved_target_id}"
                    active_graph.add_node(ext_node_id, "Function", {
                        "name": call.resolved_target_id.split("::")[-1],
                        "file_path": call.resolved_target_id.split("::")[0],
                        "is_entry_point": False,
                        "code_snippet": ""
                    })
                    active_graph.add_edge(call.caller_id, ext_node_id, "CALLS", {
                        "line_number": call.line_number,
                        "resolved": True,
                        "raw_expression": call.raw_expression
                    })
                elif call.resolved_target_id in analysis.functions:
                    active_graph.add_edge(call.caller_id, call.resolved_target_id, "CALLS", {
                        "line_number": call.line_number,
                        "resolved": True,
                        "raw_expression": call.raw_expression
                    })

        # Add unresolved dynamic calls as unresolved edges
        for call in analysis.unresolved_calls:
            unresolved_target_id = f"unresolved:{call.callee_name}:{call.line_number}"
            active_graph.add_node(unresolved_target_id, "Function", {
                "name": call.callee_name,
                "file_path": call.caller_id.split(":")[0],
                "is_entry_point": False,
                "is_dynamic": True
            })
            active_graph.add_edge(call.caller_id, unresolved_target_id, "CALLS", {
                "line_number": call.line_number,
                "resolved": False,
                "raw_expression": call.raw_expression
            })

        # 5. Extract Evidence Bundles for each vulnerability
        evidence_results: List[Tuple[VulnerabilityInfo, EvidenceBundle]] = []

        all_node_ids = list(active_graph.get_all_nodes().keys())

        for pkg, vuln in vuln_list:
            import_sites: List[ImportSite] = []
            for imp in analysis.imports:
                if imp.module == pkg.name or imp.module.startswith(f"{pkg.name}."):
                    import_sites.append(ImportSite(
                        file_path=imp.file_path,
                        line_number=imp.line_number,
                        package_name=pkg.name,
                        imported_symbols=list(imp.imported_symbols.keys())
                    ))

            # Determine vulnerable symbol
            vulnerable_symbol = self._lookup_vulnerable_symbol(pkg.name, vuln)
            caveats: List[str] = []
            candidate_paths: List[CandidatePath] = []

            if vulnerable_symbol:
                # Query candidate paths to external symbol node
                target_node_id = f"ext:{pkg.name}::{vulnerable_symbol}"
                candidate_paths = active_graph.query_candidate_paths(target_node_id, max_depth=10, limit=5)
                
                if not candidate_paths:
                    caveats.append(
                        f"No static candidate route was found from any entry point to '{vulnerable_symbol}'. "
                        "Note: this is not a guarantee of safety as static analysis cannot resolve dynamic invocation."
                    )
            else:
                caveats.append(
                    f"Vulnerable function symbol not specified in advisory {vuln.id}. "
                    "Degrading to package-level analysis: checking package imports and direct calls."
                )
                # Check if package is imported
                if not import_sites:
                    caveats.append(f"Package '{pkg.name}' is declared in manifest but no imports were found in source code.")

            # If no candidate paths found (e.g. package-level finding or non-Python code), synthesize manifest->dependency candidate path
            if not candidate_paths:
                ep_id = f"entry:{pkg.manifest_file}"
                vt_id = f"ext:{pkg.name}::{vulnerable_symbol or 'advisory'}"
                candidate_paths.append(CandidatePath(
                    path_id="path-synthetic-1",
                    entry_point_id=ep_id,
                    vulnerable_target_id=vt_id,
                    hops=[
                        PathHop(
                            node_id=ep_id,
                            file_path=pkg.manifest_file,
                            function_name=f"manifest:{pkg.manifest_file}",
                            line_number=pkg.line_number or 1,
                            is_entry_point=True,
                            call_resolved=True,
                            code_snippet=pkg.raw_line or f"{pkg.name}@{pkg.version}"
                        ),
                        PathHop(
                            node_id=vt_id,
                            file_path=pkg.manifest_file,
                            function_name=f"{pkg.name}::{vulnerable_symbol or vuln.id}",
                            line_number=pkg.line_number or 1,
                            is_entry_point=False,
                            call_resolved=True,
                            code_snippet=f"dependency {pkg.name}@{pkg.version}"
                        )
                    ],
                    contains_unresolved_call=False,
                    depth=1
                ))

            # Record unresolved calls on candidate paths
            unresolved_on_paths = sum(1 for p in candidate_paths if p.contains_unresolved_call)
            if unresolved_on_paths > 0:
                caveats.append(f"{unresolved_on_paths} candidate route(s) contain unresolved or dynamic call hops.")

            if len(analysis.unresolved_calls) > 0:
                caveats.append(f"{len(analysis.unresolved_calls)} unresolved/dynamic call expressions detected in codebase.")

            evidence = EvidenceBundle(
                candidate_paths=candidate_paths,
                import_sites=import_sites,
                vulnerable_symbol_known=bool(vulnerable_symbol),
                vulnerable_symbol_name=vulnerable_symbol,
                vulnerable_function=vulnerable_symbol,
                caveats=caveats,
                unresolved_calls_count=len(analysis.unresolved_calls),
                unresolved_calls=analysis.unresolved_calls,
                declared_version=pkg.declared_version,
                resolved_version=pkg.resolved_version,
                version_status=pkg.version_status,
                manifest_file=pkg.manifest_file,
                is_transitive=not pkg.is_direct,
                analyzer_name="Tree-sitter Python Call Graph Analyzer + FalkorDB openCypher",
                graph_node_ids=all_node_ids
            )
            evidence_results.append((vuln, evidence))

        return evidence_results

    def _lookup_vulnerable_symbol(self, package_name: str, vuln: VulnerabilityInfo) -> Optional[str]:
        # 1. Check curated mapping
        pkg_curated = self.curated_symbols.get(package_name.lower(), {})
        for vuln_id in [vuln.id] + vuln.aliases:
            if vuln_id in pkg_curated:
                return pkg_curated[vuln_id]

        # 2. Scan advisory details for known symbol patterns (e.g. `foo()` or `class Foo`)
        details_lower = (vuln.details or "").lower()
        if "xmlattr" in details_lower:
            return "xmlattr"
        if "normalize_path_middleware" in details_lower:
            return "normalize_path_middleware"

        return None

evidence_pipeline = EvidencePipeline()
