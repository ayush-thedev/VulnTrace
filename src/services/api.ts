import {
  HealthStatus,
  ScanResponse,
  ScanCreateRequest,
  Finding,
  GraphData,
  HumanReviewRecord
} from '../types/api';

const API_BASE_URL = 'http://127.0.0.1:8001/api';

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async listScans(): Promise<ScanResponse[]> {
    const res = await fetch(`${API_BASE_URL}/scans`);
    if (!res.ok) throw new Error(`Failed to list scans: ${res.statusText}`);
    return res.json();
  },

  async createScan(repoPath: string): Promise<ScanResponse> {
    const res = await fetch(`${API_BASE_URL}/scans`, {
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
};
