import React, { useState } from 'react';
import { ViewId } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Spine } from './components/layout/Spine';
import { BreadcrumbHeader } from './components/layout/BreadcrumbHeader';
import { LiveScanExecutionWidget } from './components/layout/LiveScanExecutionWidget';

import { OverviewView } from './components/views/OverviewView';
import { RepositoriesView } from './components/views/RepositoriesView';
import { ScansView } from './components/views/ScansView';
import { FindingsView } from './components/views/FindingsView';
import { DependencyGraphView } from './components/views/DependencyGraphView';
import { AgentsView } from './components/views/AgentsView';
import { RemediationView } from './components/views/RemediationView';
import { SettingsView } from './components/views/SettingsView';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewId>('overview');

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return <OverviewView onNavigate={setActiveView} />;
      case 'repositories':
        return <RepositoriesView />;
      case 'scans':
        return <ScansView />;
      case 'findings':
        return <FindingsView />;
      case 'dependency-graph':
        return <DependencyGraphView />;
      case 'agents':
        return <AgentsView />;
      case 'remediation':
        return <RemediationView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="app-container">
      {/* Fixed Sticky Sidebar */}
      <Sidebar activeView={activeView} onSelectView={setActiveView} />

      {/* Spine with glowing indicator */}
      <Spine activeView={activeView} />

      {/* Main Content Area */}
      <main className="main-content">
        <BreadcrumbHeader activeView={activeView} />
        {renderActiveView()}
      </main>

      {/* Persistent Floating Live Scan Execution Widget */}
      <LiveScanExecutionWidget 
        activeView={activeView}
        onNavigateToScans={() => setActiveView('scans')} 
      />
    </div>
  );
};

export default App;
