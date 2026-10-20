import React, { useState } from 'react';
import { Pill } from '../common/Pill';

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
  lodash: {
    id: 'lodash',
    name: 'lodash@4.17.15',
    label: 'CRITICAL',
    statusText: 'CRITICAL',
    isClean: false,
    cveInfo: 'CVE-2021-23337, GHSA-35jh-r3h4-6jhm',
    details: 'Direct dependency · imported by api-gateway/src/utils/serialize.ts · 2 vulnerable functions reachable · CVE-2021-23337, GHSA-35jh-r3h4-6jhm.',
    paths: [
      { severity: 'bad', sevLabel: 'Critical', title: 'deserialize() → qs.parse()', meta: '2 hops · confirmed reachability' },
      { severity: 'warn', sevLabel: 'High', title: 'middleware → lodash.merge()', meta: '3 hops · attacker-controlled input' }
    ]
  },
  serialize: {
    id: 'serialize',
    name: 'serialize-js@5.0.1',
    label: 'HIGH',
    statusText: 'HIGH',
    isClean: false,
    cveInfo: 'CVE-2024-11831',
    details: 'Indirect dependency via express session handler · arbitrary code execution through regex substitution in serialize() call.',
    paths: [
      { severity: 'warn', sevLabel: 'High', title: 'sessionStore.save() → serialize()', meta: '1 hop · confirmed reachability' }
    ]
  },
  axios: {
    id: 'axios',
    name: 'axios@0.21.1',
    label: 'MEDIUM',
    statusText: 'MEDIUM',
    isClean: false,
    cveInfo: 'CVE-2023-45857',
    details: 'Client proxy dependency · SSRF condition under custom redirect interceptors · Inconclusive evidence flagged for analyst review.',
    paths: [
      { severity: 'warn', sevLabel: 'Medium', title: 'webhookForwarder → axios.post()', meta: '2 hops · inconclusive vector' }
    ]
  },
  qs: {
    id: 'qs',
    name: 'qs@6.5.2',
    label: 'CRITICAL',
    statusText: 'CRITICAL',
    isClean: false,
    cveInfo: 'CVE-2022-24999',
    details: 'Sub-dependency of body-parser · prototype override in URLSearchParams parser · verified exploit path.',
    paths: [
      { severity: 'bad', sevLabel: 'Critical', title: 'qs.parse() → Object.prototype', meta: '1 hop · confirmed reachability' }
    ]
  },
  express: {
    id: 'express',
    name: 'express@4.18.2',
    label: 'OK',
    statusText: 'CLEAN',
    isClean: true,
    cveInfo: 'No known vulnerabilities in current patched tree',
    details: 'Primary web application framework · verified clean against OSV, GHSA, and Snyk feeds.',
    paths: [
      { severity: 'ok', sevLabel: 'Clean', title: 'app.use(routes) → Router', meta: 'Zero vulnerable symbols detected' }
    ]
  }
};

