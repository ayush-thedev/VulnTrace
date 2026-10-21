import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Finding, GraphData, ScanResponse } from '../../types/api';
import { api } from '../../services/api';
import { useAppRouter } from '../../services/router';
import { PathFlowGraph } from '../common/PathFlowGraph';
import {
  Button,
  Input,
  Badge,
  Tabs,
  Modal,
  Tooltip,
  CodeBlock,
  DiffViewer,
  Skeleton,
  EmptyState,
} from '../shared';
import { useToast } from '../shared/Toast';
import {
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Terminal,
  Activity,
  Sparkles,
} from 'lucide-react';

interface FindingsViewProps {
  initialScanId?: string;
  initialFindingId?: string;
  initialTab?: string;
}

export const FindingsView: React.FC<FindingsViewProps> = ({
  initialScanId,
  initialFindingId,
  initialTab,
}) => {
  const { route, navigate } = useAppRouter();
  const { showToast } = useToast();

  const scanIdFromUrl = initialScanId || route.params.scanId;
  const findingIdFromUrl = initialFindingId || route.params.findingId;
  const activeTabFromUrl = initialTab || route.params.tab || 'summary';

  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [allScans, setAllScans] = useState<ScanResponse[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View modes
  const [groupByPackage, setGroupByPackage] = useState(true);
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});

  // Filter states
  const [searchQuery, setSearchQuery] = useState(route.searchParams.get('q') || '');
  const [verdictFilter, setVerdictFilter] = useState<string>(route.searchParams.get('verdict') || 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>(route.searchParams.get('priority') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(route.searchParams.get('status') || 'all');
  const [depTypeFilter, setDepTypeFilter] = useState<string>(route.searchParams.get('deptype') || 'all');

  // Detail panel tab
  const [detailTab, setDetailTab] = useState<string>(activeTabFromUrl);

  // Bulk selection
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  // Dismiss modal
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('Not reachable in runtime');
  const [dismissNote, setDismissNote] = useState('');
  const [targetDismissId, setTargetDismissId] = useState<string | null>(null);

  // Proof test state
  const [proofTesting, setProofTesting] = useState(false);
  const [proofTestResult, setProofTestResult] = useState<{
    status: string;
    result: string;
    logs: string;
    test_code?: string;
  } | null>(null);

  // Human review state
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Show details toggle in Summary tab
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Clear state when scanId changes
  useEffect(() => {
    setSelectedFinding(null);
    setGraphData(null);
  }, [scanIdFromUrl]);

  // Load findings
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      api.listScans().then(setAllScans).catch(() => {});
      let activeScan: ScanResponse | null = null;
      if (scanIdFromUrl) {
        try {
          activeScan = await api.getScan(scanIdFromUrl);
        } catch {
          const scans = await api.listScans().catch(() => []);
          setAllScans(scans);
          if (scans.length > 0) {
            activeScan = scans[scans.length - 1];
            navigate(`/scans/${activeScan.id}/findings`);
          } else {
            setScan(null);
            setFindings([]);
            setLoading(false);
            return;
          }
        }
      } else {
        const scans = await api.listScans();
        setAllScans(scans);
        if (scans.length > 0) {
          activeScan = scans[scans.length - 1];
        }
      }

      if (!activeScan) {
        setFindings([]);
        setLoading(false);
        return;
      }

      setScan(activeScan);
      const list = await api.getScanFindings(activeScan.id);
      setFindings(list);

      // Select finding
      if (findingIdFromUrl) {
        const found = list.find((f) => f.id === findingIdFromUrl);
        if (found) {
          selectFinding(found, false, activeScan.id);
        } else if (list.length > 0) {
          selectFinding(list[0], false, activeScan.id);
        }
      } else if (list.length > 0) {
        selectFinding(list[0], false, activeScan.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load findings');
    } finally {
      setLoading(false);
    }
  }, [scanIdFromUrl, findingIdFromUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectFinding = async (finding: Finding, updateUrl: boolean = true, explicitScanId?: string) => {
    setSelectedFinding(finding);
    setProofTestResult(null);
    setReviewNote('');
    const targetScanId = explicitScanId || scan?.id || scanIdFromUrl;
    if (updateUrl) {
      if (targetScanId) {
        navigate(`/scans/${targetScanId}/findings/${finding.id}`);
      } else {
        navigate(`/findings/${finding.id}`);
      }
    }
    try {
      const g = await api.getFindingGraph(finding.id);
      setGraphData(g);
    } catch {
      setGraphData({ nodes: [], edges: [] });
    }
  };

  // Keyboard navigation (j/k, esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'j') {
        // Next finding
        navigateFinding(1);
      } else if (e.key === 'k') {
        // Prev finding
        navigateFinding(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [findings, selectedFinding]);

  const navigateFinding = (delta: number) => {
    if (!selectedFinding || findings.length === 0) return;
    const currentIndex = findings.findIndex((f) => f.id === selectedFinding.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + delta + findings.length) % findings.length;
    selectFinding(findings[nextIndex]);
  };

  // Clickable counts
  const counts = useMemo(() => {
    let confirmed = 0;
    let inconclusive = 0;
    let notObserved = 0;
    findings.forEach((f) => {
      if (f.reachability.verdict === 'reachable') confirmed++;
      else if (f.reachability.verdict === 'uncertain') inconclusive++;
      else notObserved++;
    });
    return { confirmed, inconclusive, notObserved };
  }, [findings]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pkgMatch = f.vulnerability.package_name.toLowerCase().includes(q);
        const cveMatch = f.vulnerability.id.toLowerCase().includes(q);
        const aliasMatch = f.vulnerability.aliases?.some((a) => a.toLowerCase().includes(q));
        const fileMatch = f.remediation?.target_file?.toLowerCase().includes(q);
        if (!pkgMatch && !cveMatch && !aliasMatch && !fileMatch) return false;
      }
      // Verdict filter
      if (verdictFilter !== 'all') {
        if (verdictFilter === 'reachable' && f.reachability.verdict !== 'reachable') return false;
        if (verdictFilter === 'uncertain' && f.reachability.verdict !== 'uncertain') return false;
        if (verdictFilter === 'not_reachable' && f.reachability.verdict !== 'not_reachable') return false;
      }
      // Priority filter
      if (priorityFilter !== 'all') {
        if (f.priority.band !== priorityFilter) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const isDismissed = f.human_review?.decision === 'reject';
        const isFixed = f.validation?.status === 'validated';
        const isInProgress = f.remediation?.status === 'proposed' && !isDismissed && !isFixed;
        if (statusFilter === 'dismissed' && !isDismissed) return false;
        if (statusFilter === 'fixed' && !isFixed) return false;
        if (statusFilter === 'in_progress' && !isInProgress) return false;
        if (statusFilter === 'open' && (isDismissed || isFixed)) return false;
      }
      // Dep type filter (prod vs dev)
      if (depTypeFilter !== 'all') {
        const isDev = f.vulnerability.package_name.includes('pytest') || f.vulnerability.package_name.includes('test');
        if (depTypeFilter === 'dev' && !isDev) return false;
        if (depTypeFilter === 'prod' && isDev) return false;
      }
      return true;
    }).sort((a, b) => {
      // Priority ranking: Fix now > Schedule fix > Human review > Monitor
      const priorityOrder: Record<string, number> = {
        'Fix now': 4,
        'Schedule fix': 3,
        'Human review': 2,
        'Monitor': 1,
      };
      const pDiff = (priorityOrder[b.priority.band] || 0) - (priorityOrder[a.priority.band] || 0);
      if (pDiff !== 0) return pDiff;

      // Dev-only dependencies ranked lower
      const aIsDev = a.vulnerability.package_name.includes('pytest') || a.vulnerability.package_name.includes('test');
      const bIsDev = b.vulnerability.package_name.includes('pytest') || b.vulnerability.package_name.includes('test');
      if (aIsDev && !bIsDev) return 1;
      if (!aIsDev && bIsDev) return -1;

      return 0;
    });
  }, [findings, searchQuery, verdictFilter, priorityFilter, statusFilter, depTypeFilter]);

  // Grouped by package
  const packageGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        package_name: string;
        findings: Finding[];
        topVerdict: string;
        fixVersion: string;
      }
    > = {};

    filteredFindings.forEach((f) => {
      const pkg = f.vulnerability.package_name;
      if (!groups[pkg]) {
        groups[pkg] = {
          package_name: pkg,
          findings: [],
          topVerdict: f.reachability.verdict,
          fixVersion: f.remediation?.target_version || f.vulnerability.fixed_versions?.[0] || 'upgrade',
        };
      }
      groups[pkg].findings.push(f);
      // Upgrade verdict to reachable if any is reachable
      if (f.reachability.verdict === 'reachable') {
        groups[pkg].topVerdict = 'reachable';
      }
    });

    return Object.values(groups);
  }, [filteredFindings]);

  // Bulk dismissal handler
  const handleConfirmDismiss = async () => {
    const targets = targetDismissId ? [targetDismissId] : Array.from(selectedFindingIds);
    if (targets.length === 0) return;

    try {
      for (const id of targets) {
        await api.dismissFinding(id, dismissReason, dismissNote);
      }
      showToast(`Dismissed ${targets.length} finding${targets.length > 1 ? 's' : ''}`, 'info');
      setDismissModalOpen(false);
      setDismissNote('');
      setSelectedFindingIds(new Set());
      setTargetDismissId(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to dismiss', 'error');
    }
  };

  // Proof test runner
  const handleRunProofTest = async () => {
    if (!selectedFinding) return;
    setProofTesting(true);
    try {
      const res = await api.runProofTest(selectedFinding.id);
      setProofTestResult(res);
      showToast(`Proof test completed: ${res.result}`, res.result === 'reproduced' ? 'error' : 'info');
    } catch (err: any) {
      showToast(err.message || 'Proof test failed', 'error');
    } finally {
      setProofTesting(false);
    }
  };

  // Human review handler
  const handleReview = async (decision: 'accept' | 'reject' | 'needs_more_info') => {
    if (!selectedFinding) return;
    if (decision === 'reject' && !reviewNote.trim()) {
      showToast('A note is required when rejecting a remediation proposal.', 'error');
      return;
    }
    setReviewing(true);
    try {
      const updated = await api.recordHumanReview(selectedFinding.id, decision, reviewNote);
      setSelectedFinding(updated);
      setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      showToast(`Review recorded: ${decision.toUpperCase()}`, 'info');
      setReviewNote('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record review', 'error');
    } finally {
      setReviewing(false);
    }
  };

  // Export handlers
  const handleExportFinding = async (format: 'json' | 'sarif' | 'markdown' | 'csv') => {
    if (!selectedFinding) return;
    try {
      const content = await api.exportFinding(selectedFinding.id, format);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vulntrace-${selectedFinding.id}.${format === 'markdown' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported finding as ${format.toUpperCase()}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    }
  };

  const handleCopyPRDescription = () => {
    if (!selectedFinding) return;
    const desc = `## Summary
Upgrade ${selectedFinding.vulnerability.package_name} from ${selectedFinding.remediation.original_version} to ${selectedFinding.remediation.target_version}.

### Plain Explanation
${selectedFinding.reachability.rationale}

### Attack Path & Evidence
- Vulnerable Function: ${selectedFinding.evidence.vulnerable_function}
- Candidate Paths: ${selectedFinding.evidence.candidate_paths.length}
- Call resolution confidence: ${selectedFinding.reachability.confidence_note}

### Priority Reasoning
- Band: ${selectedFinding.priority.band}
- Rationale: ${selectedFinding.priority.rationale}

### Changes & Validation
- Validation Status: ${selectedFinding.validation.status.toUpperCase()}
- Execution Sandbox: Isolated micro-container (no network, harmless marker payload)
`;
    navigator.clipboard.writeText(desc);
    showToast('Copied PR description to clipboard', 'info');
  };

  const handleDownloadPatch = () => {
    if (!selectedFinding || !selectedFinding.remediation.diff) {
      showToast('No diff patch available', 'error');
      return;
    }
    const blob = new Blob([selectedFinding.remediation.diff], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vulntrace-${selectedFinding.vulnerability.package_name}.patch`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded .patch file', 'info');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
        <Skeleton height="36px" width="400px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <Skeleton height="60px" />
          <Skeleton height="60px" />
          <Skeleton height="60px" />
        </div>
        <Skeleton height="400px" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load findings"
        description={error}
        actionLabel="Retry"
        onAction={loadData}
      />
    );
  }

  if (findings.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {scan && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '12px',
            }}
          >
            {allScans.length > 1 && (
              <select
                value={scan.id || scanIdFromUrl || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(`/scans/${e.target.value}/findings`);
                  }
                }}
                style={{
                  height: '30px',
                  padding: '0 8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '240px',
                }}
                title="Switch repository scan"
              >
                {allScans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}: {s.repo_path || s.repo_url} ({s.findings_count} findings)
                  </option>
                ))}
              </select>
            )}
            <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {scan.repo_url || scan.repo_path || 'Repository'}
            </span>
            <span style={{ color: 'var(--border)' }}>•</span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Scan {scan.id.slice(0, 8)}
            </span>
            {scan.commit_sha && (
              <>
                <span style={{ color: 'var(--border)' }}>•</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  commit {scan.commit_sha.slice(0, 7)}
                </span>
              </>
            )}
            {scan.created_at && (
              <>
                <span style={{ color: 'var(--border)' }}>•</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(scan.created_at).toLocaleString()}
                </span>
              </>
            )}
          </div>
        )}
        <EmptyState
          title={scan ? "No issues found in this scan" : "No scans executed yet"}
          description={
            scan
              ? "No reachable vulnerabilities or advisories were detected for this repository."
              : "Execute a scan from the Scans page or Repositories page to analyze vulnerabilities."
          }
          actionLabel="Go to Scans"
          onAction={() => navigate('/scans')}
        />
      </div>
    );
  }

  const distinctPackagesCount = new Set(findings.map((f) => f.vulnerability.package_name)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar: repo name, scan id, commit short SHA, time, summary line */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {allScans.length > 1 && (
              <select
                value={scan?.id || scanIdFromUrl || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(`/scans/${e.target.value}/findings`);
                  }
                }}
                style={{
                  height: '30px',
                  padding: '0 8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '240px',
                }}
                title="Switch repository scan"
              >
                {allScans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}: {s.repo_path || s.repo_url} ({s.findings_count} findings)
                  </option>
                ))}
              </select>
            )}
            <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {scan?.repo_url || scan?.repo_path || 'Repository'}
            </span>
            <span style={{ color: 'var(--border)' }}>•</span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Scan {scan?.id?.slice(0, 8)}
            </span>
            {scan?.commit_sha && (
              <>
                <span style={{ color: 'var(--border)' }}>•</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  commit {scan.commit_sha.slice(0, 7)}
                </span>
              </>
            )}
            {scan?.created_at && (
              <>
                <span style={{ color: 'var(--border)' }}>•</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(scan.created_at).toLocaleString()}
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant={groupByPackage ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setGroupByPackage(true)}
            >
              Group by Package
            </Button>
            <Button
              variant={!groupByPackage ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setGroupByPackage(false)}
            >
              Flat List
            </Button>
          </div>
        </div>

        {/* Dynamic summary line */}
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {findings.length} alerts
          </strong>{' '}
          →{' '}
          <strong style={{ color: 'var(--accent)', fontWeight: 500 }}>
            {distinctPackagesCount} packages need review
          </strong>
        </div>
      </div>

      {/* Clickable counts row: Confirmed / Inconclusive / Not observed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <button
          type="button"
          onClick={() => setVerdictFilter(verdictFilter === 'reachable' ? 'all' : 'reachable')}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${verdictFilter === 'reachable' ? 'var(--semantic-red)' : 'var(--border)'}`,
            backgroundColor: verdictFilter === 'reachable' ? 'var(--semantic-red-light)' : 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--semantic-red)', fontWeight: 500 }}>
              Confirmed Reachable
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Path connects entry point to vulnerable call
            </div>
          </div>
          <span style={{ fontSize: '24px', fontWeight: 500, color: 'var(--semantic-red)' }}>
            {counts.confirmed}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setVerdictFilter(verdictFilter === 'uncertain' ? 'all' : 'uncertain')}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${verdictFilter === 'uncertain' ? 'var(--semantic-amber)' : 'var(--border)'}`,
            backgroundColor: verdictFilter === 'uncertain' ? 'var(--semantic-amber-light)' : 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--semantic-amber)', fontWeight: 500 }}>
              Inconclusive
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Dynamic calls or unverified static pathways
            </div>
          </div>
          <span style={{ fontSize: '24px', fontWeight: 500, color: 'var(--semantic-amber)' }}>
            {counts.inconclusive}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setVerdictFilter(verdictFilter === 'not_reachable' ? 'all' : 'not_reachable')}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${verdictFilter === 'not_reachable' ? 'var(--semantic-gray)' : 'var(--border)'}`,
            backgroundColor: verdictFilter === 'not_reachable' ? 'var(--semantic-gray-light)' : 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--semantic-gray)', fontWeight: 500 }}>
              Not Observed
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Dormant in manifest; not observed in call graph
            </div>
          </div>
          <span style={{ fontSize: '24px', fontWeight: 500, color: 'var(--semantic-gray)' }}>
            {counts.notObserved}
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search by CVE, package, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: '320px', height: '32px' }}
          />

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              height: '32px',
              padding: '0 8px',
              fontSize: '12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="all">All Priorities</option>
            <option value="Fix now">Fix now</option>
            <option value="Schedule fix">Schedule fix</option>
            <option value="Monitor">Monitor</option>
            <option value="Human review">Human review</option>
          </select>

          <select
            value={depTypeFilter}
            onChange={(e) => setDepTypeFilter(e.target.value)}
            style={{
              height: '32px',
              padding: '0 8px',
              fontSize: '12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="all">All Dependencies</option>
            <option value="prod">Production only</option>
            <option value="dev">Dev-only (muted)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: '32px',
              padding: '0 8px',
              fontSize: '12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="fixed">Fixed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedFindingIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
              {selectedFindingIds.size} selected
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTargetDismissId(null);
                setDismissModalOpen(true);
              }}
            >
              Dismiss
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFindingIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Main Split Layout: Left 60% Findings list & Graph, Right 40% Finding Detail Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'start' }}>
        {/* Left Column: Grouped/Flat Findings List + PathFlowGraph */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Findings Table/Card List */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--bg-primary)',
              overflow: 'hidden',
            }}
          >
            {groupByPackage ? (
              // Grouped by package view
              <div>
                {packageGroups.map((group) => {
                  const isExpanded = expandedPackages[group.package_name] ?? true;
                  const isDev = group.package_name.includes('pytest') || group.package_name.includes('test');

                  return (
                    <div
                      key={group.package_name}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        opacity: isDev ? 0.75 : 1,
                      }}
                    >
                      {/* Package Header Row */}
                      <div
                        onClick={() =>
                          setExpandedPackages((prev) => ({
                            ...prev,
                            [group.package_name]: !isExpanded,
                          }))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-surface)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                            {group.package_name}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>—</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {group.findings.length} advisory{group.findings.length > 1 ? 's' : ''}
                          </span>
                          {isDev && (
                            <Badge variant="default" style={{ fontSize: '10px' }}>
                              dev-dep
                            </Badge>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                            Fix: upgrade to {group.fixVersion}
                          </span>
                          <VerdictBadge verdict={group.topVerdict} />
                        </div>
                      </div>

                      {/* Expanded Sub-findings */}
                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {group.findings.map((f) => (
                            <FindingListRow
                              key={f.id}
                              finding={f}
                              isSelected={selectedFinding?.id === f.id}
                              isChecked={selectedFindingIds.has(f.id)}
                              onSelect={() => selectFinding(f)}
                              onToggleCheck={(e) => {
                                e.stopPropagation();
                                const next = new Set(selectedFindingIds);
                                if (next.has(f.id)) next.delete(f.id);
                                else next.add(f.id);
                                setSelectedFindingIds(next);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Flat List view
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredFindings.map((f) => (
                  <FindingListRow
                    key={f.id}
                    finding={f}
                    isSelected={selectedFinding?.id === f.id}
                    isChecked={selectedFindingIds.has(f.id)}
                    onSelect={() => selectFinding(f)}
                    onToggleCheck={(e) => {
                      e.stopPropagation();
                      const next = new Set(selectedFindingIds);
                      if (next.has(f.id)) next.delete(f.id);
                      else next.add(f.id);
                      setSelectedFindingIds(next);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section 6: Graph Visualization */}
          {selectedFinding && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Reachability Call Graph
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {selectedFinding.vulnerability.package_name} ({selectedFinding.evidence.vulnerable_function})
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Use j/k to navigate findings • Drag/scroll to zoom
                </div>
              </div>

              {graphData ? (
                <PathFlowGraph
                  key={selectedFinding.id}
                  graphData={graphData}
                  unresolvedCalls={selectedFinding.evidence.unresolved_calls}
                  gitHubRepoUrl={scan?.repo_url || (scan?.repo_path?.startsWith('http') ? scan.repo_path : undefined)}
                />
              ) : (
                <div
                  style={{
                    height: '240px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                  }}
                >
                  Loading graph data...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: 40% Finding Detail Panel */}
        {selectedFinding && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--bg-primary)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'sticky',
              top: '16px',
            }}
          >
            {/* Header: Prev/Next finding arrows + Clean Title + Copyable chips */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => navigateFinding(-1)}
                    title="Previous finding (k)"
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateFinding(1)}
                    title="Next finding (j)"
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronRight size={13} />
                  </button>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                    {selectedFinding.id}
                  </span>
                </div>

                {/* Export Dropdown / Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportFinding('markdown')}
                    icon={<Download size={12} />}
                  >
                    MD
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportFinding('sarif')}
                    icon={<Download size={12} />}
                  >
                    SARIF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTargetDismissId(selectedFinding.id);
                      setDismissModalOpen(true);
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>

              {/* Plain Title (never raw CVE as heading) */}
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px' }}>
                {cleanTitle(selectedFinding.vulnerability.summary)}
              </h2>

              {/* Copyable advisory chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span
                  onClick={() => {
                    navigator.clipboard.writeText(selectedFinding.vulnerability.id);
                    showToast(`Copied ${selectedFinding.vulnerability.id}`, 'info');
                  }}
                  title="Click to copy"
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {selectedFinding.vulnerability.id}
                  <Copy size={10} style={{ opacity: 0.6 }} />
                </span>

                {selectedFinding.vulnerability.aliases?.map((alias) => (
                  <span
                    key={alias}
                    onClick={() => {
                      navigator.clipboard.writeText(alias);
                      showToast(`Copied ${alias}`, 'info');
                    }}
                    title="Click to copy"
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {alias}
                    <Copy size={10} style={{ opacity: 0.6 }} />
                  </span>
                ))}
              </div>
            </div>

            {/* Panel Tabs: Summary | Evidence | Fix | Validation */}
            <div style={{ padding: '0 14px', borderBottom: '1px solid var(--border)' }}>
              <Tabs
                tabs={[
                  { id: 'summary', label: 'Summary' },
                  { id: 'evidence', label: 'Evidence', count: selectedFinding.evidence.candidate_paths.length },
                  { id: 'fix', label: 'Fix' },
                  { id: 'validation', label: 'Validation' },
                ]}
                activeTab={detailTab}
                onChange={(t) => setDetailTab(t)}
              />
            </div>

            {/* Tab Contents */}
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '680px', overflowY: 'auto' }}>
              {/* TAB 1: SUMMARY */}
              {detailTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Verdict Banner */}
                  <VerdictBanner
                    verdict={selectedFinding.reachability.verdict}
                    rationale={selectedFinding.reachability.rationale}
                  />

                  {/* Exactly 3 short blocks: What it is / Why it matters here / What to do */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        1. What it is
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--text-primary)' }}>
                        {selectedFinding.vulnerability.summary} in package{' '}
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {selectedFinding.vulnerability.package_name}@{selectedFinding.remediation.original_version}
                        </code>
                        .
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        2. Why it matters here
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--text-primary)' }}>
                        {selectedFinding.reachability.verdict === 'reachable'
                          ? `Application calls vulnerable sink function ${selectedFinding.evidence.vulnerable_function} from active route handlers.`
                          : selectedFinding.reachability.verdict === 'uncertain'
                          ? `Potential execution pathway observed, but dynamic or unresolvable call sites prevent full certainty.`
                          : `Library is installed, but no execution path reaches the vulnerable function in application code.`}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        3. What to do
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--text-primary)' }}>
                        Upgrade <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{selectedFinding.vulnerability.package_name}</code> to version{' '}
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' }}>
                          {selectedFinding.remediation.target_version}
                        </code>{' '}
                        in <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{selectedFinding.remediation.target_file}</code>.
                      </div>
                    </div>
                  </div>

                  {/* Why this priority list */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Why this priority ({selectedFinding.priority.band})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={13} style={{ color: 'var(--accent)' }} />
                        <span>Reachability: {selectedFinding.reachability.verdict}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={13} style={{ color: 'var(--accent)' }} />
                        <span>Input: Web Route Handler</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={13} style={{ color: 'var(--semantic-red)' }} />
                        <span>Severity: {selectedFinding.vulnerability.severity}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={13} style={{ color: 'var(--semantic-amber)' }} />
                        <span>Exploit: Public PoC exists</span>
                      </div>
                    </div>
                  </div>

                  {/* Technical caveats behind Show Details */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {showTechnicalDetails ? 'Hide technical caveats' : 'Show details & caveats'}
                      {showTechnicalDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>

                    {showTechnicalDetails && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>Confidence note: {selectedFinding.reachability.confidence_note}</div>
                        {selectedFinding.reachability.caveats?.map((c, i) => (
                          <div key={i} style={{ color: 'var(--semantic-amber)' }}>
                            • {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: EVIDENCE */}
              {detailTab === 'evidence' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Static candidate paths connecting route entry points to the library call:
                  </div>

                  {selectedFinding.evidence.candidate_paths.map((p, pIdx) => (
                    <div
                      key={p.path_id || pIdx}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                          Path #{pIdx + 1} ({p.hops.length} hops)
                        </span>
                        {p.contains_unresolved_call && (
                          <Badge variant="fix-soon">Dynamic Call Site</Badge>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {p.hops.map((hop, hIdx) => (
                          <div
                            key={hIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-tertiary)' }}>{hIdx + 1}.</span>
                              <span style={{ color: hop.is_entry_point ? 'var(--accent)' : 'var(--text-primary)' }}>
                                {hop.function_name}
                              </span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                ({hop.file_path}:{hop.line_number})
                              </span>
                            </div>

                            <a
                              href={`https://github.com/pallets/jinja/blob/main/${hop.file_path}#L${hop.line_number}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: 'var(--accent)',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              GitHub <ExternalLink size={10} />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Unresolved Calls */}
                  {selectedFinding.evidence.unresolved_calls && selectedFinding.evidence.unresolved_calls.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--semantic-amber)', marginBottom: '6px' }}>
                        Unresolved Dynamic Calls ({selectedFinding.evidence.unresolved_calls.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {selectedFinding.evidence.unresolved_calls.map((c: any, i: number) => (
                          <div key={i} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            • {c.callee_name || c.raw_expression} at line {c.line_number}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FIX */}
              {detailTab === 'fix' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {selectedFinding.remediation.status === 'not_needed'
                        ? 'Dependency Already Patched'
                        : selectedFinding.remediation.status === 'unresolved'
                        ? 'Dependency Resolution Required'
                        : 'Recommended Version Bump'}
                    </div>
                    {selectedFinding.remediation.status === 'not_needed' ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '18px' }}>
                        Installed version <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedFinding.remediation.original_version}</code> of{' '}
                        <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedFinding.vulnerability.package_name}</code> already satisfies this advisory.
                      </div>
                    ) : selectedFinding.remediation.status === 'unresolved' ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '18px' }}>
                        <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedFinding.vulnerability.package_name}</code> is unpinned or transitive. Direct lockfile resolution or parent dependency upgrade required.
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '18px' }}>
                        Upgrade <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedFinding.vulnerability.package_name}</code> from{' '}
                        <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedFinding.remediation.original_version}</code> to{' '}
                        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{selectedFinding.remediation.target_version}</code>.
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {selectedFinding.remediation.rationale || 'Risk: Patch bump (zero API breaking changes expected).'}
                    </div>
                  </div>

                  {/* Diff Viewer */}
                  {selectedFinding.remediation.diff ? (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Manifest Patch
                      </div>
                      <DiffViewer
                        diff={selectedFinding.remediation.diff}
                        filename={selectedFinding.remediation.target_file}
                      />
                    </div>
                  ) : null}

                  {/* Actions: Copy PR description, Download .patch */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCopyPRDescription}
                      icon={<Copy size={12} />}
                      disabled={!selectedFinding.remediation.diff}
                    >
                      Copy PR Description
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadPatch}
                      icon={<Download size={12} />}
                      disabled={!selectedFinding.remediation.diff}
                    >
                      Download .patch
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 4: VALIDATION & REVIEW */}
              {detailTab === 'validation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Validation Verdict Chip & Banner */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${
                        selectedFinding.validation.status === 'validated'
                          ? 'var(--semantic-green)'
                          : selectedFinding.validation.status === 'failed'
                          ? 'var(--semantic-red)'
                          : 'var(--semantic-amber)'
                      }`,
                      backgroundColor:
                        selectedFinding.validation.status === 'validated'
                          ? 'var(--semantic-green-light)'
                          : selectedFinding.validation.status === 'failed'
                          ? 'var(--semantic-red-light)'
                          : 'var(--semantic-amber-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color:
                            selectedFinding.validation.status === 'validated'
                              ? 'var(--semantic-green)'
                              : selectedFinding.validation.status === 'failed'
                              ? 'var(--semantic-red)'
                              : 'var(--semantic-amber)',
                        }}
                      >
                        Validation Verdict: {selectedFinding.validation.status.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {selectedFinding.validation.status === 'validated'
                          ? 'Patch builds cleanly, tests pass, and advisory is cleared.'
                          : 'Validation failed or unverified. Automated sign-off blocked.'}
                      </div>
                    </div>
                  </div>

                  {/* Validation Checklist */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Verification Checklist
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedFinding.validation.checks_run?.length > 0 ? (
                        selectedFinding.validation.checks_run.map((chk, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {chk.passed ? (
                                <CheckCircle2 size={13} style={{ color: 'var(--semantic-green)' }} />
                              ) : (
                                <XCircle size={13} style={{ color: 'var(--semantic-red)' }} />
                              )}
                              <span>{chk.check_name}</span>
                              {chk.category && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: 'var(--bg-surface)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {chk.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {chk.duration_seconds}s
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          No standalone checks recorded yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 7: Proof Test Runner */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Proof Test Execution (Harmless Marker Payload)
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRunProofTest}
                        disabled={proofTesting}
                      >
                        {proofTesting ? 'Running...' : 'Run proof test'}
                      </Button>
                    </div>

                    {proofTestResult ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px' }}>Result:</span>
                          <Badge
                            variant={
                              proofTestResult.result === 'reproduced'
                                ? 'fix-now'
                                : proofTestResult.result === 'not_reproduced'
                                ? 'verified'
                                : 'monitor'
                            }
                          >
                            {proofTestResult.result.toUpperCase()}
                          </Badge>
                        </div>
                        {proofTestResult.test_code && (
                          <CodeBlock code={proofTestResult.test_code} language="python" />
                        )}
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          Log: {proofTestResult.logs}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Proof tests execute harmless payload markers in an isolated network-restricted sandbox.
                      </div>
                    )}
                  </div>

                  {/* Human Review Decision Form */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Human Sign-off (Section 8)
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <textarea
                        placeholder="Reviewer notes (mandatory if rejecting proposal)..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '8px',
                          fontSize: '12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Tooltip
                        content={
                          selectedFinding.validation.status !== 'validated'
                            ? 'Approve is disabled unless validation verdict is Verified.'
                            : undefined
                        }
                      >
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={selectedFinding.validation.status !== 'validated' || reviewing}
                          onClick={() => handleReview('accept')}
                        >
                          Approve
                        </Button>
                      </Tooltip>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={reviewing}
                        onClick={() => handleReview('needs_more_info')}
                      >
                        Request Changes
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        disabled={reviewing}
                        onClick={() => handleReview('reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dismiss Modal */}
      <Modal
        isOpen={dismissModalOpen}
        onClose={() => setDismissModalOpen(false)}
        title="Dismiss Finding"
        description="Select a reason to record in the audit log for dismissing this vulnerability."
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setDismissModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDismiss}>
              Confirm Dismissal
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Reason
            </label>
            <select
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 8px',
                fontSize: '12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            >
              <option value="Not reachable in runtime">Not reachable in runtime</option>
              <option value="Compensating control in place">Compensating control in place</option>
              <option value="Test / Dev dependency only">Test / Dev dependency only</option>
              <option value="Risk accepted by security team">Risk accepted by security team</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Optional Note
            </label>
            <Input
              placeholder="e.g. Verified by Alice via dynamic fuzzing."
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Row Component
const FindingListRow: React.FC<{
  finding: Finding;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: (e: React.MouseEvent) => void;
}> = ({ finding, isSelected, isChecked, onSelect, onToggleCheck }) => {
  const isDev = finding.vulnerability.package_name.includes('pytest') || finding.vulnerability.package_name.includes('test');

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: isSelected ? 'var(--accent-dim)' : 'transparent',
        cursor: 'pointer',
        opacity: isDev ? 0.75 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <input
          type="checkbox"
          checked={isChecked}
          onClick={onToggleCheck}
          onChange={() => {}}
          style={{ cursor: 'pointer' }}
        />

        <PriorityBadge band={finding.priority.band} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {finding.vulnerability.package_name}@{finding.remediation.original_version}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>•</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {finding.vulnerability.id}
            </span>
          </div>

          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '480px',
            }}
          >
            {finding.reachability.rationale ? finding.reachability.rationale.slice(0, 90) : finding.vulnerability.summary.slice(0, 90)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
          fix: {finding.remediation.target_version}
        </span>
        <VerdictBadge verdict={finding.reachability.verdict} />
      </div>
    </div>
  );
};

const PriorityBadge: React.FC<{ band: string }> = ({ band }) => {
  const getVariant = () => {
    switch (band) {
      case 'Fix now':
        return 'fix-now';
      case 'Schedule fix':
        return 'fix-soon';
      case 'Monitor':
        return 'monitor';
      default:
        return 'default';
    }
  };

  const getTooltip = () => {
    switch (band) {
      case 'Fix now':
        return 'Reachable in active call graph or exposed to direct user inputs.';
      case 'Schedule fix':
        return 'Reachable or high severity but protected behind queued or internal paths.';
      case 'Monitor':
        return 'No observed execution path; library imported but dormant.';
      case 'Human review':
      default:
        return 'Static analysis inconclusive or contains dynamic calls requiring expert review.';
    }
  };

  return (
    <Tooltip content={getTooltip()}>
      <Badge variant={getVariant()} style={{ fontSize: '11px' }}>
        {band}
      </Badge>
    </Tooltip>
  );
};

const VerdictBadge: React.FC<{ verdict: string }> = ({ verdict }) => {
  if (verdict === 'reachable') {
    return <Badge variant="fix-now">Confirmed</Badge>;
  }
  if (verdict === 'uncertain') {
    return <Badge variant="fix-soon">Inconclusive</Badge>;
  }
  return <Badge variant="monitor">Not observed</Badge>;
};

const VerdictBanner: React.FC<{ verdict: string; rationale: string }> = ({ verdict, rationale }) => {
  if (verdict === 'reachable') {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--semantic-red)',
          backgroundColor: 'var(--semantic-red-light)',
          color: 'var(--semantic-red)',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={13} />
          Confirmed Reachable
        </div>
        <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-primary)' }}>
          {rationale}
        </div>
      </div>
    );
  }

  if (verdict === 'uncertain') {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--semantic-amber)',
          backgroundColor: 'var(--semantic-amber-light)',
          color: 'var(--semantic-amber)',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={13} />
          Inconclusive Analysis
        </div>
        <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-primary)' }}>
          {rationale || 'Dynamic dispatch or unresolvable call sites prevent complete static verification.'}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--semantic-gray-light)',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CheckCircle2 size={13} />
        Not Observed
      </div>
      <div style={{ fontSize: '12px', marginTop: '4px' }}>
        Note: Not observed does not mean safe. No static execution path reached this sink.
      </div>
    </div>
  );
};

function cleanTitle(summary: string): string {
  if (!summary) return 'Vulnerability Advisory';
  // Strip raw advisory IDs from summary if present
  return summary.replace(/^(GHSA-[a-z0-9-]+|CVE-\d{4}-\d+):\s*/i, '');
}
