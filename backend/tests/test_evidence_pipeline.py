import pytest
from pathlib import Path
from backend.app.services.manifest import parse_manifest_file
from backend.app.services.osv import osv_client
from backend.app.services.code_analyzer import code_analyzer
from backend.app.services.evidence import evidence_pipeline

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "sample_repo"

@pytest.mark.asyncio
async def test_manifest_parser():
    manifest_file = FIXTURE_DIR / "requirements.txt"
    packages = parse_manifest_file(manifest_file)
    names = {p.name: p.version for p in packages}
    assert "jinja2" in names
    assert names["jinja2"] == "2.11.3"
    assert "aiohttp" in names
    assert names["aiohttp"] == "3.7.4"

@pytest.mark.asyncio
async def test_osv_vulnerability_lookup():
    vulns = await osv_client.query_package("jinja2", "2.11.3", ecosystem="PyPI")
    assert len(vulns) > 0
    vuln_ids = [v.id for v in vulns] + [a for v in vulns for a in v.aliases]
    # Check for verified Jinja2 advisory
    assert any("34064" in vid or "h5c8" in vid for vid in vuln_ids)

@pytest.mark.asyncio
async def test_tree_sitter_code_analysis():
    analysis = code_analyzer.analyze_repository(FIXTURE_DIR)
    
    # 1. Verify Entry Points detected by decorator / signature
    entry_ids = analysis.entry_points
    assert any("render_profile" in ep for ep in entry_ids)
    assert any("health_check" in ep for ep in entry_ids)
    assert any("dispatch_handler" in ep for ep in entry_ids)

    # 2. Verify Dynamic Dispatch is flagged as unresolved
    unresolved_calls = [c.raw_expression for c in analysis.unresolved_calls]
    assert any("getattr" in expr for expr in unresolved_calls)

@pytest.mark.asyncio
async def test_evidence_pipeline_candidate_paths():
    results = await evidence_pipeline.run(FIXTURE_DIR)
    assert len(results) > 0

    # Find the Jinja2 finding for xmlattr
    xmlattr_findings = [
        (v, e) for v, e in results 
        if v.package_name == "jinja2" and e.vulnerable_symbol_name == "xmlattr"
    ]
    assert len(xmlattr_findings) > 0, "Expected to find xmlattr advisory for jinja2"

    vuln, evidence = xmlattr_findings[0]
    assert evidence.vulnerable_symbol_known is True
    assert evidence.vulnerable_symbol_name == "xmlattr"
    assert len(evidence.candidate_paths) > 0

    # Verify the candidate route: render_profile -> format_attributes -> ext:jinja2::xmlattr
    primary_path = evidence.candidate_paths[0]
    hop_funcs = [h.function_name for h in primary_path.hops]
    assert "render_profile" in hop_funcs
    assert "format_attributes" in hop_funcs
    assert "xmlattr" in hop_funcs

    # Verify PRD §20 Acceptance Test 1: all hops exist in graph_node_ids
    for hop in primary_path.hops:
        assert hop.node_id in evidence.graph_node_ids

    # Verify that health_check does NOT appear on candidate path to xmlattr
    assert not any("health_check" in h.function_name for h in primary_path.hops)

@pytest.mark.asyncio
async def test_unknown_symbol_degradation():
    results = await evidence_pipeline.run(FIXTURE_DIR)
    
    # Find advisories without known symbols (e.g. sandbox breakout advisories without named symbol)
    unknown_findings = [(v, e) for v, e in results if not e.vulnerable_symbol_known]
    assert len(unknown_findings) > 0
    
    _, evidence = unknown_findings[0]
    assert evidence.vulnerable_symbol_known is False
    assert any("not specified in advisory" in c for c in evidence.caveats)
    assert len(evidence.import_sites) > 0  # Package-level evidence retained

@pytest.mark.asyncio
async def test_unresolved_call_caveats():
    results = await evidence_pipeline.run(FIXTURE_DIR)
    for vuln, evidence in results:
        # Caveats must surface unresolved dynamic calls
        assert evidence.unresolved_calls_count > 0
        assert any("dynamic" in c.lower() or "unresolved" in c.lower() for c in evidence.caveats)
