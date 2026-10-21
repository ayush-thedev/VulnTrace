import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Finding, RemediationStatus, ValidationCategory, ScanResponse } from '../../types/api';
import { api } from '../../services/api';
import { useAppRouter } from '../../services/router';
import {
  Button,
  Badge,
  DiffViewer,
  Tooltip,
  EmptyState,
  Skeleton,
} from '../shared';
import { useToast } from '../shared/Toast';
import {
  GitCommit,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  AlertCircle,
  ShieldCheck,
  Layers,
} from 'lucide-react';

interface FixGroup {
  id: string;
  packageName: string;
  originalVersion: string;
  targetVersion: string;
  targetFile: string;
  diff: string;
  rationale: string;
  findings: Finding[];
  remediationStatus: RemediationStatus;
  versionStatus?: string;
  declaredVersion?: string;
  resolvedVersion?: string;
  isTransitive?: boolean;
  parentDependency?: string;
  status: 'Proposed' | 'Validating' | 'Verified' | 'Failed' | 'Not Needed' | 'Unresolved';
  validationVerdict: 'Verified' | 'Failed' | 'Inconclusive' | 'Not Run';
  validationReason?: string;
  validationChecks: {
    name: string;
    passed: boolean;
    category?: ValidationCategory;
    duration: number;
    logs?: string;
  }[];
}

const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  patch_application: 'Patch Application',
  dependency_resolution: 'Dependency Resolution',
  security_verification: 'Security Check',
  test_execution: 'Test Suite',
};

interface RemediationViewProps {
  initialScanId?: string;
}

