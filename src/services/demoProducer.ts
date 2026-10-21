// Demo/simulated scan producer — generates binary frames offline
// Hardcoded fixture data lives ONLY here; no UI component reads these arrays.

import { SERVER_TYPES } from './binaryProtocol';

interface RawFrame {
  type: number;
  seq: number;
  payload: string;
}

export function generateDemoFrames(_scanId: string): RawFrame[] {
  const frames: RawFrame[] = [];
  let seq = 0;

  // 0: SCAN_STARTED
  frames.push({ type: SERVER_TYPES.SCAN_STARTED, seq: seq++, payload: JSON.stringify({ repoPath: 'demo-fixture', repoUrl: 'demo://demo-fixture' }) });

  // 1-5: DEPENDENCY_FOUND
  const deps = [
    { name: 'flask', version: '2.2.0', ecosystem: 'PyPI', source: 'requirements.txt' },
    { name: 'jinja2', version: '3.1.1', ecosystem: 'PyPI', source: 'requirements.txt' },
    { name: 'pyyaml', version: '5.3.1', ecosystem: 'PyPI', source: 'requirements.txt' },
    { name: 'werkzeug', version: '2.2.0', ecosystem: 'PyPI', source: 'requirements.txt' },
    { name: 'requests', version: '2.25.1', ecosystem: 'PyPI', source: 'requirements.txt' },
  ];
  for (const d of deps) {
    frames.push({ type: SERVER_TYPES.DEPENDENCY_FOUND, seq: seq++, payload: JSON.stringify(d) });
  }

  // 6-8: VULN_FOUND
  const vulns = [
    { vulnId: 'GHSA-hrfv-mqp8-q5rw', aliases: ['CVE-2024-34064'], summary: 'Jinja2 XSS via xmlattr filter', severity: 'High', packageName: 'jinja2', ecosystem: 'PyPI', affectedRange: '<3.1.3', fixedVersions: ['3.1.3'], advisoryUrl: 'https://github.com/advisories/GHSA-hrfv-mqp8-q5rw' },
    { vulnId: 'CVE-2021-33503', aliases: ['GHSA-q2q7-5pp4-w6pg'], summary: 'urllib3 ReDoS via URL authority parsing', severity: 'High', packageName: 'requests', ecosystem: 'PyPI', affectedRange: '<1.26.5', fixedVersions: ['1.26.5'], advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2021-33503' },
    { vulnId: 'CVE-2020-14343', aliases: ['GHSA-8q59-q68h-6hv4'], summary: 'PyYAML arbitrary code execution via yaml.load', severity: 'Critical', packageName: 'pyyaml', ecosystem: 'PyPI', affectedRange: '<5.4', fixedVersions: ['5.4'], advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2020-14343' },
  ];
  for (const v of vulns) {
    frames.push({ type: SERVER_TYPES.VULN_FOUND, seq: seq++, payload: JSON.stringify(v) });
  }

  // 9-11: PATH_FOUND
  const paths = [
    { pathId: 'path-jinja2-xss', entryPointId: 'app-route-upload', vulnerableTargetId: 'jinja2-xmlattr', hops: [
      { nodeId: 'app-route-upload', filePath: 'app.py', functionName: 'upload_handler', lineNumber: 42, isEntryPoint: true, callResolved: true },
      { nodeId: 'app-render-tmpl', filePath: 'app.py', functionName: 'render_result', lineNumber: 67, isEntryPoint: false, callResolved: true },
      { nodeId: 'jinja2-xmlattr', filePath: 'jinja2/filters.py', functionName: 'do_xmlattr', lineNumber: 394, isEntryPoint: false, callResolved: true },
    ], containsUnresolvedCall: false },
    { pathId: 'path-urllib3-redos', entryPointId: 'app-route-fetch', vulnerableTargetId: 'urllib3-parse', hops: [
      { nodeId: 'app-route-fetch', filePath: 'app.py', functionName: 'fetch_url', lineNumber: 88, isEntryPoint: true, callResolved: true },
      { nodeId: 'requests-get', filePath: 'requests/api.py', functionName: 'get', lineNumber: 75, isEntryPoint: false, callResolved: false },
    ], containsUnresolvedCall: true },
    { pathId: 'path-pyyaml-rce', entryPointId: 'app-route-config', vulnerableTargetId: 'yaml-load', hops: [
      { nodeId: 'app-route-config', filePath: 'app.py', functionName: 'load_config', lineNumber: 15, isEntryPoint: true, callResolved: true },
      { nodeId: 'yaml-load', filePath: 'yaml/__init__.py', functionName: 'load', lineNumber: 74, isEntryPoint: false, callResolved: true },
    ], containsUnresolvedCall: false },
  ];
  for (const p of paths) {
    frames.push({ type: SERVER_TYPES.PATH_FOUND, seq: seq++, payload: JSON.stringify(p) });
  }

  // 12-14: VERDICT
  const verdicts = [
    { vulnId: 'GHSA-hrfv-mqp8-q5rw', verdict: 'reachable', confidenceNote: 'Template rendering path confirmed via AST', caveats: [], evidenceRefs: ['path-jinja2-xss', 'app-route-upload', 'jinja2-xmlattr'], rationale: 'Application renders user-provided data through Jinja2 xmlattr filter in upload_handler route.' },
    { vulnId: 'CVE-2021-33503', verdict: 'uncertain', confidenceNote: 'Transitive dependency via requests', caveats: ['Unresolved call from requests.get to urllib3'], evidenceRefs: ['path-urllib3-redos', 'app-route-fetch'], rationale: 'urllib3 is a transitive dependency of requests. The call chain contains an unresolved edge.' },
    { vulnId: 'CVE-2020-14343', verdict: 'reachable', confidenceNote: 'Direct yaml.load() call without SafeLoader', caveats: [], evidenceRefs: ['path-pyyaml-rce', 'app-route-config', 'yaml-load'], rationale: 'Application calls yaml.load() directly in config loading endpoint without specifying SafeLoader.' },
  ];
  for (const v of verdicts) {
    frames.push({ type: SERVER_TYPES.VERDICT, seq: seq++, payload: JSON.stringify(v) });
  }

  // 15-17: RISK
  const risks = [
    { vulnId: 'GHSA-hrfv-mqp8-q5rw', band: 'Fix now', rationale: 'Reachable XSS via user-input upload route; high severity.' },
    { vulnId: 'CVE-2021-33503', band: 'Monitor', rationale: 'Uncertain reachability; transitive dependency with unresolved call edge.' },
    { vulnId: 'CVE-2020-14343', band: 'Fix now', rationale: 'Reachable arbitrary code execution via user-controlled YAML input; critical severity.' },
  ];
  for (const r of risks) {
    frames.push({ type: SERVER_TYPES.RISK, seq: seq++, payload: JSON.stringify(r) });
  }

  // 18-20: REMEDIATION
  const rems = [
    { vulnId: 'GHSA-hrfv-mqp8-q5rw', diff: '--- a/requirements.txt\n+++ b/requirements.txt\n@@ -2 +2 @@\n-jinja2==3.1.1\n+jinja2>=3.1.3', targetFile: 'requirements.txt', originalVersion: '3.1.1', targetVersion: '3.1.3', rationale: 'Bump jinja2 to >=3.1.3 to resolve XSS in xmlattr filter.', status: 'proposed' },
    { vulnId: 'CVE-2021-33503', diff: '--- a/requirements.txt\n+++ b/requirements.txt\n@@ -5 +5 @@\n-requests==2.25.1\n+requests>=2.26.0', targetFile: 'requirements.txt', originalVersion: '2.25.1', targetVersion: '2.26.0', rationale: 'Bump requests to pull in urllib3>=1.26.5.', status: 'proposed' },
    { vulnId: 'CVE-2020-14343', diff: '--- a/requirements.txt\n+++ b/requirements.txt\n@@ -3 +3 @@\n-pyyaml==5.3.1\n+pyyaml>=5.4', targetFile: 'requirements.txt', originalVersion: '5.3.1', targetVersion: '5.4', rationale: 'Bump pyyaml to >=5.4 where yaml.load requires explicit Loader argument.', status: 'proposed' },
  ];
  for (const r of rems) {
    frames.push({ type: SERVER_TYPES.REMEDIATION, seq: seq++, payload: JSON.stringify(r) });
  }

  // 21-23: VALIDATION
  const vals = [
    { vulnId: 'GHSA-hrfv-mqp8-q5rw', status: 'validated', checks: [{ checkName: 'OSV re-scan', passed: true, category: 'security_verification', durationSeconds: 1.2 }, { checkName: 'pytest suite', passed: true, category: 'test_execution', durationSeconds: 8.4 }], executedInSandbox: true },
    { vulnId: 'CVE-2021-33503', status: 'validated', checks: [{ checkName: 'OSV re-scan', passed: true, category: 'security_verification', durationSeconds: 0.9 }, { checkName: 'pytest suite', passed: true, category: 'test_execution', durationSeconds: 7.1 }], executedInSandbox: true },
    { vulnId: 'CVE-2020-14343', status: 'validated', checks: [{ checkName: 'OSV re-scan', passed: true, category: 'security_verification', durationSeconds: 1.0 }, { checkName: 'pytest suite', passed: true, category: 'test_execution', durationSeconds: 9.2 }], executedInSandbox: true },
  ];
  for (const v of vals) {
    frames.push({ type: SERVER_TYPES.VALIDATION, seq: seq++, payload: JSON.stringify(v) });
  }

  // 24: SCAN_COMPLETED
  frames.push({ type: SERVER_TYPES.SCAN_COMPLETED, seq: seq++, payload: JSON.stringify({ findingsCount: 3 }) });

  return frames;
}

// --- Seeded deterministic chaos ---

class LCG {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export function applyLocalChaos(
  frames: RawFrame[],
  seed: number,
  opts: { drop?: boolean; reorder?: boolean; duplicate?: boolean }
): RawFrame[] {
  const rng = new LCG(seed);
  let result = [...frames];

  // Drop ~10%
  if (opts.drop) {
    result = result.filter(() => rng.next() > 0.1);
  }

  // Reorder in windows of 4-6
  if (opts.reorder) {
    const reordered: RawFrame[] = [];
    let i = 0;
    while (i < result.length) {
      const windowSize = 4 + Math.floor(rng.next() * 3); // 4-6
      const window = result.slice(i, i + windowSize);
      // Fisher-Yates shuffle with LCG
      for (let j = window.length - 1; j > 0; j--) {
        const k = Math.floor(rng.next() * (j + 1));
        [window[j], window[k]] = [window[k], window[j]];
      }
      reordered.push(...window);
      i += windowSize;
    }
    result = reordered;
  }

  // Duplicate ~5%
  if (opts.duplicate) {
    const withDups: RawFrame[] = [];
    for (const f of result) {
      withDups.push(f);
      if (rng.next() < 0.05) {
        withDups.push({ ...f });
      }
    }
    result = withDups;
  }

  return result;
}