export const DependencyGraphView: React.FC = () => {
  const [vulnerableOnly, setVulnerableOnly] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('lodash');

  const selectedNode = NODES_DATA[selectedNodeKey] || NODES_DATA['lodash'];

  return (
    <div className="view-body">
      <div className="view-heading">
        <div>
          <h2>Dependency Graph</h2>
          <span className="view-sub">api-gateway · package-lock.json · 312 packages · 1,204 edges</span>
        </div>
        <div className="vt-actions">
          <button 
            className={`btn-secondary mono ${vulnerableOnly ? 'border-[#FF4655] text-white bg-[#FF4655]/10' : ''}`}
            onClick={() => setVulnerableOnly(!vulnerableOnly)}
          >
            {vulnerableOnly ? 'SHOW ALL PACKAGES' : 'FILTER: VULNERABLE ONLY'}
          </button>
        </div>
      </div>

      {/* SVG Canvas Card */}
      <div className="vt-card mt-5">
        <div className="flex justify-between items-center mb-2">
          <div className="vt-card-label">Attack Surface Graph</div>
          <span className="mono text-[9px] text-[#55555E]">INTERACTIVE · CLICK NODES TO INSPECT</span>
        </div>

        <svg viewBox="0 0 920 330" className="w-full h-auto block mt-3 select-none">
          <g stroke="#26262E" strokeWidth="1.5">
            <line x1="460" y1="66" x2={vulnerableOnly ? "460" : "300"} y2={vulnerableOnly ? "66" : "160"} opacity={vulnerableOnly ? 0.1 : 1} />
            <line x1="460" y1="66" x2="620" y2="160" />
            <line x1="300" y1="160" x2="150" y2="264" opacity={vulnerableOnly ? 0.1 : 1} />
            <line x1="300" y1="160" x2="430" y2="264" opacity={vulnerableOnly ? 0.1 : 1} />
            <line x1="620" y1="160" x2="490" y2="264" />
            <line x1="620" y1="160" x2="770" y2="264" />
          </g>

          {/* Root node */}
          <g className="cursor-default">
            <circle cx="460" cy="66" r="30" fill="#101016" stroke="#3A3A46" strokeWidth="1.5" />
            <text x="460" y="70" textAnchor="middle" fill="#EAEAEF" fontSize="8" fontFamily="'JetBrains Mono', monospace">ROOT</text>
            <text x="460" y="116" textAnchor="middle" fill="#8B8B96" fontSize="10" fontFamily="'JetBrains Mono', monospace">api-gateway</text>
          </g>

          {/* express node */}
          {!vulnerableOnly && (
            <g 
              className="cursor-pointer group"
              onClick={() => setSelectedNodeKey('express')}
            >
              <circle 
                cx="300" cy="160" r="24" 
                fill="#101016" 
                stroke={selectedNodeKey === 'express' ? '#fff' : '#26DE81'} 
                strokeWidth={selectedNodeKey === 'express' ? 2.5 : 1.5}
                className="transition-all"
              />
              <text x="300" y="163" textAnchor="middle" fill="#26DE81" fontSize="8" fontFamily="'JetBrains Mono', monospace">OK</text>
              <text x="300" y="204" textAnchor="middle" fill="#8B8B96" fontSize="10" fontFamily="'JetBrains Mono', monospace">express@4.18.2</text>
            </g>
          )}

          {/* lodash node */}
          <g 
            className="cursor-pointer group"
            onClick={() => setSelectedNodeKey('lodash')}
          >
            <circle 
              cx="620" cy="160" r="24" 
              fill="#1A0E12" 
              stroke={selectedNodeKey === 'lodash' ? '#fff' : '#FF4655'} 
              strokeWidth={selectedNodeKey === 'lodash' ? 2.5 : 1.5}
              className="transition-all"
            />
            <circle cx="620" cy="160" r="4" fill="#FF4655" />
            <text x="620" y="204" textAnchor="middle" fill="#FF9A9A" fontSize="10" fontFamily="'JetBrains Mono', monospace">lodash@4.17.15</text>
          </g>

          {/* serialize-js node */}
          <g 
            className="cursor-pointer group"
            onClick={() => setSelectedNodeKey('serialize')}
          >
            <circle 
              cx="150" cy="264" r="24" 
              fill="#1A140C" 
              stroke={selectedNodeKey === 'serialize' ? '#fff' : '#FF9F43'} 
              strokeWidth={selectedNodeKey === 'serialize' ? 2.5 : 1.5}
              className="transition-all"
            />
            <text x="150" y="308" textAnchor="middle" fill="#FFC48A" fontSize="10" fontFamily="'JetBrains Mono', monospace">serialize-js@5.0.1</text>
          </g>

          {/* axios node */}
          <g 
            className="cursor-pointer group"
            onClick={() => setSelectedNodeKey('axios')}
          >
            <circle 
              cx="430" cy="264" r="24" 
              fill="#16150C" 
              stroke={selectedNodeKey === 'axios' ? '#fff' : '#FECA57'} 
              strokeWidth={selectedNodeKey === 'axios' ? 2.5 : 1.5}
              className="transition-all"
            />
            <text x="430" y="308" textAnchor="middle" fill="#FCE08A" fontSize="10" fontFamily="'JetBrains Mono', monospace">axios@0.21.1</text>
          </g>

          {/* qs node */}
          <g 
            className="cursor-pointer group"
            onClick={() => setSelectedNodeKey('qs')}
          >
            <circle 
              cx="770" cy="264" r="24" 
              fill="#1A0E12" 
              stroke={selectedNodeKey === 'qs' ? '#fff' : '#FF4655'} 
              strokeWidth={selectedNodeKey === 'qs' ? 2.5 : 1.5}
              className="transition-all"
            />
            <text x="770" y="308" textAnchor="middle" fill="#FF9A9A" fontSize="10" fontFamily="'JetBrains Mono', monospace">qs@6.5.2</text>
          </g>
        </svg>

        <div className="agent-meta">
          <span className="agent-stat"><span className="dot" style={{ background: '#26DE81' }} />CLEAN</span>
          <span className="agent-stat"><span className="dot" style={{ background: '#FF9F43' }} />HIGH</span>
          <span className="agent-stat"><span className="dot" style={{ background: '#FECA57' }} />MEDIUM</span>
          <span className="agent-stat"><span className="dot" style={{ background: '#FF4655' }} />CRITICAL</span>
        </div>
      </div>

      {/* Details & Affected Paths */}
      <div className="vt-grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <div className="vt-card">
          <div className="flex justify-between items-center mb-2">
            <div className="vt-card-label">Node Details · {selectedNode.name}</div>
            <span className={`pill ${selectedNode.isClean ? 'pill-ok' : 'pill-bad'}`}>
              {selectedNode.statusText}
            </span>
          </div>
          <div className="vt-note">
            {selectedNode.details}
          </div>
        </div>

        <div className="vt-card">
          <div className="vt-card-label">Affected Paths</div>
          {selectedNode.paths.map((p, idx) => (
            <div key={idx} className="risk-item mt-2">
              <Pill variant={p.severity}>{p.sevLabel}</Pill>
              <div>
                <span className="risk-title">{p.title}</span>
                <span className="risk-meta">{p.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
