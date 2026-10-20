import React, { useState } from 'react';
import { Pill } from '../common/Pill';
import { ToggleSwitch } from '../common/ToggleSwitch';

export const SettingsView: React.FC = () => {
  // Repository integrations
  const [githubEnterprise, setGithubEnterprise] = useState(true);
  const [gitlab, setGitlab] = useState(false);

  // Security tool integrations
  const [snyk, setSnyk] = useState(true);
  const [semgrep, setSemgrep] = useState(true);
  const [trivy, setTrivy] = useState(false);

  // Scan preferences
  const [autoRemediate, setAutoRemediate] = useState(true);
  const [inconclusiveEvidence, setInconclusiveEvidence] = useState(true);

  const [notification, setNotification] = useState<string | null>(null);

  const handleSave = () => {
    setNotification('Workspace settings and integration preferences successfully saved.');
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
          <h2>Settings</h2>
          <span className="view-sub">Workspace preferences · integrations · access</span>
        </div>
        <div className="vt-actions">
          <button 
            className="btn-primary mono"
            onClick={handleSave}
          >
            SAVE CHANGES
          </button>
        </div>
      </div>

      <div className="vt-grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] items-start">
        {/* ID Card */}
        <div className="id-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '9px', letterSpacing: '2px', color: '#55555E' }}>
              VT · ACCESS CREDENTIAL
            </span>
            <Pill variant="ok">Verified</Pill>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '22px' }}>
            <div className="id-avatar">AV</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 600, color: '#EAEAEF' }}>
                Alex Varga
              </div>
              <div className="mono" style={{ fontSize: '10px', color: '#55555E', marginTop: '4px', letterSpacing: '1px' }}>
                SECURITY ENGINEER · ADMIN
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <div className="set-row">
              <span className="set-name">
                WORKSPACE ID
                <span className="set-desc">VT-0x2F41</span>
              </span>
              <span className="agent-stat">MFA ENABLED</span>
            </div>
            <div className="set-row">
              <span className="set-name">
                SCOPE
                <span className="set-desc">ALL REPOSITORIES · EVIDENCE RETENTION 90 DAYS</span>
              </span>
              <Pill variant="mut">FULL ACCESS</Pill>
            </div>
          </div>

          <div className="id-barcode" />
          <div className="mono" style={{ fontSize: '9px', letterSpacing: '2px', color: '#3A3A46', marginTop: '8px', textAlign: 'center' }}>
            0x2F41-88C4-VULNTRACE
          </div>
        </div>

        {/* Settings Columns */}
        <div>
          {/* Repository Integrations */}
          <div className="vt-card">
            <div className="vt-card-label">Repository Integrations</div>
            <div className="set-row mt-1.5">
              <span className="set-name">
                GitHub Enterprise
                <span className="set-desc">github.com/vulntrace-labs · 23 repos synced</span>
              </span>
              <ToggleSwitch 
                checked={githubEnterprise} 
                onChange={setGithubEnterprise} 
                ariaLabel="Toggle GitHub Enterprise"
              />
            </div>
            <div className="set-row">
              <span className="set-name">
                GitLab
                <span className="set-desc">{gitlab ? 'connected' : 'not connected'}</span>
              </span>
              <ToggleSwitch 
                checked={gitlab} 
                onChange={setGitlab} 
                ariaLabel="Toggle GitLab"
              />
            </div>
          </div>

          {/* Security Tool Integrations */}
          <div className="vt-card mt-4">
            <div className="vt-card-label">Security Tool Integrations</div>
            <div className="set-row mt-1.5">
              <span className="set-name">
                Snyk
                <span className="set-desc">advisory feed cross-reference</span>
              </span>
              <ToggleSwitch 
                checked={snyk} 
                onChange={setSnyk} 
                ariaLabel="Toggle Snyk"
              />
            </div>
            <div className="set-row">
              <span className="set-name">
                Semgrep
                <span className="set-desc">static analysis evidence</span>
              </span>
              <ToggleSwitch 
                checked={semgrep} 
                onChange={setSemgrep} 
                ariaLabel="Toggle Semgrep"
              />
            </div>
            <div className="set-row">
              <span className="set-name">
                Trivy
                <span className="set-desc">container scanning</span>
              </span>
              <ToggleSwitch 
                checked={trivy} 
                onChange={setTrivy} 
                ariaLabel="Toggle Trivy"
              />
            </div>
          </div>

          {/* Scan Preferences */}
          <div className="vt-card mt-4">
            <div className="vt-card-label">Scan Preferences</div>
            <div className="set-row mt-1.5">
              <span className="set-name">
                Auto-remediate criticals
                <span className="set-desc">draft patches automatically</span>
              </span>
              <ToggleSwitch 
                checked={autoRemediate} 
                onChange={setAutoRemediate} 
                ariaLabel="Toggle Auto-remediate criticals"
              />
            </div>
            <div className="set-row">
              <span className="set-name">
                Inconclusive evidence
                <span className="set-desc">flag for analyst review</span>
              </span>
              <ToggleSwitch 
                checked={inconclusiveEvidence} 
                onChange={setInconclusiveEvidence} 
                ariaLabel="Toggle Inconclusive evidence"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
