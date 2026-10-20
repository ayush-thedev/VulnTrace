import React, { useState } from 'react';
import { RiskMeter } from '../common/RiskMeter';

interface FindingNode {
  id: string;
  label: string;
  left: string;
  top: string;
  color?: string;
  borderColor?: string;
  details: string;
}

const NODES: FindingNode[] = [
  { id: '1', label: 'Gateway /Ingress', left: '5%', top: '40%', details: 'Port 443 public entrypoint · TLS termination · Unsanitized XML payload passed directly' },
  { id: '2', label: 'AuthProxy.ts', left: '35%', top: '60%', details: 'Token verified · payload forwarded without XML schema validation' },
  { id: '3', label: 'ParserService.java', left: '65%', top: '30%', borderColor: 'var(--accent-orange)', details: 'Process handler receives raw payload and delegates to XMLReader' },
  { id: '4', label: 'VULNERABLE_FUNC()', left: '85%', top: '48%', color: 'var(--accent-orange)', borderColor: 'var(--accent-orange)', details: 'xmlParseEntityRef invoked with external DTD resolution enabled' },
];

export const FindingsView: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<FindingNode>(NODES[3]);
  const [prStatus, setPrStatus] = useState<Record<string, string>>({
    libxml2: 'idle',
    'log4j-core': 'idle'
  });
  const [copiedCode, setCopiedCode] = useState(false);

  const codeSnippet = `// ParserService.java:142
public void process(String payload) {
    // Input is directly passed from Gateway
    Document doc = xmlParser.parse(payload); 
    // ^ Reachable via user-controlled input exposure
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleInitPR = (pkg: string) => {
    setPrStatus(prev => ({ ...prev, [pkg]: 'loading' }));
    setTimeout(() => {
      setPrStatus(prev => ({ ...prev, [pkg]: 'success' }));
    }, 1200);
  };

  return (
    <div className="view-body">
      {/* Top Ledger Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
        <div>
          <h1 className="text-4xl font-light mb-2 tracking-tight text-white font-heading">
            System Ledger / 01
          </h1>
          <p className="text-[#888888] max-w-md text-sm leading-relaxed">
            Real-time vulnerability reachability analysis. Evidence-driven risk prioritization for distributed topologies.
          </p>
        </div>
        <div className="flex gap-10 items-center">
          <div className="text-right">
            <span className="mono block text-[#888888] mb-1">Risk Score</span>
            <span className="text-3xl font-light text-white font-heading">
              8.4<span className="text-sm text-[#888888]">/10</span>
            </span>
          </div>
          <RiskMeter label="Critical" />
        </div>
      </header>

      {/* Main Finding Section */}
      <section className="findings">
        <div className="finding-block">
          <header className="flex items-center gap-4 mb-4">
            <span className="mono text-[#888888]">V3.4.2 — Critical — Dec 12 2024</span>
            <span className="status-dot risk" />
          </header>
          
          <h2 className="text-2xl mb-4 font-normal text-white font-heading tracking-tight">
            Remote Code Execution via reachability-path /api/v1/ingest
          </h2>
          
          <p className="text-[#888888] mb-6 leading-relaxed text-sm">
            Identified vulnerable dependency <span className="text-white font-medium">libxml2-2.9.10</span>. Analysis confirms the vulnerable function <code className="bg-[#111] px-1.5 py-0.5 rounded text-[#00FF41] font-mono text-xs">xmlParseEntityRef</code> is reachable through the primary ingestion pipeline via user-controlled XML payloads.
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            <span className="tag">CVE-2024-4210</span>
            <span className="tag text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/5">REACHABLE</span>
            <span className="tag text-[#FF4655] border-[#FF4655]/30 bg-[#FF4655]/5">EXPLOITABLE</span>
          </div>

          {/* Attack Path Canvas */}
          <div className="flex justify-between items-center mb-2">
            <div className="mono text-[#888888]">Attack Path Evidence</div>
            <span className="mono text-[9px] text-[#55555E]">CLICK A NODE TO INSPECT HOP</span>
          </div>
          
          <div className="attack-path-canvas relative">
            <div className="path-line" />
            {NODES.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  className={`node cursor-pointer transition-transform ${isSelected ? 'scale-110 shadow-[0_0_15px_rgba(0,255,65,0.6)] ring-1 ring-[#00FF41]' : ''}`}
                  style={{
                    left: node.left,
                    top: node.top,
                    color: node.color,
                    borderColor: node.borderColor || 'var(--accent-green)',
                  }}
                  onClick={() => setSelectedNode(node)}
                >
                  {node.label}
                </div>
              );
            })}

            <div className="absolute right-4 top-4 text-right mono text-[9px] pointer-events-none">
              <div className="text-[#00FF41]">SIGNAL_CLARITY: 98.2%</div>
              <div className="text-[#888888]">EXPOSURE_VECTOR: EXT_NETWORK</div>
            </div>

            {selectedNode && (
              <div className="absolute left-4 bottom-4 right-4 bg-black/90 border border-[#26262E] px-4 py-2 text-xs font-mono text-[#B9B9C4] flex items-center justify-between">
                <div>
                  <span className="text-[#00FF41] mr-2">[{selectedNode.label}]</span>
                  <span>{selectedNode.details}</span>
                </div>
                <span className="text-[10px] text-[#55555E] shrink-0 ml-4">HOP {selectedNode.id} OF 4</span>
              </div>
            )}
          </div>

          {/* Code-Level Evidence */}
          <div className="flex justify-between items-center mb-2">
            <div className="mono text-[#888888]">Code-Level Evidence</div>
            <button 
              onClick={handleCopyCode}
              className="mono text-[10px] text-[#888888] hover:text-white transition-colors"
            >
              {copiedCode ? 'COPIED ✓' : 'COPY SNIPPET'}
            </button>
          </div>
          <pre className="relative group">
            <code className="code-block">{codeSnippet}</code>
          </pre>
        </div>

        {/* Pending Remediation Sequences */}
        <div className="mt-28">
          <h3 className="mono text-white mb-8 text-sm">Pending Remediation Sequences</h3>
          
          <div className="id-card-legacy mb-8 flex items-center gap-6 bg-[#111111] border border-[rgba(255,255,255,0.1)] p-6 rounded-lg w-fit">
            <div className="halftone-profile" />
            <div className="flex flex-col justify-between py-1">
              <div>
                <div className="mono text-[10px] text-[#888888] mb-1">Primary Security Engineer</div>
                <div className="text-xl font-medium text-white font-heading">K. Kurokawa</div>
                <div className="mono text-[10px] text-[#00FF41] mt-2">Access: All Zones</div>
              </div>
              <div className="mono text-[9px] text-[#888888] mt-3">ID: 0029384-A</div>
            </div>
          </div>

          <div className="rem-table border-t border-[rgba(255,255,255,0.1)]">
            <div className="rem-row mono text-[#888888] text-[10px]">
              <span>Package</span>
              <span>Proposed Version</span>
              <span>Action</span>
            </div>

            <div className="rem-row">
              <span className="font-mono text-sm text-white">libxml2</span>
              <span className="font-mono text-sm text-[#888888]">
                2.9.10 → <span className="text-[#00FF41]">2.11.4</span>
              </span>
              <div>
                {prStatus['libxml2'] === 'success' ? (
                  <span className="mono text-xs text-[#00FF41]">PR #483 OPENED ✓</span>
                ) : (
                  <button 
                    className="glow-btn"
                    onClick={() => handleInitPR('libxml2')}
                    disabled={prStatus['libxml2'] === 'loading'}
                  >
                    {prStatus['libxml2'] === 'loading' ? 'INITIALIZING...' : 'Initialize Pull Request'}
                  </button>
                )}
              </div>
            </div>

            <div className="rem-row">
              <span className="font-mono text-sm text-white">log4j-core</span>
              <span className="font-mono text-sm text-[#888888]">
                2.14.1 → <span className="text-[#00FF41]">2.17.1</span>
              </span>
              <div>
                {prStatus['log4j-core'] === 'success' ? (
                  <span className="mono text-xs text-[#00FF41]">PR #484 OPENED ✓</span>
                ) : (
                  <button 
                    className="glow-btn"
                    onClick={() => handleInitPR('log4j-core')}
                    disabled={prStatus['log4j-core'] === 'loading'}
                  >
                    {prStatus['log4j-core'] === 'loading' ? 'INITIALIZING...' : 'Initialize Pull Request'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
