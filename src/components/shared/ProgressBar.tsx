import React from 'react';

export interface ProgressBarProps {
  percent: number;
  height?: number;
  showLabel?: boolean;
  color?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  height = 4,
  showLabel = false,
  color = 'var(--accent)',
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Progress</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className={`vt-progress-bar ${className}`}
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: `${height}px`,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width var(--duration) ease',
          }}
        />
      </div>
    </div>
  );
};
