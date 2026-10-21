import pytest
import tempfile
import shutil
from pathlib import Path
from packaging.version import parse as parse_version

from backend.app.models.schemas import (
    VulnerabilityInfo,
    RemediationProposal,
    EvidenceBundle,
    PriorityAssessment,
    ValidationReport
)
from backend.app.services.manifest import (
    detect_manifest_packages,
    find_package_declaration,
    update_manifest_file,
    ManifestPackage
)
from backend.app.agents.remediator import remediation_agent
from backend.app.services.sandbox import sandbox


@pytest.fixture
def temp_repo():
    """Create a temporary repository directory with clean manifests."""
    tmp = tempfile.mkdtemp(prefix="vulntrace_test_repo_")
    repo_path = Path(tmp)
    yield repo_path
    shutil.rmtree(tmp, ignore_errors=True)


# ==============================================================================
# 1. Determine Actual Dependency Version (No Hallucination)
# ==============================================================================

def test_manifest_determines_actual_version_not_advisory_range(temp_repo):
    """
    Requirements.txt has jinja2==2.11.3.
    Advisory has affected_version_range='< 3.1.6'.
    VulnTrace must identify original_version as '2.11.3', NEVER '3.1.6'.
    """
    req_file = temp_repo / "requirements.txt"
    req_file.write_text("requests==2.28.1\njinja2==2.11.3\nflask==2.0.1\n")

    pkg = find_package_declaration(temp_repo, "jinja2")
    assert pkg is not None
    assert pkg.declared_version == "2.11.3"
    assert pkg.version_status == "pinned"
    assert pkg.is_direct is True

    vuln = VulnerabilityInfo(
        id="GHSA-h5c8-rqwp-cp95",
        summary="Jinja vulnerability",
        package_name="jinja2",
        affected_version_range="< 3.1.6",
        fixed_versions=["3.1.6"]
    )
    priority = PriorityAssessment(band="Fix now", rationale="Critical in call path")
    evidence = EvidenceBundle(
        vulnerable_symbol_known=True,
        vulnerable_function="from_string",
        declared_version=pkg.declared_version,
        resolved_version=pkg.resolved_version,
        version_status=pkg.version_status,
        manifest_file=pkg.manifest_file,
        is_transitive=False
    )

    proposal = remediation_agent.propose(vuln, priority, evidence, repo_path=temp_repo)

    # Must accurately reflect original 2.11.3 and target 3.1.6
    assert proposal.original_version == "2.11.3"
    assert proposal.target_version == "3.1.6"
    assert proposal.status == "proposed"
    # Diff must be 2.11.3 -> 3.1.6, NEVER 3.1.6 -> 3.1.6
    assert "-jinja2==2.11.3" in proposal.diff
    assert "+jinja2==3.1.6" in proposal.diff
    assert proposal.diff != ""


def test_pyproject_toml_version_detection(temp_repo):
    """
    Test parsing PEP 621 pyproject.toml dependencies.
    """
    pyproj = temp_repo / "pyproject.toml"
    pyproj.write_text(
        """[project]
name = "demo-app"
version = "0.1.0"
dependencies = [
    "urllib3==1.26.5",
    "jinja2 == 2.11.3",
]
"""
    )

    pkg = find_package_declaration(temp_repo, "jinja2")
    assert pkg is not None
    assert pkg.declared_version == "2.11.3"
    assert pkg.manifest_file == "pyproject.toml"


# ==============================================================================
# 2. Already-Patched Dependencies (No No-Op Upgrades)
# ==============================================================================

def test_already_patched_dependency_generates_no_op_remediation(temp_repo):
    """
    When the manifest already has jinja2==3.1.6 and the advisory is for < 3.1.5,
    no patch is needed. Status must be 'not_needed' and diff must be empty.
    """
    req_file = temp_repo / "requirements.txt"
    req_file.write_text("jinja2==3.1.6\n")

    pkg = find_package_declaration(temp_repo, "jinja2")
    assert pkg.declared_version == "3.1.6"

    vuln = VulnerabilityInfo(
        id="GHSA-test-older",
        summary="Historical advisory",
        package_name="jinja2",
        affected_version_range="< 3.1.5",
        fixed_versions=["3.1.5"]
    )
    priority = PriorityAssessment(band="Monitor", rationale="Low risk")
    evidence = EvidenceBundle(
        vulnerable_symbol_known=True,
        declared_version="3.1.6",
        version_status="pinned",
        manifest_file="requirements.txt"
    )

    proposal = remediation_agent.propose(vuln, priority, evidence, repo_path=temp_repo)

    assert proposal.status == "not_needed"
    assert proposal.diff == ""
    assert "already patched" in proposal.rationale.lower() or "safe" in proposal.rationale.lower()


