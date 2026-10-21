import React, { useState } from 'react';
import { Pill } from '../common/Pill';
import { Network, Filter, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

interface GraphNodeData {
  id: string;
  name: string;
  label: string;
  statusText: string;
  isClean: boolean;
  cveInfo: string;
  details: string;
  paths: Array<{
    severity: 'bad' | 'warn' | 'ok';
    sevLabel: string;
    title: string;
    meta: string;
  }>;
}

const NODES_DATA: Record<string, GraphNodeData> = {
  jinja2: {
    id: 'jinja2',
    name: 'jinja2@2.11.3',
    label: 'HIGH',
    statusText: 'HIGH',
    isClean: false,
    cveInfo: 'GHSA-q2x7-8rv6-6q7h',
    details: 'Direct dependency in demo-fixture · reachable via generate_report() entry point · template injection vector.',
    paths: [
      { severity: 'bad', sevLabel: 'Reachable', title: 'main() → generate_report() → jinja2.Template', meta: '2 hops · confirmed AST reachability' }
    ]
  },
  pyyaml: {
    id: 'pyyaml',
    name: 'pyyaml@5.3.1',
    label: 'CRITICAL',
    statusText: 'CRITICAL',
    isClean: false,
    cveInfo: 'CVE-2020-14343, GHSA-8q59-q68m-5ver',
    details: 'Direct dependency in demo-fixture · reachable via parse_config() · arbitrary code execution via FullLoader.',
    paths: [
      { severity: 'bad', sevLabel: 'Reachable', title: 'main() → parse_config() → yaml.load()', meta: '2 hops · confirmed call site' }
    ]
  },
  requests: {
    id: 'requests',
    name: 'requests@2.25.1',
    label: 'MEDIUM',
    statusText: 'UNCERTAIN',
    isClean: false,
    cveInfo: 'CVE-2023-32681',
    details: 'Uncalled dependency in demo-fixture · imported in auth_client.py but function dispatch is unresolved.',
    paths: [
      { severity: 'warn', sevLabel: 'Uncertain', title: 'Dynamic proxy handler → requests.get()', meta: 'Unresolved call site · human review recommended' }
    ]
  },
  fastapi: {
    id: 'fastapi',
    name: 'fastapi@0.110.0',
    label: 'CLEAN',
    statusText: 'CLEAN',
    isClean: true,
    cveInfo: 'No known advisories in current version',
    details: 'Core web framework · clean against OSV.dev vulnerability database.',
    paths: [
      { severity: 'ok', sevLabel: 'Clean', title: 'api.router() → endpoint handler', meta: '0 vulnerable callsites' }
    ]
  }
};

export const DependencyGraphView: React.FC = () => {
  const [vulnerableOnly, setVulnerableOnly] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('pyyaml');

  const selectedNode = NODES_DATA[selectedNodeKey] || NODES_DATA['pyyaml'];

  return (
    <div className="view-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Network size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>Topology</span>
          </div>
          <h1 style={{ margin: 0 }}>Attack Surface Graph</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', margin: 0 }}>
            Interactive dependency and call graph topology showing entry points and vulnerable target sinks.
          </p>
        </div>
        <button 
          className={`btn ${vulnerableOnly ? 'btn-primary' : ''}`}
          onClick={() => setVulnerableOnly(!vulnerableOnly)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Filter size={13} />
          <span>{vulnerableOnly ? 'Show All Packages' : 'Filter: Vulnerable Only'}</span>
        </button>
      </div>

      {/* SVG Canvas Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'JetBrains Mono', monospace" }}>
            Visual Call Graph Topology
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
            Click nodes to inspect call paths &amp; evidence
          </span>
        </div>

        <svg viewBox="0 0 920 300" style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4364F7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Edges */}
          <g stroke="var(--border-1)" strokeWidth="1.5">
            <line x1="460" y1="50" x2={vulnerableOnly ? "460" : "280"} y2={vulnerableOnly ? "50" : "150"} opacity={vulnerableOnly ? 0.05 : 1} />
            <line x1="460" y1="50" x2="640" y2="150" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 2" />
            <line x1="280" y1="150" x2="160" y2="240" opacity={vulnerableOnly ? 0.05 : 1} />
            <line x1="640" y1="150" x2="480" y2="240" stroke="var(--red-border)" strokeWidth="2" />
            <line x1="640" y1="150" x2="780" y2="240" stroke="var(--amber-border)" strokeWidth="1.5" strokeDasharray="3 3" />
          </g>

          {/* Root node */}
          <g style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeKey('fastapi')}>
            <circle cx="460" cy="50" r="26" fill="var(--surface-2)" stroke="var(--border-2)" strokeWidth="1.5" />
            <text x="460" y="54" textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="700" fontFamily="'JetBrains Mono', monospace">APP</text>
            <text x="460" y="90" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="'JetBrains Mono', monospace">demo-fixture</text>
          </g>

          {/* Clean node (fastapi) */}
          {!vulnerableOnly && (
            <g style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeKey('fastapi')}>
              <circle 
                cx="280" cy="150" r="22" 
                fill="var(--surface-2)" 
                stroke={selectedNodeKey === 'fastapi' ? 'var(--green)' : 'var(--border-2)'} 
                strokeWidth={selectedNodeKey === 'fastapi' ? 2 : 1}
              />
              <text x="280" y="153" textAnchor="middle" fill="var(--green)" fontSize="8" fontWeight="700" fontFamily="'JetBrains Mono', monospace">OK</text>
              <text x="280" y="186" textAnchor="middle" fill="var(--text-tertiary)" fontSize="10" fontFamily="'JetBrains Mono', monospace">fastapi@0.110.0</text>
            </g>
          )}

          {/* pyyaml node (Critical & reachable) */}
          <g style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeKey('pyyaml')}>
            <circle 
              cx="640" cy="150" r="26" 
              fill="var(--red-dim)" 
              stroke={selectedNodeKey === 'pyyaml' ? 'var(--red)' : 'var(--red-border)'} 
              strokeWidth={selectedNodeKey === 'pyyaml' ? 2.5 : 1.5}
            />
            <text x="640" y="154" textAnchor="middle" fill="var(--red)" fontSize="9" fontWeight="700" fontFamily="'JetBrains Mono', monospace">CRIT</text>
            <text x="640" y="190" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono', monospace">pyyaml@5.3.1</text>
          </g>

          {/* jinja2 node (Reachable) */}
          <g style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeKey('jinja2')}>
            <circle 
              cx="480" cy="240" r="22" 
              fill="var(--red-dim)" 
              stroke={selectedNodeKey === 'jinja2' ? 'var(--red)' : 'var(--red-border)'} 
              strokeWidth={selectedNodeKey === 'jinja2' ? 2.5 : 1}
            />
            <text x="480" y="243" textAnchor="middle" fill="var(--red)" fontSize="8" fontWeight="700" fontFamily="'JetBrains Mono', monospace">HIGH</text>
            <text x="480" y="274" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="'JetBrains Mono', monospace">jinja2@2.11.3</text>
          </g>

          {/* requests node (Uncertain) */}
          <g style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeKey('requests')}>
            <circle 
              cx="780" cy="240" r="22" 
              fill="var(--amber-dim)" 
              stroke={selectedNodeKey === 'requests' ? 'var(--amber)' : 'var(--amber-border)'} 
              strokeWidth={selectedNodeKey === 'requests' ? 2.5 : 1}
            />
            <text x="780" y="243" textAnchor="middle" fill="var(--amber)" fontSize="8" fontWeight="700" fontFamily="'JetBrains Mono', monospace">UNC</text>
            <text x="780" y="274" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="'JetBrains Mono', monospace">requests@2.25.1</text>
          </g>
        </svg>
      </div>

      {/* Selected Node Details Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '16px', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{selectedNode.name}</h2>
              <span className={`badge ${selectedNode.isClean ? 'badge-validated' : selectedNode.label === 'CRITICAL' ? 'badge-failed' : 'badge-uncertain'}`}>
                {selectedNode.statusText}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {selectedNode.cveInfo}
            </div>
          </div>
          <Pill variant={selectedNode.isClean ? 'ok' : 'bad'}>
            {selectedNode.isClean ? 'Clean Package' : 'Advisory Present'}
          </Pill>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          {selectedNode.details}
        </p>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>
            Traceable Execution Paths ({selectedNode.paths.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedNode.paths.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-1)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {p.severity === 'bad' ? (
                    <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
                  ) : p.severity === 'warn' ? (
                    <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {p.meta}
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
