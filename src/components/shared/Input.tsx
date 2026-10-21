import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  prefixIcon,
  suffixIcon,
  className = '',
  style,
  disabled,
  ...props
}, ref) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: `1px solid ${error ? 'var(--semantic-red)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          backgroundColor: disabled ? 'var(--bg-surface)' : 'var(--bg-primary)',
          padding: '0 10px',
          height: '36px',
          transition: 'border-color var(--duration) ease',
        }}
      >
        {prefixIcon && <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>{prefixIcon}</span>}
        <input
          ref={ref}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            lineHeight: '20px',
            width: '100%',
            ...style,
          }}
          className={`vt-input ${className}`}
          {...props}
        />
        {suffixIcon && <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>{suffixIcon}</span>}
      </div>
      {error ? (
        <span style={{ fontSize: '12px', color: 'var(--semantic-red)' }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{helperText}</span>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
