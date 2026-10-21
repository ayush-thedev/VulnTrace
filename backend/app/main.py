import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.api import health, scans, findings, repositories

# Ensure Git directories are included in PATH on Windows
for git_dir in [
    r"C:\Program Files\Git\cmd",
    r"C:\Program Files\Git\bin",
    r"C:\Program Files (x86)\Git\cmd",
    r"C:\Program Files (x86)\Git\bin",
]:
    if Path(git_dir).is_dir() and git_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = f"{git_dir};{os.environ.get('PATH', '')}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("vulntrace")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # If no scans in DB or memory, auto-seed demo-fixture scan
    if not scans.SCANS_STORE:
        try:
            demo_req = scans.ScanCreateRequest(repo_path="demo-fixture")
            from fastapi import BackgroundTasks
            await scans.create_scan(demo_req, BackgroundTasks(), sync=True)
            logger.info("Auto-seeded initial demo scan on startup.")
        except Exception as e:
            logger.warning(f"Could not auto-seed demo scan: {e}")
    yield

app = FastAPI(
    title="VulnTrace AI API",
    description="Evidence-Driven Vulnerability Reachability and Assisted Remediation",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API Routers
app.include_router(health.router, prefix="/api")
app.include_router(health.router, prefix="")
app.include_router(scans.router, prefix="/api")
app.include_router(scans.router, prefix="")
app.include_router(findings.router, prefix="/api")
app.include_router(findings.router, prefix="")
app.include_router(findings.fixes_router, prefix="/api")
app.include_router(findings.fixes_router, prefix="")
app.include_router(repositories.router, prefix="/api")
app.include_router(repositories.router, prefix="")

@app.get("/")
def root():
    return {
        "project": "VulnTrace AI",
        "description": "Evidence-Driven Vulnerability Reachability and Assisted Remediation",
        "team": "TECHNOVISIONERS",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
