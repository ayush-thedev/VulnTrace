import React, { useState, useEffect } from 'react';
import { Finding } from '../../types/api';
import { api } from '../../services/api';
import { ShieldCheck } from 'lucide-react';

export const RemediationView: React.FC = () => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    loadFindings();
  }, []);

  const loadFindings = async () => {
    try {
      const scans = await api.listScans();
      if (scans.length > 0) {
        const res = await api.getScanFindings(scans[scans.length - 1].id);
        setFindings(res);
        if (res.length > 0) setSelectedFinding(res[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReview = async (decision: 'accept' | 'reject' | 'needs_more_info') => {
    if (!selectedFinding) return;
    try {
      const updated = await api.recordHumanReview(selectedFinding.id, decision, notes);
      setSelectedFinding(updated);
      setFindings(prev => prev.map(f => f.id === updated.id ? updated : f));
      setNotification(`Review recorded: ${decision.toUpperCase()}`);
      setNotes('');
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

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
            <span className="text-xs font-bold uppercase tracking-wider text-vt-navy font-mono">Assisted Remediation</span>
            <span className="text-vt-muted">✱</span>
            <span className="badge-ai">Remediation Agent + Sandbox Validation</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-vt-deep-navy">
            Patch &amp; Remediation Review
          </h1>
          <p className="text-sm text-vt-muted mt-1 max-w-xl">
            Proposed dependency bumps validated through controlled test execution. Retains human review before any change is applied.
          </p>
        </div>
      </div>

      {/* Non-Claim Notice (PRD §3, §17) */}
      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-vt-muted flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-vt-navy mt-0.5" />
        <div>
          <strong className="text-vt-deep-navy font-semibold">Honest Scope Notice (PRD §3 &amp; §17):</strong> Automated Pull Request generation is explicitly out of scope. VulnTrace AI generates reviewable unified diffs and validates them in an isolated sandbox, leaving commit and merge actions to human engineers.
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Proposals List (Left) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold uppercase font-mono text-vt-muted">
            Pending Remediation Proposals ({findings.length})
          </h2>
          {findings.map((f) => (
            <div
              key={f.id}
              onClick={() => setSelectedFinding(f)}
              className={`vt-card cursor-pointer p-4 transition-all ${
                selectedFinding?.id === f.id
                  ? 'border-vt-navy bg-vt-tint/30 shadow-md ring-1 ring-vt-navy'
                  : 'hover:border-vt-navy/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-vt-deep-navy">
                  {f.vulnerability.package_name}
                </span>
                <span className="mono text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  {f.remediation.original_version} → {f.remediation.target_version}
                </span>
              </div>
              <div className="text-xs text-vt-ink font-heading line-clamp-1 mb-2">
                {f.vulnerability.summary}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-vt-border/60">
                <span className="mono text-vt-muted">Status: {f.remediation.status}</span>
                {f.human_review ? (
                  <span className="font-mono font-bold text-vt-navy uppercase text-[10px]">
                    ✓ {f.human_review.decision}
                  </span>
                ) : (
                  <span className="text-[10px] text-vt-amber font-mono">Awaiting Review</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Diff & Review Inspector (Right) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedFinding ? (
            <div className="vt-card space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="mono text-xs text-vt-muted">Target: {selectedFinding.remediation.target_file}</span>
                  <h3 className="font-heading font-bold text-xl text-vt-deep-navy mt-1">
                    Upgrade {selectedFinding.vulnerability.package_name} ({selectedFinding.remediation.original_version} → {selectedFinding.remediation.target_version})
                  </h3>
                </div>
                <span className="badge-evidence text-xs">
                  {selectedFinding.vulnerability.id}
                </span>
              </div>

              {/* Unified Diff */}
              <div className="space-y-1.5">
                <span className="mono text-xs font-bold text-vt-muted uppercase block">
                  Generated Unified Diff
                </span>
                <div className="bg-[#1A1A2E] text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                  <pre>{selectedFinding.remediation.diff || 'No diff available.'}</pre>
                </div>
              </div>

              {/* Rationale */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                <strong className="text-vt-deep-navy block font-mono">Remediation Rationale:</strong>
                <p className="text-vt-muted leading-relaxed">{selectedFinding.remediation.rationale}</p>
              </div>

              {/* Human Decision Box */}
              <div className="pt-4 border-t border-vt-border space-y-3">
                <h4 className="font-heading font-bold text-sm text-vt-deep-navy">
                  Human Review &amp; Sign-off
                </h4>
                {selectedFinding.human_review && (
                  <div className="p-3 bg-vt-tint/50 border border-vt-navy rounded-lg text-xs space-y-1">
                    <div className="font-mono font-bold text-vt-deep-navy">
                      Current Decision: {selectedFinding.human_review.decision.toUpperCase()}
                    </div>
                    {selectedFinding.human_review.reviewer_notes && (
                      <div className="text-vt-muted">
                        Notes: {selectedFinding.human_review.reviewer_notes}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Review notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-vt-border rounded-lg outline-none focus:border-vt-navy"
                  />
                  <button
                    onClick={() => handleReview('accept')}
                    className="bg-vt-green hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview('reject')}
                    className="bg-vt-red hover:bg-rose-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleReview('needs_more_info')}
                    className="btn-secondary text-xs"
                  >
                    Need Info
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="vt-card text-center py-20 text-vt-muted">
              Select a remediation proposal to review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
