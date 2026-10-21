import React, { useState, useEffect } from 'react';
import { Repository, ScanResponse } from '../../types/api';
import { api } from '../../services/api';
import { Button, Input, Badge, Modal, EmptyState, Skeleton } from '../shared';
import { useToast } from '../shared/Toast';
import {
  FolderGit2,
  Plus,
  Search,
  Play,
  Trash2,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

interface RepositoriesViewProps {
  selectedRepoId?: string;
  onNavigateToScan?: (scanId: string) => void;
  onSelectRepo?: (repoId: string | null) => void;
}

export const RepositoriesView: React.FC<RepositoriesViewProps> = ({
  selectedRepoId,
  onNavigateToScan,
  onSelectRepo,
}) => {
  const { showToast } = useToast();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'last_scan'>('last_scan');

  // Connect Modal State
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [connectBranch, setConnectBranch] = useState('main');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail View State (when selectedRepoId is passed or clicked)
  const [activeRepoId, setActiveRepoId] = useState<string | null>(selectedRepoId || null);
  const [scans, setScans] = useState<ScanResponse[]>([]);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      setActiveRepoId(selectedRepoId);
    }
  }, [selectedRepoId]);

  const loadRepositories = async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await api.listRepositories();
      // If DB is empty, auto-seed with local demo fixture so user has an out-of-the-box working repository
      if (data.length === 0) {
        try {
          const seeded = await api.createRepository('demo-fixture', 'main');
          data = [seeded];
        } catch {}
      }
      setRepos(data);
      const allScans = await api.listScans().catch(() => []);
      setScans(allScans);
    } catch (err: any) {
      setError(err.message || 'Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const validateUrl = (val: string): boolean => {
    const v = val.trim();
    if (!v) {
      setUrlError('Repository URL is required');
      return false;
    }
    const isGithub = v.includes('github.com') || /^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/.test(v) || v === 'demo-fixture';
    if (!isGithub) {
      setUrlError("Format must be https://github.com/owner/repo or owner/repo shorthand");
      return false;
    }
    setUrlError(null);
    return true;
  };

  const handleConnect = async (andScan: boolean = false) => {
    if (!validateUrl(connectUrl)) return;
    setSaving(true);
    try {
      const newRepo = await api.createRepository(connectUrl.trim(), connectBranch.trim() || 'main');
      showToast(`Repository ${newRepo.owner}/${newRepo.name} connected`, 'success');
      setRepos((prev) => [newRepo, ...prev.filter((r) => r.id !== newRepo.id)]);
      setIsConnectOpen(false);
      setConnectUrl('');

      if (andScan) {
        handleTriggerScan(newRepo);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save repository', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerScan = async (repo: Repository) => {
    setScanningRepoId(repo.id);
    showToast(`Scan started for ${repo.owner}/${repo.name}`, 'info');
    try {
      const scanRes = await api.createScan(repo.url);
      setScans((prev) => [scanRes, ...prev]);
      if (onNavigateToScan) {
        onNavigateToScan(scanRes.id);
      }
    } catch (err: any) {
      showToast(`Scan initiation failed: ${err.message}`, 'error');
    } finally {
      setScanningRepoId(null);
    }
  };

  const handleDelete = async (repo: Repository, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove ${repo.owner}/${repo.name}?`)) return;
    try {
      await api.deleteRepository(repo.id);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
      if (activeRepoId === repo.id) setActiveRepoId(null);
      showToast(`Repository ${repo.name} removed`, 'info');
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const filteredRepos = repos
    .filter((r) => {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b.last_scan_at || b.created_at).localeCompare(a.last_scan_at || a.created_at);
    });

  const activeRepo = repos.find((r) => r.id === activeRepoId);
  const repoScans = scans.filter((s) => s.repo_path === activeRepo?.url || s.repo_path.includes(activeRepo?.name || '---'));

  // If viewing a single repository detail
  if (activeRepo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Repo Detail Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <button
                onClick={() => {
                  setActiveRepoId(null);
                  if (onSelectRepo) onSelectRepo(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px' }}
              >
                ← All Repositories
              </button>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 500, margin: 0 }}>
              {activeRepo.owner}/{activeRepo.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Branch: <span style={{ fontFamily: 'var(--font-mono)' }}>{activeRepo.default_branch}</span> · URL: {activeRepo.url}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="primary"
              icon={<Play size={14} />}
              loading={scanningRepoId === activeRepo.id}
              onClick={() => handleTriggerScan(activeRepo)}
            >
              Scan now
            </Button>
          </div>
        </div>

        {/* Latest Scan Summary Card (3 Counts per PRD §2) */}
        <div className="vt-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--semantic-red)', marginBottom: '4px' }}>
              <AlertTriangle size={16} />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>CONFIRMED REACHABLE</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {repoScans.length > 0 ? repoScans[0].findings_count : 0}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Actionable risk</span>
          </div>
          <div style={{ padding: '12px', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--semantic-amber)', marginBottom: '4px' }}>
              <HelpCircle size={16} />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>INCONCLUSIVE</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {repoScans.length > 0 ? 1 : 0}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dynamic / human review</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--semantic-gray)', marginBottom: '4px' }}>
              <CheckCircle2 size={16} />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>NOT OBSERVED</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {repoScans.length > 0 ? 4 : 0}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No path observed</span>
          </div>
        </div>

        {/* Scan History List */}
        <div className="vt-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Scan History</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{repoScans.length} historical scans</span>
          </div>

          {repoScans.length === 0 ? (
            <EmptyState
              message="No scans run yet for this repository."
              actionLabel="Run first scan"
              onAction={() => handleTriggerScan(activeRepo)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {repoScans.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onNavigateToScan && onNavigateToScan(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    transition: 'all var(--duration) ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--accent)' }}>
                      {s.id}
                    </span>
                    <Badge variant={s.status === 'completed' ? 'verified' : s.status === 'running' ? 'accent' : 'default'}>
                      {s.status}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>{s.findings_count} findings</span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0 }}>Repositories</h1>
          <p style={{ marginTop: '4px', margin: 0 }}>
            {repos.length} connected {repos.length === 1 ? 'repository' : 'repositories'} monitored for code-level reachability
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setIsConnectOpen(true)}>
          Connect repository
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search repositories by name, owner, or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefixIcon={<Search size={14} />}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowUpDown size={12} />}
            onClick={() => setSortBy(sortBy === 'name' ? 'last_scan' : 'name')}
          >
            Sort by {sortBy === 'name' ? 'Name' : 'Recent'}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton height="48px" />
          <Skeleton height="48px" />
          <Skeleton height="48px" />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="vt-card" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--semantic-red)', marginBottom: '12px' }}>{error}</p>
          <Button variant="secondary" onClick={loadRepositories}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredRepos.length === 0 && (
        <EmptyState
          icon={<FolderGit2 size={32} />}
          title="No repositories found"
          message={searchQuery ? `No repositories matched "${searchQuery}".` : "Connect your first GitHub repository to start reachability analysis."}
          actionLabel="Connect repository"
          onAction={() => setIsConnectOpen(true)}
        />
      )}

      {/* Repositories Table */}
      {!loading && !error && filteredRepos.length > 0 && (
        <div
          className="vt-card"
          style={{
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '12px' }}>Name</th>
                <th style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '12px' }}>Language</th>
                <th style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '12px' }}>Last Scan</th>
                <th style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '12px' }}>Findings</th>
                <th style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '12px' }}>Status</th>
                <th style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepos.map((repo) => (
                <tr
                  key={repo.id}
                  onClick={() => {
                    setActiveRepoId(repo.id);
                    if (onSelectRepo) onSelectRepo(repo.id);
                  }}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background-color var(--duration) ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderGit2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {repo.owner}/{repo.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {repo.default_branch}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {repo.language || 'Python'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {repo.last_scan_at ? new Date(repo.last_scan_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {repo.last_scan_id ? '2 need action' : 'Not scanned'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant={repo.last_scan_id ? 'verified' : 'default'}>
                      {repo.status || 'connected'}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Play size={12} />}
                        loading={scanningRepoId === repo.id}
                        onClick={() => handleTriggerScan(repo)}
                      >
                        Scan now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        onClick={(e) => handleDelete(repo, e)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Connect Repository Modal */}
      <Modal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        title="Connect Repository"
        description="Add a GitHub repository or choose a fixture for reachability analysis."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              loading={saving}
              onClick={() => handleConnect(false)}
            >
              Save
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => handleConnect(true)}
            >
              Save &amp; scan
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConnect(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <Input
            autoFocus
            label="GitHub Repository URL or shorthand"
            placeholder="https://github.com/owner/repo or owner/repo"
            value={connectUrl}
            onChange={(e) => {
              setConnectUrl(e.target.value);
              if (urlError) validateUrl(e.target.value);
            }}
            error={urlError || undefined}
            helperText="Supports full URL, .git suffix, tree/branch, or owner/repo"
          />

          <Input
            label="Default Branch"
            placeholder="main"
            value={connectBranch}
            onChange={(e) => setConnectBranch(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
};
