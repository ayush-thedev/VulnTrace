import React, { useState } from 'react';
import { Pill } from '../common/Pill';
import { DependencyUpdateItem } from '../../types';

const INITIAL_UPDATES: DependencyUpdateItem[] = [
  { package: 'lodash', upgrade: '4.17.15 → 4.17.21', advisory: 'CVE-2021-23337', status: { label: 'Awaiting Approval', variant: 'warn' } },
  { package: 'serialize-javascript', upgrade: '5.0.1 → 6.0.2', advisory: 'CVE-2024-11831', status: { label: 'Approved', variant: 'ok' } },
  { package: 'axios', upgrade: '0.21.1 → 1.6.8', advisory: 'CVE-2023-45857', status: { label: 'In Validation', variant: 'run' } },
];

export const RemediationView: React.FC = () => {
  const [updates, setUpdates] = useState<DependencyUpdateItem[]>(INITIAL_UPDATES);
  const [prCreated, setPrCreated] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const handleApprove = (pkgName: string) => {
    setUpdates(prev => prev.map(u => {
      if (u.package === pkgName) {
        return { ...u, status: { label: 'Approved', variant: 'ok' } };
      }
      return u;
    }));
    setNotification(`Approved dependency upgrade for ${pkgName}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreatePR = () => {
    setPrCreated(true);
    setNotification('Pull Request #482 created successfully on github.com/vulntrace-labs/api-gateway/pull/482');
    setTimeout(() => setNotification(null), 4000);
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
          <h2>Remediation</h2>
          <span className="view-sub">Proposed updates · patch review · validation · pull requests</span>
        </div>
        <div className="vt-actions">
          <button 
            className="btn-secondary mono"
            onClick={() => setNotification('Approval Queue: 2 pending patches awaiting senior engineer sign-off.')}
          >
            APPROVAL QUEUE (2)
          </button>
        </div>
      </div>

      {/* Grid: Proposed Updates & Validation */}
      <div className="vt-grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="vt-card overflow-x-auto">
          <div className="vt-card-label mb-2">Proposed Dependency Updates</div>
          <table className="vt-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Upgrade</th>
                <th>Advisory</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((item) => (
                <tr key={item.package} className="hover:bg-white/[0.02] transition-colors">
                  <td className="font-mono text-white font-medium">{item.package}</td>
                  <td className="font-mono text-xs">{item.upgrade}</td>
                  <td className="font-mono text-[10px] text-[#888888]">{item.advisory}</td>
                  <td>
                    {item.status.variant === 'warn' ? (
                      <button
                        onClick={() => handleApprove(item.package)}
                        className="group flex items-center gap-1.5"
                        title="Click to approve upgrade"
                      >
                        <Pill variant="warn">
                          {item.status.label}
                        </Pill>
                        <span className="mono text-[8px] text-[#26DE81] opacity-0 group-hover:opacity-100 transition-opacity">
                          [APPROVE]
                        </span>
                      </button>
                    ) : (
                      <Pill variant={item.status.variant}>
                        {item.status.label}
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="vt-card">
          <div className="vt-card-label mb-2">Test &amp; Security Validation</div>
          <div className="set-row mt-2">
            <span className="set-name">
              UNIT TESTS
              <span className="set-desc">56 / 56 PASSED</span>
            </span>
            <Pill variant="ok">Pass</Pill>
          </div>
          <div className="set-row">
            <span className="set-name">
              SECURITY REGRESSION
              <span className="set-desc">0 NEW ISSUES</span>
            </span>
            <Pill variant="ok">Pass</Pill>
          </div>
          <div className="set-row">
            <span className="set-name">
              SAST DIFF SCAN
              <span className="set-desc">0 NEW FINDINGS</span>
            </span>
            <Pill variant="ok">Pass</Pill>
          </div>
          <div className="set-row">
            <span className="set-name">
              INTEGRATION TESTS
              <span className="set-desc">2 SKIPPED · FLAKY ENV</span>
            </span>
            <Pill variant="warn">Review</Pill>
          </div>
          <div className="set-row">
            <span className="set-name">
              LICENSE COMPLIANCE
              <span className="set-desc">COMPATIBLE</span>
            </span>
            <Pill variant="ok">Pass</Pill>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="vt-banner">
        PATCH AWAITING APPROVAL — applying changes to api-gateway requires reviewer sign-off before a pull request is opened.
      </div>

      {/* PR Card */}
      <div className="vt-card mt-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
          <div>
            <div className="vt-card-label">
              Pull Request #482 · chore(security): bump lodash to 4.17.21 &amp; add deserialization guard
            </div>
            <div className="risk-meta mt-1.5">
              Validation results attached as reviewable comments · target: main
            </div>
          </div>
          <div className="flex gap-2.5 items-center flex-wrap">
            <Pill variant="ok">Checks Passing</Pill>
            <button 
              className="btn-secondary mono"
              onClick={() => setShowGithubModal(true)}
            >
              VIEW ON GITHUB
            </button>
            <button 
              className="btn-primary mono"
              onClick={handleCreatePR}
              disabled={prCreated}
            >
              {prCreated ? 'PULL REQUEST OPENED ✓' : 'CREATE PULL REQUEST'}
            </button>
          </div>
        </div>
      </div>

      {/* GitHub Preview Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[#26262E] w-full max-w-2xl rounded-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-white">GitHub PR #482 Diff Preview</h3>
                <span className="mono text-[10px] text-[#55555E]">vulntrace-labs/api-gateway (branch: patch/security-f2847)</span>
              </div>
              <button onClick={() => setShowGithubModal(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="bg-[#050508] border border-[#1C1C22] p-4 rounded font-mono text-xs overflow-x-auto space-y-1">
              <div className="text-gray-500">diff --git a/package.json b/package.json</div>
              <div className="text-red-400">-    "lodash": "^4.17.15",</div>
              <div className="text-green-400">+    "lodash": "^4.17.21",</div>
              <div className="text-gray-500 mt-2">diff --git a/src/utils/serialize.ts b/src/utils/serialize.ts</div>
              <div className="text-gray-400">@@ -14,6 +14,8 @@ export function deserialize(input: string) &#123;</div>
              <div className="text-green-400">+    // Security guard against prototype pollution (CVE-2021-23337)</div>
              <div className="text-green-400">+    if (/(__proto__|constructor|prototype)/.test(input)) throw new Error("Blocked payload");</div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowGithubModal(false)} className="btn-secondary mono">CLOSE</button>
              <button 
                onClick={() => {
                  handleCreatePR();
                  setShowGithubModal(false);
                }} 
                className="btn-primary mono"
              >
                CONFIRM &amp; MERGE PR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
