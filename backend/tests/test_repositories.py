import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services import db

client = TestClient(app)

def test_repositories_crud_and_validation():
    # 1. Invalid URL rejection
    invalid_resp = client.post("/api/repositories", json={"url": "not-a-repo-at-all!!!"})
    assert invalid_resp.status_code == 400

    # 2. Add valid repository (shorthand)
    resp = client.post("/api/repositories", json={"url": "pallets/jinja", "branch": "main"})
    assert resp.status_code == 201
    repo = resp.json()
    assert repo["owner"] == "pallets"
    assert repo["name"] == "jinja"
    assert repo["url"] == "https://github.com/pallets/jinja"
    repo_id = repo["id"]

    # 3. Duplicate repository returns existing row
    dup_resp = client.post("/api/repositories", json={"url": "https://github.com/pallets/jinja.git"})
    assert dup_resp.status_code == 201
    assert dup_resp.json()["id"] == repo_id

    # 4. List repositories
    list_resp = client.get("/api/repositories")
    assert list_resp.status_code == 200
    repos = list_resp.json()
    assert any(r["id"] == repo_id for r in repos)

    # 5. Get single repository
    get_resp = client.get(f"/api/repositories/{repo_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == repo_id

    # 6. Delete repository
    del_resp = client.delete(f"/api/repositories/{repo_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # 7. Confirm 404 after deletion
    after_del = client.get(f"/api/repositories/{repo_id}")
    assert after_del.status_code == 404
