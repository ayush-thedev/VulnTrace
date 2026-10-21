import React from 'react';
import { ViewId } from '../../types';
import { FolderGit2, Search, ShieldAlert, GitCommit, Settings as SettingsIcon } from 'lucide-react';

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
}

interface NavItemConfig {
  id: ViewId;
  label: string;
  icon: any;
}

const PRIMARY_NAV_ITEMS: NavItemConfig[] = [
  { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
  { id: 'scans', label: 'Scans', icon: Search },
  { id: 'findings', label: 'Findings', icon: ShieldAlert },
  { id: 'fixes', label: 'Fixes', icon: GitCommit },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelectView }) => {
  return (
    <aside className="sidebar-rail" aria-label="Sidebar Navigation">
      {/* Brand Icon (Clean V mark) */}
      <div
        className="sidebar-brand-icon"
        onClick={() => onSelectView('repositories')}
        title="VulnTrace"
        style={{ cursor: 'pointer' }}
      >
        V
      </div>

      {/* Nav Items */}
      <nav className="sidebar-nav-list">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive =
            activeView === item.id ||
            (item.id === 'fixes' && activeView === 'remediation');
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(item.id === 'fixes' ? 'fixes' : item.id)}
              role="button"
              tabIndex={0}
              title={item.label}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectView(item.id === 'fixes' ? 'fixes' : item.id);
                }
              }}
            >
              <div className="sidebar-nav-icon">
                <Icon size={16} />
              </div>
              <span className="sidebar-nav-label">{item.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
