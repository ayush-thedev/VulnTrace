import React, { useState, useRef, useCallback } from 'react';

interface LockfileDropZoneProps {
  onDependenciesParsed: (deps: Array<{ name: string; version: string; ecosystem: string; source: string; isPathDep: boolean; sourceAvailable: boolean }>) => void;
  onError: (msg: string) => void;
}

export const LockfileDropZone: React.FC<LockfileDropZoneProps> = ({ onDependenciesParsed, onError }) => {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [depCount, setDepCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      onError('Please drop a package-lock.json file');
      return;
    }
    try {
      const text = await file.text();
      // Dynamic import to avoid bundling lockfileParser in main chunk if not needed
      const { parseLockfile } = await import('../../services/lockfileParser');
      const result = parseLockfile(text);
      if (result.error) {
        onError(result.error);
        return;
      }
      setFileName(file.name);
      setDepCount(result.deps.length);
      onDependenciesParsed(result.deps);
    } catch (e) {
      onError(`Failed to parse file: ${(e as Error).message}`);
    }
  }, [onDependenciesParsed, onError]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onClick = useCallback(() => fileInputRef.current?.click(), []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'rgba(30,51,140,0.05)' : 'transparent',
        transition: 'all 150ms ease',
        marginBottom: '16px',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={onFileSelect}
      />
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {fileName
          ? `✓ ${fileName} — ${depCount} dependencies`
          : '📦 Drop package-lock.json here or click to select'}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
        Parsed client-side · nothing uploaded · supports lockfile v1/v2/v3
      </div>
    </div>
  );
};