@pytest.mark.asyncio
async def test_sandbox_validation_on_already_patched_dependency(temp_repo):
    """
    Sandbox validation should succeed without attempting to re-patch
    an already patched manifest.
    """
    req_file = temp_repo / "requirements.txt"
    req_file.write_text("jinja2==3.1.6\n")

    vuln = VulnerabilityInfo(
        id="GHSA-test-older",
        summary="Historical advisory",
        package_name="jinja2",
        affected_version_range="< 3.1.5",
        fixed_versions=["3.1.5"]
    )
    proposal = RemediationProposal(
        diff="",
        target_file="requirements.txt",
        original_version="3.1.6",
        target_version="3.1.6",
        rationale="Already patched",
        status="not_needed"
    )

    report, updated = await sandbox.validate_remediation(temp_repo, vuln, proposal)

    # Patch application should pass (bypassed cleanly)
    patch_check = next(c for c in report.checks_run if c.category == "patch_application")
    assert patch_check.passed is True
    # Dependency resolution check passes
    dep_check = next(c for c in report.checks_run if c.category == "dependency_resolution")
    assert dep_check.passed is True


# ==============================================================================
# 3. Missing Manifests Handling
# ==============================================================================

@pytest.mark.asyncio
async def test_missing_manifest_fails_with_precise_patch_error(temp_repo):
    """
    When target_file does not exist in repository, sandbox validation
    fails precisely under category 'patch_application'.
    """
    vuln = VulnerabilityInfo(
        id="GHSA-test-missing",
        summary="Missing manifest test",
        package_name="jinja2",
        affected_version_range="< 3.1.6",
        fixed_versions=["3.1.6"]
    )
    proposal = RemediationProposal(
        diff="--- a/requirements.txt\n+++ b/requirements.txt\n@@ -1 +1 @@\n-jinja2==2.11.3\n+jinja2==3.1.6",
        target_file="nonexistent_manifest.txt",
        original_version="2.11.3",
        target_version="3.1.6",
        rationale="Target nonexistent manifest",
        status="proposed"
    )

    report, updated = await sandbox.validate_remediation(temp_repo, vuln, proposal)

    assert report.status == "failed"
    assert updated.status == "failed"
    patch_check = next((c for c in report.checks_run if c.category == "patch_application"), None)
    assert patch_check is not None
    assert patch_check.passed is False
    assert "not found" in patch_check.output.lower()


# ==============================================================================
# 4. Transitive Dependencies Handling
# ==============================================================================

def test_transitive_dependency_marked_unresolved(temp_repo):
    """
    If a package is only present transitively (or in lockfile without direct manifest),
    remediation agent marks proposal as 'unresolved' instead of fabricating a patch.
    """
    # Create poetry.lock with transitive package
    lock_file = temp_repo / "poetry.lock"
    lock_file.write_text(
        """[[package]]
name = "markupsafe"
version = "2.0.1"
description = "Safely add untrusted strings to HTML/XML markup."
"""
    )
    # Direct manifest pyproject.toml does NOT declare markupsafe
    pyproj = temp_repo / "pyproject.toml"
    pyproj.write_text(
        """[tool.poetry.dependencies]
python = "^3.10"
jinja2 = "3.1.6"
"""
    )

    pkgs = detect_manifest_packages(temp_repo)
    markupsafe_pkg = next((p for p in pkgs if p.name == "markupsafe"), None)
    assert markupsafe_pkg is not None
    assert markupsafe_pkg.is_direct is False
    assert markupsafe_pkg.version_status == "transitive"

    vuln = VulnerabilityInfo(
        id="GHSA-transitive-test",
        summary="Transitive vulnerability",
        package_name="markupsafe",
        affected_version_range="< 2.1.1",
        fixed_versions=["2.1.1"]
    )
    priority = PriorityAssessment(band="Schedule fix", rationale="Transitive risk")
    evidence = EvidenceBundle(
        vulnerable_symbol_known=False,
        declared_version="2.0.1",
        version_status="transitive",
        is_transitive=True,
        manifest_file="poetry.lock"
    )

    proposal = remediation_agent.propose(vuln, priority, evidence, repo_path=temp_repo)
    assert proposal.status == "unresolved"
    assert proposal.is_transitive is True
    assert proposal.diff == ""


