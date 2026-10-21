import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius)',
  style,
  className = '',
}) => {
  return (
    <div
      className={`vt-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        animation: 'pulse 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  );
};
