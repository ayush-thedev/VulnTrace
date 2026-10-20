import difflib
from typing import Dict, Any, Optional
from pydantic import BaseModel
from backend.app.models.schemas import (
    RemediationProposal,
    VulnerabilityInfo,
    EvidenceBundle,
    PriorityAssessment
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
3. Unified diff format: Produce or confirm clean manifest version updates.
"""

class RemediationAgent:
    def propose(
        self,
        vuln: VulnerabilityInfo,
        priority: PriorityAssessment,
        evidence: EvidenceBundle,
        current_version: str,
        manifest_path: str = "requirements.txt"
    ) -> RemediationProposal:
        # Determine fixed version
        target_version = vuln.fixed_versions[0] if vuln.fixed_versions else "latest"

        user_prompt = f"""
VULNERABILITY:
- Package: {vuln.package_name}
- Current Version: {current_version}
- Fixed Versions: {vuln.fixed_versions}
- Priority: {priority.band} ({priority.rationale})
- Advisory: {vuln.id} ({vuln.summary})
"""

        mock_output = {
            "target_version": target_version,
            "rationale": f"Upgrade {vuln.package_name} from {current_version} to {target_version} to resolve advisory {vuln.id} while minimizing breaking changes."
        }

        llm_out: RemediationLLMOutput = groq_client.generate_structured(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=RemediationLLMOutput,
            mock_response=mock_output
        )

        resolved_target_version = llm_out.target_version or target_version

        # Generate deterministic unified diff
        diff_text = self._generate_manifest_diff(
            package_name=vuln.package_name,
            current_version=current_version,
            target_version=resolved_target_version,
            manifest_file=manifest_path
        )

        return RemediationProposal(
            diff=diff_text,
            target_file=manifest_path,
            original_version=current_version,
            target_version=resolved_target_version,
            rationale=llm_out.rationale,
            status="proposed",
            is_ai_generated=True
        )

    def _generate_manifest_diff(
        self,
        package_name: str,
        current_version: str,
        target_version: str,
        manifest_file: str
    ) -> str:
        orig_line = f"{package_name}=={current_version}\n"
        new_line = f"{package_name}=={target_version}\n"

        diff = difflib.unified_diff(
            [orig_line],
            [new_line],
            fromfile=f"a/{manifest_file}",
            tofile=f"b/{manifest_file}",
            lineterm=""
        )
        return "\n".join(diff)

remediation_agent = RemediationAgent()
