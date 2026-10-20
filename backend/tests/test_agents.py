import pytest
from pathlib import Path
from backend.app.models.schemas import (
    VulnerabilityInfo,
    EvidenceBundle,
    CandidatePath,
    PathHop,
    ReachabilityAssessment,
    PriorityAssessment
)
from backend.app.agents.reachability import reachability_analyst
from backend.app.agents.prioritizer import risk_prioritizer
from backend.app.agents.remediator import remediation_agent
from backend.app.agents.validator import validate_evidence_refs, EvidenceRefValidationError
from backend.app.agents.coordinator import coordinator

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "sample_repo"

def test_evidence_ref_validator_safeguard():
    valid_graph_nodes = ["app.py:main", "helpers.py:format_attributes", "ext:jinja2::xmlattr"]
    
    # 1. Valid citation passes
    is_valid, unknown = validate_evidence_refs(["app.py:main", "ext:jinja2::xmlattr"], valid_graph_nodes)
    assert is_valid is True
    assert len(unknown) == 0

    # 2. PRD Acceptance Test 3: Hallucinated / unknown reference is rejected
    is_valid, unknown = validate_evidence_refs(["app.py:main", "invented_function()"], valid_graph_nodes)
    assert is_valid is False
    assert "invented_function()" in unknown

def test_reachability_analyst_deterministic_assessment():
    vuln = VulnerabilityInfo(
        id="GHSA-test-01",
        summary="Test vulnerability in helper",
        package_name="test-lib",
        affected_version_range="<2.0.0",
        fixed_versions=["2.0.0"]
    )
    evidence = EvidenceBundle(
        candidate_paths=[
            CandidatePath(
                path_id="p-1",
                entry_point_id="app.py:render",
                vulnerable_target_id="ext:test-lib::vuln_func",
                hops=[
                    PathHop(node_id="app.py:render", file_path="app.py", function_name="render", line_number=10, is_entry_point=True),
                    PathHop(node_id="ext:test-lib::vuln_func", file_path="test-lib", function_name="vuln_func", line_number=1)
                ],
                contains_unresolved_call=False
            )
        ],
        vulnerable_symbol_known=True,
        vulnerable_symbol_name="vuln_func",
        graph_node_ids=["app.py:render", "ext:test-lib::vuln_func"]
    )

    assessment = reachability_analyst.analyze(vuln, evidence)
    assert assessment.verdict == "reachable"
    assert len(assessment.evidence_refs) > 0
    # Every cited ref must be in valid graph_node_ids
    for ref in assessment.evidence_refs:
        assert ref in evidence.graph_node_ids

def test_reachability_analyst_unresolved_route_enforces_uncertain():
    # PRD Acceptance Test 2: finding with unresolved call must be uncertain, never not_reachable
    vuln = VulnerabilityInfo(
        id="GHSA-test-02",
        summary="Dynamic dispatch vulnerability",
        package_name="dynamic-lib",
        affected_version_range="<1.0.0"
    )
    evidence = EvidenceBundle(
        candidate_paths=[
            CandidatePath(
                path_id="p-2",
                entry_point_id="app.py:dispatch",
                vulnerable_target_id="ext:dynamic-lib::target",
                hops=[
                    PathHop(node_id="app.py:dispatch", file_path="app.py", function_name="dispatch", line_number=20, is_entry_point=True, call_resolved=False)
                ],
                contains_unresolved_call=True
            )
        ],
        vulnerable_symbol_known=True,
        vulnerable_symbol_name="target",
        caveats=["Contains unresolved dynamic call expression"],
        unresolved_calls_count=1,
        graph_node_ids=["app.py:dispatch", "ext:dynamic-lib::target"]
    )

    assessment = reachability_analyst.analyze(vuln, evidence)
    assert assessment.verdict == "uncertain"

def test_risk_prioritizer_categorical_bands():
    vuln = VulnerabilityInfo(
        id="GHSA-test-03",
        summary="Remote input flaw",
        package_name="jinja2",
        affected_version_range="<3.0.0"
    )
    reach_reachable = ReachabilityAssessment(
        verdict="reachable",
        confidence_note="Reachable from HTTP route",
        caveats=[],
        rationale="User route reaches vulnerable function.",
        is_ai_generated=True
    )
    evidence = EvidenceBundle(
        candidate_paths=[
            CandidatePath(
                path_id="p-1",
                entry_point_id="app.py:render",
                vulnerable_target_id="ext:jinja2::xmlattr",
                hops=[PathHop(node_id="app.py:render", file_path="app.py", function_name="render", line_number=1, is_entry_point=True)]
            )
        ],
        vulnerable_symbol_known=True
    )

    priority = risk_prioritizer.prioritize(vuln, reach_reachable, evidence)
    assert priority.band == "Fix now"
    # Ensure no invented numeric score
    assert "8.4" not in priority.rationale

def test_remediation_agent_unified_diff():
    vuln = VulnerabilityInfo(
        id="GHSA-test-04",
        summary="Jinja flaw",
        package_name="jinja2",
        affected_version_range="<3.1.4",
        fixed_versions=["3.1.4"]
    )
    prio = PriorityAssessment(band="Fix now", rationale="Urgent")
    evidence = EvidenceBundle(vulnerable_symbol_known=True)

    proposal = remediation_agent.propose(vuln, prio, evidence, current_version="2.11.3")
    assert proposal.status == "proposed"
    assert "--- a/requirements.txt" in proposal.diff
    assert "+++ b/requirements.txt" in proposal.diff
    assert "-jinja2==2.11.3" in proposal.diff
    assert "+jinja2==3.1.4" in proposal.diff

@pytest.mark.asyncio
async def test_langgraph_coordinator_e2e():
    findings = await coordinator.execute(FIXTURE_DIR, scan_id="SCAN-TEST")
    assert len(findings) > 0

    for f in findings:
        assert f.scan_id == "SCAN-TEST"
        assert f.reachability.verdict in ["reachable", "not_reachable", "uncertain"]
        assert f.priority.band in ["Fix now", "Schedule fix", "Monitor", "Human review"]
        assert f.remediation.status in ["proposed", "unverified"]
        assert f.validation.status == "not_run"
        # Provenance check
        assert len(f.provenance.deterministic_stages) > 0
        assert len(f.provenance.llm_stages) > 0
