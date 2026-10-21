import os
import sys
import shutil
import tempfile
import subprocess
import time
import logging
import re
from pathlib import Path
from typing import Tuple, List, Optional, Literal
from datetime import datetime, timezone
from packaging.version import parse as parse_version

from backend.app.config import settings
from backend.app.models.schemas import (
    ValidationReport,
    ValidationCheck,
    ValidationStatus,
    ValidationCategory,
    RemediationProposal,
    VulnerabilityInfo
)
from backend.app.services.osv import osv_client
from backend.app.services.manifest import (
    parse_manifest_file,
    detect_manifest_packages,
    update_manifest_file,
    find_package_declaration,
    ManifestPackage
)

logger = logging.getLogger("vulntrace.sandbox")

class ValidationSandbox:
    def __init__(self, timeout: int = None):
        self.timeout = timeout or settings.SANDBOX_TIMEOUT_SECONDS

    async def validate_remediation(
        self,
        repo_path: Path,
        vuln: VulnerabilityInfo,
        remediation: RemediationProposal
    ) -> Tuple[ValidationReport, RemediationProposal]:
        """
        Executes controlled, isolated validation of a proposed remediation diff (PRD §12).
        Separates failure stages:
        1. Patch Application
        2. Dependency Version Resolution
        3. Security Verification (OSV re-scan)
        4. Test Suite Execution (Regression checking)
        """
        checks: List[ValidationCheck] = []
        logs_accumulated: List[str] = []

        # 0. Handle Unresolved / Transitive Dependency
        if remediation.status == "unresolved":
            checks.append(ValidationCheck(
                check_name="Patch Application",
                passed=False,
                category="patch_application",
                command="diff apply",
                output=(
                    f"Patch application blocked: Dependency declaration for '{vuln.package_name}' "
                    f"cannot be established in direct manifests. Transitive dependency resolution required."
                ),
                duration_seconds=0.0
            ))
            report = ValidationReport(
                status="failed",
                checks_run=checks,
                logs_summary="Failed at patch application: missing direct dependency declaration.",
                executed_in_sandbox=False,
                timestamp=datetime.now(timezone.utc)
            )
            return report, remediation.model_copy(update={"status": "failed"})

        # Setup sandbox directory
        with tempfile.TemporaryDirectory(prefix="vulntrace_sandbox_") as tmp_dir:
            sandbox_dir = Path(tmp_dir) / "repo"
            # 1. Isolated copy of repo
            shutil.copytree(
                repo_path,
                sandbox_dir,
                ignore=shutil.ignore_patterns(".git", "venv", "__pycache__", ".pytest_cache")
            )

            # Check if package is ALREADY PATCHED (status == "not_needed")
            is_already_patched = (
                remediation.status == "not_needed"
                or (remediation.original_version == remediation.target_version and remediation.original_version != "unknown")
            )

            if is_already_patched:
                # Patch application bypassed cleanly
                checks.append(ValidationCheck(
                    check_name="Apply Proposed Remediation Diff",
                    passed=True,
                    category="patch_application",
                    command="manifest inspection",
                    output=f"Package '{vuln.package_name}' already at target version {remediation.target_version}. Manifest modification bypassed.",
                    duration_seconds=0.05
                ))
                logs_accumulated.append("Patch application bypassed: package already at target version.")
            else:
                # Step 1: Patch Application
                patch_applied, patch_msg = self._apply_patch(sandbox_dir, remediation, vuln)
                checks.append(ValidationCheck(
                    check_name="Apply Proposed Remediation Diff",
                    passed=patch_applied,
                    category="patch_application",
                    command=f"patch {remediation.target_file}",
                    output=patch_msg,
                    duration_seconds=0.1
                ))
                logs_accumulated.append(f"Patch Application: {patch_msg}")

                if not patch_applied:
                    report = ValidationReport(
                        status="failed",
                        checks_run=checks,
                        logs_summary="\n".join(logs_accumulated),
                        executed_in_sandbox=True,
                        timestamp=datetime.now(timezone.utc)
                    )
                    return report, remediation.model_copy(update={"status": "failed"})

            # Step 2: Dependency Resolution Check
            res_passed, res_msg = self._verify_dependency_resolution(sandbox_dir, vuln, remediation)
            checks.append(ValidationCheck(
                check_name="Dependency Version Resolution",
                passed=res_passed,
                category="dependency_resolution",
                command=f"resolve {vuln.package_name}",
                output=res_msg,
                duration_seconds=0.2
            ))
            logs_accumulated.append(f"Dependency Resolution: {res_msg}")

            if not res_passed:
                report = ValidationReport(
                    status="failed",
                    checks_run=checks,
                    logs_summary="\n".join(logs_accumulated),
                    executed_in_sandbox=True,
                    timestamp=datetime.now(timezone.utc)
                )
                return report, remediation.model_copy(update={"status": "failed"})

            # Step 3: Security Verification Check (OSV Re-scan)
            osv_check_passed, osv_msg = await self._run_osv_rescan(sandbox_dir, vuln, remediation)
            checks.append(ValidationCheck(
                check_name="OSV Vulnerability Re-scan",
                passed=osv_check_passed,
                category="security_verification",
                command=f"osv query {vuln.package_name}@{remediation.target_version}",
                output=osv_msg,
                duration_seconds=0.4
            ))
            logs_accumulated.append(f"Security Check: {osv_msg}")

            if not osv_check_passed:
                report = ValidationReport(
                    status="failed",
                    checks_run=checks,
                    logs_summary="\n".join(logs_accumulated),
                    executed_in_sandbox=True,
                    timestamp=datetime.now(timezone.utc)
                )
                return report, remediation.model_copy(update={"status": "failed"})

            # Step 4: Test Suite Regression Check
            test_passed, test_output, tests_executed = self._run_isolated_tests(sandbox_dir)
            if tests_executed:
                checks.append(ValidationCheck(
                    check_name="Repository Test Suite Regression Check",
                    passed=test_passed,
                    category="test_execution",
                    command=f"{sys.executable} -m pytest",
                    output=test_output[:2000] if test_output else "All tests passed cleanly.",
                    duration_seconds=1.2
                ))
                logs_accumulated.append(f"Test Suite Result: {'PASSED' if test_passed else 'FAILED'}\n{test_output[:500] if test_output else ''}")

                if test_passed:
                    overall_status = "validated"
                else:
                    overall_status = "failed"
            else:
                # No runnable test suite detected
                checks.append(ValidationCheck(
                    check_name="Repository Test Suite Regression Check",
                    passed=False,
                    category="test_execution",
                    command="N/A",
                    output="No automated test suite detected in repository. Cannot claim verified without tests.",
                    duration_seconds=0.0
                ))
                logs_accumulated.append("No automated test suite found. Result remains unverified.")
                overall_status = "unverified"

        # Overall remediation status
        if overall_status == "validated":
            updated_remediation_status = "validated"
        elif overall_status == "failed":
            updated_remediation_status = "failed"
        else:
            updated_remediation_status = "unverified"

        updated_remediation = remediation.model_copy(update={"status": updated_remediation_status})

        report = ValidationReport(
            status=overall_status,
            checks_run=checks,
            logs_summary="\n".join(logs_accumulated),
            executed_in_sandbox=True,
            timestamp=datetime.now(timezone.utc)
        )

        return report, updated_remediation

    def _apply_patch(
        self,
        sandbox_dir: Path,
        remediation: RemediationProposal,
        vuln: VulnerabilityInfo
    ) -> Tuple[bool, str]:
        target_path = sandbox_dir / remediation.target_file
        if not target_path.exists():
            return False, f"Target manifest file '{remediation.target_file}' not found in repository."

        # Apply update using syntax-preserving manifest modifier
        success, msg, new_line = update_manifest_file(
            manifest_path=target_path,
            package_name=vuln.package_name,
            target_version=remediation.target_version
        )
        if success:
            return True, f"Successfully applied patch to {remediation.target_file}: {new_line}"
        else:
            return False, f"Patch application failed: {msg}"

    def _verify_dependency_resolution(
        self,
        sandbox_dir: Path,
        vuln: VulnerabilityInfo,
        remediation: RemediationProposal
    ) -> Tuple[bool, str]:
        manifest_path = sandbox_dir / remediation.target_file
        if not manifest_path.exists():
            return False, f"Manifest file '{remediation.target_file}' missing during resolution verification."

        try:
            packages = parse_manifest_file(manifest_path)
            norm_target = vuln.package_name.lower().replace("_", "-")
            for p in packages:
                if p.name == norm_target:
                    actual_v = p.resolved_version or p.declared_version or p.version
                    if actual_v == remediation.target_version:
                        return True, f"Verified dependency resolution: {p.raw_name} resolves to {actual_v} in {remediation.target_file}."
                    else:
                        return False, f"Resolution mismatch: expected {remediation.target_version}, but manifest declares {actual_v}."

            return False, f"Expected dependency declaration for '{vuln.package_name}' not found in '{remediation.target_file}'."
        except Exception as e:
            return False, f"Dependency resolution error: {e}"

    def _is_version_in_range(self, version_str: str, range_str: str) -> bool:
        if not range_str or not version_str or version_str in ("unknown", "unresolved"):
            return False
        try:
            from packaging.specifiers import SpecifierSet
            spec = SpecifierSet(range_str.replace(" ", ""))
            return parse_version(version_str) in spec
        except Exception:
            pass
        m = re.search(r"(<|<=)\s*([0-9a-zA-Z\.\-]+)", range_str)
        if m:
            op, bound = m.groups()
            try:
                if op == "<":
                    return parse_version(version_str) < parse_version(bound)
                else:
                    return parse_version(version_str) <= parse_version(bound)
            except Exception:
                pass
        return False

    async def _run_osv_rescan(
        self,
        sandbox_dir: Path,
        vuln: VulnerabilityInfo,
        remediation: RemediationProposal
    ) -> Tuple[bool, str]:
        try:
            # 1. Deterministic check: verify target_version is not within advisory's affected range
            if vuln.affected_version_range and self._is_version_in_range(remediation.target_version, vuln.affected_version_range):
                return False, f"Security verification failed: target version {remediation.target_version} is still affected by range '{vuln.affected_version_range}' for advisory {vuln.id}."

            # 2. Re-query OSV for the upgraded target version
            new_vulns = await osv_client.query_package(vuln.package_name, remediation.target_version, ecosystem="PyPI")
            active_ids = {v.id for v in new_vulns}
            for v in new_vulns:
                active_ids.update(v.aliases)

            # Confirm specific advisory (and aliases) are cleared
            advisory_keys = {vuln.id} | set(vuln.aliases)
            intersect = advisory_keys & active_ids

            if intersect:
                return False, f"Security verification failed: advisory {', '.join(intersect)} still affects target version {remediation.target_version}."

            return True, f"Security check passed: advisory {vuln.id} is cleared in version {remediation.target_version}."
        except Exception as e:
            return False, f"OSV re-scan error: {e}"

    def _run_isolated_tests(self, sandbox_dir: Path) -> Tuple[bool, Optional[str], bool]:
        """
        Executes test runner in clean sandbox using current Python interpreter.
        """
        test_files = list(sandbox_dir.glob("**/test_*.py")) + list(sandbox_dir.glob("**/*_test.py"))
        if not test_files:
            return False, None, False

        safe_env = {
            "PATH": str(Path(sys.executable).parent) + os.pathsep + os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", "C:\\Windows"),
            "TEMP": str(sandbox_dir),
            "PYTHONPATH": str(sandbox_dir)
        }

        try:
            res = subprocess.run(
                [sys.executable, "-m", "pytest", "-q", "-o", f"pythonpath={sandbox_dir}"],
                cwd=str(sandbox_dir),
                env=safe_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=self.timeout
            )
            output = res.stdout + ("\n" + res.stderr if res.stderr else "")
            return res.returncode == 0, output.strip(), True
        except subprocess.TimeoutExpired:
            return False, f"Execution timed out after {self.timeout}s in sandbox.", True
        except Exception as e:
            return False, f"Sandbox test execution error: {e}", True

sandbox = ValidationSandbox()
