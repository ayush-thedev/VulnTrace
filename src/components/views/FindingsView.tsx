import React, { useState, useEffect } from 'react';
import { Finding, GraphData } from '../../types/api';
import { api } from '../../services/api';
import { PathFlowGraph } from '../common/PathFlowGraph';
import { 
  GitCommit, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle,
  Sparkles,
  Database
} from 'lucide-react';

export const FindingsView: React.FC = () => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [validating, setValidating] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');

  useEffect(() => {
    loadFindings();
  }, []);

  const loadFindings = async () => {
    setLoading(true);
    try {
      const scans = await api.listScans();
      if (scans.length > 0) {
        const latestScan = scans[scans.length - 1];
        const res = await api.getScanFindings(latestScan.id);
        setFindings(res);
        if (res.length > 0) {
          selectFinding(res[0]);
        }
      } else {
        // Fallback default sample scan for immediate demo
        const scanRes = await api.createScan('backend/tests/fixtures/sample_repo');
        const res = await api.getScanFindings(scanRes.id);
        setFindings(res);
        if (res.length > 0) {
          selectFinding(res[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load findings:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectFinding = async (finding: Finding) => {
    setSelectedFinding(finding);
    try {
      const graph = await api.getFindingGraph(finding.id);
      setGraphData(graph);
    } catch (err) {
      console.error('Failed to load graph:', err);
    }
  };

  const handleValidate = async () => {
    if (!selectedFinding) return;
    setValidating(true);
    try {
      const updated = await api.validateRemediation(selectedFinding.id);
      setSelectedFinding(updated);
      setFindings(prev => prev.map(f => f.id === updated.id ? updated : f));
      setNotification(`Validation executed: Status is now "${updated.validation.status}"`);
    } catch (err: any) {
      setNotification(`Validation failed: ${err.message}`);
    } finally {
      setValidating(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleReview = async (decision: 'accept' | 'reject' | 'needs_more_info') => {
    if (!selectedFinding) return;
    try {
      const updated = await api.recordHumanReview(selectedFinding.id, decision, reviewNotes);
      setSelectedFinding(updated);
      setFindings(prev => prev.map(f => f.id === updated.id ? updated : f));
      setNotification(`Review recorded: ${decision.toUpperCase()}`);
      setReviewNotes('');
    } catch (err: any) {
      setNotification(`Error recording review: ${err.message}`);
    } finally {
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const renderVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'reachable':
        return <span className="badge-reachable">REACHABLE</span>;
      case 'not_reachable':
        return <span className="badge-not-reachable">NOT REACHABLE (No route found)</span>;
      default:
        return <span className="badge-uncertain">UNCERTAIN (Human Review)</span>;
    }
  };

  const renderPriorityBadge = (band: string) => {
    let colorClass = 'bg-amber-100 text-amber-900 border-amber-300';
    if (band === 'Fix now') colorClass = 'bg-red-100 text-red-900 border-red-300 font-bold';
    else if (band === 'Schedule fix') colorClass = 'bg-blue-100 text-blue-900 border-blue-300';
    else if (band === 'Monitor') colorClass = 'bg-gray-100 text-gray-800 border-gray-300';

    return (
      <span className={`px-2.5 py-1 rounded text-xs border ${colorClass}`}>
        {band}
      </span>
    );
  };

  const renderValidationStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return <span className="badge-validated flex items-center gap-1"><CheckCircle2 size={12} /> VALIDATED</span>;
      case 'failed':
        return <span className="badge-failed flex items-center gap-1"><XCircle size={12} /> FAILED</span>;
      case 'unverified':
        return <span className="badge-uncertain flex items-center gap-1"><HelpCircle size={12} /> UNVERIFIED</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs border border-gray-200">NOT RUN</span>;
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-vt-muted">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-vt-navy border-t-transparent rounded-full mb-4"></div>
        <p className="font-heading text-lg">Gathering code analysis and reachability evidence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {notification && (
        <div className="p-4 bg-vt-tint border border-vt-navy text-vt-deep-navy rounded-lg text-sm flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-vt-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-vt-navy font-mono">Evidence-Linked Findings</span>
            <span className="text-vt-muted">✱</span>
            <span className="badge-evidence">
              <Database size={11} /> Grounded in Tree-sitter &amp; FalkorDB
            </span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-vt-deep-navy">
            Reachability Ledger
          </h1>
          <p className="text-sm text-vt-muted mt-1 max-w-xl">
            A scanner identifies a vulnerable package. VulnTrace investigates whether the application appears to reach the vulnerable functionality.
          </p>
        </div>
        <button onClick={loadFindings} className="btn-secondary">
          Refresh Findings
        </button>
      </div>

      {findings.length === 0 ? (
        <div className="vt-card text-center py-12">
          <p className="text-vt-muted">No findings recorded. Start a scan to analyze dependencies.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Findings List (Left column) */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-vt-muted">
              Findings ({findings.length})
            </h2>
            {findings.map((f) => (
              <div
                key={f.id}
                onClick={() => selectFinding(f)}
                className={`vt-card cursor-pointer p-4 transition-all ${
                  selectedFinding?.id === f.id
                    ? 'border-vt-navy bg-vt-tint/30 shadow-md ring-1 ring-vt-navy'
                    : 'hover:border-vt-navy/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-vt-deep-navy">
                    {f.vulnerability.package_name}
                  </span>
                  {renderPriorityBadge(f.priority.band)}
                </div>

                <div className="text-sm font-semibold text-vt-ink line-clamp-1 mb-2 font-heading">
                  {f.vulnerability.summary}
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-vt-border/60">
                  <div className="flex items-center gap-2">
                    {renderVerdictBadge(f.reachability.verdict)}
                  </div>
                  <div>
                    {renderValidationStatusBadge(f.validation.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Finding Detail Inspector (Right column) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedFinding ? (
              <>
                {/* Vulnerability & Reachability Overview */}
                <div className="vt-card space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="mono text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {selectedFinding.vulnerability.id}
                        </span>
                        {selectedFinding.vulnerability.aliases.map((alias) => (
                          <span key={alias} className="mono text-xs text-vt-muted">
                            {alias}
                          </span>
                        ))}
                        {renderVerdictBadge(selectedFinding.reachability.verdict)}
                      </div>
                      <h2 className="text-xl font-heading font-bold text-vt-deep-navy">
                        {selectedFinding.vulnerability.summary}
                      </h2>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <span className="block text-xs font-mono uppercase text-vt-muted mb-1">Priority Band</span>
                      {renderPriorityBadge(selectedFinding.priority.band)}
                    </div>
                  </div>

                  {/* Reachability Rationale & Provenance */}
                  <div className="bg-vt-card border border-vt-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase font-mono text-vt-deep-navy flex items-center gap-1.5">
                        <Sparkles size={13} className="text-vt-navy" />
                        Reachability Assessment
                      </span>
                      <span className="badge-ai text-[10px]">
                        AI-generated explanation (Groq)
                      </span>
                    </div>
                    <p className="text-sm text-vt-ink leading-relaxed">
                      {selectedFinding.reachability.rationale}
                    </p>
                    <div className="text-xs text-vt-muted bg-white p-2.5 rounded border border-gray-200 font-mono">
                      <strong>Confidence note:</strong> {selectedFinding.reachability.confidence_note}
                    </div>

                    {/* Caveats */}
                    {selectedFinding.reachability.caveats.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[11px] font-bold text-vt-amber uppercase font-mono block">
                          Static Analysis Caveats:
                        </span>
                        <ul className="list-disc list-inside text-xs text-vt-muted space-y-0.5">
                          {selectedFinding.reachability.caveats.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Candidate Execution Path Canvas (React Flow) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase font-mono text-vt-deep-navy flex items-center gap-1.5">
                        <Database size={13} className="text-vt-navy" />
                        Candidate Route Evidence (React Flow)
                      </span>
                      <span className="badge-evidence text-[10px]">
                        Deterministic Graph
                      </span>
                    </div>

                    {graphData && (
                      <PathFlowGraph graphData={graphData} />
                    )}
                  </div>

                  {/* Remediation Diff Viewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase font-mono text-vt-deep-navy flex items-center gap-1.5">
                        <GitCommit size={13} className="text-vt-navy" />
                        Proposed Remediation (Unified Diff)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-vt-muted">
                          Status: <strong className="font-mono">{selectedFinding.remediation.status}</strong>
                        </span>
                        {renderValidationStatusBadge(selectedFinding.validation.status)}
                      </div>
                    </div>

                    <div className="bg-[#1A1A2E] text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                      <pre>{selectedFinding.remediation.diff || 'No diff required or proposed.'}</pre>
                    </div>

                    <p className="text-xs text-vt-muted">
                      {selectedFinding.remediation.rationale}
                    </p>
                  </div>

                  {/* Validation Actions & Report */}
                  <div className="pt-4 border-t border-vt-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-vt-deep-navy">Controlled Sandbox Validation</h4>
                        <p className="text-xs text-vt-muted">Run tests in an isolated sandbox and re-scan with OSV.</p>
                      </div>
                      <button
                        onClick={handleValidate}
                        disabled={validating}
                        className="btn-primary"
                      >
                        {validating ? 'Validating in Sandbox...' : 'Run Sandbox Validation'}
                      </button>
                    </div>

                    {/* Validation Checks Record */}
                    {selectedFinding.validation.checks_run.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
                        <span className="font-bold font-mono text-vt-deep-navy block">Checks Executed:</span>
                        {selectedFinding.validation.checks_run.map((chk, i) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-gray-200 last:border-none">
                            <span className="flex items-center gap-2">
                              {chk.passed ? (
                                <CheckCircle2 size={13} className="text-vt-green" />
                              ) : (
                                <AlertTriangle size={13} className="text-vt-amber" />
                              )}
                              {chk.check_name}
                            </span>
                            <span className="mono text-[10px] text-vt-muted">{chk.duration_seconds}s</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Human in the loop review decision */}
                  <div className="pt-4 border-t border-vt-border space-y-3 bg-vt-tint/20 -mx-6 -mb-6 p-6 rounded-b-12">
                    <div className="flex items-center justify-between">
                      <h4 className="font-heading font-bold text-sm text-vt-deep-navy">Human Review Sign-off</h4>
                      {selectedFinding.human_review && (
                        <span className="text-xs font-mono font-bold text-vt-navy bg-white px-2 py-0.5 rounded border border-vt-navy">
                          Decision: {selectedFinding.human_review.decision.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-vt-muted">
                      VulnTrace keeps a human in the loop. Review the reachability evidence and validation logs before approving changes.
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Reviewer notes (optional)..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-vt-border rounded-lg outline-none focus:border-vt-navy"
                      />
                      <button
                        onClick={() => handleReview('accept')}
                        className="bg-vt-green hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg"
                      >
                        Accept Patch
                      </button>
                      <button
                        onClick={() => handleReview('reject')}
                        className="bg-vt-red hover:bg-rose-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReview('needs_more_info')}
                        className="btn-secondary text-xs"
                      >
                        Needs Info
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="vt-card text-center py-20 text-vt-muted">
                Select a finding from the ledger to inspect evidence.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
