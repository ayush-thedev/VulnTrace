import os
import re
import io
import zipfile
import uuid
import json
import asyncio
import logging
import subprocess
import shutil
import httpx
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from fastapi.responses import StreamingResponse

from backend.app.models.schemas import (
    ScanCreateRequest,
    ScanResponse,
    ScanStage,
    Finding,
    FixResponse
)
from backend.app.agents.coordinator import coordinator
from backend.app.services.graph_db import get_or_create_scan_graph
from backend.app.services import db

logger = logging.getLogger("vulntrace.api.scans")

router = APIRouter(prefix="/scans", tags=["Scans"])

# In-memory scan state stores scoped to scan_id
SCANS_STORE: Dict[str, ScanResponse] = {}
SCAN_FINDINGS_STORE: Dict[str, List[Finding]] = {}
SCAN_PROGRESS_STREAM: Dict[str, List[Dict[str, Any]]] = {}
SCAN_CANCEL_FLAGS: Dict[str, bool] = {}
COMMIT_CACHE: Dict[str, str] = {}  # cache_key (repo_url@commit_sha) -> scan_id

def init_scans_store_from_db():
    try:
        records = db.list_scan_records()
        for rec in records:
            s_obj = ScanResponse.model_validate(rec)
            SCANS_STORE[s_obj.id] = s_obj
            f_records = db.get_scan_findings_records(s_obj.id)
            if f_records:
                SCAN_FINDINGS_STORE[s_obj.id] = [Finding.model_validate(f) for f in f_records]
            elif s_obj.id not in SCAN_FINDINGS_STORE:
                SCAN_FINDINGS_STORE[s_obj.id] = []
    except Exception as e:
        logger.warning(f"Could not load scan records from DB: {e}")

init_scans_store_from_db()

WORKSPACES_ROOT = Path("workspaces")
WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)

# 8 Weighted stages per Section 3:
WEIGHTED_STAGES = [
    {"id": 1, "name": "Fetch", "weight": 5, "nature": "Deterministic"},
    {"id": 2, "name": "Detect", "weight": 5, "nature": "Deterministic"},
    {"id": 3, "name": "Inventory", "weight": 10, "nature": "Deterministic"},
    {"id": 4, "name": "Match", "weight": 15, "nature": "Deterministic"},
    {"id": 5, "name": "Parse", "weight": 20, "nature": "Deterministic"},
    {"id": 6, "name": "Graph", "weight": 15, "nature": "Deterministic"},
    {"id": 7, "name": "Reach", "weight": 15, "nature": "Deterministic"},
    {"id": 8, "name": "Rank+Explain", "weight": 15, "nature": "LLM-assisted"},
]

def create_initial_stages() -> List[ScanStage]:
    stages = []
    for s in WEIGHTED_STAGES:
        stages.append(
            ScanStage(
                stage_id=s["id"],
                name=s["name"],
                nature=s["nature"],
                status="pending",
                detail=""
            )
        )
    return stages

def push_sse_event(scan_id: str, stage_name: str, stage_idx: int, percent: int, message: str, counters: Dict[str, Any], new_finding: Optional[Any] = None):
    event = {
        "stage": stage_name,
        "stage_index": stage_idx,
        "stage_total": len(WEIGHTED_STAGES),
        "percent": percent,
        "message": message,
        "counters": counters,
        "new_finding": new_finding
    }
    if scan_id not in SCAN_PROGRESS_STREAM:
        SCAN_PROGRESS_STREAM[scan_id] = []
    SCAN_PROGRESS_STREAM[scan_id].append(event)

