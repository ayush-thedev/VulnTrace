import React, { useState, useEffect, useRef } from 'react';
import { ViewId } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { BreadcrumbHeader, BreadcrumbSegment } from './components/layout/BreadcrumbHeader';
import { LiveScanExecutionWidget } from './components/layout/LiveScanExecutionWidget';
import { RepositoriesView } from './components/views/RepositoriesView';
import { ScansView } from './components/views/ScansView';
import { FindingsView } from './components/views/FindingsView';
import { AgentsView } from './components/views/AgentsView';
import { RemediationView } from './components/views/RemediationView';
import { SettingsView } from './components/views/SettingsView';
import { HomeView } from './components/views/HomeView';
import { CommandPalette } from './components/common/CommandPalette';
import { ShortcutSheet } from './components/common/ShortcutSheet';
import { useAppRouter } from './services/router';
import { ToastProvider } from './components/shared/Toast';
import { InspectorPanel, InspectorData } from './components/common/InspectorPanel';
import { ScanClient } from './services/scanClient';

export const AppContent: React.FC = () => {
  const { route, navigate } = useAppRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorData, setInspectorData] = useState<InspectorData>({
    logLength: 0,
    lastOffset: -1,
    nextSeq: 0,
    bufferedFrames: 0,
    dupCount: 0,
    nackCount: 0,
    connectionState: 'idle',
    stateHash: '00000000',
    replayStateHash: '00000000',
    hashMatch: true,
  });
  const clientRef = useRef<ScanClient | null>(null);

  useEffect(() => {
    const scanId = route.params.scanId || 'SCAN-B6E50D';
    const client = new ScanClient({
      scanId,
      onStateUpdate: (_state, stats) => {
        setInspectorData(stats);
      },
    });
    clientRef.current = client;
    client.init().catch(() => {});

    return () => {
      client.dispose();
    };
  }, [route.params.scanId]);

  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);

  // Global Keyboard shortcuts: Cmd+K, ?, g r, g s, g f
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // ? for shortcuts sheet
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShortcutSheetOpen((prev) => !prev);
        return;
      }

      // g + r / g + s / g + f sequence
      const now = Date.now();
      if (e.key === 'g') {
        lastKeyRef.current = { key: 'g', time: now };
        return;
      }

      if (lastKeyRef.current && lastKeyRef.current.key === 'g' && now - lastKeyRef.current.time < 1000) {
        if (e.key === 'r') {
          e.preventDefault();
          navigate('/repos');
        } else if (e.key === 's') {
          e.preventDefault();
          navigate('/scans');
        } else if (e.key === 'f') {
          e.preventDefault();
          navigate('/findings');
        }
        lastKeyRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Map route.view to active Sidebar ViewId
  const currentViewId: ViewId =
    route.view === 'home' || route.view === 'repositories'
      ? 'repositories'
      : route.view === 'scans'
      ? 'scans'
      : route.view === 'findings'
      ? 'findings'
      : route.view === 'fixes'
      ? 'fixes'
      : route.view === 'agents'
      ? 'agents'
      : 'settings';

  const handleSelectView = (view: ViewId) => {
    switch (view) {
      case 'repositories':
        navigate('/repos');
        break;
      case 'scans':
        navigate(route.params.scanId ? `/scans/${route.params.scanId}` : '/scans');
        break;
      case 'findings':
        navigate(route.params.scanId ? `/scans/${route.params.scanId}/findings` : '/findings');
        break;
      case 'fixes':
      case 'remediation':
        navigate(route.params.scanId ? `/scans/${route.params.scanId}/fixes` : '/fixes');
        break;
      case 'agents':
        navigate('/agents');
        break;
      case 'settings':
        navigate('/settings');
        break;
      default:
        navigate('/repos');
        break;
    }
  };

  // Compute real-data dynamic breadcrumb segments (Section 1.3)
  const breadcrumbSegments: BreadcrumbSegment[] = [
    { label: 'VulnTrace', onClick: () => navigate('/repos') },
  ];

  if (route.view === 'repositories') {
    breadcrumbSegments.push({
      label: route.params.repoId ? `Repo: ${route.params.repoId}` : 'Repositories',
      onClick: route.params.repoId ? () => navigate('/repos') : undefined,
    });
  } else if (route.view === 'scans') {
    breadcrumbSegments.push({
      label: 'Scans',
      onClick: route.params.scanId ? () => navigate('/scans') : undefined,
    });
    if (route.params.scanId) {
      breadcrumbSegments.push({
        label: `Scan #${route.params.scanId.slice(0, 8)}`,
      });
    }
  } else if (route.view === 'findings') {
    if (route.params.scanId) {
      breadcrumbSegments.push({
        label: `Scan #${route.params.scanId.slice(0, 8)}`,
        onClick: () => navigate(`/scans/${route.params.scanId}`),
      });
    }
    breadcrumbSegments.push({
      label: 'Findings',
      onClick: route.params.scanId
        ? () => navigate(`/scans/${route.params.scanId}/findings`)
        : route.params.findingId
        ? () => navigate('/findings')
        : undefined,
    });
    if (route.params.findingId) {
      breadcrumbSegments.push({
        label: `Finding ${route.params.findingId.slice(0, 8)}`,
      });
    }
  } else if (route.view === 'fixes') {
    if (route.params.scanId) {
      breadcrumbSegments.push({
        label: `Scan #${route.params.scanId.slice(0, 8)}`,
        onClick: () => navigate(`/scans/${route.params.scanId}`),
      });
    }
    breadcrumbSegments.push({ label: 'Fixes & Remediation' });
  } else if (route.view === 'agents') {
    breadcrumbSegments.push({ label: 'Agents & Provenance' });
  } else if (route.view === 'settings') {
    breadcrumbSegments.push({ label: 'Settings' });
  } else if (route.view === 'home') {
    breadcrumbSegments.push({ label: 'Get Started' });
  }

  const renderActiveView = () => {
    switch (route.view) {
      case 'home':
        return (
          <HomeView
            onStartScan={(target) => {
              navigate(`/scans?target=${encodeURIComponent(target)}`);
            }}
          />
        );
      case 'repositories':
        return <RepositoriesView selectedRepoId={route.params.repoId} />;
      case 'scans':
        return (
          <ScansView
            initialScanId={route.params.scanId}
            onNavigateToFindings={(scanId) => navigate(`/scans/${scanId}/findings`)}
          />
        );
      case 'findings':
        return (
          <FindingsView
            initialScanId={route.params.scanId}
            initialFindingId={route.params.findingId}
            initialTab={route.params.tab}
          />
        );
      case 'fixes':
        return <RemediationView initialScanId={route.params.scanId} />;
      case 'agents':
        return <AgentsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <RepositoriesView />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeView={currentViewId} onSelectView={handleSelectView} />
      <main className="main-content">
        <div className="page">
          <BreadcrumbHeader activeView={currentViewId} segments={breadcrumbSegments} />
          {renderActiveView()}
        </div>
        <LiveScanExecutionWidget onNavigateToScans={(scanId) => navigate(scanId ? `/scans/${scanId}` : '/scans')} />
      </main>

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(path) => {
          setCommandPaletteOpen(false);
          navigate(path);
        }}
      />

      {/* Keyboard Shortcuts Sheet (?) */}
      <ShortcutSheet
        isOpen={shortcutSheetOpen}
        onClose={() => setShortcutSheetOpen(false)}
      />

      {/* Binary Stream Inspector */}
      <InspectorPanel
        data={inspectorData}
        visible={inspectorOpen}
        onToggle={() => setInspectorOpen((prev) => !prev)}
        onReplay={() => {
          clientRef.current?.replayFromZero().catch(() => {});
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
