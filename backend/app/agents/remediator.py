import difflib
import re
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from pydantic import BaseModel
from packaging.version import parse as parse_version, InvalidVersion

from backend.app.models.schemas import (
    RemediationProposal,
    VulnerabilityInfo,
    EvidenceBundle,
    PriorityAssessment
)
from backend.app.services.manifest import (
    find_package_declaration,
    detect_manifest_packages,
    ManifestPackage
)
from backend.app.agents.groq_client import groq_client

class RemediationLLMOutput(BaseModel):
    target_version: str
    rationale: str

SYSTEM_PROMPT = """You are the Remediation Agent for VulnTrace AI.
Your task is to propose a minimal dependency upgrade or patch to remediate a verified vulnerability.

CRITICAL CONSTRAINTS:
1. Status stays "proposed" until controlled sandbox validation runs. NEVER claim the fix is validated or guaranteed safe.
2. Recommend the minimal non-vulnerable fixed version from the advisory.
3. If the dependency is already patched, declare that no change is needed.
4. Unified diff format: Produce clean manifest version updates matching existing syntax.
"""

class RemediationAgent:
    def propose(
        self,
        vuln: VulnerabilityInfo,
        priority: PriorityAssessment,
        evidence: EvidenceBundle,
        current_version: Optional[str] = None,
        repo_path: Optional[Any] = None,
        manifest_path: str = "requirements.txt"
    ) -> RemediationProposal:
        # 1. Resolve actual current version without inventing one
        actual_current_ver = self._resolve_actual_version(vuln.package_name, current_version, evidence, repo_path)

        # 2. Determine safe target version from advisory fixed_versions
        target_version = self._calculate_safe_fixed_version(vuln, actual_current_ver)

        # 3. Check if transitive dependency or version cannot be established
        is_trans = evidence.is_transitive or (evidence.version_status == "transitive")
        if is_trans:
            return RemediationProposal(
                diff="",
                target_file=evidence.manifest_file or manifest_path,
                original_version=actual_current_ver or "unknown",
                target_version=target_version or "latest",
                rationale=(
                    f"Dependency '{vuln.package_name}' is a transitive dependency (not directly declared in manifest). "
                    f"Automated direct patching is not supported; parent dependency upgrade or direct manifest override is required."
                ),
                status="unresolved",
                version_status="transitive",
                declared_version=actual_current_ver,
                resolved_version=actual_current_ver,
                is_transitive=True,
                is_ai_generated=False
            )

        if not actual_current_ver or actual_current_ver == "unknown":
            return RemediationProposal(
                diff="",
                target_file=manifest_path,
                original_version="unknown",
                target_version=target_version or "unknown",
                rationale=(
                    f"Dependency declaration for '{vuln.package_name}' could not be established in direct manifests. "
                    f"Requires explicit dependency resolution before patch generation."
                ),
                status="unresolved",
                version_status="unknown",
                is_transitive=False,
                is_ai_generated=False
            )

        # 4. Check if ALREADY PATCHED (current_version >= target_version)
        if target_version and target_version != "latest":
            try:
                curr_parsed = parse_version(actual_current_ver)
                target_parsed = parse_version(target_version)
                if curr_parsed >= target_parsed:
                    return RemediationProposal(
                        diff="",
                        target_file=manifest_path,
                        original_version=actual_current_ver,
                        target_version=actual_current_ver,
                        rationale=(
                            f"Package '{vuln.package_name}' is already patched at version {actual_current_ver}, "
                            f"which is safe and meets or exceeds target {target_version}. "
                            f"No manifest modification required."
                        ),
                        status="not_needed",
                        version_status=evidence.version_status or "pinned",
                        declared_version=actual_current_ver,
                        resolved_version=actual_current_ver,
                        is_transitive=evidence.is_transitive,
                        is_ai_generated=False
                    )
            except (InvalidVersion, TypeError):
                if actual_current_ver == target_version:
                    return RemediationProposal(
                        diff="",
                        target_file=manifest_path,
                        original_version=actual_current_ver,
                        target_version=actual_current_ver,
                        rationale=f"Package '{vuln.package_name}' is already at version {actual_current_ver}. No upgrade required.",
                        status="not_needed",
                        version_status=evidence.version_status or "pinned",
                        is_ai_generated=False
                    )

        # 5. Fallback target version if none found in advisory
        resolved_target_version = target_version or "latest"

        # 6. LLM consultation for human-readable explanation
        user_prompt = f"""
VULNERABILITY:
- Package: {vuln.package_name}
- Current Version: {actual_current_ver}
- Fixed Versions: {vuln.fixed_versions}
- Priority: {priority.band} ({priority.rationale})
- Advisory: {vuln.id} ({vuln.summary})
- Target Version: {resolved_target_version}
"""
        mock_output = {
            "target_version": resolved_target_version,
            "rationale": f"Upgrade {vuln.package_name} from {actual_current_ver} to {resolved_target_version} to resolve advisory {vuln.id}."
        }

        try:
            llm_out: RemediationLLMOutput = groq_client.generate_structured(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_model=RemediationLLMOutput,
                mock_response=mock_output
            )
            rationale_text = llm_out.rationale
        except Exception:
            rationale_text = mock_output["rationale"]

        # 7. Generate accurate, syntax-matched manifest diff
        diff_text, target_manifest_file = self._generate_accurate_diff(
            package_name=vuln.package_name,
            current_version=actual_current_ver,
            target_version=resolved_target_version,
            default_manifest=manifest_path,
            repo_path=repo_path
        )

        return RemediationProposal(
            diff=diff_text,
            target_file=target_manifest_file,
            original_version=actual_current_ver,
            target_version=resolved_target_version,
            rationale=rationale_text,
            status="proposed",
            version_status=evidence.version_status or "pinned",
            declared_version=actual_current_ver,
            resolved_version=actual_current_ver,
            is_transitive=evidence.is_transitive,
            is_ai_generated=True
        )

    def _resolve_actual_version(
        self,
        package_name: str,
        current_version: Optional[str],
        evidence: EvidenceBundle,
        repo_path: Optional[str]
    ) -> Optional[str]:
        # 1. Check evidence bundle for direct resolved or declared version
        if evidence.resolved_version and evidence.resolved_version != "unknown":
            return evidence.resolved_version
        if evidence.declared_version and evidence.declared_version != "unknown":
            return evidence.declared_version

        # 2. Check repo path directly
        if repo_path:
            pkg_decl = find_package_declaration(Path(repo_path), package_name)
            if pkg_decl:
                return pkg_decl.resolved_version or pkg_decl.declared_version or pkg_decl.version

        # 3. Check passed current_version if not a placeholder
        if current_version and current_version not in ("unknown", "current"):
            return current_version

        return None

    def _calculate_safe_fixed_version(self, vuln: VulnerabilityInfo, current_version: Optional[str]) -> Optional[str]:
        valid_versions: List[str] = []
        for ver in vuln.fixed_versions:
            if not ver or ver == "unknown":
                continue
            try:
                # Validate parseability
                parse_version(ver)
                valid_versions.append(ver)
            except InvalidVersion:
                valid_versions.append(ver)

        if not valid_versions:
            return None

        # Sort valid versions semantically
        try:
            sorted_versions = sorted(valid_versions, key=lambda v: parse_version(v))
        except Exception:
            sorted_versions = valid_versions

        if current_version:
            try:
                curr_parsed = parse_version(current_version)
                # Find smallest fixed version strictly greater than current version
                strictly_greater = [v for v in sorted_versions if parse_version(v) > curr_parsed]
                if strictly_greater:
                    return strictly_greater[0]
            except Exception:
                pass

        # Return the highest fixed version to clear all ranges
        return sorted_versions[-1]

    def _generate_accurate_diff(
        self,
        package_name: str,
        current_version: str,
        target_version: str,
        default_manifest: str,
        repo_path: Optional[str]
    ) -> Tuple[str, str]:
        norm_name = package_name.lower().replace("_", "-")

        if repo_path:
            repo_dir = Path(repo_path)
            # Find the actual manifest containing the package
            pkg_decl = find_package_declaration(repo_dir, package_name)
            if pkg_decl:
                manifest_rel = pkg_decl.manifest_file
                manifest_full = repo_dir / manifest_rel
                if manifest_full.exists():
                    content = manifest_full.read_text(encoding="utf-8")
                    lines = content.splitlines()
                    for line in lines:
                        clean = line.strip()
                        # If line contains the package declaration
                        if clean and not clean.startswith("#"):
                            line_pkg = clean.split("==")[0].split(">=")[0].split("~=")[0].strip().lower().replace("_", "-")
                            if line_pkg == norm_name:
                                orig_line = line
                                # Preserve indentation and specifier
                                if "==" in line:
                                    prefix = line.split("==")[0] + "=="
                                    new_line = f"{prefix}{target_version}"
                                elif "~=" in line:
                                    prefix = line.split("~=")[0] + "~="
                                    new_line = f"{prefix}{target_version}"
                                else:
                                    prefix = line.split(">=")[0].split("<=")[0].strip()
                                    new_line = f"{prefix}=={target_version}"

                                diff = difflib.unified_diff(
                                    [orig_line + "\n"],
                                    [new_line + "\n"],
                                    fromfile=f"a/{manifest_rel}",
                                    tofile=f"b/{manifest_rel}",
                                    lineterm=""
                                )
                                return "\n".join(diff), manifest_rel

        # Fallback diff format
        orig_line = f"{package_name}=={current_version}\n"
        new_line = f"{package_name}=={target_version}\n"
        diff = difflib.unified_diff(
            [orig_line],
            [new_line],
            fromfile=f"a/{default_manifest}",
            tofile=f"b/{default_manifest}",
            lineterm=""
        )
        return "\n".join(diff), default_manifest

remediation_agent = RemediationAgent()
