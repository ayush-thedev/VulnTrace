import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ScanResponse } from '../../types/api';

interface LiveScanWidgetProps {
  onNavigateToScans: (scanId?: string) => void;
}

export const LiveScanExecutionWidget: React.FC<LiveScanWidgetProps> = ({ onNavigateToScans }) => {
  const [latestScan, setLatestScan] = useState<ScanResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchLatest = async () => {
      try {
        const scans = await api.listScans();
        if (mounted && scans.length > 0) {
          setLatestScan(scans[scans.length - 1]);
        }
      } catch {
        // ignore
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!latestScan) return null;

  const isRunning = latestScan.status === 'running' || latestScan.status === 'queued';

  return (
    <div
      onClick={() => onNavigateToScans(latestScan.id)}
      title="View Scan Execution"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '24px',
        zIndex: 40,
        backgroundColor: 'var(--bg-primary)',
        border: `1px solid ${isRunning ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'border-color 150ms ease',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isRunning ? 'var(--accent)' : 'var(--semantic-green)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {isRunning ? 'Scan in progress' : 'Latest scan'}
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            ({latestScan.id.slice(0, 8)})
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {isRunning ? 'Analyzing AST paths...' : `${latestScan.findings_count} findings detected`}
        </div>
      </div>
    </div>
  );
};
