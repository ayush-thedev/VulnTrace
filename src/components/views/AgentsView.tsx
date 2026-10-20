import React, { useState } from 'react';
import { Pill } from '../common/Pill';

interface AgentCardData {
  id: string;
  name: string;
  status: { label: string; variant: 'run' | 'ok' | 'warn' | 'bad' };
  description: string;
  stats: string[];
}

const AGENTS: AgentCardData[] = [
  {
    id: 'reachability-analyzer',
    name: 'reachability-analyzer',
    status: { label: 'Running', variant: 'run' },
    description: 'Tracing execution paths in api-gateway · F-2847 · confirming whether vulnerable functions are invoked with attacker-controlled input.',
    stats: ['14 EVIDENCE ARTIFACTS', 'UPTIME 6h 12m', '62% COMPLETE']
  },
  {
    id: 'cve-correlator',
    name: 'cve-correlator',
    status: { label: 'Completed', variant: 'ok' },
    description: 'Cross-referenced 312 packages against OSV, GHSA and NVD advisories · 47 matches confirmed with exploit conditions.',
    stats: ['312 PACKAGES', '47 MATCHES']
  },
  {
    id: 'patch-synthesizer',
    name: 'patch-synthesizer',
    status: { label: 'Awaiting Input', variant: 'warn' },
    description: 'Draft patch for F-2847 ready · includes dependency upgrade to serialize-javascript@6.0.2 and code-level deserialization guard.',
    stats: ['1 PATCH DRAFT', 'REVIEW REQUIRED']
  },
  {
    id: 'test-runner',
    name: 'test-runner',
    status: { label: 'Running', variant: 'run' },
    description: 'Executing security regression suite against proposed patch · inconclusive results are surfaced, never suppressed.',
    stats: ['41 / 56 CHECKS', '0 FAILURES']
  }
];

const INITIAL_LOGS = [
  { time: '14:32:07', agent: 'reachability-analyzer', text: 'reachability-analyzer · trace complete · F-2847 · 14 evidence artifacts attached' },
  { time: '14:31:52', agent: 'test-runner', text: 'test-runner · security suite executing · 41/56 checks passed' },
  { time: '14:28:11', agent: 'cve-correlator', text: 'cve-correlator · matched GHSA-35jh-r3h4-6jhm · lodash@4.17.15' },
  { time: '14:22:40', agent: 'patch-synthesizer', text: 'patch-synthesizer · draft patch ready · awaiting reviewer approval' },
];

export const AgentsView: React.FC = () => {
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs] = useState(INITIAL_LOGS);

  return (
    <div className="view-body">
      <div className="view-heading">
        <div>
          <h2>Agents</h2>
          <span className="view-sub">4 autonomous agents · evidence &amp; execution details</span>
        </div>
        <div className="vt-actions">
          <button 
            className="btn-secondary mono"
            onClick={() => setShowLogsModal(true)}
          >
            AGENT LOGS
          </button>
        </div>
      </div>

      {/* Agents 2x2 Grid */}
      <div className="vt-grid grid-cols-1 md:grid-cols-2">
        {AGENTS.map((agent) => (
          <div key={agent.id} className="vt-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="vt-card-label font-mono">{agent.name}</div>
              <Pill variant={agent.status.variant}>
                {agent.status.label}
              </Pill>
            </div>
            <div className="vt-note">
              {agent.description}
            </div>
            <div className="agent-meta">
              {agent.stats.map((s, idx) => (
                <span key={idx} className="agent-stat">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Live Execution Log */}
      <div className="vt-card mt-4">
        <div className="flex justify-between items-center mb-2">
          <div className="vt-card-label">Execution Log</div>
          <span className="mono text-[9px] text-[#55555E]">LIVE FEED · 4 ENTRIES</span>
        </div>
        <div className="mt-2 divide-y divide-[#141419]">
          {logs.map((log, idx) => (
            <div key={idx} className="log-line">
              <span className="log-time font-mono">{log.time}</span>
              <span className="font-mono text-[#B9B9C4]">{log.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[#26262E] w-full max-w-2xl rounded-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-white">Autonomous Agent Runtime Logs</h3>
                <span className="mono text-[10px] text-[#55555E]">STREAMING STDOUT/STDERR SESSIONS</span>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="bg-[#050508] border border-[#1C1C22] p-4 rounded font-mono text-xs text-[#8B8B96] max-h-96 overflow-y-auto space-y-2">
              <div>[14:32:07.112] <span className="text-[#5C7CFA]">INFO</span> reachability-analyzer: AST parse tree generated for 214 modules</div>
              <div>[14:32:07.450] <span className="text-[#00FF41]">SUCCESS</span> reachability-analyzer: 14 evidence artifacts persisted to sqlite memory</div>
              <div>[14:31:52.001] <span className="text-[#5C7CFA]">INFO</span> test-runner: pytest --security-regression suite in container sandbox</div>
              <div>[14:28:11.890] <span className="text-[#FF9F43]">WARN</span> cve-correlator: CVE-2021-23337 flagged with public exploit in exploit-db</div>
              <div>[14:22:40.120] <span className="text-[#FECA57]">NOTICE</span> patch-synthesizer: generated AST transform patch diff /api-gateway/src/utils/serialize.ts</div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowLogsModal(false)} className="btn-primary mono">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
