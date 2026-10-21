// Pure event-sourced reducer for VulnTrace scan state
// No Date.now, Math.random, IO, or mutation. Time from event.ts.

// --- Event Types ---

export interface HopData {
  nodeId: string;
  filePath: string;
  functionName: string;
  lineNumber: number;
  isEntryPoint: boolean;
  callResolved: boolean;
}

export interface CheckData {
  checkName: string;
  passed: boolean;
  category?: string;
  durationSeconds: number;
}

export type ScanEvent =
  | { type: 'SCAN_STARTED'; scanId: string; seq: number; ts: number; payload: { repoPath: string; repoUrl?: string } }
  | { type: 'DEPENDENCY_FOUND'; scanId: string; seq: number; ts: number; payload: { name: string; version: string; ecosystem: string; source?: string; isPathDep?: boolean; sourceAvailable?: boolean } }
  | { type: 'VULN_FOUND'; scanId: string; seq: number; ts: number; payload: { vulnId: string; aliases: string[]; summary: string; severity: string; packageName: string; ecosystem: string; affectedRange: string; fixedVersions: string[]; advisoryUrl?: string } }
  | { type: 'PATH_FOUND'; scanId: string; seq: number; ts: number; payload: { pathId: string; entryPointId: string; vulnerableTargetId: string; hops: HopData[]; containsUnresolvedCall: boolean } }
  | { type: 'VERDICT'; scanId: string; seq: number; ts: number; payload: { vulnId: string; verdict: string; confidenceNote: string; caveats: string[]; evidenceRefs: string[]; rationale: string } }
  | { type: 'RISK'; scanId: string; seq: number; ts: number; payload: { vulnId: string; band: string; rationale: string } }
  | { type: 'REMEDIATION'; scanId: string; seq: number; ts: number; payload: { vulnId: string; diff: string; targetFile: string; originalVersion: string; targetVersion: string; rationale: string; status: string } }
  | { type: 'VALIDATION'; scanId: string; seq: number; ts: number; payload: { vulnId: string; status: string; checks: CheckData[]; executedInSandbox: boolean } }
  | { type: 'SCAN_COMPLETED'; scanId: string; seq: number; ts: number; payload: { findingsCount: number } }
  | { type: 'RESET'; scanId: string; seq: number; ts: number; payload: Record<string, never> };

// --- State ---

export interface DepInfo { name: string; version: string; ecosystem: string; source?: string; isPathDep?: boolean; sourceAvailable?: boolean }
export interface VulnInfo { vulnId: string; aliases: string[]; summary: string; severity: string; packageName: string; ecosystem: string; affectedRange: string; fixedVersions: string[]; advisoryUrl?: string }
export interface PathInfo { pathId: string; entryPointId: string; vulnerableTargetId: string; hops: HopData[]; containsUnresolvedCall: boolean }
export interface VerdictInfo { verdict: string; rawVerdict?: string; confidenceNote: string; caveats: string[]; evidenceRefs: string[]; rationale: string; downgradeReason?: string }
export interface RiskInfo { band: string; rationale: string }
export interface RemInfo { diff: string; targetFile: string; originalVersion: string; targetVersion: string; rationale: string; status: string }
export interface ValInfo { status: string; checks: CheckData[]; executedInSandbox: boolean }

export interface ScanState {
  scanId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stalled';
  repoPath: string;
  repoUrl: string;
  startedAt: number;
  completedAt: number | null;
  dependencies: ReadonlyMap<string, DepInfo>;
  vulnerabilities: ReadonlyMap<string, VulnInfo>;
  paths: ReadonlyMap<string, PathInfo>;
  verdicts: ReadonlyMap<string, VerdictInfo>;
  risks: ReadonlyMap<string, RiskInfo>;
  remediations: ReadonlyMap<string, RemInfo>;
  validations: ReadonlyMap<string, ValInfo>;
  eventCount: number;
  lastEventTs: number;
}

export const INITIAL_STATE: ScanState = {
  scanId: null,
  status: 'idle',
  repoPath: '',
  repoUrl: '',
  startedAt: 0,
  completedAt: null,
  dependencies: new Map(),
  vulnerabilities: new Map(),
  paths: new Map(),
  verdicts: new Map(),
  risks: new Map(),
  remediations: new Map(),
  validations: new Map(),
  eventCount: 0,
  lastEventTs: 0,
};

// --- Reducer ---

