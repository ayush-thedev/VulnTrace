from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import (
    Finding,
    GraphData,
    ReactFlowNode,
    ReactFlowEdge,
    HumanReviewRecord
)
from backend.app.api.scans import SCAN_FINDINGS_STORE, SCANS_STORE
from backend.app.services.sandbox import sandbox

router = APIRouter(prefix="/findings", tags=["Findings"])

def find_finding_by_id(finding_id: str) -> Optional[Finding]:
    for findings in SCAN_FINDINGS_STORE.values():
        for f in findings:
            if f.id == finding_id:
                return f
    return None

@router.get("/{finding_id}", response_model=Finding)
def get_finding(finding_id: str):
    f = find_finding_by_id(finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    return f

@router.get("/{finding_id}/graph", response_model=GraphData)
def get_finding_graph(finding_id: str):
    """
    Transforms candidate paths into React Flow layout nodes and edges (PRD §10, §14).
    Nodes display: entry point, intermediate function, vulnerable target, file:line indicators.
    """
    f = find_finding_by_id(finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")

    nodes: Dict[str, ReactFlowNode] = {}
    edges: list[ReactFlowEdge] = []

    # Map candidate paths to React Flow nodes and edges
    for path_idx, path in enumerate(f.evidence.candidate_paths):
        prev_node_id = None
        for hop_idx, hop in enumerate(path.hops):
            node_key = hop.node_id
            
            # Determine node styling type
            node_type = "entry" if hop.is_entry_point else ("target" if hop_idx == len(path.hops) - 1 else "intermediate")
            
            if node_key not in nodes:
                nodes[node_key] = ReactFlowNode(
                    id=node_key,
                    type=node_type,
                    position={"x": hop_idx * 280.0 + 50.0, "y": path_idx * 160.0 + 100.0},
                    data={
                        "label": hop.function_name,
                        "file_path": hop.file_path,
                        "line_number": hop.line_number,
                        "is_entry_point": hop.is_entry_point,
                        "is_vulnerable_target": hop_idx == len(path.hops) - 1,
                        "call_resolved": hop.call_resolved,
                        "code_snippet": hop.code_snippet
                    }
                )

            if prev_node_id:
                edge_id = f"e-{prev_node_id}->{node_key}"
                edges.append(ReactFlowEdge(
                    id=edge_id,
                    source=prev_node_id,
                    target=node_key,
                    label="CALLS",
                    animated=True if f.reachability.verdict == "reachable" else False,
                    style={"stroke": "#1E338C" if hop.call_resolved else "#B7791F", "strokeWidth": 2}
                ))
            prev_node_id = node_key

    # If no candidate paths, display package & file nodes
    if not nodes:
        pkg_id = f"pkg:{f.vulnerability.package_name}"
        nodes[pkg_id] = ReactFlowNode(
            id=pkg_id,
            type="package",
            position={"x": 100.0, "y": 100.0},
            data={"label": f.vulnerability.package_name, "version": f.remediation.original_version}
        )
        for imp_idx, imp in enumerate(f.evidence.import_sites):
            imp_id = f"file:{imp.file_path}:{imp.line_number}"
            nodes[imp_id] = ReactFlowNode(
                id=imp_id,
                type="importSite",
                position={"x": 400.0, "y": 80.0 + imp_idx * 100.0},
                data={"label": f"{imp.file_path}:{imp.line_number}", "imported": imp.imported_symbols}
            )
            edges.append(ReactFlowEdge(
                id=f"e-{imp_id}->{pkg_id}",
                source=imp_id,
                target=pkg_id,
                label="IMPORTS",
                style={"stroke": "#5A6070", "strokeDasharray": "5,5"}
            ))

    return GraphData(nodes=list(nodes.values()), edges=edges)

@router.post("/{finding_id}/remediation/validate", response_model=Finding)
async def validate_remediation(finding_id: str):
    f = find_finding_by_id(finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")

    scan = SCANS_STORE.get(f.scan_id)
    if not scan:
        raise HTTPException(status_code=400, detail="Associated scan not found")

    repo_dir = Path(scan.repo_path)
    # Run isolated sandbox validation
    report, updated_remediation = await sandbox.validate_remediation(
        repo_path=repo_dir,
        vuln=f.vulnerability,
        remediation=f.remediation
    )

    f.validation = report
    f.remediation = updated_remediation
    return f

@router.post("/{finding_id}/review", response_model=Finding)
def record_human_review(finding_id: str, review: HumanReviewRecord):
    f = find_finding_by_id(finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")

    f.human_review = review
    return f
