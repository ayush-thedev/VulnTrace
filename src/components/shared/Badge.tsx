import React from 'react';

export type BadgeVariant = 'fix-now' | 'fix-soon' | 'monitor' | 'verified' | 'accent' | 'default';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  icon,
  className = '',
  style,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'fix-now':
        return {
          bg: 'var(--semantic-red-light)',
          color: 'var(--semantic-red)',
          border: '1px solid var(--semantic-red)',
        };
      case 'fix-soon':
        return {
          bg: 'var(--semantic-amber-light)',
          color: 'var(--semantic-amber)',
          border: '1px solid var(--semantic-amber)',
        };
      case 'monitor':
        return {
          bg: 'var(--semantic-gray-light)',
          color: 'var(--semantic-gray)',
          border: '1px solid var(--border)',
        };
      case 'verified':
        return {
          bg: 'var(--semantic-green-light)',
          color: 'var(--semantic-green)',
          border: '1px solid var(--semantic-green)',
        };
      case 'accent':
        return {
          bg: 'var(--accent-light)',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
        };
      default:
        return {
          bg: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        };
    }
  };

  const { bg, color, border } = getColors();

  return (
    <span
      className={`vt-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: 'var(--radius)',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '16px',
        backgroundColor: bg,
        color: color,
        border: border,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </span>
  );
};
