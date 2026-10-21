import React, { useEffect, useState } from 'react';
import { ViewId } from '../../types';
import { HealthStatus, ScanResponse } from '../../types/api';
import { api } from '../../services/api';
import { CheckCircle2, HelpCircle, ArrowRight, ShieldAlert, Search, GitCommit, Cpu } from 'lucide-react';

interface OverviewViewProps { onNavigate: (view: ViewId) => void; }

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResponse[]>([]);

  useEffect(() => {
    api.getHealth().catch(() => null).then(h => h && setHealth(h));
    api.listScans().catch(() => []).then(s => s && setRecentScans(s));
  }, []);

  const reachableCount = recentScans.filter(s => s.findings_count > 0).length;
  const totalFindings = recentScans.reduce((a, s) => a + s.findings_count, 0);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'28px'}}>

      {/* Hero */}
      <div style={{borderBottom:'1px solid var(--border-1)',paddingBottom:'24px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
          <span style={{fontSize:'11px',fontWeight:600,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.8px',fontFamily:"'JetBrains Mono',monospace"}}>VulnTrace AI</span>
          <span style={{color:'var(--border-2)'}}>·</span>
          <span style={{fontSize:'11px',color:'var(--text-tertiary)'}}>Team TECHNOVISIONERS</span>
          <span className={`badge ${health?.status === 'healthy' ? 'badge-validated' : 'badge-ai'}`} style={{marginLeft:'auto'}}>
            Backend {health?.status?.toUpperCase() || 'OFFLINE'}
          </span>
        </div>
        <h1 style={{fontSize:'22px',letterSpacing:'-0.4px',marginBottom:'8px'}}>Evidence-Driven Vulnerability Reachability</h1>
        <p style={{color:'var(--text-secondary)',fontSize:'13px',maxWidth:'640px',lineHeight:'1.6'}}>
          A scanner identifies a vulnerable package. VulnTrace investigates whether your application <em>appears</em> to reach the vulnerable functionality — using deterministic Tree-sitter AST analysis and FalkorDB graph queries — then helps you decide what to do next.
        </p>
      </div>

      {/* KPI Row */}
      <div className="card-grid-4">
        {[
          { label: 'Total Scans', value: recentScans.length, sub: 'Run new scan →', action: () => onNavigate('scans'), icon: Search },
          { label: 'Total Findings', value: totalFindings, sub: 'Inspect reachability →', action: () => onNavigate('findings'), icon: ShieldAlert },
          { label: 'Scans with Findings', value: reachableCount, sub: 'Review remediation →', action: () => onNavigate('remediation'), icon: GitCommit },
          { label: 'Active Agents', value: 3, sub: 'View pipeline →', action: () => onNavigate('agents'), icon: Cpu },
        ].map(({ label, value, sub, action, icon: Icon }) => (
          <div key={label} className="card" style={{cursor:'pointer'}} onClick={action}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'12px'}}>
              <span className="stat-label">{label}</span>
              <Icon size={14} style={{color:'var(--text-tertiary)'}} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-trend" style={{marginTop:'8px',color:'var(--accent)',cursor:'pointer',fontSize:'12px'}}>
              {sub} <ArrowRight size={11} />
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Architecture */}
      <div className="card">
        <div style={{marginBottom:'16px'}}>
          <h2 style={{marginBottom:'4px'}}>7-Stage Pipeline Architecture</h2>
          <p style={{color:'var(--text-secondary)',fontSize:'12px'}}>Deterministic evidence collection → Multi-agent assessment → Human review</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'0'}}>
          {[
            { n: '01', name: 'Repository & Manifests', nature: 'Deterministic', detail: 'Parses requirements.txt / pyproject.toml / package.json' },
            { n: '02', name: 'Vulnerability Lookup', nature: 'Deterministic', detail: 'Queries OSV.dev — real CVE/GHSA advisories, no fabricated data' },
            { n: '03', name: 'Code Analysis (Tree-sitter)', nature: 'Deterministic', detail: 'AST-level import sites, function definitions, entry points' },
            { n: '04', name: 'Graph Construction', nature: 'Deterministic', detail: 'FalkorDB openCypher call-graph with bounded 1–10 hop queries' },
            { n: '05', name: 'Reachability Agent', nature: 'LLM-assisted', detail: 'Groq llama-3.3-70b — may only cite verified graph node IDs' },
            { n: '06', name: 'Risk Prioritizer + Remediation Agent', nature: 'LLM-assisted', detail: 'Categorical bands: Fix now / Schedule fix / Monitor / Human review' },
            { n: '07', name: 'Sandbox Validation', nature: 'Deterministic', detail: 'Isolated test regression + OSV re-scan; no PR auto-creation' },
          ].map(({ n, name, nature, detail }) => (
            <div key={n} className="stage-row">
              <span className="mono" style={{color:'var(--text-tertiary)',minWidth:'24px'}}>{n}</span>
              <div style={{flex:1}}>
                <span className="stage-name">{name}</span>
                <span style={{fontSize:'11px',color:'var(--text-tertiary)',display:'block',marginTop:'1px'}}>{detail}</span>
              </div>
              <span className={`badge ${nature === 'Deterministic' ? 'badge-evidence' : 'badge-ai'}`}>{nature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities Matrix */}
      {health?.capabilities && (
        <div className="card">
          <h2 style={{marginBottom:'16px'}}>Capabilities Matrix (Live from /api/health)</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px'}}>
            {Object.entries(health.capabilities).map(([key, val]) => (
              <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--surface-2)',borderRadius:'6px',border:'1px solid var(--border-1)'}}>
                <div>
                  <div style={{fontSize:'10px',color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'2px',fontFamily:"'JetBrains Mono',monospace"}}>{key.replace(/_/g,' ')}</div>
                  <div style={{fontSize:'12px',color:'var(--text-primary)',fontWeight:500}}>{val}</div>
                </div>
                {val.includes('Not claimed') ? (
                  <span style={{fontSize:'10px',color:'var(--text-tertiary)',background:'var(--surface-3)',padding:'2px 6px',borderRadius:'4px'}}>Out of Scope</span>
                ) : val.includes('Connected') || val.includes('Ready') || val.includes('Verified') ? (
                  <CheckCircle2 size={15} style={{color:'var(--green)',flexShrink:0}} />
                ) : (
                  <HelpCircle size={15} style={{color:'var(--amber)',flexShrink:0}} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
