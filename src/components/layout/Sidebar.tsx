import React from 'react';
import { ViewId } from '../../types';
import { 
  LayoutDashboard, 
  Search, 
  ShieldAlert, 
  Cpu, 
  GitCommit, 
  FolderGit2, 
  Network,
  Settings as SettingsIcon 
} from 'lucide-react';

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
}

interface NavItemConfig {
  id: ViewId;
  label: string;
  icon: any;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'scans', label: 'Scans & Pipeline', icon: Search },
  { id: 'findings', label: 'Findings Ledger', icon: ShieldAlert },
  { id: 'agents', label: 'Multi-Agent System', icon: Cpu },
  { id: 'remediation', label: 'Remediation Review', icon: GitCommit },
  { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
  { id: 'dependency-graph', label: 'Topology Graph', icon: Network },
  { id: 'settings', label: 'Configuration', icon: SettingsIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelectView }) => {
  return (
    <aside className="sidebar">
      <div>
        {/* Brand Header */}
        <div 
          className="mb-8 cursor-pointer flex items-center gap-2.5"
          onClick={() => onSelectView('overview')}
        >
          <div className="w-8 h-8 rounded-lg bg-vt-navy flex items-center justify-center text-white font-bold text-sm shadow-sm">
            ✱
          </div>
          <div>
            <div className="font-heading font-bold text-lg text-vt-deep-navy tracking-tight leading-none">
              VulnTrace AI
            </div>
            <span className="text-[10px] text-vt-muted font-mono tracking-wider">
              TECHNOVISIONERS
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-vt-tint text-vt-navy font-bold shadow-xs' 
                    : 'text-vt-muted hover:text-vt-deep-navy hover:bg-gray-100'
                }`}
                onClick={() => onSelectView(item.id)}
                role="button"
                tabIndex={0}
              >
                <Icon size={16} className={isActive ? 'text-vt-navy' : 'text-vt-muted'} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-vt-border text-[11px] text-vt-muted space-y-0.5 font-mono">
        <div className="font-semibold text-vt-ink">VulnTrace AI</div>
        <div className="text-[10px] opacity-75">Evidence-Driven Reachability</div>
      </div>
    </aside>
  );
};
