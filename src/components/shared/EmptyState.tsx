import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  description,
  icon,
  actionLabel,
  onAction,
  className = '',
}) => {
  const text = message || description || '';
  return (
    <div
      className={`vt-empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-primary)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius)',
        gap: '12px',
      }}
    >
      {icon && (
        <div style={{ color: 'var(--text-muted)', display: 'inline-flex', marginBottom: '4px' }}>
          {icon}
        </div>
      )}
      {title && (
        <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          {title}
        </h3>
      )}
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', margin: 0 }}>
        {text}
      </p>
      {actionLabel && onAction && (
        <div style={{ marginTop: '4px' }}>
          <Button variant="secondary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
