from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "VulnTrace AI"
    assert "health_url" in data

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    
    assert "status" in data
    assert data["status"] in ["healthy", "degraded", "unhealthy"]
    assert "capabilities" in data
    assert isinstance(data["capabilities"], dict)
    
    # Verify required capability keys per PRD §13 & §17
    caps = data["capabilities"]
    assert "graph_database" in caps
    assert "code_intelligence" in caps
    assert "vulnerability_intelligence" in caps
    assert "llm_agents" in caps
    assert "patch_validation" in caps
    assert "pull_requests" in caps
    assert "Not claimed" in caps["pull_requests"]

def test_schema_integrity():
    from backend.app.models.schemas import Finding, VulnerabilityInfo, ReachabilityAssessment, PriorityAssessment, RemediationProposal, ValidationReport, EvidenceBundle, Provenance
    
    # Ensure Finding schema can be instantiated with strict typing
    finding = Finding(
        id="FINDING-TEST-001",
        scan_id="SCAN-001",
        vulnerability=VulnerabilityInfo(
            id="GHSA-test-1234",
            summary="Test Advisory",
            package_name="test-pkg",
            affected_version_range="<1.0.0",
            fixed_versions=["1.0.0"]
        ),
        evidence=EvidenceBundle(
            vulnerable_symbol_known=True,
            vulnerable_symbol_name="vulnerable_func"
        ),
        reachability=ReachabilityAssessment(
            verdict="reachable",
            confidence_note="Candidate route found from entry point",
            evidence_refs=["hop-1"],
            rationale="Path reaches vulnerable function."
        ),
        priority=PriorityAssessment(
            band="Fix now",
            rationale="User-controlled entry point reaches vulnerable target."
        ),
        remediation=RemediationProposal(
            diff="--- a/requirements.txt\n+++ b/requirements.txt\n@@ -1 +1 @@\n-test-pkg==0.9.0\n+test-pkg==1.0.0",
            target_file="requirements.txt",
            original_version="0.9.0",
            target_version="1.0.0",
            rationale="Upgrade to fixed version 1.0.0.",
            status="proposed"
        ),
        validation=ValidationReport(
            status="not_run"
        )
    )
    assert finding.id == "FINDING-TEST-001"
    assert finding.reachability.verdict == "reachable"
    assert finding.priority.band == "Fix now"
