from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# Core Semantics (PRD §7, §8, §12)
ReachabilityVerdict = Literal["reachable", "not_reachable", "uncertain"]
PriorityBand = Literal["Fix now", "Schedule fix", "Monitor", "Human review"]
RemediationStatus = Literal["proposed", "validated", "failed", "unverified", "not_needed", "unresolved"]
ValidationStatus = Literal["not_run", "validated", "failed", "unverified"]
HumanReviewDecision = Literal["accept", "reject", "needs_more_info"]
ValidationCategory = Literal["patch_application", "dependency_resolution", "security_verification", "test_execution"]

class PathHop(BaseModel):
    node_id: str
    file_path: str
    function_name: str
    line_number: int
    is_entry_point: bool = False
    call_resolved: bool = True
    code_snippet: Optional[str] = None

class CandidatePath(BaseModel):
    path_id: str
    entry_point_id: str
    vulnerable_target_id: str
    hops: List[PathHop] = Field(default_factory=list)
    contains_unresolved_call: bool = False
    depth: int = 0

class ImportSite(BaseModel):
    file_path: str
    line_number: int
    package_name: str
    alias: Optional[str] = None
    imported_symbols: List[str] = Field(default_factory=list)

class EvidenceBundle(BaseModel):
    candidate_paths: List[CandidatePath] = Field(default_factory=list)
    import_sites: List[ImportSite] = Field(default_factory=list)
    vulnerable_symbol_known: bool
    vulnerable_symbol_name: Optional[str] = None
    vulnerable_function: Optional[str] = None
    caveats: List[str] = Field(default_factory=list)
    unresolved_calls_count: int = 0
    unresolved_calls: Optional[List[Any]] = Field(default_factory=list)
    declared_version: Optional[str] = None
    resolved_version: Optional[str] = None
    version_status: Optional[str] = "pinned"
    manifest_file: Optional[str] = "requirements.txt"
    is_transitive: bool = False
    analyzer_name: str = "Tree-sitter Python Call Graph Analyzer"
    graph_node_ids: List[str] = Field(default_factory=list)

class VulnerabilityInfo(BaseModel):
    id: str  # e.g. OSV/CVE/GHSA ID
    aliases: List[str] = Field(default_factory=list)
    summary: str
    details: Optional[str] = None
    severity: str = "UNKNOWN"  # CRITICAL, HIGH, MEDIUM, LOW, UNKNOWN
    package_name: str
    package_ecosystem: str = "PyPI"
    affected_version_range: str
    fixed_versions: List[str] = Field(default_factory=list)
    advisory_url: Optional[str] = None

class ReachabilityAssessment(BaseModel):
    verdict: ReachabilityVerdict
    confidence_note: str
    caveats: List[str] = Field(default_factory=list)
    evidence_refs: List[str] = Field(default_factory=list)
    rationale: str
    is_ai_generated: bool = True

class PriorityAssessment(BaseModel):
    band: PriorityBand
    rationale: str
    is_ai_generated: bool = True

class RemediationProposal(BaseModel):
    diff: str
    target_file: str
    original_version: str
    target_version: str
    rationale: str
    status: RemediationStatus = "proposed"
    version_status: Optional[str] = "pinned"
    declared_version: Optional[str] = None
    resolved_version: Optional[str] = None
    is_transitive: bool = False
    parent_dependency: Optional[str] = None
    is_ai_generated: bool = True

class ValidationCheck(BaseModel):
    check_name: str
    passed: bool
    category: Optional[ValidationCategory] = None
    command: Optional[str] = None
    output: Optional[str] = None
    duration_seconds: float = 0.0

class ValidationReport(BaseModel):
    status: ValidationStatus = "not_run"
    checks_run: List[ValidationCheck] = Field(default_factory=list)
    logs_summary: Optional[str] = None
    executed_in_sandbox: bool = False
    timestamp: Optional[datetime] = None

class Provenance(BaseModel):
    deterministic_stages: List[str] = Field(
        default_factory=lambda: [
            "Manifest Parsing",
            "OSV Vulnerability Identification",
            "Tree-sitter AST & Call Graph",
            "FalkorDB Path Query",
            "Remediation Diff Validation"
        ]
    )
    llm_stages: List[str] = Field(
        default_factory=lambda: [
            "Reachability Analyst Interpretation",
            "Risk Prioritizer Rationale",
            "Remediation Proposal Explanation"
        ]
    )

class HumanReviewRecord(BaseModel):
    decision: HumanReviewDecision
    reviewer_notes: Optional[str] = None
    reviewed_at: datetime = Field(default_factory=datetime.utcnow)

class Finding(BaseModel):
    id: str
    scan_id: str
    vulnerability: VulnerabilityInfo
    evidence: EvidenceBundle
    reachability: ReachabilityAssessment
    priority: PriorityAssessment
    remediation: RemediationProposal
    validation: ValidationReport
    provenance: Provenance = Field(default_factory=Provenance)
    human_review: Optional[HumanReviewRecord] = None

# Scan and Workflow Schemas (PRD §5, §13)
class ScanStage(BaseModel):
    stage_id: int
    name: str
    nature: Literal["Deterministic", "LLM-assisted"]
    status: Literal["pending", "in_progress", "completed", "failed", "skipped"]
    detail: Optional[str] = None

class ScanCreateRequest(BaseModel):
    repo_path: str
    ecosystem: str = "PyPI"
    run_validation_sandbox: bool = True

class ScanResponse(BaseModel):
    id: str
    repo_path: str
    repo_url: Optional[str] = None
    commit_sha: Optional[str] = None
    status: Literal["queued", "running", "completed", "failed", "cancelled"] = "running"
    stage_progress: List[ScanStage] = Field(default_factory=list)
    findings_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

class FixResponse(BaseModel):
    id: str
    scan_id: str
    finding_id: str
    package_name: str
    target_file: str
    original_version: str
    target_version: str
    diff: str
    rationale: str
    status: RemediationStatus = "proposed"
    validation_verdict: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# React Flow Graph Schema (PRD §10, §14)
class ReactFlowPosition(BaseModel):
    x: float
    y: float

class ReactFlowNode(BaseModel):
    id: str
    type: str = "customNode"
    position: ReactFlowPosition
    data: Dict[str, Any]

class ReactFlowEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    animated: bool = False
    style: Optional[Dict[str, Any]] = None

class GraphData(BaseModel):
    nodes: List[ReactFlowNode] = Field(default_factory=list)
    edges: List[ReactFlowEdge] = Field(default_factory=list)

# Health & Capabilities Schema (PRD §13, §20)
class HealthStatus(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    version: str = "1.0.0"
    falkordb_reachable: bool
    groq_configured: bool
    docker_available: bool
    tree_sitter_ready: bool
    capabilities: Dict[str, str]
