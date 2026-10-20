import React, { useEffect, useState } from 'react';
import { ViewId } from '../../types';
import { HealthStatus, ScanResponse } from '../../types/api';
import { api } from '../../services/api';
import { 
  CheckCircle2, 
  HelpCircle, 
  Layers, 
  ArrowRight
} from 'lucide-react';

interface OverviewViewProps {
  onNavigate: (view: ViewId) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResponse[]>([]);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      const [h, s] = await Promise.all([
        api.getHealth().catch(() => null),
        api.listScans().catch(() => [])
      ]);
      setHealth(h);
      setRecentScans(s);
    } catch (e) {
      console.error('Error loading overview:', e);
    }
  };

  return (
    <div className="space-y-8">
      {/* Memorable Distinction Hero (PRD §2) */}
      <div className="vt-card bg-vt-tint/30 border-vt-navy/40 p-6 space-y-3 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="mono text-xs font-bold uppercase tracking-wider text-vt-navy">
            VulnTrace AI
          </span>
          <span className="text-vt-navy">✱</span>
          <span className="text-xs text-vt-muted">Team TECHNOVISIONERS</span>
        </div>

        <blockquote className="text-lg md:text-xl font-heading font-bold text-vt-deep-navy border-l-4 border-vt-navy pl-4 py-1">
          &ldquo;A scanner identifies a vulnerable package. VulnTrace investigates whether the application appears to reach the vulnerable functionality — and helps developers decide what to do next.&rdquo;
        </blockquote>

        <p className="text-xs text-vt-muted max-w-2xl leading-relaxed">
          Traditional scanners stop at package alerts. VulnTrace connects Tree-sitter code intelligence, FalkorDB openCypher graph queries, Groq-hosted multi-agent triage, and isolated sandbox validation while keeping a human in the loop.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('scans')}
          className="vt-card cursor-pointer hover:border-vt-navy transition-all"
        >
          <span className="mono text-xs text-vt-muted uppercase block mb-1">Total Scans Run</span>
          <div className="text-3xl font-heading font-bold text-vt-deep-navy">{recentScans.length}</div>
          <span className="text-xs text-vt-navy flex items-center gap-1 mt-2 font-medium">
            Run new scan <ArrowRight size={12} />
          </span>
        </div>

        <div
          onClick={() => onNavigate('findings')}
          className="vt-card cursor-pointer hover:border-vt-navy transition-all"
        >
          <span className="mono text-xs text-vt-muted uppercase block mb-1">Findings Ledger</span>
          <div className="text-3xl font-heading font-bold text-vt-deep-navy">
            {recentScans.reduce((acc, s) => acc + s.findings_count, 0)}
          </div>
          <span className="text-xs text-vt-navy flex items-center gap-1 mt-2 font-medium">
            Inspect reachability <ArrowRight size={12} />
          </span>
        </div>

        <div className="vt-card">
          <span className="mono text-xs text-vt-muted uppercase block mb-1">Reachability Engine</span>
          <div className="text-base font-bold text-vt-deep-navy font-heading mt-1">Tree-sitter + FalkorDB</div>
          <span className="text-[11px] text-vt-muted block mt-2 font-mono">
            Bounded openCypher (1..10 hops)
          </span>
        </div>

        <div className="vt-card">
          <span className="mono text-xs text-vt-muted uppercase block mb-1">Human-in-the-Loop</span>
          <div className="text-base font-bold text-vt-deep-navy font-heading mt-1">Review Required</div>
          <span className="text-[11px] text-vt-muted block mt-2 font-mono">
            No unvalidated automated PRs
          </span>
        </div>
      </div>

      {/* Honest Implementation Status & Capabilities Panel (PRD §13, §17, §20) */}
      <div className="vt-card space-y-4">
        <div className="flex items-center justify-between border-b border-vt-border pb-3">
          <div className="flex items-center gap-2">
            <Layers className="text-vt-navy" size={18} />
            <h2 className="font-heading font-bold text-lg text-vt-deep-navy">
              System Capabilities &amp; Verification Matrix (PRD §17)
            </h2>
          </div>
          <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
            health?.status === 'healthy' ? 'badge-validated' : 'badge-uncertain'
          }`}>
            Backend: {health?.status?.toUpperCase() || 'OFFLINE'}
          </span>
        </div>

        <p className="text-xs text-vt-muted">
          In strict compliance with PRD §0 and §17 honesty rules, this matrix reports real runtime capabilities without fake completeness.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {health?.capabilities ? (
            Object.entries(health.capabilities).map(([key, val]) => (
              <div key={key} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-mono text-gray-500 uppercase text-[10px] block">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold text-vt-deep-navy">{val}</span>
                </div>
                {val.includes('Not claimed') ? (
                  <span className="mono text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">Out of Scope</span>
                ) : val.includes('Connected') || val.includes('Ready') || val.includes('Verified') ? (
                  <CheckCircle2 size={16} className="text-vt-green" />
                ) : (
                  <HelpCircle size={16} className="text-vt-amber" />
                )}
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-4 text-vt-muted">
              Capabilities loaded from FastAPI /api/health when backend is running.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
