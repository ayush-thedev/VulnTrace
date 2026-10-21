import {
  HealthStatus,
  ScanResponse,
  ScanCreateRequest,
  Finding,
  GraphData,
  HumanReviewRecord,
  Repository,
  RepositoryCreateRequest,
  FixResponse
} from '../types/api';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async listRepositories(): Promise<Repository[]> {
    const res = await fetch(`${API_BASE_URL}/repositories`);
    if (!res.ok) throw new Error(`Failed to list repositories: ${res.statusText}`);
    return res.json();
  },

  async getRepository(repoId: string): Promise<Repository> {
    const res = await fetch(`${API_BASE_URL}/repositories/${repoId}`);
    if (!res.ok) throw new Error(`Failed to fetch repository ${repoId}`);
    return res.json();
  },

  async createRepository(url: string, branch?: string): Promise<Repository> {
    const res = await fetch(`${API_BASE_URL}/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, branch } as RepositoryCreateRequest),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Repository registration failed: ${res.statusText}`);
    }
    return res.json();
  },

  async deleteRepository(repoId: string): Promise<{ status: string; id: string }> {
    const res = await fetch(`${API_BASE_URL}/repositories/${repoId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete repository ${repoId}`);
    return res.json();
  },

  async listScans(): Promise<ScanResponse[]> {
    const res = await fetch(`${API_BASE_URL}/scans`);
    if (!res.ok) throw new Error(`Failed to list scans: ${res.statusText}`);
    return res.json();
  },

  async createScan(repoPath: string, sync: boolean = false): Promise<ScanResponse> {
    const url = sync ? `${API_BASE_URL}/scans?sync=true` : `${API_BASE_URL}/scans`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_path: repoPath } as ScanCreateRequest),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Scan creation failed: ${res.statusText}`);
    }
    return res.json();
  },

  async cancelScan(scanId: string): Promise<{ status: string; id: string }> {
    const res = await fetch(`${API_BASE_URL}/scans/${scanId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to cancel scan ${scanId}`);
    return res.json();
  },

  getScanStreamUrl(scanId: string): string {
    return `${API_BASE_URL}/scans/${scanId}/stream`;
  },

  async getScan(scanId: string): Promise<ScanResponse> {
    const res = await fetch(`${API_BASE_URL}/scans/${scanId}`);
    if (!res.ok) throw new Error(`Failed to fetch scan ${scanId}`);
    return res.json();
  },

  async getScanFindings(scanId: string): Promise<Finding[]> {
    const res = await fetch(`${API_BASE_URL}/scans/${scanId}/findings`);
    if (!res.ok) throw new Error(`Failed to fetch findings for ${scanId}`);
    return res.json();
  },

  async getScanFixes(scanId: string): Promise<FixResponse[]> {
    const res = await fetch(`${API_BASE_URL}/scans/${scanId}/fixes`);
    if (!res.ok) throw new Error(`Failed to fetch fixes for scan ${scanId}`);
    return res.json();
  },

  async getFix(fixId: string): Promise<FixResponse> {
    const res = await fetch(`${API_BASE_URL}/fixes/${fixId}`);
    if (!res.ok) throw new Error(`Failed to fetch fix ${fixId}`);
    return res.json();
  },

  async getFinding(findingId: string): Promise<Finding> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}`);
    if (!res.ok) throw new Error(`Failed to fetch finding ${findingId}`);
    return res.json();
  },

  async getFindingGraph(findingId: string): Promise<GraphData> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}/graph`);
    if (!res.ok) throw new Error(`Failed to fetch graph for finding ${findingId}`);
    return res.json();
  },

  async validateRemediation(findingId: string): Promise<Finding> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}/remediation/validate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Validation failed for finding ${findingId}`);
    return res.json();
  },

  async recordHumanReview(
    findingId: string,
    decision: 'accept' | 'reject' | 'needs_more_info',
    notes?: string
  ): Promise<Finding> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        reviewer_notes: notes,
        reviewed_at: new Date().toISOString(),
      } as HumanReviewRecord),
    });
    if (!res.ok) throw new Error(`Review recording failed for ${findingId}`);
    return res.json();
  },

  async dismissFinding(findingId: string, reason: string, notes?: string): Promise<Finding> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, notes }),
    });
    if (!res.ok) throw new Error(`Dismiss failed for ${findingId}`);
    return res.json();
  },

  async runProofTest(findingId: string): Promise<{ status: string; result: string; logs: string; test_code?: string; command?: string }> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}/proof`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Proof test failed for ${findingId}`);
    return res.json();
  },

  async exportFinding(findingId: string, format: 'json' | 'sarif' | 'markdown' | 'csv'): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/findings/${findingId}/export?format=${format}`);
    if (!res.ok) throw new Error(`Export failed for ${findingId}`);
    return res.text();
  },
};