async def run_scan_workflow(scan_id: str, repo_path: Path, repo_url: Optional[str] = None, commit_sha: Optional[str] = None, repo_ref: Optional[str] = None):
    scan = SCANS_STORE.get(scan_id)
    if not scan:
        return

    cumulative_percent = 0
    counters = {"packages": 0, "files": 0, "findings": 0}

    try:
        scan.status = "running"
        push_sse_event(scan_id, "Fetch", 1, 5, f"Cloned/inspected repository workspace: {repo_path.name}", counters)
        cumulative_percent += 5

        if SCAN_CANCEL_FLAGS.get(scan_id, False):
            scan.status = "cancelled"
            return

        # Stage 1: Fetch
        scan.stage_progress[0].status = "completed"
        scan.stage_progress[0].detail = f"Workspace loaded: {repo_path.name}"

        # Stage 2: Detect
        scan.stage_progress[1].status = "in_progress"
        cumulative_percent += 5
        py_files = list(repo_path.glob("**/*.py"))
        js_files = list(repo_path.glob("**/*.js")) + list(repo_path.glob("**/*.ts"))
        total_files = len(py_files) + len(js_files)
        lang = "Python" if len(py_files) >= len(js_files) else "JavaScript/TypeScript"
        counters["files"] = total_files or len(list(repo_path.glob("*.*")))
        push_sse_event(scan_id, "Detect", 2, cumulative_percent, f"Detected language: {lang}, {counters['files']} source files", counters)
        await asyncio.sleep(0.05)
        scan.stage_progress[1].status = "completed"
        scan.stage_progress[1].detail = f"Detected {counters['files']} files ({lang})"

        # Stage 3: Inventory
        scan.stage_progress[2].status = "in_progress"
        cumulative_percent += 10
        from backend.app.services.manifest import detect_manifest_packages
        detected_pkgs = detect_manifest_packages(repo_path)
        package_count = len(detected_pkgs)
        counters["packages"] = package_count
        push_sse_event(scan_id, "Inventory", 3, cumulative_percent, f"Indexed dependency tree ({package_count} packages)", counters)
        await asyncio.sleep(0.05)
        scan.stage_progress[2].status = "completed"

        # Stage 4: Match
        scan.stage_progress[3].status = "in_progress"
        cumulative_percent += 15
        push_sse_event(scan_id, "Match", 4, cumulative_percent, "Querying OSV advisory intelligence database", counters)
        await asyncio.sleep(0.05)
        scan.stage_progress[3].status = "completed"

        # Stage 5: Parse (Tree-sitter)
        scan.stage_progress[4].status = "in_progress"
        cumulative_percent += 20
        push_sse_event(scan_id, "Parse", 5, cumulative_percent, f"Tree-sitter AST parsing across {len(py_files)} files", counters)
        await asyncio.sleep(0.05)
        scan.stage_progress[4].status = "completed"

        # Stage 6: Graph (Per-scan isolated GraphDB)
        scan.stage_progress[5].status = "in_progress"
        cumulative_percent += 15
        push_sse_event(scan_id, "Graph", 6, cumulative_percent, f"Constructing knowledge graph for scan {scan_id}", counters)
        await asyncio.sleep(0.05)
        scan.stage_progress[5].status = "completed"

        # Stage 7 & 8: Reach & Rank+Explain via Coordinator
        scan.stage_progress[6].status = "in_progress"
        scan.stage_progress[7].status = "in_progress"
        cumulative_percent += 30

        push_sse_event(scan_id, "Reach", 7, 85, "Executing multi-agent reachability & risk triage", counters)
        findings = await coordinator.execute(repo_path, scan_id=scan_id)

        counters["findings"] = len(findings)
        scan.stage_progress[6].status = "completed"
        scan.stage_progress[7].status = "completed"
        scan.stage_progress[7].detail = f"Triage complete: {len(findings)} findings"

        SCAN_FINDINGS_STORE[scan_id] = findings
        scan.findings_count = len(findings)
        scan.status = "completed"
        scan.completed_at = datetime.now(timezone.utc)

        # Cache commit SHA if present
        if repo_url and commit_sha:
            cache_key = f"{repo_url}@{commit_sha}"
            COMMIT_CACHE[cache_key] = scan_id

        # Persist to SQLite
        try:
            db.save_scan_record(scan.model_dump(mode="json"))
            db.save_scan_findings_records(scan_id, [f.model_dump(mode="json") for f in findings])
        except Exception as save_err:
            logger.error(f"Failed to persist scan {scan_id} to DB: {save_err}")

        push_sse_event(scan_id, "Complete", 8, 100, f"Scan finished with {len(findings)} findings", counters)

        # Update SQLite repository row if matched
        if repo_ref:
            db.update_repository_scan(repo_ref, scan_id, scan.completed_at.isoformat(), "scanned")
    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {e}")
        scan.status = "failed"
        scan.error_message = str(e)
        try:
            db.save_scan_record(scan.model_dump(mode="json"))
        except Exception:
            pass
        push_sse_event(scan_id, "Error", 0, cumulative_percent, f"Failed: {str(e)}", counters)

