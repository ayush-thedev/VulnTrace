from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from backend.app.models.schemas import (
    ReachabilityVerdict,
    ReachabilityAssessment,
    EvidenceBundle,
    VulnerabilityInfo
)
from backend.app.agents.groq_client import groq_client
from backend.app.agents.validator import validate_evidence_refs, EvidenceRefValidationError

class ReachabilityLLMOutput(BaseModel):
    verdict: ReachabilityVerdict
    confidence_note: str
    evidence_refs: List[str] = Field(default_factory=list)
    rationale: str
    caveats: List[str] = Field(default_factory=list)

SYSTEM_PROMPT = """You are the Reachability Analyst Agent for VulnTrace AI.
Your sole job is to interpret deterministic code-analysis evidence and assess whether the vulnerable functionality appears reachable.

NON-NEGOTIABLE HONESTY RULES:
1. Grounding: You must NEVER invent call paths, function names, files, or CVE details. You may ONLY cite evidence references (IDs) explicitly listed in the input.
2. Verdict Semantics:
   - "reachable": At least one candidate route connects an application entry point to the vulnerable function.
   - "not_reachable": No route found by the static analyzer (caveat: this is NOT a guarantee of safety).
   - "uncertain": Dynamic dispatch (getattr/eval), unresolved imports, or missing vulnerable symbol data.
3. If candidate routes contain unresolved calls or if dynamic dispatch was detected, verdict MUST be "uncertain", never "not_reachable".
"""

class ReachabilityAnalystAgent:
    def analyze(self, vuln: VulnerabilityInfo, evidence: EvidenceBundle) -> ReachabilityAssessment:
        # Prepare deterministic grounding context
        user_prompt = f"""
VULNERABILITY:
- Package: {vuln.package_name} (advisory {vuln.id})
- Summary: {vuln.summary}
- Vulnerable Symbol Known: {evidence.vulnerable_symbol_known} ({evidence.vulnerable_symbol_name or 'N/A'})

EVIDENCE BUNDLE:
- Candidate Paths: {len(evidence.candidate_paths)} found
- Candidate Path Details: {[
    {"path_id": p.path_id, "hops": [h.node_id for h in p.hops], "has_unresolved": p.contains_unresolved_call} 
    for p in evidence.candidate_paths
]}
- Import Sites: {[{"file": i.file_path, "line": i.line_number, "symbols": i.imported_symbols} for i in evidence.import_sites]}
- Analyzer Caveats: {evidence.caveats}
- Unresolved / Dynamic Calls in codebase: {evidence.unresolved_calls_count}

VALID EVIDENCE NODE IDS YOU MAY CITE:
{evidence.graph_node_ids}
"""

        # Generate deterministic mock fallback if Groq API is not called
        mock_output = self._deterministic_fallback(vuln, evidence)

        llm_out: ReachabilityLLMOutput = groq_client.generate_structured(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=ReachabilityLLMOutput,
            mock_response=mock_output
        )

        # Enforce PRD Acceptance Test 2: Unresolved routes must be uncertain
        if evidence.unresolved_calls_count > 0 and not evidence.candidate_paths:
            # If dynamic calls exist and no static path was proven, must remain uncertain
            if any("dynamic" in c.lower() for c in evidence.caveats):
                llm_out.verdict = "uncertain"

        if any(p.contains_unresolved_call for p in evidence.candidate_paths):
            llm_out.verdict = "uncertain"

        # Validate evidence references (PRD §8, Acceptance Test 3)
        is_valid, unknown_refs = validate_evidence_refs(llm_out.evidence_refs, evidence.graph_node_ids)
        if not is_valid:
            raise EvidenceRefValidationError(
                f"Reachability Analyst cited unknown evidence refs: {unknown_refs}. Output rejected per PRD §8 rule."
            )

        return ReachabilityAssessment(
            verdict=llm_out.verdict,
            confidence_note=llm_out.confidence_note,
            caveats=list(set(evidence.caveats + llm_out.caveats)),
            evidence_refs=llm_out.evidence_refs,
            rationale=llm_out.rationale,
            is_ai_generated=True
        )

    def _deterministic_fallback(self, vuln: VulnerabilityInfo, evidence: EvidenceBundle) -> Dict[str, Any]:
        """Provides verified deterministic fallback for offline evaluation."""
        if not evidence.vulnerable_symbol_known:
            return {
                "verdict": "uncertain",
                "confidence_note": "Degraded to package-level analysis because vulnerable symbol is not specified in advisory.",
                "evidence_refs": [f"pkg:{vuln.package_name}" if f"pkg:{vuln.package_name}" in evidence.graph_node_ids else evidence.graph_node_ids[0]],
                "rationale": f"Advisory {vuln.id} does not identify the vulnerable symbol. Package '{vuln.package_name}' is imported, but specific function reachability cannot be statically proven.",
                "caveats": ["Vulnerable symbol unknown in advisory."]
            }

        if len(evidence.candidate_paths) > 0:
            primary_path = evidence.candidate_paths[0]
            cited_refs = [h.node_id for h in primary_path.hops if h.node_id in evidence.graph_node_ids]
            
            if primary_path.contains_unresolved_call:
                verdict: ReachabilityVerdict = "uncertain"
                conf = "Uncertain due to unresolved call expressions on route."
            else:
                verdict: ReachabilityVerdict = "reachable"
                conf = f"Static route found from entry point '{primary_path.entry_point_id}' to '{evidence.vulnerable_symbol_name}'."

            return {
                "verdict": verdict,
                "confidence_note": conf,
                "evidence_refs": cited_refs,
                "rationale": f"Candidate execution path traces from application entry point through {len(primary_path.hops)} hops to vulnerable target.",
                "caveats": evidence.caveats
            }
        else:
            cited_refs = [evidence.graph_node_ids[0]] if evidence.graph_node_ids else []
            return {
                "verdict": "not_reachable",
                "confidence_note": "No candidate route found from application entry points by static analyzer.",
                "evidence_refs": cited_refs,
                "rationale": f"The analyzer found no call chain connecting an entry point to '{evidence.vulnerable_symbol_name}'. Note: this is not a guarantee of safety.",
                "caveats": evidence.caveats
            }

reachability_analyst = ReachabilityAnalystAgent()
