import socket
import shutil
import subprocess
from fastapi import APIRouter
from backend.app.config import settings
from backend.app.models.schemas import HealthStatus

router = APIRouter(tags=["Health & Capabilities"])

def check_falkordb() -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        result = sock.connect_ex((settings.FALKORDB_HOST, settings.FALKORDB_PORT))
        sock.close()
        return result == 0
    except Exception:
        return False

def check_docker() -> bool:
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return False
    try:
        res = subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        return res.returncode == 0
    except Exception:
        return False

def check_tree_sitter() -> bool:
    try:
        import tree_sitter
        import tree_sitter_python
        return True
    except Exception:
        return False

@router.get("/health", response_model=HealthStatus)
def get_health() -> HealthStatus:
    falkor_ok = check_falkordb()
    docker_ok = check_docker()
    groq_ok = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())
    ts_ok = check_tree_sitter()

    status = "healthy"
    if not groq_ok or not falkor_ok or not docker_ok:
        status = "degraded"

    capabilities = {
        "graph_database": "FalkorDB (Connected)" if falkor_ok else "In-Memory NetworkX/openCypher Fallback",
        "code_intelligence": "Tree-sitter Python AST & Call Graph (Ready)" if ts_ok else "Unavailable",
        "vulnerability_intelligence": "OSV REST API (api.osv.dev)",
        "llm_agents": f"Groq API ({settings.GROQ_MODEL})" if groq_ok else "Offline Fixture / Mock Replay Mode (API key unconfigured)",
        "patch_validation": "Isolated Docker Sandbox" if docker_ok else "Controlled Subprocess Runner (Host-isolated fallback)",
        "pull_requests": "Not claimed / Out of scope (PRD §3, §17)"
    }

    return HealthStatus(
        status=status,
        version="1.0.0",
        falkordb_reachable=falkor_ok,
        groq_configured=groq_ok,
        docker_available=docker_ok,
        tree_sitter_ready=ts_ok,
        capabilities=capabilities
    )