export function reduce(state: ScanState, event: ScanEvent): ScanState {
  const base = { ...state, eventCount: state.eventCount + 1, lastEventTs: event.ts };

  switch (event.type) {
    case 'RESET':
      return { ...INITIAL_STATE, eventCount: base.eventCount, lastEventTs: event.ts };

    case 'SCAN_STARTED':
      return {
        ...base,
        scanId: event.scanId,
        status: 'running',
        repoPath: event.payload.repoPath,
        repoUrl: event.payload.repoUrl ?? '',
        startedAt: event.ts,
        completedAt: null,
        dependencies: new Map(),
        vulnerabilities: new Map(),
        paths: new Map(),
        verdicts: new Map(),
        risks: new Map(),
        remediations: new Map(),
        validations: new Map(),
      };

    case 'DEPENDENCY_FOUND': {
      const deps = new Map(state.dependencies);
      deps.set(event.payload.name, event.payload);
      return { ...base, dependencies: deps };
    }

    case 'VULN_FOUND': {
      const vulns = new Map(state.vulnerabilities);
      vulns.set(event.payload.vulnId, event.payload);
      return { ...base, vulnerabilities: vulns };
    }

    case 'PATH_FOUND': {
      const paths = new Map(state.paths);
      paths.set(event.payload.pathId, event.payload);
      return { ...base, paths: paths };
    }

    case 'VERDICT': {
      const verdicts = new Map(state.verdicts);
      let verdict = event.payload.verdict;
      let rawVerdict: string | undefined;
      let downgradeReason: string | undefined;

      if (verdict === 'reachable') {
        // Downgrade check 1: path dependency with missing source
        const vuln = state.vulnerabilities.get(event.payload.vulnId);
        if (vuln) {
          const dep = state.dependencies.get(vuln.packageName);
          if (dep?.isPathDep === true && dep.sourceAvailable !== true) {
            rawVerdict = 'reachable';
            verdict = 'uncertain';
            downgradeReason = 'Path dependency target source missing';
          }
        }

        // Downgrade check 2: evidence refs missing from graph
        if (verdict === 'reachable') {
          const allNodeIds = new Set<string>();
          for (const [pathId, pathInfo] of state.paths) {
            allNodeIds.add(pathId);
            for (const hop of pathInfo.hops) {
              allNodeIds.add(hop.nodeId);
            }
          }
          const missingRef = event.payload.evidenceRefs.some(ref => !allNodeIds.has(ref));
          if (missingRef) {
            rawVerdict = 'reachable';
            verdict = 'uncertain';
            downgradeReason = 'Evidence references missing graph nodes';
          }
        }
      }

      verdicts.set(event.payload.vulnId, {
        verdict,
        rawVerdict,
        confidenceNote: event.payload.confidenceNote,
        caveats: event.payload.caveats,
        evidenceRefs: event.payload.evidenceRefs,
        rationale: event.payload.rationale,
        downgradeReason,
      });
      return { ...base, verdicts };
    }

    case 'RISK': {
      const risks = new Map(state.risks);
      risks.set(event.payload.vulnId, { band: event.payload.band, rationale: event.payload.rationale });
      return { ...base, risks };
    }

    case 'REMEDIATION': {
      const rems = new Map(state.remediations);
      rems.set(event.payload.vulnId, event.payload);
      return { ...base, remediations: rems };
    }

    case 'VALIDATION': {
      const vals = new Map(state.validations);
      vals.set(event.payload.vulnId, event.payload);
      return { ...base, validations: vals };
    }

    case 'SCAN_COMPLETED':
      return { ...base, status: 'completed', completedAt: event.ts };

    default:
      return base;
  }
}

export function replay(events: ScanEvent[]): ScanState {
  return events.reduce(reduce, INITIAL_STATE);
}

// --- Selectors ---

export function selectDepCount(state: ScanState): number {
  return state.dependencies.size;
}

export function selectVulnCount(state: ScanState): number {
  return state.vulnerabilities.size;
}

export function selectFindingsCount(state: ScanState): number {
  // Vulns that have received a verdict
  return state.verdicts.size;
}

export function selectReachableCount(state: ScanState): number {
  let n = 0;
  for (const v of state.verdicts.values()) { if (v.verdict === 'reachable') n++; }
  return n;
}

export function selectUncertainCount(state: ScanState): number {
  let n = 0;
  for (const v of state.verdicts.values()) { if (v.verdict === 'uncertain') n++; }
  return n;
}

export function selectNotReachableCount(state: ScanState): number {
  let n = 0;
  for (const v of state.verdicts.values()) { if (v.verdict === 'not_reachable') n++; }
  return n;
}

export function selectRiskBands(state: ScanState): Record<string, number> {
  const bands: Record<string, number> = {};
  for (const r of state.risks.values()) {
    bands[r.band] = (bands[r.band] ?? 0) + 1;
  }
  return bands;
}

export function selectDependencies(state: ScanState): DepInfo[] {
  return Array.from(state.dependencies.values());
}

export interface FullFindingView {
  vulnId: string;
  vuln: VulnInfo;
  verdict?: VerdictInfo;
  risk?: RiskInfo;
  remediation?: RemInfo;
  validation?: ValInfo;
}

export function selectVulnerabilities(state: ScanState): FullFindingView[] {
  const results: FullFindingView[] = [];
  for (const [vulnId, vuln] of state.vulnerabilities) {
    results.push({
      vulnId,
      vuln,
      verdict: state.verdicts.get(vulnId),
      risk: state.risks.get(vulnId),
      remediation: state.remediations.get(vulnId),
      validation: state.validations.get(vulnId),
    });
  }
  return results;
}
