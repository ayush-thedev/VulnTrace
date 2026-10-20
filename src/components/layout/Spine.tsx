import React from 'react';
import { ViewId } from '../../types';

interface SpineProps {
  activeView: ViewId;
}

const VIEW_ORDER: ViewId[] = [
  'overview',
  'repositories',
  'scans',
  'findings',
  'dependency-graph',
  'agents',
  'remediation',
  'settings'
];

export const Spine: React.FC<SpineProps> = ({ activeView }) => {
  const index = Math.max(0, VIEW_ORDER.indexOf(activeView));
  // Logo top margin ~ 80px, then nav items are ~ 42px each
  const dotTop = 138 + index * 43;

  return (
    <div className="spine">
      <style>{`
        .spine::after {
          top: ${dotTop}px !important;
        }
      `}</style>
    </div>
  );
};
