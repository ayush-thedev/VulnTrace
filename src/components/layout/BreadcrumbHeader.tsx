import React from 'react';
import { ViewId, CRUMB_MAP } from '../../types';

interface BreadcrumbHeaderProps {
  activeView: ViewId;
}

export const BreadcrumbHeader: React.FC<BreadcrumbHeaderProps> = ({ activeView }) => {
  const [section, identifier] = CRUMB_MAP[activeView] || ['Overview', 'DASH-01'];

  return (
    <div className="breadcrumb flex items-center gap-3 mb-8 pb-4 border-b border-[#141419]">
      <span className="mono text-[10px] text-[#55555E]">VULNTRACE</span>
      <span className="text-[#3A3A46] text-xs">/</span>
      <span className="mono text-[10px] text-white">{section}</span>
      <span className="text-[#3A3A46] text-xs">/</span>
      <span className="mono text-[10px] text-[#00FF41] bg-[#00FF41]/10 px-2 py-0.5 rounded border border-[#00FF41]/20">
        {identifier}
      </span>
    </div>
  );
};
