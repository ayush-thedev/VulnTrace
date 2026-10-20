import React from 'react';
import { PillVariant } from '../../types';

interface PillProps {
  variant: PillVariant;
  children: React.ReactNode;
  className?: string;
}

export const Pill: React.FC<PillProps> = ({ variant, children, className = '' }) => {
  const variantClass = {
    ok: 'pill-ok',
    warn: 'pill-warn',
    run: 'pill-run',
    bad: 'pill-bad',
    mut: 'pill-mut',
  }[variant];

  return (
    <span className={`pill ${variantClass} ${className}`}>
      {children}
    </span>
  );
};
