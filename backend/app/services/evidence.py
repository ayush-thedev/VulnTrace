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
from backend.app.services.manifest import parse_manifest_file, ManifestPackage
from backend.app.services.osv import osv_client
from backend.app.services.code_analyzer import code_analyzer, AnalysisResult
from backend.app.services.graph_db import graph_db, VulnTraceGraphDB

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

    async def run(self, repo_path: Path, manifest_filename: str = "requirements.txt") -> List[Tuple[VulnerabilityInfo, EvidenceBundle]]:
        repo_dir = repo_path.resolve()
        manifest_file = repo_dir / manifest_filename

        # 1. Parse manifest packages
        packages: List[ManifestPackage] = []
        if manifest_file.exists():
            packages = parse_manifest_file(manifest_file)

        # 2. Query OSV for each package
        vuln_list: List[Tuple[ManifestPackage, VulnerabilityInfo]] = []
        for pkg in packages:
            vulns = await osv_client.query_package(pkg.name, pkg.version, ecosystem="PyPI")
            for v in vulns:
                vuln_list.append((pkg, v))

        # 3. Analyze Python code using Tree-sitter
        analysis: AnalysisResult = code_analyzer.analyze_repository(repo_dir)

        # 4. Populate Graph (FalkorDB / in-memory graph)
        self.graph.reset_graph()
        repo_id = f"repo:{repo_dir.name}"
        self.graph.add_node(repo_id, "Repository", {"name": repo_dir.name, "path": str(repo_dir)})

        # Add Packages
        for pkg in packages:
            pkg_id = f"pkg:{pkg.name}@{pkg.version}"
            self.graph.add_node(pkg_id, "Package", {"name": pkg.name, "version": pkg.version})
            self.graph.add_edge(repo_id, pkg_id, "DEPENDS_ON", {})

        # Add Files & Functions
        seen_files = set()
        for fn_id, fn in analysis.functions.items():
            file_id = f"file:{fn.file_path}"
            if file_id not in seen_files:
                self.graph.add_node(file_id, "File", {"path": fn.file_path})
                self.graph.add_edge(repo_id, file_id, "CONTAINS", {})
                seen_files.add(file_id)

            self.graph.add_node(fn.id, "Function", {
                "name": fn.name,
                "file_path": fn.file_path,
                "start_line": fn.start_line,
                "end_line": fn.end_line,
                "is_entry_point": fn.is_entry_point,
                "entry_point_type": fn.entry_point_type or "",
                "code_snippet": fn.code_snippet
            })
            self.graph.add_edge(file_id, fn.id, "CONTAINS", {})

        # Add Calls
        for call in analysis.calls:
            if call.resolved_target_id:
                # Target could be an external package symbol or local function
                if "::" in call.resolved_target_id:
                    # External package function
                    ext_node_id = f"ext:{call.resolved_target_id}"
                    self.graph.add_node(ext_node_id, "Function", {
                        "name": call.resolved_target_id.split("::")[-1],
                        "file_path": call.resolved_target_id.split("::")[0],
                        "is_entry_point": False,
                        "code_snippet": ""
                    })
                    self.graph.add_edge(call.caller_id, ext_node_id, "CALLS", {
                        "line_number": call.line_number,
                        "resolved": True,
                        "raw_expression": call.raw_expression
                    })
                elif call.resolved_target_id in analysis.functions:
                    self.graph.add_edge(call.caller_id, call.resolved_target_id, "CALLS", {
                        "line_number": call.line_number,
                        "resolved": True,
                        "raw_expression": call.raw_expression
                    })

        # Add unresolved dynamic calls as unresolved edges
        for call in analysis.unresolved_calls:
            unresolved_target_id = f"unresolved:{call.callee_name}:{call.line_number}"
            self.graph.add_node(unresolved_target_id, "Function", {
                "name": call.callee_name,
                "file_path": call.caller_id.split(":")[0],
                "is_entry_point": False,
                "is_dynamic": True
            })
            self.graph.add_edge(call.caller_id, unresolved_target_id, "CALLS", {
                "line_number": call.line_number,
                "resolved": False,
                "raw_expression": call.raw_expression
            })

        # 5. Extract Evidence Bundles for each vulnerability
        evidence_results: List[Tuple[VulnerabilityInfo, EvidenceBundle]] = []

        all_node_ids = list(self.graph.get_all_nodes().keys())

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
                candidate_paths = self.graph.query_candidate_paths(target_node_id, max_depth=10, limit=5)
                
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
                caveats=caveats,
                unresolved_calls_count=len(analysis.unresolved_calls),
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
