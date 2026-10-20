import React, { useState } from 'react';
import { Pill } from '../common/Pill';
import { RepositoryItem } from '../../types';

const INITIAL_REPOS: RepositoryItem[] = [
  {
    name: 'api-gateway',
    language: 'TypeScript',
    lastScan: '2h ago',
    findings: 12,
    reachability: '18 CONFIRMED',
    status: { label: 'Active', variant: 'ok' }
  },
  {
    name: 'checkout-service',
    language: 'Go',
    lastScan: '5h ago',
    findings: 3,
    reachability: '4 CONFIRMED',
    status: { label: 'Active', variant: 'ok' }
  },
  {
    name: 'billing-worker',
    language: 'Python',
    lastScan: '1d ago',
    findings: 7,
    reachability: '2 INCONCLUSIVE',
    status: { label: 'Evidence Incomplete', variant: 'warn' }
  },
  {
    name: 'legacy-auth',
    language: 'Java',
    lastScan: '3d ago',
    findings: '—',
    reachability: '—',
    status: { label: 'Scan Failed', variant: 'bad' }
  },
  {
    name: 'notifications-svc',
    language: '—',
    lastScan: '—',
    findings: '—',
    reachability: '—',
    status: { label: 'Not Connected', variant: 'mut' }
  }
];

export const RepositoriesView: React.FC = () => {
  const [repos, setRepos] = useState<RepositoryItem[]>(INITIAL_REPOS);
  const [filterQuery, setFilterQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [importLanguage, setImportLanguage] = useState('TypeScript');

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    r.language.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoUrl.trim()) return;

    const repoName = newRepoUrl.split('/').pop()?.replace('.git', '') || 'new-service';
    const newRepo: RepositoryItem = {
      name: repoName,
      language: importLanguage,
      lastScan: 'Just now',
      findings: 0,
      reachability: 'ANALYZING',
      status: { label: 'Active', variant: 'ok' }
    };

    setRepos([newRepo, ...repos]);
    setNewRepoUrl('');
    setShowImportModal(false);
  };

  return (
    <div className="view-body">
      <div className="view-heading">
        <div>
          <h2>Repositories</h2>
          <span className="view-sub">23 connected · github.com/vulntrace-labs</span>
        </div>
        <div className="vt-actions">
          <button 
            className="btn-primary mono"
            onClick={() => setShowImportModal(true)}
          >
            IMPORT REPOSITORY
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="FILTER REPOSITORIES..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-[#0E0E12] border border-[#1C1C22] text-xs font-mono px-3 py-2 text-white placeholder-[#55555E] focus:outline-none focus:border-[#55555E] rounded"
          />
        </div>
        <div className="mono text-[10px] text-[#55555E]">
          SHOWING {filteredRepos.length} OF {repos.length} REPOSITORIES
        </div>
      </div>

      <div className="vt-card mt-4 overflow-x-auto" style={{ padding: '8px 20px 12px 20px' }}>
        <table className="vt-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Language</th>
              <th>Last Scan</th>
              <th>Findings</th>
              <th>Reachability</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepos.map((repo) => (
              <tr key={repo.name} className="hover:bg-white/[0.02] transition-colors">
                <td className="font-mono text-white font-medium">{repo.name}</td>
                <td>{repo.language}</td>
                <td>{repo.lastScan}</td>
                <td>{repo.findings}</td>
                <td className="font-mono text-[10px]">{repo.reachability}</td>
                <td>
                  <Pill variant={repo.status.variant}>
                    {repo.status.label}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0E0E12] border border-[#26262E] w-full max-w-md rounded-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-lg font-semibold text-white">Import Repository</h3>
              <button 
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleImport}>
              <div className="mb-4">
                <label className="mono text-[10px] text-[#888888] block mb-2">Repository URL / Name</label>
                <input
                  type="text"
                  placeholder="github.com/vulntrace-labs/user-auth"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  className="w-full bg-[#141419] border border-[#2A2A33] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4655] rounded"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="mono text-[10px] text-[#888888] block mb-2">Primary Language</label>
                <select
                  value={importLanguage}
                  onChange={(e) => setImportLanguage(e.target.value)}
                  className="w-full bg-[#141419] border border-[#2A2A33] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4655] rounded"
                >
                  <option value="TypeScript">TypeScript</option>
                  <option value="Go">Go</option>
                  <option value="Python">Python</option>
                  <option value="Java">Java</option>
                  <option value="Rust">Rust</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary mono"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-primary mono"
                >
                  START INGESTION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
