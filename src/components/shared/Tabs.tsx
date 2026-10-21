import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`vt-tabs ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '2px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              border: isActive ? '1px solid var(--border)' : '1px solid transparent',
              fontFamily: 'var(--font-ui)',
              fontSize: '14px',
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              transition: 'all var(--duration) ease',
              outline: 'none',
            }}
          >
            {tab.icon && <span style={{ display: 'inline-flex' }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'var(--bg-surface)',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
