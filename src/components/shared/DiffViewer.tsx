import React, { useState } from 'react';

export interface DiffViewerProps {
  diff: string;
  filename?: string;
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  filename,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const lines = (diff || '').split('\n');

  return (
    <div
      className={`vt-diff-viewer ${className}`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '18px',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {filename || 'diff'}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setViewMode('unified')}
            style={{
              padding: '2px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: viewMode === 'unified' ? 'var(--bg-primary)' : 'transparent',
              color: viewMode === 'unified' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            style={{
              padding: '2px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: viewMode === 'split' ? 'var(--bg-primary)' : 'transparent',
              color: viewMode === 'split' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div style={{ padding: '8px 0', overflowX: 'auto' }}>
        {lines.map((line, idx) => {
          const isAdd = line.startsWith('+') && !line.startsWith('+++');
          const isDel = line.startsWith('-') && !line.startsWith('---');
          const isHunk = line.startsWith('@@');

          const bg = isAdd
            ? 'var(--semantic-green-light)'
            : isDel
            ? 'var(--semantic-red-light)'
            : isHunk
            ? 'var(--bg-surface)'
            : 'transparent';

          const color = isAdd
            ? 'var(--semantic-green)'
            : isDel
            ? 'var(--semantic-red)'
            : isHunk
            ? 'var(--text-muted)'
            : 'var(--text-primary)';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                backgroundColor: bg,
                color,
                padding: '1px 12px',
                whiteSpace: 'pre',
              }}
            >
              <span
                style={{
                  width: '32px',
                  color: 'var(--text-muted)',
                  userSelect: 'none',
                  flexShrink: 0,
                  fontSize: '11px',
                }}
              >
                {idx + 1}
              </span>
              <span style={{ flex: 1 }}>{line || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
