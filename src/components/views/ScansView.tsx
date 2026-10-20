import React, { useState, useEffect } from 'react';
import { ScanResponse } from '../../types/api';
import { api } from '../../services/api';
import { Play, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const ScansView: React.FC = () => {
  const [scans, setScans] = useState<ScanResponse[]>([]);
  const [repoPath, setRepoPath] = useState('backend/tests/fixtures/sample_repo');
  const [scanning, setScanning] = useState(false);
  const [activeScan, setActiveScan] = useState<ScanResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    try {
      const data = await api.listScans();
      setScans(data);
      if (data.length > 0) {
        setActiveScan(data[data.length - 1]);
      }
    } catch (err: any) {
      console.error('Failed to load scans:', err);
    }
  };

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanning(true);
    setErrorMsg(null);
    try {
      const newScan = await api.createScan(repoPath);
      setActiveScan(newScan);
      await loadScans();
    } catch (err: any) {
      setErrorMsg(err.message || 'Scan initiation failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-vt-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-vt-navy font-mono">Scan Orchestration</span>
            <span className="text-vt-muted">✱</span>
            <span className="badge-evidence">7-Stage Pipeline</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-vt-deep-navy">
            Repository Scans
          </h1>
          <p className="text-sm text-vt-muted mt-1 max-w-xl">
            Deterministic code intelligence paired with Groq-hosted multi-agent reachability triage.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-vt-red-light border border-vt-red text-vt-red rounded-lg text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Start Scan Form */}
      <div className="vt-card space-y-4">
        <h2 className="font-heading font-bold text-lg text-vt-deep-navy">
          Initiate Reachability Scan
        </h2>
        <form onSubmit={handleStartScan} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="Target repository path (e.g. backend/tests/fixtures/sample_repo)"
            className="flex-1 px-4 py-2 border border-vt-border rounded-lg text-sm font-mono focus:border-vt-navy outline-none"
            required
          />
          <button
            type="submit"
            disabled={scanning}
            className="btn-primary whitespace-nowrap"
          >
            <Play size={14} />
            {scanning ? 'Executing Pipeline...' : 'Start 7-Stage Scan'}
          </button>
        </form>
      </div>

      {/* Active Scan Stage Progress (PRD §5) */}
      {activeScan && (
        <div className="vt-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="mono text-xs text-vt-muted uppercase">Active Pipeline Run</span>
              <h3 className="font-heading font-bold text-base text-vt-deep-navy">
                {activeScan.id} · {activeScan.repo_path}
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
              activeScan.status === 'completed' ? 'badge-validated' : 'badge-uncertain'
            }`}>
              {activeScan.status.toUpperCase()}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase font-mono text-vt-muted">
              Workflow Stages (PRD §5)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeScan.stage_progress.map((stg) => (
                <div
                  key={stg.stage_id}
                  className="p-3 border border-vt-border rounded-lg bg-gray-50 flex items-start gap-3"
                >
                  <div className="mt-0.5">
                    {stg.status === 'completed' ? (
                      <CheckCircle2 size={16} className="text-vt-green" />
                    ) : stg.status === 'in_progress' ? (
                      <Clock size={16} className="text-vt-amber animate-spin" />
                    ) : (
                      <AlertCircle size={16} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-vt-ink">
                        {stg.stage_id}. {stg.name}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        stg.nature === 'Deterministic' ? 'badge-evidence' : 'badge-ai'
                      }`}>
                        {stg.nature}
                      </span>
                    </div>
                    {stg.detail && (
                      <p className="text-[11px] text-vt-muted mt-1 font-mono">
                        {stg.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scans History Table */}
      <div className="vt-card space-y-4">
        <h3 className="font-heading font-bold text-base text-vt-deep-navy">
          Scan History
        </h3>
        {scans.length === 0 ? (
          <p className="text-sm text-vt-muted py-4 text-center">No scans recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-vt-border text-vt-muted font-mono uppercase">
                <tr>
                  <th className="py-2.5 px-3">Scan ID</th>
                  <th className="py-2.5 px-3">Repository</th>
                  <th className="py-2.5 px-3">Findings</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scans.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setActiveScan(s)}
                    className="hover:bg-vt-tint/20 cursor-pointer"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-vt-navy">{s.id}</td>
                    <td className="py-3 px-3 text-vt-ink font-mono">{s.repo_path}</td>
                    <td className="py-3 px-3 font-bold">{s.findings_count} findings</td>
                    <td className="py-3 px-3">
                      <span className={s.status === 'completed' ? 'badge-validated' : 'badge-uncertain'}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-vt-muted">{new Date(s.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
