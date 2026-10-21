import React, { useState, useEffect } from 'react';
import { Search, FolderGit2, ShieldAlert, GitCommit, Settings as SettingsIcon } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Input } from '../shared/Input';
import { api } from '../../services/api';
import { Repository, Finding } from '../../types/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      api.listRepositories().then(setRepos).catch(() => {});
      api.listScans().then(async (scansData) => {
        if (scansData.length > 0) {
          const f = await api.getScanFindings(scansData[scansData.length - 1].id).catch(() => []);
          setFindings(f);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  const q = query.toLowerCase().trim();

  // Navigation commands
  const defaultActions: PaletteItem[] = [
    { id: 'act-repos', title: 'Go to Repositories', category: 'Navigation', icon: <FolderGit2 size={14} />, path: '/repos' },
    { id: 'act-scans', title: 'Go to Scans', category: 'Navigation', icon: <Search size={14} />, path: '/scans' },
    { id: 'act-findings', title: 'Go to Findings', category: 'Navigation', icon: <ShieldAlert size={14} />, path: '/findings' },
    { id: 'act-fixes', title: 'Go to Fixes', category: 'Navigation', icon: <GitCommit size={14} />, path: '/fixes' },
    { id: 'act-settings', title: 'Go to Settings', category: 'Navigation', icon: <SettingsIcon size={14} />, path: '/settings' },
  ];

  // Matching items
  const matchedActions = defaultActions.filter((a) => a.title.toLowerCase().includes(q));

  const matchedRepos: PaletteItem[] = repos
    .filter((r) => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q) || r.url.toLowerCase().includes(q))
    .slice(0, 5)
    .map((r) => ({
      id: `repo-${r.id}`,
      title: `${r.owner}/${r.name}`,
      category: 'Repositories',
      icon: <FolderGit2 size={14} />,
      path: `/repos/${r.id}`,
      badge: r.default_branch,
    }));

  const matchedFindings: PaletteItem[] = findings
    .filter((f) =>
      f.vulnerability.package_name.toLowerCase().includes(q) ||
      f.vulnerability.id.toLowerCase().includes(q) ||
      (f.vulnerability.summary || '').toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map((f) => ({
      id: `finding-${f.id}`,
      title: `${f.vulnerability.package_name} — ${f.vulnerability.id}`,
      category: 'Findings',
      icon: <ShieldAlert size={14} />,
      path: `/findings/${f.id}`,
      badge: f.reachability.verdict,
    }));

  const allItems: PaletteItem[] = [...matchedActions, ...matchedRepos, ...matchedFindings];

  const handleSelect = (item: PaletteItem) => {
    onClose();
    if (item.path) {
      onNavigate(item.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex]);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Command Palette" maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Input
          autoFocus
          placeholder="Type a command or search repos, CVEs, packages..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          prefixIcon={<Search size={14} />}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '320px', overflowY: 'auto' }}>
          {allItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No matching commands or entities found for "{query}".
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                    border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all var(--duration) ease',
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {item.icon}
                    </span>
                    <span>{item.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {item.badge && (
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {item.badge}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border)',
            paddingTop: '8px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <span>Use ↑↓ to navigate · Enter to select · Esc to close</span>
          <span>Cmd/Ctrl + K</span>
        </div>
      </div>
    </Modal>
  );
};
