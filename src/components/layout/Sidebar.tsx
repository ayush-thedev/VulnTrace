import React from 'react';
import { ViewId } from '../../types';

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
}

interface NavItemConfig {
  id: ViewId;
  label: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'scans', label: 'Scans' },
  { id: 'findings', label: 'Findings' },
  { id: 'dependency-graph', label: 'Dependency Graph' },
  { id: 'agents', label: 'Agents' },
  { id: 'remediation', label: 'Remediation' },
  { id: 'settings', label: 'Settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelectView }) => {
  return (
    <aside className="sidebar">
      <div className="top-nav">
        <div 
          className="logo mb-12 cursor-pointer flex items-center gap-3 group"
          onClick={() => onSelectView('overview')}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="transition-transform group-hover:scale-105">
            <path d="M16 4L28 28H4L16 4Z" stroke="white" strokeWidth="2" />
            <circle cx="16" cy="18" r="4" fill="white" />
          </svg>
          <span className="mono font-bold tracking-widest text-sm text-white group-hover:text-[#00FF41] transition-colors">
            VulnTrace
          </span>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <div
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectView(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectView(item.id);
                  }
                }}
              >
                <span className={`status-dot ${isActive ? 'active' : ''}`} />
                <span className="mono">{item.label}</span>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="bottom-stats">
        <div className="border-t border-[rgba(255,255,255,0.1)] pt-8">
          <div className="flex justify-between mb-2">
            <span className="mono text-[10px] text-[#888888]">Uptime</span>
            <span className="mono text-white">99.994%</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="mono text-[10px] text-[#888888]">Active Nodes</span>
            <span className="mono text-white">14,202</span>
          </div>
          <div className="flex justify-between">
            <span className="mono text-[10px] text-[#888888]">Sys_Health</span>
            <span className="mono text-[#00FF41]">Optimal</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
