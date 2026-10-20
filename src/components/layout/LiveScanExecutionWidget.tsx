import React, { useState, useEffect } from 'react';
import { ViewId } from '../../types';

interface LiveScanWidgetProps {
  onNavigateToScans: () => void;
  activeView?: ViewId;
}

export const LiveScanExecutionWidget: React.FC<LiveScanWidgetProps> = ({ 
  onNavigateToScans,
}) => {
  const [pathsCount, setPathsCount] = useState(4202);
  const totalPaths = 6100;

  useEffect(() => {
    const timer = setInterval(() => {
      setPathsCount((prev) => {
        if (prev >= 6080) return 4200;
        return prev + Math.floor(Math.random() * 8) + 1;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const progressPercent = Math.min(100, Math.round((pathsCount / totalPaths) * 100));

  return (
    <div 
      className="fixed bottom-12 right-12 bg-black border border-[rgba(255,255,255,0.15)] p-6 w-80 shadow-2xl cursor-pointer hover:border-[rgba(255,255,255,0.35)] transition-all z-30 group"
      onClick={onNavigateToScans}
      title="Click to view live Scans audit"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="mono text-[10px] text-white group-hover:text-[#5C7CFA] transition-colors">
            Live Scan Execution
          </span>
        </div>
        <div className="flex gap-1 items-center">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-75" />
          <div className="w-1 h-1 bg-white opacity-20" />
        </div>
      </div>
      <div className="h-1 bg-[rgba(255,255,255,0.1)] mb-4 rounded-sm overflow-hidden">
        <div 
          className="h-full bg-white shadow-[0_0_10px_#fff] transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex justify-between items-center mono text-[9px] text-[#888888]">
        <span>Mapping execution paths: {pathsCount.toLocaleString()} / {totalPaths.toLocaleString()}</span>
        <span className="text-white">{progressPercent}%</span>
      </div>
    </div>
  );
};
