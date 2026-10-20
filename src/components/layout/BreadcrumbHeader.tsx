import React from 'react';
import { ViewId, CRUMB_MAP } from '../../types';

interface BreadcrumbHeaderProps {
  activeView: ViewId;
}

export const BreadcrumbHeader: React.FC<BreadcrumbHeaderProps> = ({ activeView }) => {
  const [section, identifier] = CRUMB_MAP[activeView] || ['Overview', 'DASH-01'];

  return (
    <div className="flex items-center gap-3 mb-8 pb-4 border-b border-vt-border">
      <span className="mono text-[10px] text-vt-muted tracking-wider">VULNTRACE AI</span>
      <span className="text-vt-border text-xs">/</span>
      <span className="mono text-[10px] text-vt-deep-navy font-bold">{section}</span>
      <span className="text-vt-border text-xs">/</span>
      <span className="mono text-[10px] text-vt-navy bg-vt-tint px-2 py-0.5 rounded border border-vt-navy/30 font-semibold">
        {identifier}
      </span>
    </div>
  );
};
