import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-ui)',
    fontSize: size === 'sm' ? '12px' : '14px',
    fontWeight: 500,
    lineHeight: size === 'sm' ? '16px' : '20px',
    padding: size === 'sm' ? '4px 10px' : '6px 14px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'all var(--duration) ease',
    textDecoration: 'none',
    outline: 'none',
    border: '1px solid transparent',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent)',
      color: '#FFFFFF',
      borderColor: 'var(--accent)',
    },
    secondary: {
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent',
    },
    danger: {
      backgroundColor: 'var(--semantic-red)',
      color: '#FFFFFF',
      borderColor: 'var(--semantic-red)',
    },
  };

  return (
    <button
      style={{ ...baseStyles, ...variantStyles[variant] }}
      className={`vt-button ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: '12px',
            height: '12px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        icon && <span style={{ display: 'inline-flex' }}>{icon}</span>
      )}
      {children}
    </button>
  );
};
