import React, { useState } from 'react';
import { Pill } from '../common/Pill';
import { ViewId } from '../../types';

interface OverviewViewProps {
  onNavigate: (view: ViewId) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="view-body">
      {notification && (
        <div className="mb-4 bg-[#1B1B24] border border-[#26DE81]/40 text-[#26DE81] px-4 py-2 rounded font-mono text-xs flex justify-between items-center transition-all animate-fade-in">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white ml-4">✕</button>
        </div>
      )}

      <div className="view-heading">
        <div>
          <h2>Security Overview</h2>
          <span className="view-sub">Fleet-wide posture · evidence-driven · updated 2 min ago</span>
        </div>
        <div className="vt-actions">
          <button 
            className="btn-secondary mono"
            onClick={() => showNotification("Security report exported: report-vulntrace-2024.pdf")}
          >
            EXPORT REPORT
          </button>
          <button 
            className="btn-primary mono"
            onClick={() => {
              showNotification("Initiating Full Scan across all 23 repositories...");
              setTimeout(() => onNavigate('scans'), 700);
            }}
          >
            RUN FULL SCAN
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="vt-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="vt-card cursor-pointer" onClick={() => onNavigate('findings')}>
          <div className="vt-card-label">Active Findings</div>
          <div className="vt-card-value">47</div>
          <div className="vt-card-delta">
            <span className="sev-critical">12 CRITICAL</span> · 6 RESOLVED THIS WEEK
          </div>
        </div>
        <div className="vt-card cursor-pointer" onClick={() => onNavigate('repositories')}>
          <div className="vt-card-label">Repositories</div>
          <div className="vt-card-value">23</div>
          <div className="vt-card-delta">20 MONITORED · 3 PENDING IMPORT</div>
        </div>
        <div className="vt-card cursor-pointer" onClick={() => onNavigate('scans')}>
          <div className="vt-card-label">Scan Coverage</div>
          <div className="vt-card-value">92%</div>
          <div className="vt-card-delta">
            <span className="sev-ok">+4%</span> VS LAST CYCLE
          </div>
        </div>
        <div className="vt-card cursor-pointer" onClick={() => onNavigate('remediation')}>
          <div className="vt-card-label">PRs Merged</div>
          <div className="vt-card-value">128</div>
          <div className="vt-card-delta">VERIFIED REMEDIATIONS TO DATE</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="vt-grid grid-cols-1 lg:grid-cols-2">
        <div className="vt-card">
          <div className="vt-card-label">Findings by Severity</div>
          <div className="bar-row">
            <span className="bar-label">Critical</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '25%', background: '#FF4655' }} />
            </div>
            <span className="bar-count">12</span>
          </div>
          <div className="bar-row">
            <span className="bar-label">High</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '31%', background: '#FF9F43' }} />
            </div>
            <span className="bar-count">15</span>
          </div>
          <div className="bar-row">
            <span className="bar-label">Medium</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '29%', background: '#FECA57' }} />
            </div>
            <span className="bar-count">14</span>
          </div>
          <div className="bar-row">
            <span className="bar-label">Low</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '12%', background: '#5C7CFA' }} />
            </div>
            <span className="bar-count">6</span>
          </div>
        </div>

        <div className="vt-card">
          <div className="vt-card-label">Reachability Breakdown</div>
          <div className="reach-row">
            <span className="dot" style={{ background: '#26DE81' }} />
            <span className="reach-label">Confirmed</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '38%', background: '#26DE81' }} />
            </div>
            <span className="bar-count">18</span>
          </div>
          <div className="reach-row">
            <span className="dot" style={{ background: '#FF9F43' }} />
            <span className="reach-label">Inconclusive</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '19%', background: '#FF9F43' }} />
            </div>
            <span className="bar-count">9</span>
          </div>
          <div className="reach-row">
            <span className="dot" style={{ background: '#3A3A46' }} />
            <span className="reach-label">Unobserved</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: '43%', background: '#3A3A46' }} />
            </div>
            <span className="bar-count">20</span>
          </div>
          <div className="vt-note">
            Confirmed reachability is verified through execution-path tracing. Inconclusive evidence is flagged for analyst review, never auto-resolved.
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="vt-grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="vt-card overflow-x-auto">
          <div className="flex justify-between items-center mb-2">
            <div className="vt-card-label">Recent Scans</div>
            <button 
              onClick={() => onNavigate('scans')}
              className="mono text-[9px] text-[#55555E] hover:text-white transition-colors"
            >
              VIEW ALL →
            </button>
          </div>
          <table className="vt-table">
            <thead>
              <tr>
                <th>Scan ID</th>
                <th>Repository</th>
                <th>Type</th>
                <th>Findings</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr className="cursor-pointer" onClick={() => onNavigate('scans')}>
                <td className="text-white font-mono">SCAN-2290</td>
                <td>api-gateway</td>
                <td>FULL</td>
                <td>12</td>
                <td><Pill variant="ok">Completed</Pill></td>
                <td>14m 32s</td>
              </tr>
              <tr className="cursor-pointer" onClick={() => onNavigate('scans')}>
                <td className="text-white font-mono">SCAN-2289</td>
                <td>checkout-service</td>
                <td>INCREMENTAL</td>
                <td>3</td>
                <td><Pill variant="ok">Completed</Pill></td>
                <td>6m 04s</td>
              </tr>
              <tr className="cursor-pointer" onClick={() => onNavigate('scans')}>
                <td className="text-white font-mono">SCAN-2288</td>
                <td>legacy-auth</td>
                <td>FULL</td>
                <td>—</td>
                <td><Pill variant="bad">Failed · Retry</Pill></td>
                <td>2m 11s</td>
              </tr>
              <tr className="cursor-pointer" onClick={() => onNavigate('scans')}>
                <td className="text-white font-mono">SCAN-2287</td>
                <td>billing-worker</td>
                <td>FULL</td>
                <td>—</td>
                <td><Pill variant="mut">Cancelled</Pill></td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="vt-card">
          <div className="flex justify-between items-center mb-2">
            <div className="vt-card-label">Top Risk · Attack Surface</div>
            <button 
              onClick={() => onNavigate('findings')}
              className="mono text-[9px] text-[#55555E] hover:text-white transition-colors"
            >
              INSPECT →
            </button>
          </div>
          <div 
            className="risk-item mt-2 cursor-pointer group"
            onClick={() => onNavigate('findings')}
          >
            <Pill variant="bad">Critical</Pill>
            <div>
              <span className="risk-title group-hover:text-[#FF4655] transition-colors">
                F-2847 · Deserialization of Untrusted Data
              </span>
              <span className="risk-meta">serialize-javascript@5.0.1 · attacker-controlled input · exploit available</span>
            </div>
          </div>
          <div 
            className="risk-item cursor-pointer group"
            onClick={() => onNavigate('findings')}
          >
            <Pill variant="warn">High</Pill>
            <div>
              <span className="risk-title group-hover:text-[#FF9F43] transition-colors">
                F-2841 · Prototype Pollution
              </span>
              <span className="risk-meta">lodash@4.17.15 · confirmed reachability</span>
            </div>
          </div>
          <div 
            className="risk-item cursor-pointer group"
            onClick={() => onNavigate('findings')}
          >
            <Pill variant="warn">High</Pill>
            <div>
              <span className="risk-title group-hover:text-[#FF9F43] transition-colors">
                F-2839 · SSRF in Request Handler
              </span>
              <span className="risk-meta">axios@0.21.1 · inconclusive evidence · flagged for review</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
