import React from 'react';

export interface InspectorData {
  logLength: number;
  lastOffset: number;
  nextSeq: number;
  bufferedFrames: number;
  dupCount: number;
  nackCount: number;
  connectionState: string;
  stateHash: string;
  replayStateHash: string;
  hashMatch: boolean;
}

interface InspectorPanelProps {
  data: InspectorData;
  onReplay: () => void;
  visible: boolean;
  onToggle: () => void;
  chaosEnabled?: boolean;
  onToggleChaos?: () => void;
  isSocketOwner?: boolean;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  data,
  onReplay,
  visible,
  onToggle,
  chaosEnabled,
  onToggleChaos,
  isSocketOwner,
}) => {
  if (!visible) {
    return (
      <button
        onClick={onToggle}
        title="Show Binary Stream Inspector"
        style={{
          position: 'fixed', bottom: '70px', right: '24px', zIndex: 50,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '6px 10px',
          fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        ⚡ Inspector
      </button>
    );
  }

  const connColor = data.connectionState === 'connected' ? 'var(--semantic-green)'
    : data.connectionState === 'stalled' ? 'var(--semantic-red)'
    : 'var(--text-tertiary)';

  return (
    <div style={{
      position: 'fixed', bottom: '70px', right: '24px', zIndex: 50, width: '320px',
      background: 'var(--bg-primary)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '12px', fontSize: '11px',
      fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>⚡ Binary Stream Inspector</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '14px' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <Row label="Connection" value={data.connectionState} color={connColor} />
        {isSocketOwner !== undefined && (
          <Row label="Socket Lock" value={isSocketOwner ? 'Owner' : 'Follower'} color={isSocketOwner ? 'var(--semantic-green)' : 'var(--text-tertiary)'} />
        )}
        <Row label="Log length" value={String(data.logLength)} />
        <Row label="Last offset" value={String(data.lastOffset)} />
        <Row label="Next seq" value={String(data.nextSeq)} />
        <Row label="Buffered" value={String(data.bufferedFrames)} />
        <Row label="Duplicates" value={String(data.dupCount)} />
        <Row label="NACKs sent" value={String(data.nackCount)} />
      </div>

      <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>State hash: </span>
          <span style={{ color: 'var(--accent)' }}>{data.stateHash}</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Replay hash: </span>
          <span style={{ color: 'var(--accent)' }}>{data.replayStateHash}</span>
        </div>
        <div style={{
          padding: '4px 8px', borderRadius: '4px',
          background: data.hashMatch ? 'rgba(0,180,100,0.1)' : 'rgba(220,50,50,0.1)',
          color: data.hashMatch ? 'var(--semantic-green)' : 'var(--semantic-red)',
          fontWeight: 600, textAlign: 'center',
        }}>
          {data.hashMatch ? '✓ MATCH' : '✗ MISMATCH'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <button
          onClick={onReplay}
          style={{
            flex: 1, padding: '6px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)',
            fontSize: '11px',
          }}
        >
          ↻ Replay offset 0
        </button>
        {onToggleChaos && (
          <button
            onClick={onToggleChaos}
            style={{
              padding: '6px 10px',
              background: chaosEnabled ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
              border: `1px solid ${chaosEnabled ? 'var(--semantic-red)' : 'var(--border)'}`,
              borderRadius: '4px', cursor: 'pointer',
              color: chaosEnabled ? 'var(--semantic-red)' : 'var(--text-secondary)',
              fontSize: '11px',
            }}
            title="Toggle Chaos Simulation (loss, reorder, duplicate frames)"
          >
            {chaosEnabled ? '🎲 Chaos ON' : '🎲 Chaos OFF'}
          </button>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <>
    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    <span style={{ color: color ?? 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
  </>
);
