// Client-side lockfile parser for package-lock.json

export interface ParsedDependency {
  name: string;
  version: string;
  ecosystem: 'npm';
  source: 'package-lock';
  isPathDep: boolean;
  sourceAvailable: boolean;
}

export interface ParseResult {
  deps: ParsedDependency[];
  error: string | null;
}

export function parseLockfile(jsonStr: string): ParseResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (e) {
    return { deps: [], error: `Invalid JSON: ${(e as Error).message}` };
  }

  const lockfileVersion = typeof parsed.lockfileVersion === 'number' ? parsed.lockfileVersion : 1;
  const deps: ParsedDependency[] = [];

  if (lockfileVersion >= 2 && parsed.packages && typeof parsed.packages === 'object') {
    // v2/v3: iterate "packages" keys
    const packages = parsed.packages as Record<string, Record<string, unknown>>;
    for (const [key, entry] of Object.entries(packages)) {
      if (key === '') continue; // skip root
      const name = extractNameFromKey(key);
      if (!name) continue;
      const version = typeof entry.version === 'string' ? entry.version : '0.0.0';
      const isPathDep = detectPathDep(entry, key);
      const sourceAvailable = isPathDep ? detectSourceAvailable(entry) : true;
      deps.push({ name, version, ecosystem: 'npm', source: 'package-lock', isPathDep, sourceAvailable });
    }
  } else if (parsed.dependencies && typeof parsed.dependencies === 'object') {
    // v1: recursively iterate "dependencies"
    parseDepsV1(parsed.dependencies as Record<string, Record<string, unknown>>, deps);
  }

  return { deps, error: null };
}

function extractNameFromKey(key: string): string | null {
  // Key looks like "node_modules/@scope/pkg" or "node_modules/pkg"
  const marker = 'node_modules/';
  const lastIdx = key.lastIndexOf(marker);
  if (lastIdx === -1) return null;
  const name = key.slice(lastIdx + marker.length);
  return name || null;
}

function detectPathDep(entry: Record<string, unknown>, key: string): boolean {
  if (entry.link === true) return true;
  const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
  const version = typeof entry.version === 'string' ? entry.version : '';
  if (resolved.startsWith('file:') || resolved.startsWith('link:')) return true;
  if (version.startsWith('file:') || version.startsWith('link:')) return true;
  // Workspace entries outside node_modules
  if (!key.includes('node_modules/')) return true;
  return false;
}

function detectSourceAvailable(entry: Record<string, unknown>): boolean {
  // For path deps, source is considered available if resolved points to an existing-looking path
  const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
  if (!resolved) return false;
  // We can't check filesystem from browser, so assume available if resolved is non-empty
  return resolved.length > 0;
}

function parseDepsV1(deps: Record<string, Record<string, unknown>>, result: ParsedDependency[]): void {
  for (const [name, entry] of Object.entries(deps)) {
    const version = typeof entry.version === 'string' ? entry.version : '0.0.0';
    const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
    const isPathDep = resolved.startsWith('file:') || resolved.startsWith('link:') || version.startsWith('file:');
    result.push({ name, version, ecosystem: 'npm', source: 'package-lock', isPathDep, sourceAvailable: !isPathDep || resolved.length > 0 });
    // Recurse into nested dependencies
    if (entry.dependencies && typeof entry.dependencies === 'object') {
      parseDepsV1(entry.dependencies as Record<string, Record<string, unknown>>, result);
    }
  }
}

// --- OSV batch query ---

interface OsvVuln {
  id: string;
  summary: string;
  severity: string;
  aliases: string[];
  affectedRange: string;
  fixedVersions: string[];
  advisoryUrl?: string;
}

export interface OsvResult {
  dep: ParsedDependency;
  vulns: OsvVuln[];
}

export async function queryOsvBatch(deps: ParsedDependency[], timeoutMs = 5000): Promise<OsvResult[]> {
  const results: OsvResult[] = deps.map(d => ({ dep: d, vulns: [] }));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const queries = deps.map(d => ({
      package: { name: d.name, ecosystem: 'npm' },
      version: d.version,
    }));

    const resp = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) return results;

    const data = await resp.json() as { results: Array<{ vulns?: Array<Record<string, unknown>> }> };

    for (let i = 0; i < data.results.length && i < deps.length; i++) {
      const entry = data.results[i];
      if (entry.vulns && Array.isArray(entry.vulns)) {
        results[i].vulns = entry.vulns.map(v => ({
          id: (v.id as string) || '',
          summary: (v.summary as string) || '',
          severity: extractSeverity(v),
          aliases: Array.isArray(v.aliases) ? (v.aliases as string[]) : [],
          affectedRange: extractAffectedRange(v),
          fixedVersions: extractFixedVersions(v),
          advisoryUrl: typeof v.references === 'object' ? undefined : undefined,
        }));
      }
    }
  } catch {
    // Non-fatal: return empty results
  }

  return results;
}

function extractSeverity(v: Record<string, unknown>): string {
  if (v.database_specific && typeof v.database_specific === 'object') {
    const db = v.database_specific as Record<string, unknown>;
    if (typeof db.severity === 'string') return db.severity;
  }
  if (Array.isArray(v.severity)) {
    for (const s of v.severity) {
      if (typeof s === 'object' && s && 'score' in (s as Record<string, unknown>)) {
        return String((s as Record<string, unknown>).score);
      }
    }
  }
  return 'Unknown';
}

function extractAffectedRange(v: Record<string, unknown>): string {
  if (Array.isArray(v.affected)) {
    for (const a of v.affected) {
      if (typeof a === 'object' && a) {
        const affected = a as Record<string, unknown>;
        if (Array.isArray(affected.ranges)) {
          return JSON.stringify(affected.ranges);
        }
      }
    }
  }
  return 'Unknown';
}

function extractFixedVersions(v: Record<string, unknown>): string[] {
  const fixed: string[] = [];
  if (Array.isArray(v.affected)) {
    for (const a of v.affected) {
      if (typeof a === 'object' && a) {
        const affected = a as Record<string, unknown>;
        if (Array.isArray(affected.ranges)) {
          for (const range of affected.ranges) {
            if (typeof range === 'object' && range && Array.isArray((range as Record<string, unknown>).events)) {
              for (const event of (range as Record<string, unknown>).events as Array<Record<string, unknown>>) {
                if (typeof event.fixed === 'string') {
                  fixed.push(event.fixed);
                }
              }
            }
          }
        }
      }
    }
  }
  return fixed;
}
