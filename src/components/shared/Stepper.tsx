import React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';

export interface StepItem {
  id: string | number;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, className = '' }) => {
  return (
    <div
      className={`vt-stepper ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        overflowX: 'auto',
        padding: '4px 0',
      }}
    >
      {steps.map((step, idx) => {
        const isDone = step.status === 'done';
        const isRunning = step.status === 'running';
        const isFailed = step.status === 'failed';

        const stepColor = isDone
          ? 'var(--semantic-green)'
          : isRunning
          ? 'var(--accent)'
          : isFailed
          ? 'var(--semantic-red)'
          : 'var(--text-muted)';

        const stepBg = isDone
          ? 'var(--semantic-green-light)'
          : isRunning
          ? 'var(--accent-light)'
          : isFailed
          ? 'var(--semantic-red-light)'
          : 'var(--bg-surface)';

        return (
          <React.Fragment key={step.id}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: stepBg,
                  border: `1px solid ${stepColor}`,
                  color: stepColor,
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {isDone && <Check size={14} />}
                {isRunning && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {isFailed && <AlertCircle size={14} />}
                {!isDone && !isRunning && !isFailed && <span>{idx + 1}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isRunning ? 500 : 400,
                    color: isRunning || isDone ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {step.detail}
                  </span>
                )}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: isDone ? 'var(--semantic-green)' : 'var(--border)',
                  minWidth: '16px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