export const RemediationView: React.FC<RemediationViewProps> = ({ initialScanId }) => {
  const { route, navigate } = useAppRouter();
  const { showToast } = useToast();
  const scanIdFromUrl = initialScanId || route.params.scanId;

  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [allScans, setAllScans] = useState<ScanResponse[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFixId, setSelectedFixId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedFixId(null);
  }, [scanIdFromUrl]);

  const loadData = useCallback(async () => {
    setLoading(true);
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
            navigate(`/scans/${activeScan.id}/fixes`);
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
      const res = await api.getScanFindings(activeScan.id);
      setFindings(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to load fixes', 'error');
    } finally {
      setLoading(false);
    }
  }, [scanIdFromUrl, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group findings by package and target manifest/version: same package + same target = 1 fix
  const fixGroups: FixGroup[] = useMemo(() => {
    const map = new Map<string, FixGroup>();

    findings.forEach((f) => {
      const key = `${f.vulnerability.package_name}@${f.remediation.target_version || 'current'}`;
      let group = map.get(key);

      const remStatus = f.remediation.status;
      const isValidated = f.validation.status === 'validated';
      const isFailed = f.validation.status === 'failed';
      const isNotRun = f.validation.status === 'not_run';
      const isAccepted = f.human_review?.decision === 'accept';
      const isRejected = f.human_review?.decision === 'reject';

      let status: FixGroup['status'] = 'Proposed';
      if (remStatus === 'not_needed') {
        status = 'Not Needed';
      } else if (remStatus === 'unresolved') {
        status = 'Unresolved';
      } else if (isAccepted) {
        status = 'Verified';
      } else if (isRejected || isFailed) {
        status = 'Failed';
      } else if (isValidated) {
        status = 'Verified';
      } else if (f.validation.status === 'unverified') {
        status = 'Validating';
      }

      let validationVerdict: FixGroup['validationVerdict'] = 'Not Run';
      if (remStatus === 'not_needed') {
        validationVerdict = 'Verified';
      } else if (isValidated) {
        validationVerdict = 'Verified';
      } else if (isFailed) {
        validationVerdict = 'Failed';
      } else if (isNotRun) {
        validationVerdict = 'Not Run';
      } else {
        validationVerdict = 'Inconclusive';
      }

      let validationReason: string | undefined = undefined;
      if (remStatus === 'not_needed') {
        validationReason = `Installed version (${f.remediation.original_version}) already satisfies all known advisories. No code modification required.`;
      } else if (remStatus === 'unresolved') {
        validationReason = 'Version cannot be automatically updated. Dependency is unpinned or transitive; manual dependency resolution required.';
      } else if (isFailed) {
        // Find failed check log
        const failedCheck = f.validation.checks_run?.find((c) => !c.passed);
        validationReason = failedCheck
          ? `Failed check: ${failedCheck.check_name}. ${failedCheck.output || 'Manual inspection required.'}`
          : 'Validation tests failed in sandbox environment. Manual inspection required.';
      } else if (f.validation.status === 'unverified') {
        validationReason = 'Sandbox validation unverified due to dynamic runtime dependency or inconclusive environment.';
      }

      if (!group) {
        const checks = (f.validation.checks_run || []).map((c) => ({
          name: c.check_name,
          passed: c.passed,
          category: c.category,
          duration: c.duration_seconds,
          logs: c.output,
        }));

        group = {
          id: key,
          packageName: f.vulnerability.package_name,
          originalVersion: f.remediation.original_version,
          targetVersion: f.remediation.target_version,
          targetFile: f.remediation.target_file,
          diff: f.remediation.diff,
          rationale: f.remediation.rationale,
          findings: [f],
          remediationStatus: remStatus,
          versionStatus: f.remediation.version_status || f.evidence.version_status,
          declaredVersion: f.remediation.declared_version || f.evidence.declared_version,
          resolvedVersion: f.remediation.resolved_version || f.evidence.resolved_version,
          isTransitive: f.remediation.is_transitive ?? f.evidence.is_transitive,
          parentDependency: f.remediation.parent_dependency,
          status,
          validationVerdict,
          validationReason,
          validationChecks: checks,
        };
        map.set(key, group);
      } else {
        group.findings.push(f);
      }
    });

    return Array.from(map.values());
  }, [findings]);

  useEffect(() => {
    if (!selectedFixId && fixGroups.length > 0) {
      setSelectedFixId(fixGroups[0].id);
    }
  }, [fixGroups, selectedFixId]);

  const selectedFix = fixGroups.find((g) => g.id === selectedFixId) || fixGroups[0];

  const handleValidate = async () => {
    if (!selectedFix || selectedFix.findings.length === 0) return;
    setValidating(true);
    try {
      const primaryFinding = selectedFix.findings[0];
      const updated = await api.validateRemediation(primaryFinding.id);
      setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      showToast(`Validation suite completed: ${updated.validation.status.toUpperCase()}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Validation failed', 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleHumanReview = async (decision: 'accept' | 'reject' | 'needs_more_info') => {
    if (!selectedFix || selectedFix.findings.length === 0) return;
    if (decision === 'reject' && !reviewNote.trim()) {
      showToast('A note is required when rejecting a remediation proposal.', 'error');
      return;
    }
    setReviewing(true);
    try {
      for (const f of selectedFix.findings) {
        await api.recordHumanReview(f.id, decision, reviewNote);
      }
      showToast(`Review recorded: ${decision.toUpperCase()}`, 'info');
      setReviewNote('');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record review', 'error');
    } finally {
      setReviewing(false);
    }
  };

  const handleCopyPRDescription = () => {
    if (!selectedFix) return;
    const advisories = Array.from(new Set(selectedFix.findings.map((f) => f.vulnerability.id))).join(', ');
    const desc = `## Summary
Bump ${selectedFix.packageName} from ${selectedFix.originalVersion} to ${selectedFix.targetVersion} in \`${selectedFix.targetFile}\`.
Resolves advisories: ${advisories}.

### Plain Explanation
${selectedFix.rationale || `Upgrades ${selectedFix.packageName} to eliminate vulnerable code pathways identified during static analysis.`}

### Changes
\`\`\`diff
${selectedFix.diff}
\`\`\`

### Validation Table
| Check | Status | Duration |
|-------|--------|----------|
${selectedFix.validationChecks.map((c) => `| ${c.name} | ${c.passed ? 'PASSED' : 'FAILED'} | ${c.duration}s |`).join('\n')}

### Proof Before / After
- Before: Vulnerable call path detected in call graph.
- After: Fixed version verified in micro-sandbox environment. Zero new reachability paths observed.

### Rollback Notes
If regressions are observed, revert commit and restore \`${selectedFix.targetFile}\` to ${selectedFix.originalVersion}.
`;
    navigator.clipboard.writeText(desc);
    showToast('Copied PR description to clipboard', 'info');
  };

  const handleDownloadPatch = () => {
    if (!selectedFix || !selectedFix.diff) {
      showToast('No diff available to download', 'error');
      return;
    }
    const blob = new Blob([selectedFix.diff], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vulntrace-${selectedFix.packageName}.patch`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded .patch file', 'info');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
        <Skeleton height="32px" width="300px" />
        <Skeleton height="200px" />
      </div>
    );
  }

  if (fixGroups.length === 0) {
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
                    navigate(`/scans/${e.target.value}/fixes`);
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
          title={scan ? "No remediation proposals" : "No scans executed yet"}
          description={
            scan
              ? "No fixes currently proposed for this scan."
              : "Execute a scan to generate verified remediation patches and dependency upgrades."
          }
          actionLabel="Go to Scans"
          onAction={() => navigate('/scans')}
        />
      </div>
    );
  }

  // Deduplicate advisory IDs for display
  const uniqueAdvisories = selectedFix
    ? Array.from(new Set(selectedFix.findings.map((f) => f.vulnerability.id)))
    : [];

  const canApprove =
    selectedFix &&
    selectedFix.validationVerdict === 'Verified' &&
    selectedFix.remediationStatus !== 'not_needed' &&
    selectedFix.remediationStatus !== 'unresolved' &&
    selectedFix.diff.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '12px',
        }}
      >
        {scan && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {allScans.length > 1 && (
              <select
                value={scan.id || scanIdFromUrl || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(`/scans/${e.target.value}/fixes`);
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
              Remediation &amp; Patch Verification
            </h1>
            <p style={{ margin: 0, marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Isolated sandbox testing with mandatory human sign-off before code merging.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleValidate}
              disabled={validating || selectedFix?.remediationStatus === 'unresolved'}
            >
              {validating ? 'Running sandbox...' : 'Re-run validation suite'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left 340px Fixes List, Right Detail Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px', alignItems: 'start' }}>
        {/* Left: Fixes List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-primary)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              fontSize: '11px',
              fontWeight: 500,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Remediation Proposals ({fixGroups.length})
          </div>

          {fixGroups.map((group) => {
            const isSelected = selectedFix?.id === group.id;
            const groupAdvisories = Array.from(new Set(group.findings.map((f) => f.vulnerability.id)));

            return (
              <div
                key={group.id}
                onClick={() => setSelectedFixId(group.id)}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: isSelected ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                    {group.packageName}
                  </span>
                  {group.remediationStatus === 'not_needed' ? (
                    <span style={{ fontSize: '11px', color: 'var(--semantic-green)', fontWeight: 500 }}>
                      v{group.originalVersion} (Secure)
                    </span>
                  ) : group.remediationStatus === 'unresolved' ? (
                    <span style={{ fontSize: '11px', color: 'var(--semantic-amber)', fontWeight: 500 }}>
                      v{group.originalVersion} (Unresolved)
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent)',
                      }}
                    >
                      {group.originalVersion} → {group.targetVersion}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {group.remediationStatus === 'not_needed'
                    ? `Already safe against ${groupAdvisories.length} advisory${groupAdvisories.length > 1 ? 's' : ''}`
                    : `Resolves ${groupAdvisories.length} advisory${groupAdvisories.length > 1 ? 's' : ''} (${groupAdvisories.slice(0, 2).join(', ')}${groupAdvisories.length > 2 ? '...' : ''})`}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {group.targetFile}
                  </span>
                  <FixStatusBadge status={group.status} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Fix Details & Review */}
        {selectedFix && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Recommendation Summary */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '14px',
                backgroundColor: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedFix.remediationStatus === 'not_needed' ? (
                    <ShieldCheck size={18} style={{ color: 'var(--semantic-green)' }} />
                  ) : selectedFix.remediationStatus === 'unresolved' ? (
                    <AlertCircle size={18} style={{ color: 'var(--semantic-amber)' }} />
                  ) : (
                    <GitCommit size={18} style={{ color: 'var(--accent)' }} />
                  )}
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>
                    {selectedFix.remediationStatus === 'not_needed'
                      ? `${selectedFix.packageName} is already patched (v${selectedFix.originalVersion})`
                      : selectedFix.remediationStatus === 'unresolved'
                      ? `${selectedFix.packageName} requires manual resolution`
                      : `Upgrade ${selectedFix.packageName} to ${selectedFix.targetVersion}`}
                  </span>
                </div>
                {selectedFix.diff && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCopyPRDescription}
                      icon={<Copy size={12} />}
                    >
                      Copy PR Description
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadPatch}
                      icon={<Download size={12} />}
                    >
                      Download .patch
                    </Button>
                  </div>
                )}
              </div>

              {/* Version & Dependency Context */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Detected Version: </span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                    {selectedFix.originalVersion}
                  </code>{' '}
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    ({selectedFix.versionStatus || 'pinned'})
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Target Version: </span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent)' }}>
                    {selectedFix.targetVersion}
                  </code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Manifest: </span>
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedFix.targetFile}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Type: </span>
                  <span>{selectedFix.isTransitive ? 'Transitive dependency' : 'Direct manifest dependency'}</span>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '18px' }}>
                {selectedFix.rationale}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={13} />
                <span>
                  Addresses {uniqueAdvisories.length} advisory{uniqueAdvisories.length > 1 ? 's' : ''}:{' '}
                  {uniqueAdvisories.map((id) => (
                    <code key={id} style={{ fontFamily: 'var(--font-mono)', marginRight: '4px' }}>
                      {id}
                    </code>
                  ))}
                </span>
              </div>
            </div>

            {/* Diff Viewer */}
            {selectedFix.diff ? (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Manifest Changes
                </div>
                <DiffViewer
                  diff={selectedFix.diff}
                  filename={selectedFix.targetFile}
                />
              </div>
            ) : selectedFix.remediationStatus === 'not_needed' ? (
              <div
                style={{
                  border: '1px solid var(--semantic-green)',
                  borderRadius: 'var(--radius)',
                  padding: '14px',
                  backgroundColor: 'var(--semantic-green-light)',
                  color: 'var(--semantic-green)',
                  fontSize: '13px',
                }}
              >
                <strong>No Patch Required:</strong> The manifest already specifies {selectedFix.packageName}=={selectedFix.originalVersion}, which is outside the affected range for all detected advisories.
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid var(--semantic-amber)',
                  borderRadius: 'var(--radius)',
                  padding: '14px',
                  backgroundColor: 'var(--semantic-amber-light)',
                  color: 'var(--semantic-amber)',
                  fontSize: '13px',
                }}
              >
                <strong>Manual Resolution Required:</strong> VulnTrace cannot safely patch unpinned or transitive dependencies without explicit project resolution.
              </div>
            )}

            {/* Validation Checklist */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--bg-primary)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Sandbox Validation Suite
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color:
                      selectedFix.validationVerdict === 'Verified'
                        ? 'var(--semantic-green)'
                        : selectedFix.validationVerdict === 'Failed'
                        ? 'var(--semantic-red)'
                        : 'var(--semantic-amber)',
                  }}
                >
                  Verdict: {selectedFix.validationVerdict.toUpperCase()}
                </span>
              </div>

              {selectedFix.validationReason && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${
                      selectedFix.validationVerdict === 'Verified'
                        ? 'var(--semantic-green)'
                        : 'var(--semantic-red)'
                    }`,
                    backgroundColor:
                      selectedFix.validationVerdict === 'Verified'
                        ? 'var(--semantic-green-light)'
                        : 'var(--semantic-red-light)',
                    color:
                      selectedFix.validationVerdict === 'Verified'
                        ? 'var(--semantic-green)'
                        : 'var(--semantic-red)',
                    fontSize: '12px',
                  }}
                >
                  {selectedFix.validationReason}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedFix.validationChecks.length > 0 ? (
                  selectedFix.validationChecks.map((chk, i) => {
                    const isExpanded = expandedLogIndex === i;
                    const catLabel = chk.category ? CATEGORY_LABELS[chk.category] : undefined;

                    return (
                      <div
                        key={i}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 10px',
                          backgroundColor: 'var(--bg-surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div
                          onClick={() => setExpandedLogIndex(isExpanded ? null : i)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {chk.passed ? (
                              <CheckCircle2 size={13} style={{ color: 'var(--semantic-green)' }} />
                            ) : (
                              <XCircle size={13} style={{ color: 'var(--semantic-red)' }} />
                            )}
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {chk.name}
                            </span>
                            {catLabel && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  backgroundColor: 'var(--bg-primary)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {catLabel}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {chk.duration}s
                            </span>
                            {chk.logs && (
                              <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                                {isExpanded ? 'Hide log' : 'View log'}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded && chk.logs && (
                          <div
                            style={{
                              marginTop: '4px',
                              padding: '6px 8px',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '160px',
                              overflowY: 'auto',
                            }}
                          >
                            {chk.logs}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'center',
                    }}
                  >
                    No sandbox validation checks have executed yet. Click &quot;Re-run validation suite&quot; to test this patch.
                  </div>
                )}
              </div>
            </div>

            {/* Human Review Sign-Off Card */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--bg-primary)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Human Reviewer Decision (Strict Sign-off)
              </div>

              <div>
                <textarea
                  placeholder="Reviewer notes (required if rejecting proposal)..."
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
                    !canApprove
                      ? selectedFix.remediationStatus === 'not_needed'
                        ? 'No patch needed: Dependency is already safe.'
                        : selectedFix.remediationStatus === 'unresolved'
                        ? 'Approve is disabled for unresolved transitive dependencies.'
                        : 'Approve is disabled until the patch passes sandbox validation.'
                      : undefined
                  }
                >
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!canApprove || reviewing}
                    onClick={() => handleHumanReview('accept')}
                  >
                    Approve Fix
                  </Button>
                </Tooltip>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={reviewing}
                  onClick={() => handleHumanReview('needs_more_info')}
                >
                  Request Changes
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={reviewing}
                  onClick={() => handleHumanReview('reject')}
                >
                  Reject Proposal
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FixStatusBadge: React.FC<{ status: FixGroup['status'] }> = ({ status }) => {
  switch (status) {
    case 'Verified':
      return <Badge variant="verified">Verified</Badge>;
    case 'Failed':
      return <Badge variant="fix-now">Failed</Badge>;
    case 'Validating':
      return <Badge variant="fix-soon">Validating</Badge>;
    case 'Not Needed':
      return <Badge variant="verified">Already Patched</Badge>;
    case 'Unresolved':
      return <Badge variant="fix-soon">Unresolved</Badge>;
    case 'Proposed':
    default:
      return <Badge variant="default">Proposed</Badge>;
  }
};
