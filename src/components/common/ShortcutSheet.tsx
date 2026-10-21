import React from 'react';
import { Modal } from '../shared/Modal';

interface ShortcutSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutSheet: React.FC<ShortcutSheetProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: 'Cmd/Ctrl + K', desc: 'Open Command Palette' },
    { key: 'g r', desc: 'Navigate to Repositories' },
    { key: 'g s', desc: 'Navigate to Scans' },
    { key: 'g f', desc: 'Navigate to Findings' },
    { key: 'j / k', desc: 'Move down / up in findings and repository lists' },
    { key: 'Enter', desc: 'Open selected finding or repository detail' },
    { key: 'Esc', desc: 'Close open drawer, modal, or command palette' },
    { key: '?', desc: 'Show this keyboard shortcuts guide' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {shortcuts.map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: idx < shortcuts.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: '13px',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{s.desc}</span>
            <kbd
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '2px 6px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            >
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
};