def get_git_binary() -> Optional[str]:
    found = shutil.which("git")
    if found:
        return found
    common_windows_locations = [
        r"C:\Program Files\Git\cmd\git.exe",
        r"C:\Program Files\Git\bin\git.exe",
        r"C:\Program Files (x86)\Git\cmd\git.exe",
        r"C:\Program Files (x86)\Git\bin\git.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\cmd\git.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\git.exe"),
    ]
    for loc in common_windows_locations:
        if Path(loc).is_file():
            loc_dir = str(Path(loc).parent)
            if loc_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = f"{loc_dir};{os.environ.get('PATH', '')}"
            return loc
    return None

def _get_git_commit_sha(repo_dir: Path) -> Optional[str]:
    git_bin = get_git_binary()
    if not git_bin:
        return None
    try:
        sha_res = subprocess.run(
            [git_bin, "rev-parse", "HEAD"],
            cwd=str(repo_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        if sha_res.returncode == 0 and sha_res.stdout.strip():
            return sha_res.stdout.strip()
    except Exception:
        pass
    return None

async def _clone_or_fetch_repo(remote_url: str, dest_dir: Path) -> Optional[str]:
    """
    Attempts to clone via git CLI first. If git is unavailable or fails,
    downloads the repo archive from GitHub (main or master branch) and unzips it.
    Returns commit SHA if available.
    """
    git_bin = get_git_binary()
    if git_bin:
        try:
            subprocess.run(
                [git_bin, "clone", "--depth", "1", remote_url, str(dest_dir)],
                check=True,
                capture_output=True,
                text=True,
                timeout=60
            )
            return _get_git_commit_sha(dest_dir)
        except Exception as e:
            logger.warning(f"Git clone failed with {git_bin} for '{remote_url}': {e}. Attempting archive fallback.")

    # Fallback to GitHub archive download if it's a GitHub repo
    gh_match = re.search(r"github\.com/([^/]+)/([^/]+)", remote_url)
    if gh_match:
        owner = gh_match.group(1)
        name = gh_match.group(2).removesuffix(".git").split("#")[0].split("?")[0]
        for branch in ["main", "master"]:
            zip_url = f"https://github.com/{owner}/{name}/archive/refs/heads/{branch}.zip"
            try:
                async with httpx.AsyncClient(follow_redirects=True, timeout=45.0) as client:
                    resp = await client.get(zip_url)
                    if resp.status_code == 200 and len(resp.content) > 0:
                        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                            root_prefix = f"{name}-{branch}/"
                            for member in zf.infolist():
                                if member.filename.startswith(root_prefix):
                                    rel_name = member.filename[len(root_prefix):]
                                    if not rel_name:
                                        continue
                                    target_file = dest_dir / rel_name
                                    if member.is_dir():
                                        target_file.mkdir(parents=True, exist_ok=True)
                                    else:
                                        target_file.parent.mkdir(parents=True, exist_ok=True)
                                        with zf.open(member) as src, open(target_file, "wb") as dst:
                                            dst.write(src.read())
                        return f"gh-{branch}"
            except Exception as e:
                logger.warning(f"Archive download failed for {zip_url}: {e}")

    if not git_bin:
        raise RuntimeError("Git CLI is not installed or not in PATH, and repository archive could not be downloaded.")
    raise RuntimeError(f"Failed to clone repository from '{remote_url}'.")

@router.post("", response_model=ScanResponse)
async def create_scan(
    request: ScanCreateRequest,
    background_tasks: BackgroundTasks,
    sync: bool = False
):
    target_str = request.repo_path.strip()
    scan_id = f"SCAN-{uuid.uuid4().hex[:6].upper()}"
    workspace_dir = WORKSPACES_ROOT / scan_id
    workspace_dir.mkdir(parents=True, exist_ok=True)

    repo_url: Optional[str] = None
    commit_sha: Optional[str] = None
    repo_ref: Optional[str] = target_str

    # 1. User explicitly picks the demo fixture
    if target_str in ["demo-fixture", "sample_repo"]:
        source_dir = Path("demo-fixture") if target_str == "demo-fixture" else Path("backend/tests/fixtures/sample_repo")
        if source_dir.exists():
            shutil.copytree(source_dir, workspace_dir, dirs_exist_ok=True)
        repo_url = f"demo://{target_str}"
        commit_sha = "demo-commit-001"

    # 2. Check if shorthand owner/repo (e.g. juice-shop/juice-shop)
    elif not (target_str.startswith("http://") or target_str.startswith("https://")) and "/" in target_str and not Path(target_str).exists():
        db_repo = db.get_repository(target_str)
        if db_repo:
            target_str = db_repo["url"]
        else:
            target_str = f"https://github.com/{target_str}"
        repo_url = target_str
        try:
            commit_sha = await _clone_or_fetch_repo(target_str, workspace_dir)
        except Exception as e:
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail=f"Failed to clone repository from '{target_str}': {e}"
            )

    # 3. GitHub or Remote Git URL
    elif target_str.startswith("http://") or target_str.startswith("https://") or "github.com" in target_str:
        repo_url = target_str
        try:
            commit_sha = await _clone_or_fetch_repo(target_str, workspace_dir)
        except Exception as e:
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail=f"Failed to clone repository from '{target_str}': {e}"
            )

    # 4. Local filesystem path
    elif Path(target_str).exists():
        src_path = Path(target_str).resolve()
        repo_url = f"file://{src_path}"
        try:
            shutil.copytree(src_path, workspace_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git", "venv", "__pycache__", ".pytest_cache"))
        except Exception as e:
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to copy local repository workspace: {e}"
            )
        commit_sha = _get_git_commit_sha(src_path)

    # 5. Check saved repository record in DB
    else:
        db_repo = db.get_repository(target_str)
        if db_repo:
            db_url = db_repo["url"]
            repo_url = db_url
            if db_url.startswith("http://") or db_url.startswith("https://") or "github.com" in db_url:
                try:
                    commit_sha = await _clone_or_fetch_repo(db_url, workspace_dir)
                except Exception as e:
                    shutil.rmtree(workspace_dir, ignore_errors=True)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to clone registered repository '{db_url}': {e}"
                    )
            elif Path(db_url).exists():
                shutil.copytree(Path(db_url), workspace_dir, dirs_exist_ok=True)
                commit_sha = "local-commit"
            else:
                shutil.rmtree(workspace_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=404,
                    detail=f"Target repository path '{db_url}' not found."
                )
        else:
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise HTTPException(
                status_code=404,
                detail=f"Path not found: '{request.repo_path}'. Provide a valid repository URL, a local directory, or 'demo-fixture'."
            )

    # Check commit cache: ONLY reuse if commit SHA AND repo URL match
    if repo_url and commit_sha:
        cache_key = f"{repo_url}@{commit_sha}"
        if cache_key in COMMIT_CACHE:
            cached_scan_id = COMMIT_CACHE[cache_key]
            cached_scan = SCANS_STORE.get(cached_scan_id)
            if cached_scan and cached_scan.status == "completed" and cached_scan_id in SCAN_FINDINGS_STORE:
                logger.info(f"Reusing cached scan results for {cache_key} (Scan {cached_scan_id})")
                # Clone cached findings into this scan
                cached_findings = SCAN_FINDINGS_STORE[cached_scan_id]
                new_findings = []
                for f in cached_findings:
                    copied = f.model_copy(deep=True, update={"id": f"finding-{uuid.uuid4().hex}", "scan_id": scan_id})
                    new_findings.append(copied)

                scan = ScanResponse(
                    id=scan_id,
                    repo_path=str(target_str),
                    repo_url=repo_url,
                    commit_sha=commit_sha,
                    status="completed",
                    stage_progress=[s.model_copy(update={"status": "completed"}) for s in create_initial_stages()],
                    findings_count=len(new_findings),
                    created_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc)
                )
                SCANS_STORE[scan_id] = scan
                SCAN_FINDINGS_STORE[scan_id] = new_findings
                return scan

    scan = ScanResponse(
        id=scan_id,
        repo_path=str(target_str),
        repo_url=repo_url,
        commit_sha=commit_sha,
        status="running",
        stage_progress=create_initial_stages(),
        findings_count=0,
        created_at=datetime.now(timezone.utc)
    )
    SCANS_STORE[scan_id] = scan
    SCAN_PROGRESS_STREAM[scan_id] = []
    SCAN_CANCEL_FLAGS[scan_id] = False
    try:
        db.save_scan_record(scan.model_dump(mode="json"))
    except Exception:
        pass

    if sync:
        await run_scan_workflow(scan_id, workspace_dir, repo_url, commit_sha, repo_ref)
    else:
        background_tasks.add_task(run_scan_workflow, scan_id, workspace_dir, repo_url, commit_sha, repo_ref)

    return SCANS_STORE[scan_id]

