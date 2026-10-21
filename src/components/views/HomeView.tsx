import React, { useState } from 'react';
import { Input, Button } from '../shared';
import { ArrowRight, Play } from 'lucide-react';

interface HomeViewProps {
  onStartScan: (target: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onStartScan }) => {
  const [repoInput, setRepoInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput.trim()) {
      onStartScan(repoInput.trim());
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 16px',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--accent)',
          fontSize: '18px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        V
      </div>

      <h1 style={{ fontSize: '24px', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
        VulnTrace
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '28px' }}>
        Evidence-driven vulnerability reachability and assisted remediation
      </p>

      {/* One prominent input + button */}
      <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <Input
            autoFocus
            placeholder="Paste a GitHub link..."
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
          />
        </div>
        <Button variant="primary" type="submit" icon={<ArrowRight size={14} />}>
          Scan
        </Button>
      </form>

      {/* Try the demo link */}
      <div>
        <button
          type="button"
          onClick={() => onStartScan('demo-fixture')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Play size={12} />
          <span>Try the demo</span>
        </button>
      </div>
    </div>
  );
};
