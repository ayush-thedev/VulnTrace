import React from 'react';

interface RiskMeterProps {
  score?: string;
  maxScore?: string;
  label?: string;
}

export const RiskMeter: React.FC<RiskMeterProps> = ({ label = 'Critical' }) => {
  return (
    <div className="risk-meter">
      <span className="mono text-[10px] tracking-widest text-[#FF4D00] font-semibold">{label}</span>
    </div>
  );
};