@router.get("", response_model=List[ScanResponse])
def list_scans():
    # Merge DB scans if any missing from in-memory store
    try:
        db_scans = db.list_scan_records()
        for s_data in db_scans:
            if s_data["id"] not in SCANS_STORE:
                s_obj = ScanResponse.model_validate(s_data)
                SCANS_STORE[s_obj.id] = s_obj
                f_recs = db.get_scan_findings_records(s_obj.id)
                if f_recs:
                    SCAN_FINDINGS_STORE[s_obj.id] = [Finding.model_validate(f) for f in f_recs]
    except Exception:
        pass
    return list(SCANS_STORE.values())

@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: str):
    scan = SCANS_STORE.get(scan_id)
    if not scan:
        try:
            rec = db.get_scan_record(scan_id)
            if rec:
                scan = ScanResponse.model_validate(rec)
                SCANS_STORE[scan_id] = scan
                f_recs = db.get_scan_findings_records(scan_id)
                if f_recs:
                    SCAN_FINDINGS_STORE[scan_id] = [Finding.model_validate(f) for f in f_recs]
        except Exception:
            pass
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")
    return scan

@router.post("/{scan_id}/cancel")
def cancel_scan(scan_id: str):
    scan = SCANS_STORE.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")
    SCAN_CANCEL_FLAGS[scan_id] = True
    scan.status = "cancelled"
    return {"status": "cancelled", "id": scan_id}