# ==============================================================================
# 5. Version Ranges in Manifests
# ==============================================================================

def test_version_range_manifest_preserved(temp_repo):
    """
    Manifest has range jinja2>=2.0,<3.0.
    Updating to target version 3.1.6 replaces range with fixed target
    preserving file structure and syntax.
    """
    req_file = temp_repo / "requirements.txt"
    req_file.write_text("# Requirements\nrequests>=2.25.0\njinja2>=2.0,<3.0\nclick==8.0.0\n")

    pkg = find_package_declaration(temp_repo, "jinja2")
    assert pkg is not None
    assert pkg.version_status == "range"

    success, msg, new_line = update_manifest_file(req_file, "jinja2", "3.1.6")
    assert success is True
    assert "jinja2>=3.1.6" in new_line or "jinja2==3.1.6" in new_line

    content = req_file.read_text()
    assert "requests>=2.25.0" in content
    assert "click==8.0.0" in content
    assert "<3.0" not in content


# ==============================================================================
# 6. Categorized Sandbox Validation Failures
# ==============================================================================

@pytest.mark.asyncio
async def test_sandbox_security_verification_detects_unfixed_target(temp_repo):
    """
    If a remediation targets a version that is STILL vulnerable according to
    the advisory's affected range, security verification must fail!
    """
    req_file = temp_repo / "requirements.txt"
    req_file.write_text("jinja2==2.11.3\n")

    # Advisory affects < 3.1.6, but remediation only bumped to 3.1.2 (still vulnerable!)
    vuln = VulnerabilityInfo(
        id="GHSA-test-range",
        summary="Security range test",
        package_name="jinja2",
        affected_version_range="< 3.1.6",
        fixed_versions=["3.1.6"]
    )
    proposal = RemediationProposal(
        diff="--- a/requirements.txt\n+++ b/requirements.txt\n@@ -1 +1 @@\n-jinja2==2.11.3\n+jinja2==3.1.2",
        target_file="requirements.txt",
        original_version="2.11.3",
        target_version="3.1.2",
        rationale="Insufficient bump",
        status="proposed"
    )

    report, updated = await sandbox.validate_remediation(temp_repo, vuln, proposal)

    assert report.status == "failed"
    assert updated.status == "failed"
    sec_check = next((c for c in report.checks_run if c.category == "security_verification"), None)
    assert sec_check is not None
    assert sec_check.passed is False
    assert "still affected" in sec_check.output.lower() or "vulnerable" in sec_check.output.lower()


@pytest.mark.asyncio
async def test_sandbox_test_failure_categorization(temp_repo):
    """
    If repository tests fail after applying patch, report must show
    test_execution failure and status 'failed'.
    """
    req_file = temp_repo / "requirements.txt"
    req_file.write_text("jinja2==2.11.3\n")

    # Add a failing test
    test_file = temp_repo / "test_app.py"
    test_file.write_text(
        """def test_expected_regression():
    assert False, "Regression detected: breaking template syntax"
"""
    )

    vuln = VulnerabilityInfo(
        id="GHSA-h5c8-rqwp-cp95",
        summary="Jinja vulnerability",
        package_name="jinja2",
        affected_version_range="< 3.1.6",
        fixed_versions=["3.1.6"]
    )
    proposal = RemediationProposal(
        diff="--- a/requirements.txt\n+++ b/requirements.txt\n@@ -1 +1 @@\n-jinja2==2.11.3\n+jinja2==3.1.6",
        target_file="requirements.txt",
        original_version="2.11.3",
        target_version="3.1.6",
        rationale="Upgrade to 3.1.6",
        status="proposed"
    )

    report, updated = await sandbox.validate_remediation(temp_repo, vuln, proposal)

    assert report.status == "failed"
    assert updated.status == "failed"
    test_check = next((c for c in report.checks_run if c.category == "test_execution"), None)
    assert test_check is not None
    assert test_check.passed is False
    assert "regression" in test_check.output.lower() or "failed" in test_check.output.lower()
