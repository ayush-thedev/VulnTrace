import React, { useState, useEffect } from 'react';
import { ViewId } from '../../types';
import { api } from '../../services/api';
import { ScanResponse } from '../../types/api';
import { Search } from 'lucide-react';

interface LiveScanWidgetProps {
  onNavigateToScans: () => void;
  activeView?: ViewId;
}

export const LiveScanExecutionWidget: React.FC<LiveScanWidgetProps> = ({ 
  onNavigateToScans,
}) => {
  const [latestScan, setLatestScan] = useState<ScanResponse | null>(null);

  useEffect(() => {
    api.listScans()
      .then(scans => {
        if (scans.length > 0) setLatestScan(scans[scans.length - 1]);
      })
      .catch(() => {});
  }, []);

  return (
    <div 
      className="fixed bottom-8 right-8 bg-white border border-vt-border shadow-lg rounded-xl p-4 w-72 cursor-pointer hover:border-vt-navy transition-all z-30 group"
      onClick={onNavigateToScans}
      title="Click to view live Scans view"
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-vt-navy animate-pulse" />
          <span className="mono text-[10px] text-vt-deep-navy font-bold uppercase">
            Pipeline Monitor
          </span>
        </div>
        <Search size={14} className="text-vt-muted group-hover:text-vt-navy" />
      </div>

      <div className="text-xs text-vt-ink font-semibold truncate mb-1">
        {latestScan ? latestScan.id : 'Ready to Scan'}
      </div>

      <div className="flex justify-between items-center mono text-[10px] text-vt-muted pt-2 border-t border-gray-100">
        <span>{latestScan ? `${latestScan.findings_count} findings` : 'Idle'}</span>
        <span className="text-vt-navy font-bold font-mono">
          {latestScan?.status.toUpperCase() || 'STANDBY'}
        </span>
      </div>
    </div>
  );
};