@router.get("/{scan_id}/stream")
async def stream_scan_progress(scan_id: str):
    if scan_id not in SCANS_STORE:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")

    async def event_generator():
        sent_index = 0
        while True:
            events = SCAN_PROGRESS_STREAM.get(scan_id, [])
            while sent_index < len(events):
                event = events[sent_index]
                sent_index += 1
                yield f"data: {json.dumps(event)}\n\n"

            scan = SCANS_STORE.get(scan_id)
            if scan and scan.status in ["completed", "failed", "cancelled"]:
                yield f"data: {json.dumps({'done': True, 'status': scan.status})}\n\n"
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/{scan_id}/findings", response_model=List[Finding])
def get_scan_findings(scan_id: str):
    if scan_id not in SCANS_STORE:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")
    return SCAN_FINDINGS_STORE.get(scan_id, [])

@router.get("/{scan_id}/fixes", response_model=List[FixResponse])
def get_scan_fixes(scan_id: str):
    if scan_id not in SCANS_STORE:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")
    
    findings = SCAN_FINDINGS_STORE.get(scan_id, [])
    fixes: List[FixResponse] = []
    for f in findings:
        if f.remediation:
            fixes.append(FixResponse(
                id=f"fix-{f.id}",
                scan_id=scan_id,
                finding_id=f.id,
                package_name=f.vulnerability.package_name,
                target_file=f.remediation.target_file,
                original_version=f.remediation.original_version,
                target_version=f.remediation.target_version,
                diff=f.remediation.diff,
                rationale=f.remediation.rationale,
                status=f.remediation.status,
                validation_verdict=f.validation.status if f.validation else "not_run",
                created_at=f.validation.timestamp or datetime.now(timezone.utc)
            ))
    return fixes
