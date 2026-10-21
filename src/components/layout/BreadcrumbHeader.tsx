import React from 'react';
import { ViewId, CRUMB_MAP } from '../../types';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbHeaderProps {
  activeView: ViewId;
  segments?: BreadcrumbSegment[];
}

export const BreadcrumbHeader: React.FC<BreadcrumbHeaderProps> = ({ activeView, segments }) => {
  const defaultLabel = CRUMB_MAP[activeView]?.[0] || 'Repositories';

  const items: BreadcrumbSegment[] = segments && segments.length > 0
    ? segments
    : [{ label: 'VulnTrace' }, { label: defaultLabel }];

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginBottom: '20px',
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {item.label}
              </button>
            ) : (
              <span
                style={{
                  color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isLast ? 500 : 400,
                }}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
