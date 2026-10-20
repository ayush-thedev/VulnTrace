import React, { useState, useEffect } from 'react';
import { Pill } from '../common/Pill';
import { ScanItem } from '../../types';

const INITIAL_SCANS: ScanItem[] = [
  { id: 'SCAN-2290', repository: 'api-gateway', type: 'FULL', findings: 12, status: { label: 'Completed', variant: 'ok' }, duration: '14m 32s' },
  { id: 'SCAN-2289', repository: 'checkout-service', type: 'INCREMENTAL', findings: 3, status: { label: 'Completed', variant: 'ok' }, duration: '6m 04s' },
  { id: 'SCAN-2288', repository: 'legacy-auth', type: 'FULL', findings: '—', status: { label: 'Failed · Retry', variant: 'bad' }, duration: '2m 11s' },
  { id: 'SCAN-2287', repository: 'billing-worker', type: 'FULL', findings: '—', status: { label: 'Cancelled', variant: 'mut' }, duration: '—' },
  { id: 'SCAN-2286', repository: 'api-gateway', type: 'DIFF', findings: 0, status: { label: 'Completed', variant: 'ok' }, duration: '4m 47s' },
];

export const ScansView: React.FC = () => {
  const [progress, setProgress] = useState(68);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showNewScanModal, setShowNewScanModal] = useState(false);
  const [scans, setScans] = useState<ScanItem[]>(INITIAL_SCANS);
  const [scanType, setScanType] = useState('FULL');
  const [selectedRepo, setSelectedRepo] = useState('api-gateway');

  // Subtle live progress increment
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 68;
        return prev + 1;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    const newScanId = `SCAN-${Math.floor(2292 + Math.random() * 50)}`;
    const newScan: ScanItem = {
      id: newScanId,
      repository: selectedRepo,
      type: scanType,
      findings: 'Running',
      status: { label: 'In Progress', variant: 'run' },
      duration: '0m 10s'
    };
    setScans([newScan, ...scans]);
    setShowNewScanModal(false);
  };

  return (
    <div className="view-body">
      <div className="view-heading">
        <div>
          <h2>Scans</h2>
          <span className="view-sub">Execution &amp; live progress · history &amp; audit trail</span>
        </div>
        <div className="vt-actions">
          <button 
            className="btn-secondary mono"
            onClick={() => setShowConfigModal(true)}
          >
            SCAN CONFIGURATION
          </button>
          <button 
            className="btn-primary mono"
            onClick={() => setShowNewScanModal(true)}
          >
            NEW SCAN
          </button>
        </div>
      </div>

      {/* Live Scan Card */}
      <div className="vt-card mt-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="vt-card-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-dot" />
            <span>Scan In Progress · SCAN-2291 · api-gateway</span>
          </div>
          <span className="mono" style={{ fontSize: '10px', color: '#55555E' }}>ETA 3 MIN</span>
        </div>
        <div className="progress-line">
          <div className="bar-track">
            <div 
              className="bar-fill" 
              style={{ 
                width: `${progress}%`, 
                background: 'linear-gradient(90deg, #5C7CFA, #7A9BFF)' 
              }} 
            />
          </div>
          <span className="bar-count">{progress}%</span>
        </div>
        <div className="vt-note">
          Stage 4 of 5 · Tracing execution paths through 214 modules · collecting code-level evidence · inconclusive paths flagged.
        </div>
      </div>

      {/* History Card */}
      <div className="vt-card mt-4 overflow-x-auto">
        <div className="vt-card-label mb-2">History &amp; Audit Trail</div>
        <table className="vt-table">
          <thead>
            <tr>
              <th>Scan ID</th>
              <th>Repository</th>
              <th>Type</th>
              <th>Findings</th>
              <th>Status</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="font-mono text-white font-medium">{scan.id}</td>
                <td>{scan.repository}</td>
                <td>{scan.type}</td>
                <td>{scan.findings}</td>
                <td>
                  <Pill variant={scan.status.variant}>
                    {scan.status.label}
                  </Pill>
                </td>
                <td>{scan.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Scan Modal */}
      {showNewScanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[#26262E] w-full max-w-md rounded-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-lg font-semibold text-white">Execute Security Scan</h3>
              <button onClick={() => setShowNewScanModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleStartScan}>
              <div className="mb-4">
                <label className="mono text-[10px] text-[#888888] block mb-2">Target Repository</label>
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full bg-[#141419] border border-[#2A2A33] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4655] rounded"
                >
                  <option value="api-gateway">api-gateway</option>
                  <option value="checkout-service">checkout-service</option>
                  <option value="billing-worker">billing-worker</option>
                  <option value="legacy-auth">legacy-auth</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="mono text-[10px] text-[#888888] block mb-2">Scan Depth</label>
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value)}
                  className="w-full bg-[#141419] border border-[#2A2A33] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4655] rounded"
                >
                  <option value="FULL">FULL (Deep AST + Reachability)</option>
                  <option value="INCREMENTAL">INCREMENTAL (Delta commits)</option>
                  <option value="DIFF">DIFF (PR branch analysis)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewScanModal(false)} className="btn-secondary mono">CANCEL</button>
                <button type="submit" className="btn-primary mono">QUEUE SCAN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[#26262E] w-full max-w-md rounded-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-lg font-semibold text-white">Scan Engine Parameters</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-4 text-xs font-mono text-[#8B8B96]">
              <div className="flex justify-between border-b border-[#1C1C22] pb-2">
                <span>CONCURRENCY_WORKERS:</span>
                <span className="text-white">16</span>
              </div>
              <div className="flex justify-between border-b border-[#1C1C22] pb-2">
                <span>AST_REACHABILITY_SOLVER:</span>
                <span className="text-[#00FF41]">Z3_SYMBOLIC_ENGINE</span>
              </div>
              <div className="flex justify-between border-b border-[#1C1C22] pb-2">
                <span>TIMEOUT_PER_MODULE:</span>
                <span className="text-white">120s</span>
              </div>
              <div className="flex justify-between border-b border-[#1C1C22] pb-2">
                <span>EVIDENCE_ARTIFACT_RETENTION:</span>
                <span className="text-white">90 DAYS</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowConfigModal(false)} className="btn-primary mono">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
