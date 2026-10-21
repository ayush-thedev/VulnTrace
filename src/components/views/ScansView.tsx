import React, { useState, useEffect, useRef } from 'react';
import { ScanResponse, Repository, Finding } from '../../types/api';
import { api } from '../../services/api';
import { Button, Input, Badge, ProgressBar, Stepper, StepItem } from '../shared';
import { useToast } from '../shared/Toast';
import { useAppRouter } from '../../services/router';
import { Play, XCircle, RefreshCw, Clock, ExternalLink } from 'lucide-react';

interface ScansViewProps {
  initialScanId?: string;
  onNavigateToFindings?: (scanId: string) => void;
}

export const ScansView: React.FC<ScansViewProps> = ({
  initialScanId,
  onNavigateToFindings,
}) => {
  const { navigate } = useAppRouter();
  const { showToast } = useToast();
  const [scans, setScans] = useState<ScanResponse[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [activeScan, setActiveScan] = useState<ScanResponse | null>(null);
  const [repoInput, setRepoInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [percent, setPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to scan');
  const [counters, setCounters] = useState<{ packages?: number; files?: number; findings?: number }>({});
  const [streamedFindings, setStreamedFindings] = useState<Finding[]>([]);
  const [eta, setEta] = useState<string>('about 45s left');
  const [scanJustCompleted, setScanJustCompleted] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const goToFindings = (targetScanId: string) => {
    if (onNavigateToFindings) {
      onNavigateToFindings(targetScanId);
    } else {
      navigate(`/scans/${targetScanId}/findings`);
    }
  };

  useEffect(() => {
    loadInitialData();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const [scansData, reposData] = await Promise.all([
        api.listScans().catch(() => []),
        api.listRepositories().catch(() => []),
      ]);
      setScans(scansData);
      setRepos(reposData);

      if (initialScanId) {
        const found = scansData.find((s) => s.id === initialScanId);
        if (found) {
          selectScan(found);
          return;
        }
      }
      if (scansData.length > 0) {
        selectScan(scansData[scansData.length - 1]);
      }
    } catch {}
  };

  const selectScan = async (scan: ScanResponse) => {
    setActiveScan(scan);
    if (scan.status === 'completed') {
      setPercent(100);
      setStatusMessage('Scan complete');
      const f = await api.getScanFindings(scan.id).catch(() => []);
      setStreamedFindings(f);
    } else if (scan.status === 'running') {
      startSSEStream(scan.id);
    }
  };

  const startSSEStream = (scanId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const streamUrl = api.getScanStreamUrl(scanId);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.percent !== undefined) setPercent(data.percent);
        if (data.message) setStatusMessage(data.message);
        if (data.counters) setCounters(data.counters);

        // Update ETA estimation
        if (data.percent > 0 && data.percent < 100) {
          const remainingSecs = Math.max(5, Math.round(((100 - data.percent) / data.percent) * 30));
          setEta(`about ${remainingSecs}s left`);
        }

        if (data.new_finding) {
          setStreamedFindings((prev) => [...prev, data.new_finding]);
        }

        if (data.done || data.percent >= 100) {
          es.close();
          setScanJustCompleted(true);
          showToast('Scan complete', 'success');
          // Update active scan status
          api.getScan(scanId).then((sc) => {
            setActiveScan(sc);
            setScans((prev) => prev.map((item) => (item.id === sc.id ? sc : item)));
          }).catch(() => {});

          // Fetch findings
          api.getScanFindings(scanId).then((f) => {
            setStreamedFindings(f);
          }).catch(() => {});

          // Auto-redirect after 1.5s per Section 3
          setTimeout(() => {
            goToFindings(scanId);
          }, 1500);
        }
      } catch {}
    };

    es.onerror = () => {
      // Fallback polling if SSE drops
      api.getScan(scanId).then((sc) => {
        if (sc.status !== 'running') {
          es.close();
          setActiveScan(sc);
          if (sc.status === 'completed') {
            api.getScanFindings(scanId).then(setStreamedFindings).catch(() => {});
          }
        }
      }).catch(() => {});
    };
  };

  const handleStartScan = async (path: string) => {
    if (!path.trim()) return;
    setScanning(true);
    setStreamedFindings([]);
    setPercent(5);
    setStatusMessage('Initiating scan...');
    try {
      const newScan = await api.createScan(path.trim());
      setActiveScan(newScan);
      setScans((prev) => [newScan, ...prev]);
      showToast(`Scan ${newScan.id} started`, 'info');
      startSSEStream(newScan.id);
    } catch (err: any) {
      showToast(err.message || 'Scan initiation failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleCancel = async () => {
    if (!activeScan) return;
    setCancelling(true);
    try {
      await api.cancelScan(activeScan.id);
      if (eventSourceRef.current) eventSourceRef.current.close();
      setActiveScan((prev) => prev ? { ...prev, status: 'cancelled' } : null);
      showToast(`Scan ${activeScan.id} cancelled`, 'info');
    } catch (err: any) {
      showToast(`Cancel failed: ${err.message}`, 'error');
    } finally {
      setCancelling(false);
    }
  };

  // Build Stepper steps
  const stepperSteps: StepItem[] = (activeScan?.stage_progress || []).map((stg) => {
    let sStatus: StepItem['status'] = 'waiting';
    if (stg.status === 'completed') sStatus = 'done';
    else if (stg.status === 'in_progress') sStatus = 'running';
    else if (stg.status === 'failed') sStatus = 'failed';

    return {
      id: stg.stage_id,
      label: stg.name,
      status: sStatus,
      detail: stg.detail || undefined,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0 }}>Scans</h1>
          <p style={{ marginTop: '4px', margin: 0 }}>
            Deterministic AST &amp; call-graph intelligence with multi-agent triage
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={loadInitialData}>
          Refresh
        </Button>
      </div>

      {/* Start Scan Card */}
      <div className="vt-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0 }}>Start Reachability Scan</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Select a connected repository or paste any GitHub URL to execute shallow cloning &amp; reachability triage.
        </p>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {repos.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setRepoInput(e.target.value);
              }}
              style={{
                height: '36px',
                padding: '0 12px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="">Choose saved repo...</option>
              {repos.map((r) => (
                <option key={r.id} value={r.url}>
                  {r.owner}/{r.name}
                </option>
              ))}
            </select>
          )}

          <div style={{ flex: 1 }}>
            <Input
              placeholder="e.g. https://github.com/owner/repo or demo-fixture"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartScan(repoInput);
              }}
            />
          </div>

          <Button
            variant="primary"
            icon={<Play size={14} />}
            loading={scanning}
            onClick={() => handleStartScan(repoInput || 'demo-fixture')}
          >
            Start Scan
          </Button>

          <button
            type="button"
            onClick={() => {
              setRepoInput('demo-fixture');
              handleStartScan('demo-fixture');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline',
              whiteSpace: 'nowrap',
            }}
          >
            Try the demo
          </button>
        </div>
      </div>

      {/* Active Scan Live Monitor */}
      {activeScan && (
        <div className="vt-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 500, color: 'var(--accent)' }}>
                {activeScan.id}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {activeScan.repo_path}
              </span>
              <Badge variant={activeScan.status === 'completed' ? 'verified' : activeScan.status === 'running' ? 'accent' : 'default'}>
                {activeScan.status.toUpperCase()}
              </Badge>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeScan.status === 'running' && (
                <Button variant="danger" size="sm" icon={<XCircle size={12} />} loading={cancelling} onClick={handleCancel}>
                  Cancel scan
                </Button>
              )}
              {activeScan.status === 'completed' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ExternalLink size={12} />}
                  onClick={() => goToFindings(activeScan.id)}
                >
                  View results ({activeScan.findings_count})
                </Button>
              )}
            </div>
          </div>

          {/* Big Percent & Thin Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {percent}%
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {statusMessage}
                </span>
              </div>
              {activeScan.status === 'running' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{eta}</span>
                </div>
              )}
            </div>

            <ProgressBar percent={percent} height={4} />

            {/* Live Counters */}
            <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {counters.packages !== undefined && (
                <span><strong>{counters.packages}</strong> dependencies indexed</span>
              )}
              {counters.files !== undefined && (
                <span><strong>{counters.files}</strong> files analyzed</span>
              )}
              <span><strong>{counters.findings || activeScan.findings_count}</strong> findings discovered</span>
            </div>
          </div>

          {/* Stepper (Horizontal) */}
          {stepperSteps.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <Stepper steps={stepperSteps} />
            </div>
          )}

          {/* Streamed Findings List */}
          {streamedFindings.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Streamed Findings ({streamedFindings.length})
              </div>
              {streamedFindings.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--bg-surface)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {f.vulnerability.package_name}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{f.vulnerability.id}</span>
                  </div>
                  <Badge variant={f.reachability.verdict === 'reachable' ? 'fix-now' : f.reachability.verdict === 'uncertain' ? 'fix-soon' : 'monitor'}>
                    {f.reachability.verdict.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Completion Banner */}
          {scanJustCompleted && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--semantic-green-light)',
                border: '1px solid var(--semantic-green)',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                color: 'var(--semantic-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Scan complete, {activeScan?.findings_count ?? streamedFindings.length} findings produced. View in Findings tab
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => activeScan && goToFindings(activeScan.id)}
              >
                View results
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Historical Scans Table */}
      <div className="vt-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Scan Log ({scans.length})</h3>
        </div>
        {scans.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No scans executed yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '12px' }}>Scan ID</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '12px' }}>Target</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '12px' }}>Findings</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '12px' }}>Created</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '12px' }}>Status</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToFindings(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goToFindings(s.id);
                    }
                  }}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    backgroundColor: activeScan?.id === s.id ? 'var(--bg-surface)' : 'transparent',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = activeScan?.id === s.id ? 'var(--bg-surface)' : 'transparent')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 500 }}>
                    {s.id}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{s.repo_path}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.findings_count}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant={s.status === 'completed' ? 'verified' : s.status === 'running' ? 'accent' : 'default'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={12} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToFindings(s.id);
                      }}
                    >
                      View results
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
