import logging
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END

from backend.app.models.schemas import (
    Finding,
    VulnerabilityInfo,
    EvidenceBundle,
    ReachabilityAssessment,
    PriorityAssessment,
    RemediationProposal,
    ValidationReport,
    Provenance
)
from backend.app.services.evidence import evidence_pipeline
from backend.app.agents.reachability import reachability_analyst
from backend.app.agents.prioritizer import risk_prioritizer
from backend.app.agents.remediator import remediation_agent

logger = logging.getLogger("vulntrace.coordinator")

class PipelineState(BaseModel):
    repo_path: str
    scan_id: str = "SCAN-001"
    raw_evidence_pairs: List[Dict[str, Any]] = Field(default_factory=list)
    findings: List[Finding] = Field(default_factory=list)
    stage: str = "initialized"
    error: Optional[str] = None

class WorkflowCoordinator:
    def __init__(self):
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(PipelineState)

        # 1. Deterministic Evidence Node
        async def node_gather_evidence(state: PipelineState) -> Dict[str, Any]:
            try:
                repo_dir = Path(state.repo_path)
                results = await evidence_pipeline.run(repo_dir, scan_id=state.scan_id)
                serialized = [
                    {"vuln": v.model_dump(), "evidence": e.model_dump()}
                    for v, e in results
                ]
                return {"raw_evidence_pairs": serialized, "stage": "evidence_gathered"}
            except Exception as e:
                logger.error(f"Evidence gathering failed: {e}")
                return {"error": str(e), "stage": "failed"}

        # 2. Agent Assessment Node
        async def node_agent_pipeline(state: PipelineState) -> Dict[str, Any]:
            findings: List[Finding] = []
            for idx, item in enumerate(state.raw_evidence_pairs):
                vuln = VulnerabilityInfo.model_validate(item["vuln"])
                evidence = EvidenceBundle.model_validate(item["evidence"])

                # Agent 1: Reachability Analyst
                try:
                    reach_assess = reachability_analyst.analyze(vuln, evidence)
                except Exception as e:
                    logger.warning(f"Reachability Analyst failed for {vuln.id}: {e}")
                    reach_assess = ReachabilityAssessment(
                        verdict="uncertain",
                        confidence_note="Analysis incomplete or evidence ref validation failed.",
                        caveats=evidence.caveats + [str(e)],
                        rationale="Agent analysis degraded to uncertain.",
                        is_ai_generated=False
                    )

                # Agent 2: Risk Prioritizer
                try:
                    prio_assess = risk_prioritizer.prioritize(vuln, reach_assess, evidence)
                except Exception as e:
                    prio_assess = PriorityAssessment(
                        band="Human review",
                        rationale=f"Defaulting to human review due to prioritizer error: {e}",
                        is_ai_generated=False
                    )

                # Agent 3: Remediation Agent
                try:
                    remed_proposal = remediation_agent.propose(
                        vuln=vuln,
                        priority=prio_assess,
                        evidence=evidence,
                        current_version=evidence.resolved_version or evidence.declared_version,
                        repo_path=state.repo_path
                    )
                except Exception as e:
                    remed_proposal = RemediationProposal(
                        diff="",
                        target_file="requirements.txt",
                        original_version=evidence.declared_version or "unknown",
                        target_version=vuln.fixed_versions[0] if vuln.fixed_versions else "unknown",
                        rationale=f"Remediation proposal unavailable: {e}",
                        status="unresolved",
                        is_ai_generated=False
                    )

                finding_id = f"finding-{uuid.uuid4().hex}"
                finding = Finding(
                    id=finding_id,
                    scan_id=state.scan_id,
                    vulnerability=vuln,
                    evidence=evidence,
                    reachability=reach_assess,
                    priority=prio_assess,
                    remediation=remed_proposal,
                    validation=ValidationReport(status="not_run"),
                    provenance=Provenance()
                )
                findings.append(finding)

            return {"findings": findings, "stage": "agents_completed"}

        # Define conditional routing
        def check_has_evidence(state: PipelineState) -> str:
            if state.error or not state.raw_evidence_pairs:
                return "end"
            return "agents"

        workflow.add_node("gather_evidence", node_gather_evidence)
        workflow.add_node("agent_pipeline", node_agent_pipeline)

        workflow.add_edge(START, "gather_evidence")
        workflow.add_conditional_edges(
            "gather_evidence",
            check_has_evidence,
            {
                "agents": "agent_pipeline",
                "end": END
            }
        )
        workflow.add_edge("agent_pipeline", END)

        return workflow.compile()

    async def execute(self, repo_path: Path, scan_id: str = "SCAN-001") -> List[Finding]:
        initial_state = PipelineState(
            repo_path=str(repo_path.resolve()),
            scan_id=scan_id
        )
        final_state = await self.graph.ainvoke(initial_state)
        # LangGraph returns a dict when invoked
        if isinstance(final_state, dict):
            return final_state.get("findings", [])
        return final_state.findings

coordinator = WorkflowCoordinator()
