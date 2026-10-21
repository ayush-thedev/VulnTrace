import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLine?: number;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  showLineNumbers = false,
  highlightLine,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const lines = code.trimEnd().split('\n');

  return (
    <div
      className={`vt-code-block ${className}`}
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '18px',
      }}
    >
      {/* Header bar if language or copy button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          style={{
            background: 'none',
            border: 'none',
            color: copied ? 'var(--semantic-green)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code contents */}
      <div style={{ padding: '12px', overflowX: 'auto' }}>
        <pre style={{ margin: 0 }}>
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const isHighlighted = highlightLine === lineNum;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  backgroundColor: isHighlighted ? 'var(--accent-light)' : 'transparent',
                  padding: '1px 0',
                }}
              >
                {showLineNumbers && (
                  <span
                    style={{
                      width: '36px',
                      color: 'var(--text-muted)',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}
                  >
                    {lineNum}
                  </span>
                )}
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>{line || ' '}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};
