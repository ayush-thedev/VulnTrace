from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from backend.app.services import db

router = APIRouter(prefix="/repositories", tags=["Repositories"])

class RepositoryCreateRequest(BaseModel):
    url: str
    branch: Optional[str] = None

class RepositoryResponse(BaseModel):
    id: str
    url: str
    owner: str
    name: str
    default_branch: str
    language: Optional[str] = "Python"
    created_at: str
    last_scan_id: Optional[str] = None
    last_scan_at: Optional[str] = None
    status: Optional[str] = "connected"

@router.post("", status_code=status.HTTP_201_CREATED, response_model=RepositoryResponse)
def connect_repository(payload: RepositoryCreateRequest):
    try:
        row = db.add_repository(payload.url, payload.branch)
        return RepositoryResponse(**row)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to register repository: {e}")

@router.get("", response_model=List[RepositoryResponse])
def get_repositories():
    rows = db.list_repositories()
    return [RepositoryResponse(**r) for r in rows]

@router.get("/{repo_id}", response_model=RepositoryResponse)
def get_repository_detail(repo_id: str):
    row = db.get_repository(repo_id)
    if not row:
        raise HTTPException(status_code=404, detail="Repository not found")
    return RepositoryResponse(**row)

@router.delete("/{repo_id}")
def remove_repository(repo_id: str):
    deleted = db.delete_repository(repo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Repository not found")
    return {"status": "deleted", "id": repo_id}
