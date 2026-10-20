from typing import Dict, Any, Optional
from pydantic import BaseModel
from backend.app.models.schemas import (
    PriorityBand,
    PriorityAssessment,
    ReachabilityAssessment,
    VulnerabilityInfo,
    EvidenceBundle
)
from backend.app.agents.groq_client import groq_client

class PrioritizerLLMOutput(BaseModel):
    band: PriorityBand
    rationale: str

SYSTEM_PROMPT = """You are the Risk Prioritizer Agent for VulnTrace AI.
Your task is to explain why a vulnerability finding should be addressed sooner or later based on reachability evidence and exposure context.

MANDATORY RULES:
1. DO NOT invent an undocumented scoring formula or numeric score (e.g., no "8.4/10").
2. Assign exactly ONE of these four categorical priority bands:
   - "Fix now": Reachable and exposed to user-controlled input (e.g., HTTP route handler, upload endpoint).
   - "Schedule fix": Reachable, but internal use only (e.g., offline worker, internal script).
   - "Monitor": Not reachable according to analyzer; no candidate route found.
   - "Human review": Reachability is uncertain, dynamic dispatch was used, or vulnerable symbol is unknown.
3. Provide a clear, plain-language rationale explaining why this band was assigned.
"""

class RiskPrioritizerAgent:
    def prioritize(
        self,
        vuln: VulnerabilityInfo,
        reachability: ReachabilityAssessment,
        evidence: EvidenceBundle
    ) -> PriorityAssessment:
        user_prompt = f"""
VULNERABILITY:
- Package: {vuln.package_name}
- Advisory ID: {vuln.id}
- Severity: {vuln.severity}
- Summary: {vuln.summary}

REACHABILITY VERDICT: {reachability.verdict}
CONFIDENCE NOTE: {reachability.confidence_note}
REACHABILITY RATIONALE: {reachability.rationale}

ENTRY POINT CONTEXT:
- Candidate Paths: {len(evidence.candidate_paths)}
- Entry Point Details: {[
    {"path_id": p.path_id, "entry_point": p.entry_point_id}
    for p in evidence.candidate_paths
]}
- Caveats: {evidence.caveats}
"""

        mock_output = self._deterministic_fallback(vuln, reachability, evidence)

        llm_out: PrioritizerLLMOutput = groq_client.generate_structured(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=PrioritizerLLMOutput,
            mock_response=mock_output
        )

        return PriorityAssessment(
            band=llm_out.band,
            rationale=llm_out.rationale,
            is_ai_generated=True
        )

    def _deterministic_fallback(
        self,
        vuln: VulnerabilityInfo,
        reachability: ReachabilityAssessment,
        evidence: EvidenceBundle
    ) -> Dict[str, Any]:
        if reachability.verdict == "uncertain":
            return {
                "band": "Human review",
                "rationale": "Reachability could not be statically resolved due to dynamic features, unresolved calls, or missing symbol data. A security engineer must review the usage context."
            }
        elif reachability.verdict == "not_reachable":
            return {
                "band": "Monitor",
                "rationale": "No candidate execution route was found connecting application entry points to the vulnerable functionality. Keep the package under observation during routine dependency updates."
            }
        elif reachability.verdict == "reachable":
            # Check if entry point is HTTP route handler (user-controlled)
            is_user_input = False
            for path in evidence.candidate_paths:
                ep_hop = path.hops[0] if path.hops else None
                if ep_hop and ("route" in ep_hop.file_path.lower() or "app" in ep_hop.file_path.lower() or ep_hop.is_entry_point):
                    is_user_input = True
                    break

            if is_user_input:
                return {
                    "band": "Fix now",
                    "rationale": "The vulnerable functionality is reachable from a public HTTP/application entry point where user input can trigger execution."
                }
            else:
                return {
                    "band": "Schedule fix",
                    "rationale": "The vulnerable functionality appears reachable, but appears confined to internal workflows. Prioritize for the next regular patch cycle."
                }

        return {
            "band": "Human review",
            "rationale": "Defaulting to human review for safety."
        }

risk_prioritizer = RiskPrioritizerAgent()
