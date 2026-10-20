import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.api import health, scans, findings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("vulntrace")

app = FastAPI(
    title="VulnTrace AI API",
    description="Evidence-Driven Vulnerability Reachability and Assisted Remediation",
    version="1.0.0"
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
app.include_router(scans.router, prefix="/api")
app.include_router(findings.router, prefix="/api")

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
