import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

FIXTURE_JINJA = Path(__file__).parent / "fixtures" / "fixture_jinja"
FIXTURE_REQUESTS = Path(__file__).parent / "fixtures" / "fixture_requests"

def test_two_scans_isolation_and_scoping():
    # 1. Create Scan A with Jinja2 fixture
    resp_a = client.post("/api/scans", json={"repo_path": str(FIXTURE_JINJA.resolve())})
    assert resp_a.status_code == 200, resp_a.text
    scan_a = resp_a.json()
    scan_a_id = scan_a["id"]
    assert "repo_url" in scan_a
    assert "commit_sha" in scan_a

    # 2. Create Scan B with Requests fixture
    resp_b = client.post("/api/scans", json={"repo_path": str(FIXTURE_REQUESTS.resolve())})
    assert resp_b.status_code == 200, resp_b.text
    scan_b = resp_b.json()
    scan_b_id = scan_b["id"]
    assert scan_a_id != scan_b_id

    # 3. Assert GET /scans/{scan_id} returns the scan
    get_a = client.get(f"/api/scans/{scan_a_id}")
    assert get_a.status_code == 200
    assert get_a.json()["id"] == scan_a_id

    get_b = client.get(f"/api/scans/{scan_b_id}")
    assert get_b.status_code == 200
    assert get_b.json()["id"] == scan_b_id

    # 4. Assert GET /scans/{A}/findings and GET /scans/{B}/findings return different sets
    resp_findings_a = client.get(f"/api/scans/{scan_a_id}/findings")
    assert resp_findings_a.status_code == 200
    findings_a = resp_findings_a.json()

    resp_findings_b = client.get(f"/api/scans/{scan_b_id}/findings")
    assert resp_findings_b.status_code == 200
    findings_b = resp_findings_b.json()

    assert len(findings_a) > 0, "Scan A should find jinja vulnerability"
    assert len(findings_b) > 0, "Scan B should find requests vulnerability"

    # Package names and CVE IDs must differ
    pkgs_a = {f["vulnerability"]["package_name"] for f in findings_a}
    pkgs_b = {f["vulnerability"]["package_name"] for f in findings_b}
    assert "jinja2" in pkgs_a
    assert "requests" in pkgs_b
    assert pkgs_a.isdisjoint(pkgs_b)

    # All finding IDs must be globally unique UUIDs
    ids_a = {f["id"] for f in findings_a}
    ids_b = {f["id"] for f in findings_b}
    assert ids_a.isdisjoint(ids_b)
    for fid in ids_a | ids_b:
        assert fid.startswith("finding-")
        assert len(fid) > 16

    finding_a_id = findings_a[0]["id"]
    finding_b_id = findings_b[0]["id"]

    # 5. Assert GET /findings/{id of A}/graph never returns B's nodes
    graph_a_resp = client.get(f"/api/findings/{finding_a_id}/graph")
    assert graph_a_resp.status_code == 200
    graph_a = graph_a_resp.json()
    graph_a_labels = [n["data"]["label"].lower() for n in graph_a.get("nodes", [])]

    graph_b_resp = client.get(f"/api/findings/{finding_b_id}/graph")
    assert graph_b_resp.status_code == 200
    graph_b = graph_b_resp.json()
    graph_b_labels = [n["data"]["label"].lower() for n in graph_b.get("nodes", [])]

    # Graph A should not contain requests nodes, Graph B should not contain jinja nodes
    assert not any("requests" in l for l in graph_a_labels)
    assert not any("jinja" in l for l in graph_b_labels)
    assert graph_a != graph_b

    # 6. Assert fixes are filtered by scan
    fixes_a_resp = client.get(f"/api/scans/{scan_a_id}/fixes")
    assert fixes_a_resp.status_code == 200
    fixes_a = fixes_a_resp.json()

    fixes_b_resp = client.get(f"/api/scans/{scan_b_id}/fixes")
    assert fixes_b_resp.status_code == 200
    fixes_b = fixes_b_resp.json()

    fix_pkgs_a = {fx["package_name"] for fx in fixes_a}
    fix_pkgs_b = {fx["package_name"] for fx in fixes_b}
    assert "jinja2" in fix_pkgs_a
    assert "requests" in fix_pkgs_b
    assert fix_pkgs_a.isdisjoint(fix_pkgs_b)

    # 7. Assert GET /fixes/{fix_id}
    if fixes_a:
        single_fix_resp = client.get(f"/api/fixes/{fixes_a[0]['id']}")
        assert single_fix_resp.status_code == 200
        assert single_fix_resp.json()["id"] == fixes_a[0]["id"]

    # 8. Assert 404 for unknown IDs
    assert client.get("/api/scans/nonexistent-scan-id").status_code == 404
    assert client.get("/api/scans/nonexistent-scan-id/findings").status_code == 404
    assert client.get("/api/scans/nonexistent-scan-id/fixes").status_code == 404
    assert client.get("/api/findings/nonexistent-finding-id").status_code == 404
    assert client.get("/api/findings/nonexistent-finding-id/graph").status_code == 404
    assert client.get("/api/fixes/nonexistent-fix-id").status_code == 404
