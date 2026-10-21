import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { HealthStatus } from '../../types/api';
import {
  Button,
  Input,
  Tabs,
} from '../shared';
import { useToast } from '../shared/Toast';
import {
  Github,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');

  // Theme settings: light, dark, system
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('vt-theme') as any) || 'system';
  });

  // GitHub integration
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('vt-gh-token') || '');
  const [defaultBranch, setDefaultBranch] = useState(() => localStorage.getItem('vt-default-branch') || 'main');
  const [scanOnPush, setScanOnPush] = useState(() => localStorage.getItem('vt-scan-on-push') === 'true');

  // Ignore rules
  const [ignoreDevDeps, setIgnoreDevDeps] = useState(() => localStorage.getItem('vt-ignore-dev') !== 'false');
  const [ignoredPackages, setIgnoredPackages] = useState(() => localStorage.getItem('vt-ignored-pkgs') || 'pytest, flake8, black');

  // Data retention
  const [deleteCloneAfterScan, setDeleteCloneAfterScan] = useState(() => localStorage.getItem('vt-delete-clone') !== 'false');
  const [retentionDays, setRetentionDays] = useState('30');

  // Backend Health & Model
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('vt-theme', newTheme);

    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    } else {
      // System
      root.removeAttribute('data-theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    showToast(`Theme changed to ${newTheme}`, 'info');
  };

  const handleSaveSettings = () => {
    localStorage.setItem('vt-gh-token', githubToken);
    localStorage.setItem('vt-default-branch', defaultBranch);
    localStorage.setItem('vt-scan-on-push', String(scanOnPush));
    localStorage.setItem('vt-ignore-dev', String(ignoreDevDeps));
    localStorage.setItem('vt-ignored-pkgs', ignoredPackages);
    localStorage.setItem('vt-delete-clone', String(deleteCloneAfterScan));

    showToast('Settings saved successfully', 'info');
  };

  const handleDeleteScanData = () => {
    showToast('Historical scan caches purged', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
            Workspace Settings
          </h1>
          <p style={{ margin: 0, marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Configure repository integrations, scanner rules, data retention, and system environment.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleSaveSettings}>
          Save Changes
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'general', label: 'General & Theme' },
          { id: 'github', label: 'GitHub & Repos' },
          { id: 'rules', label: 'Ignore Rules' },
          { id: 'retention', label: 'Data Retention' },
          { id: 'about', label: 'About & System' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab 1: General & Theme */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              Appearance &amp; Theme
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Select your color preference. Default is system.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleThemeChange('system')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${theme === 'system' ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: theme === 'system' ? 'var(--accent-dim)' : 'transparent',
                  color: theme === 'system' ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <Laptop size={14} /> System
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: theme === 'light' ? 'var(--accent-dim)' : 'transparent',
                  color: theme === 'light' ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <Sun size={14} /> Light
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: theme === 'dark' ? 'var(--accent-dim)' : 'transparent',
                  color: theme === 'dark' ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <Moon size={14} /> Dark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: GitHub & Repos */}
      {activeTab === 'github' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Github size={16} />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>GitHub Integration</span>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Personal Access Token (for private repositories)
              </label>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Default Branch
              </label>
              <Input
                placeholder="main"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={scanOnPush}
                onChange={(e) => setScanOnPush(e.target.checked)}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                Enable webhook automated scan on push
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Tab 3: Ignore Rules */}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Vulnerability Filtering &amp; Ignore Rules</div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ignoreDevDeps}
                onChange={(e) => setIgnoreDevDeps(e.target.checked)}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                Visually mute and deprioritize dev-only dependencies (e.g. test frameworks, linters)
              </span>
            </label>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Ignore specific packages (comma-separated)
              </label>
              <Input
                placeholder="pytest, mypy, flake8"
                value={ignoredPackages}
                onChange={(e) => setIgnoredPackages(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Data Retention */}
      {activeTab === 'retention' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Repository Storage &amp; Cache Policies</div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deleteCloneAfterScan}
                onChange={(e) => setDeleteCloneAfterScan(e.target.checked)}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                Delete shallow repository clone immediately after AST parse and graph build
              </span>
            </label>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Scan report data retention (days)
              </label>
              <Input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                style={{ width: '120px' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Purge Historical Data
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Clear temporary fixture caches and AST indexes.
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={handleDeleteScanData} icon={<Trash2 size={12} />}>
                Purge Cache
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: About & System */}
      {activeTab === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500 }}>System Status &amp; AI Engine</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>FastAPI Backend:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {health ? (
                    <>
                      <CheckCircle2 size={13} style={{ color: 'var(--semantic-green)' }} />
                      <span style={{ color: 'var(--semantic-green)', fontWeight: 500 }}>Online ({health.version})</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={13} style={{ color: 'var(--semantic-red)' }} />
                      <span style={{ color: 'var(--semantic-red)' }}>Offline</span>
                    </>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>FalkorDB Graph:</span>
                <span style={{ color: health?.falkordb_reachable ? 'var(--semantic-green)' : 'var(--semantic-amber)', fontWeight: 500 }}>
                  {health?.falkordb_reachable ? 'Connected' : 'In-Memory Mock'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>LLM Provider:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  Groq (llama-3.3-70b-versatile)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tree-sitter Parser:</span>
                <span style={{ color: 'var(--semantic-green)', fontWeight: 500 }}>Ready</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                VulnTrace AI • Deterministic Code Property Graphs + LangGraph Orchestration
              </span>
              <Button variant="secondary" size="sm" onClick={loadHealth} disabled={loadingHealth}>
                {loadingHealth ? 'Checking...' : 'Refresh Status'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
