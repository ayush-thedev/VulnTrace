export type ViewId = 
  | 'overview' 
  | 'repositories' 
  | 'scans' 
  | 'findings' 
  | 'fixes'
  | 'dependency-graph' 
  | 'agents' 
  | 'remediation' 
  | 'settings';

export interface BreadcrumbInfo {
  title: string;
  badge?: string;
}

export const CRUMB_MAP: Record<ViewId, [string, string]> = {
  'overview': ['Overview', ''],
  'repositories': ['Repositories', ''],
  'scans': ['Scans', ''],
  'findings': ['Findings', ''],
  'fixes': ['Fixes', ''],
  'dependency-graph': ['Dependency Graph', ''],
  'agents': ['Agents', ''],
  'remediation': ['Fixes', ''],
  'settings': ['Settings', '']
};

export type PillVariant = 'ok' | 'warn' | 'run' | 'bad' | 'mut';

export interface RepositoryItem {
  name: string;
  language: string;
  lastScan: string;
  findings: string | number;
  reachability: string;
  status: {
    label: string;
    variant: PillVariant;
  };
}

export interface ScanItem {
  id: string;
  repository: string;
  type: string;
  findings: string | number;
  status: {
    label: string;
    variant: PillVariant;
  };
  duration: string;
}

export interface AgentItem {
  id: string;
  name: string;
  status: {
    label: string;
    variant: PillVariant;
  };
  description: string;
  stats: string[];
}

export interface LogItem {
  time: string;
  text: string;
}

export interface DependencyUpdateItem {
  package: string;
  upgrade: string;
  advisory: string;
  status: {
    label: string;
    variant: PillVariant;
  };
}

export interface ValidationItem {
  name: string;
  desc: string;
  status: {
    label: string;
    variant: PillVariant;
  };
}

export interface DependencyGraphNode {
  id: string;
  label: string;
  tag: string;
  type: 'clean' | 'high' | 'medium' | 'critical' | 'root';
  x: number;
  y: number;
  r: number;
  cveInfo?: string;
  affectedPaths?: Array<{
    severity: 'Critical' | 'High' | 'Medium';
    title: string;
    meta: string;
  }>;
}
