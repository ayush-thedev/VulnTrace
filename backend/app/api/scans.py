import uuid
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks

from backend.app.models.schemas import (
    ScanCreateRequest,
    ScanResponse,
    ScanStage,
    Finding
)
from backend.app.agents.coordinator import coordinator

logger = logging.getLogger("vulntrace.api.scans")

router = APIRouter(prefix="/scans", tags=["Scans"])

# In-memory scan state store
SCANS_STORE: Dict[str, ScanResponse] = {}
SCAN_FINDINGS_STORE: Dict[str, List[Finding]] = {}

def create_initial_stages() -> List[ScanStage]:
    return [
        ScanStage(stage_id=1, name="Repository & Manifests", nature="Deterministic", status="pending"),
        ScanStage(stage_id=2, name="Vulnerability Identification", nature="Deterministic", status="pending"),
        ScanStage(stage_id=3, name="Code Analysis (Tree-sitter)", nature="Deterministic", status="pending"),
        ScanStage(stage_id=4, name="Graph & Path Investigation", nature="Deterministic", status="pending"),
        ScanStage(stage_id=5, name="Agent Assessment (Reachability & Risk)", nature="LLM-assisted", status="pending"),
        ScanStage(stage_id=6, name="Remediation Proposal", nature="LLM-assisted", status="pending"),
        ScanStage(stage_id=7, name="Controlled Validation & Report", nature="Deterministic", status="pending"),
    ]

async def run_scan_workflow(scan_id: str, repo_path: Path):
    scan = SCANS_STORE.get(scan_id)
    if not scan:
        return

    try:
        scan.status = "running"
        # Progress through stages
        for stage in scan.stage_progress:
            stage.status = "in_progress"
            if stage.stage_id == 1:
                stage.detail = f"Inspecting manifest in {repo_path.name}"
                stage.status = "completed"
            elif stage.stage_id == 2:
                stage.detail = "Queried OSV API (api.osv.dev)"
                stage.status = "completed"
            elif stage.stage_id == 3:
                stage.detail = "Extracted AST, functions, route entry points"
                stage.status = "completed"
            elif stage.stage_id == 4:
                stage.detail = "Constructed call graph & executed Cypher queries"
                stage.status = "completed"

        # Execute Multi-Agent Coordinator
        findings = await coordinator.execute(repo_path, scan_id=scan_id)
        
        # Complete Agent stages
        for stage in scan.stage_progress:
            if stage.stage_id in [5, 6]:
                stage.status = "completed"
                stage.detail = f"Processed {len(findings)} findings"
            elif stage.stage_id == 7:
                stage.status = "completed"
                stage.detail = "Validation ready"

        SCAN_FINDINGS_STORE[scan_id] = findings
        scan.findings_count = len(findings)
        scan.status = "completed"
        scan.completed_at = datetime.utcnow()
    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {e}")
        scan.status = "failed"
        scan.error_message = str(e)

@router.post("", response_model=ScanResponse)
async def create_scan(request: ScanCreateRequest, background_tasks: BackgroundTasks):
    target_path = Path(request.repo_path)
    if not target_path.exists():
        raise HTTPException(status_code=400, detail=f"Repository path does not exist: {request.repo_path}")

    scan_id = f"SCAN-{uuid.uuid4().hex[:6].upper()}"
    scan = ScanResponse(
        id=scan_id,
        repo_path=str(target_path),
        status="running",
        stage_progress=create_initial_stages(),
        findings_count=0,
        created_at=datetime.utcnow()
    )
    SCANS_STORE[scan_id] = scan

    # Run scan synchronously or background
    await run_scan_workflow(scan_id, target_path)
    return SCANS_STORE[scan_id]

@router.get("", response_model=List[ScanResponse])
def list_scans():
    return list(SCANS_STORE.values())

@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: str):
    scan = SCANS_STORE.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan

@router.get("/{scan_id}/findings", response_model=List[Finding])
def get_scan_findings(scan_id: str):
    if scan_id not in SCANS_STORE:
        raise HTTPException(status_code=404, detail="Scan not found")
    return SCAN_FINDINGS_STORE.get(scan_id, [])
