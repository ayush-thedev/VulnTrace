// VulnTrace AI Shared TypeScript Schemas (Mirrors backend/app/models/schemas.py)

export type ReachabilityVerdict = 'reachable' | 'not_reachable' | 'uncertain';
export type PriorityBand = 'Fix now' | 'Schedule fix' | 'Monitor' | 'Human review';
export type RemediationStatus = 'proposed' | 'validated' | 'failed' | 'unverified';
export type ValidationStatus = 'not_run' | 'validated' | 'failed' | 'unverified';
export type HumanReviewDecision = 'accept' | 'reject' | 'needs_more_info';

export interface PathHop {
  node_id: string;
  file_path: string;
  function_name: string;
  line_number: number;
  is_entry_point: boolean;
  call_resolved: boolean;
  code_snippet?: string;
}

export interface CandidatePath {
  path_id: string;
  entry_point_id: string;
  vulnerable_target_id: string;
  hops: PathHop[];
  contains_unresolved_call: boolean;
  depth: number;
}

export interface ImportSite {
  file_path: string;
  line_number: number;
  package_name: string;
  alias?: string;
  imported_symbols: string[];
}

export interface EvidenceBundle {
  candidate_paths: CandidatePath[];
  import_sites: ImportSite[];
  vulnerable_symbol_known: boolean;
  vulnerable_symbol_name?: string;
  caveats: string[];
  unresolved_calls_count: number;
  analyzer_name: string;
  graph_node_ids: string[];
}

export interface VulnerabilityInfo {
  id: string;
  aliases: string[];
  summary: string;
  details?: string;
  severity: string;
  package_name: string;
  package_ecosystem: string;
  affected_version_range: string;
  fixed_versions: string[];
  advisory_url?: string;
}

export interface ReachabilityAssessment {
  verdict: ReachabilityVerdict;
  confidence_note: string;
  caveats: string[];
  evidence_refs: string[];
  rationale: string;
  is_ai_generated: boolean;
}

export interface PriorityAssessment {
  band: PriorityBand;
  rationale: string;
  is_ai_generated: boolean;
}

export interface RemediationProposal {
  diff: string;
  target_file: string;
  original_version: string;
  target_version: string;
  rationale: string;
  status: RemediationStatus;
  is_ai_generated: boolean;
}

export interface ValidationCheck {
  check_name: string;
  passed: boolean;
  command?: string;
  output?: string;
  duration_seconds: number;
}

export interface ValidationReport {
  status: ValidationStatus;
  checks_run: ValidationCheck[];
  logs_summary?: string;
  executed_in_sandbox: boolean;
  timestamp?: string;
}

export interface Provenance {
  deterministic_stages: string[];
  llm_stages: string[];
}

export interface HumanReviewRecord {
  decision: HumanReviewDecision;
  reviewer_notes?: string;
  reviewed_at: string;
}

export interface Finding {
  id: string;
  scan_id: string;
  vulnerability: VulnerabilityInfo;
  evidence: EvidenceBundle;
  reachability: ReachabilityAssessment;
  priority: PriorityAssessment;
  remediation: RemediationProposal;
  validation: ValidationReport;
  provenance: Provenance;
  human_review?: HumanReviewRecord;
}

export interface ScanStage {
  stage_id: number;
  name: string;
  nature: 'Deterministic' | 'LLM-assisted';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  detail?: string;
}

export interface ScanCreateRequest {
  repo_path: string;
  ecosystem?: string;
  run_validation_sandbox?: boolean;
}

export interface ScanResponse {
  id: string;
  repo_path: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage_progress: ScanStage[];
  findings_count: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, any>;
}

export interface GraphData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  falkordb_reachable: boolean;
  groq_configured: boolean;
  docker_available: boolean;
  tree_sitter_ready: boolean;
  capabilities: Record<string, string>;
}
