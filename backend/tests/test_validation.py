import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.schemas import (
    VulnerabilityInfo,
    RemediationProposal,
    HumanReviewRecord
)
from backend.app.services.sandbox import sandbox

client = TestClient(app)
FIXTURE_DIR = Path(__file__).parent / "fixtures" / "sample_repo"

@pytest.mark.asyncio
async def test_sandbox_validation_success():
    vuln = VulnerabilityInfo(
        id="GHSA-h5c8-rqwp-cp95",
        aliases=["CVE-2024-34064"],
        summary="Jinja vulnerability",
        package_name="jinja2",
        affected_version_range="<3.1.4",
        fixed_versions=["3.1.4"]
    )
    remediation = RemediationProposal(
        diff="--- a/requirements.txt\n+++ b/requirements.txt\n@@ -1 +1 @@\n-jinja2==2.11.3\n+jinja2==3.1.4",
        target_file="requirements.txt",
        original_version="2.11.3",
        target_version="3.1.4",
        rationale="Upgrade to fixed version 3.1.4",
        status="proposed"
    )

    report, updated_rem = await sandbox.validate_remediation(FIXTURE_DIR, vuln, remediation)
    
    # Manifest patch applied successfully
    assert any(c.check_name == "Apply Proposed Remediation Diff" and c.passed for c in report.checks_run)
    # OSV re-scan check ran
    assert any(c.check_name == "OSV Vulnerability Re-scan" and c.passed for c in report.checks_run)
    # Status cannot be 'not_run' after execution
    assert report.status in ["validated", "unverified"]
    assert report.executed_in_sandbox is True

@pytest.mark.asyncio
async def test_sandbox_validation_invalid_patch_fails():
    # Acceptance Test 5: failed patch yields 'failed', never 'validated'
    vuln = VulnerabilityInfo(
        id="GHSA-test-broken",
        summary="Test Broken",
        package_name="jinja2",
        affected_version_range="<3.0.0"
    )
    broken_remediation = RemediationProposal(
        diff="invalid patch content",
        target_file="nonexistent_file.txt",
        original_version="0.0.0",
        target_version="1.0.0",
        rationale="Broken patch",
        status="proposed"
    )

    report, updated_rem = await sandbox.validate_remediation(FIXTURE_DIR, vuln, broken_remediation)
    assert report.status == "failed"
    assert updated_rem.status == "failed"
    assert "never" not in report.status

def test_api_scans_and_findings_flow():
    # 1. Trigger Scan
    response = client.post("/api/scans?sync=true", json={"repo_path": str(FIXTURE_DIR.resolve())})
    assert response.status_code == 200
    scan_data = response.json()
    scan_id = scan_data["id"]
    assert scan_data["status"] == "completed"
    assert len(scan_data["stage_progress"]) == 8

    # 2. List Findings
    findings_resp = client.get(f"/api/scans/{scan_id}/findings")
    assert findings_resp.status_code == 200
    findings = findings_resp.json()
    assert len(findings) > 0

    finding_id = findings[0]["id"]

    # 3. Get Single Finding
    f_resp = client.get(f"/api/findings/{finding_id}")
    assert f_resp.status_code == 200
    f_obj = f_resp.json()
    assert f_obj["id"] == finding_id
    assert f_obj["remediation"]["status"] in ["proposed", "unverified"]

    # 4. Get Graph for React Flow
    graph_resp = client.get(f"/api/findings/{finding_id}/graph")
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    assert "nodes" in graph_data
    assert "edges" in graph_data
    assert len(graph_data["nodes"]) > 0

    # 5. Validate Remediation Endpoint
    val_resp = client.post(f"/api/findings/{finding_id}/remediation/validate")
    assert val_resp.status_code == 200
    val_finding = val_resp.json()
    assert val_finding["validation"]["status"] in ["validated", "unverified", "failed"]

    # 6. Record Human Review
    review_resp = client.post(
        f"/api/findings/{finding_id}/review",
        json={"decision": "accept", "reviewer_notes": "Reviewed and approved by AppSec lead"}
    )
    assert review_resp.status_code == 200
    reviewed_finding = review_resp.json()
    assert reviewed_finding["human_review"] is not None
    assert reviewed_finding["human_review"]["decision"] == "accept"
