import React from 'react';
import { Shield, GitCommit, Network, Cpu } from 'lucide-react';

export const AgentsView: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-vt-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-vt-navy font-mono">Architecture &amp; Roles</span>
            <span className="text-vt-muted">✱</span>
            <span className="badge-ai">Groq API (openai/gpt-oss-120b)</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-vt-deep-navy">
            Multi-Agent Architecture
          </h1>
          <p className="text-sm text-vt-muted mt-1 max-w-xl">
            Three cooperating agents with strict JSON-schema enforcement, coordinated by non-LLM orchestration code (LangGraph).
          </p>
        </div>
      </div>

      {/* Non-LLM Coordinator Card */}
      <div className="vt-card border-vt-navy bg-vt-tint/20 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-vt-navy text-white rounded-lg">
              <Network size={20} />
            </div>
            <div>
              <span className="mono text-[10px] text-vt-navy font-bold uppercase">Non-LLM Orchestration</span>
              <h2 className="font-heading font-bold text-xl text-vt-deep-navy">
                Workflow Coordinator (LangGraph)
              </h2>
            </div>
          </div>
          <span className="badge-evidence">Deterministic Python</span>
        </div>

        <p className="text-sm text-vt-ink leading-relaxed">
          The coordinator is <strong>ordinary orchestration code (not an LLM agent)</strong> that executes the stateful pipeline, passes evidence bundles between agents, validates all output references, and routes uncertain findings directly to human review.
        </p>

        <div className="bg-white p-3 rounded-lg border border-vt-border font-mono text-xs text-vt-muted">
          Stateful Pipeline: ingest → osv_lookup → code_analysis → graph_build → path_query → reachability_agent → prioritizer_agent → remediation_agent → validation → human_review
        </div>
      </div>

      {/* Three Cooperating Agents Grid (PRD §8) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Agent 1: Reachability Analyst */}
        <div className="vt-card flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] text-vt-navy font-bold uppercase">Agent 1</span>
              <span className="badge-ai text-[10px]">Candidate: gpt-oss-120b</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="text-vt-navy" size={18} />
              <h3 className="font-heading font-bold text-lg text-vt-deep-navy">
                Reachability Analyst
              </h3>
            </div>
            <p className="text-xs text-vt-ink leading-relaxed">
              Assesses whether vulnerable functionality appears reachable from application entry points based solely on deterministic Tree-sitter evidence.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-vt-border text-xs">
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <strong className="text-vt-deep-navy font-mono text-[11px] block mb-1">Strict Guardrail:</strong>
              <span className="text-vt-muted text-[11px]">
                May only cite verified graph node IDs. Coordinator validates every ref and rejects outputs with hallucinated references.
              </span>
            </div>
            <div className="mono text-[10px] text-vt-navy font-semibold">
              Output: verdict (reachable | not_reachable | uncertain), evidence_refs, caveats
            </div>
          </div>
        </div>

        {/* Agent 2: Risk Prioritizer */}
        <div className="vt-card flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] text-vt-navy font-bold uppercase">Agent 2</span>
              <span className="badge-ai text-[10px]">Candidate: gpt-oss-120b</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="text-vt-navy" size={18} />
              <h3 className="font-heading font-bold text-lg text-vt-deep-navy">
                Risk Prioritizer
              </h3>
            </div>
            <p className="text-xs text-vt-ink leading-relaxed">
              Explains why a finding should be addressed sooner or later based on entry-point exposure context (HTTP/public vs. internal).
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-vt-border text-xs">
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <strong className="text-vt-deep-navy font-mono text-[11px] block mb-1">Categorical Bands:</strong>
              <span className="text-vt-muted text-[11px]">
                No invented numeric score formulas. Maps strictly to Fix now, Schedule fix, Monitor, or Human review.
              </span>
            </div>
            <div className="mono text-[10px] text-vt-navy font-semibold">
              Output: priority_band, plain-language rationale
            </div>
          </div>
        </div>

        {/* Agent 3: Remediation Agent */}
        <div className="vt-card flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] text-vt-navy font-bold uppercase">Agent 3</span>
              <span className="badge-ai text-[10px]">Candidate: gpt-oss-120b</span>
            </div>
            <div className="flex items-center gap-2">
              <GitCommit className="text-vt-navy" size={18} />
              <h3 className="font-heading font-bold text-lg text-vt-deep-navy">
                Remediation Agent
              </h3>
            </div>
            <p className="text-xs text-vt-ink leading-relaxed">
              Suggests minimal dependency version bumps as unified diffs and hands off to controlled sandboxed validation.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-vt-border text-xs">
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <strong className="text-vt-deep-navy font-mono text-[11px] block mb-1">Validation Constraint:</strong>
              <span className="text-vt-muted text-[11px]">
                Never claims a fix succeeded until sandbox execution verifies it. Status stays proposed until tests pass.
              </span>
            </div>
            <div className="mono text-[10px] text-vt-navy font-semibold">
              Output: unified diff, status (proposed | unverified)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
