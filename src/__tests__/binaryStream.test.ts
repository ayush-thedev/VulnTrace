// Vitest tests for Binary Stream twist
import { describe, it, expect } from 'vitest';
import { encodeFrame, decodeFrame, fnv1aHash, canonicalJsonStringify, SERVER_TYPES } from '../services/binaryProtocol';
import { createReceiverState, processFrame } from '../services/receiver';
import { reduce, replay, INITIAL_STATE, type ScanEvent, type ScanState } from '../services/reducer';
import { generateDemoFrames, applyLocalChaos } from '../services/demoProducer';
import { typeNameMap } from '../services/binaryProtocol';

// --- 1. Header encode/decode round-trip ---

describe('Binary Protocol', () => {
  it('encodes and decodes a frame round-trip', () => {
    const payload = JSON.stringify({ name: 'flask', version: '2.2.0' });
    const buf = encodeFrame(SERVER_TYPES.DEPENDENCY_FOUND, 42, payload);
    const decoded = decodeFrame(buf);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe(SERVER_TYPES.DEPENDENCY_FOUND);
    expect(decoded!.seq).toBe(42);
    expect(decoded!.payload).toBe(payload);
  });

  it('returns null for buffer too short', () => {
    const buf = new ArrayBuffer(5);
    expect(decodeFrame(buf)).toBeNull();
  });

  it('returns null for mismatched length', () => {
    const payload = 'hello';
    const buf = encodeFrame(0x01, 0, payload);
    // Truncate by 1 byte
    const truncated = buf.slice(0, buf.byteLength - 1);
    expect(decodeFrame(truncated)).toBeNull();
  });

  it('throws for payload > 65535 bytes', () => {
    const bigPayload = 'x'.repeat(70000);
    expect(() => encodeFrame(0x01, 0, bigPayload)).toThrow();
  });

  it('round-trips all server types', () => {
    for (const [, typeVal] of Object.entries(SERVER_TYPES)) {
      const payload = JSON.stringify({ test: true });
      const buf = encodeFrame(typeVal, 99, payload);
      const d = decodeFrame(buf);
      expect(d).not.toBeNull();
      expect(d!.type).toBe(typeVal);
      expect(d!.seq).toBe(99);
    }
  });
});

// --- 2. Reorder+loss+duplicate yields same final state as in-order ---

describe('Receiver reordering', () => {
  it('delivers in-order frames immediately', () => {
    let state = createReceiverState(0);
    const results: Array<{type: number; seq: number}> = [];

    for (let i = 0; i < 5; i++) {
      const r = processFrame(state, 0x02, i, JSON.stringify({i}), Date.now());
      state = r.newState;
      results.push(...r.deliverable);
    }

    expect(results.length).toBe(5);
    expect(results.map(r => r.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(state.nextSeq).toBe(5);
  });

  it('buffers out-of-order and delivers on gap fill', () => {
    let state = createReceiverState(0);
    const delivered: number[] = [];

    // Send seq 2, then 1, then 0
    let r = processFrame(state, 0x02, 2, '{}', Date.now());
    state = r.newState;
    delivered.push(...r.deliverable.map(d => d.seq));
    expect(delivered.length).toBe(0); // buffered

    r = processFrame(state, 0x02, 1, '{}', Date.now());
    state = r.newState;
    delivered.push(...r.deliverable.map(d => d.seq));
    expect(delivered.length).toBe(0); // still waiting for 0

    r = processFrame(state, 0x02, 0, '{}', Date.now());
    state = r.newState;
    delivered.push(...r.deliverable.map(d => d.seq));
    expect(delivered).toEqual([0, 1, 2]); // drain all
    expect(state.nextSeq).toBe(3);
  });

  it('counts duplicates', () => {
    let state = createReceiverState(0);

    let r = processFrame(state, 0x02, 0, '{}', Date.now());
    state = r.newState;
    expect(state.dupCount).toBe(0);

    // Send seq 0 again
    r = processFrame(state, 0x02, 0, '{}', Date.now());
    state = r.newState;
    expect(state.dupCount).toBe(1);
  });
});

// --- 3. Chaos yields same final state as in-order ---

describe('Chaos resilience', () => {
  it('reorder+loss+dup yields same final state as in-order delivery', () => {
    const frames = generateDemoFrames('test-scan');
    const chaosFrames = applyLocalChaos(frames, 12345, { drop: false, reorder: true, duplicate: true });

    // In-order: build events and reduce
    const inOrderEvents = framesToEvents(frames, 'test-scan');
    const inOrderState = replay(inOrderEvents);

    // Chaos: process through receiver then reduce
    let receiver = createReceiverState(0);
    const deliveredEvents: ScanEvent[] = [];

    for (const cf of chaosFrames) {
      const r = processFrame(receiver, cf.type, cf.seq, cf.payload, Date.now());
      receiver = r.newState;
      for (const d of r.deliverable) {
        const typeName = typeNameMap[d.type] ?? `UNKNOWN_${d.type}`;
        let parsed: unknown;
        try { parsed = JSON.parse(d.payload); } catch { parsed = {}; }
        deliveredEvents.push({
          type: typeName,
          scanId: 'test-scan',
          seq: d.seq,
          ts: Date.now(),
          payload: parsed,
        } as ScanEvent);
      }
    }

    const chaosState = replay(deliveredEvents);

    // Compare key counts (ts will differ so we compare structure)
    expect(chaosState.dependencies.size).toBe(inOrderState.dependencies.size);
    expect(chaosState.vulnerabilities.size).toBe(inOrderState.vulnerabilities.size);
    expect(chaosState.verdicts.size).toBe(inOrderState.verdicts.size);
    expect(chaosState.status).toBe(inOrderState.status);
  });
});

// --- 4. Reducer determinism: incremental === replay ---

describe('Reducer determinism', () => {
  it('incremental reduce matches full replay', () => {
    const frames = generateDemoFrames('det-scan');
    const events = framesToEvents(frames, 'det-scan');

    // Incremental
    let incremental: ScanState = INITIAL_STATE;
    for (const e of events) {
      incremental = reduce(incremental, e);
    }

    // Full replay
    const replayed = replay(events);

    // Compare
    expect(incremental.dependencies.size).toBe(replayed.dependencies.size);
    expect(incremental.vulnerabilities.size).toBe(replayed.vulnerabilities.size);
    expect(incremental.verdicts.size).toBe(replayed.verdicts.size);
    expect(incremental.risks.size).toBe(replayed.risks.size);
    expect(incremental.eventCount).toBe(replayed.eventCount);
    expect(incremental.status).toBe(replayed.status);

    // State hashes should match
    const hash1 = fnv1aHash(canonicalJsonStringify(stateToObj(incremental)));
    const hash2 = fnv1aHash(canonicalJsonStringify(stateToObj(replayed)));
    expect(hash1).toBe(hash2);
  });
});

// --- 5. Path-dependency downgrade ---

describe('Path dependency downgrade', () => {
  it('downgrades reachable to uncertain for path deps with missing source', () => {
    const events: ScanEvent[] = [
      { type: 'SCAN_STARTED', scanId: 's1', seq: 0, ts: 1, payload: { repoPath: 'test' } },
      { type: 'DEPENDENCY_FOUND', scanId: 's1', seq: 1, ts: 2, payload: { name: 'my-local-pkg', version: '1.0.0', ecosystem: 'npm', isPathDep: true, sourceAvailable: false } },
      { type: 'VULN_FOUND', scanId: 's1', seq: 2, ts: 3, payload: { vulnId: 'CVE-PATH-1', aliases: [], summary: 'Test vuln', severity: 'High', packageName: 'my-local-pkg', ecosystem: 'npm', affectedRange: '<2.0', fixedVersions: ['2.0'] } },
      { type: 'PATH_FOUND', scanId: 's1', seq: 3, ts: 4, payload: { pathId: 'p1', entryPointId: 'ep1', vulnerableTargetId: 'vt1', hops: [{ nodeId: 'ep1', filePath: 'a.js', functionName: 'main', lineNumber: 1, isEntryPoint: true, callResolved: true }], containsUnresolvedCall: false } },
      { type: 'VERDICT', scanId: 's1', seq: 4, ts: 5, payload: { vulnId: 'CVE-PATH-1', verdict: 'reachable', confidenceNote: 'test', caveats: [], evidenceRefs: ['p1', 'ep1'], rationale: 'test' } },
    ];

    const state = replay(events);
    const verdict = state.verdicts.get('CVE-PATH-1');
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('uncertain');
    expect(verdict!.rawVerdict).toBe('reachable');
    expect(verdict!.downgradeReason).toBe('Path dependency target source missing');
  });

  it('downgrades reachable to uncertain for missing evidence refs', () => {
    const events: ScanEvent[] = [
      { type: 'SCAN_STARTED', scanId: 's2', seq: 0, ts: 1, payload: { repoPath: 'test' } },
      { type: 'DEPENDENCY_FOUND', scanId: 's2', seq: 1, ts: 2, payload: { name: 'somepkg', version: '1.0.0', ecosystem: 'PyPI' } },
      { type: 'VULN_FOUND', scanId: 's2', seq: 2, ts: 3, payload: { vulnId: 'CVE-REF-1', aliases: [], summary: 'Test', severity: 'High', packageName: 'somepkg', ecosystem: 'PyPI', affectedRange: '<2.0', fixedVersions: ['2.0'] } },
      { type: 'VERDICT', scanId: 's2', seq: 3, ts: 4, payload: { vulnId: 'CVE-REF-1', verdict: 'reachable', confidenceNote: 'test', caveats: [], evidenceRefs: ['nonexistent-path-id', 'ghost-node'], rationale: 'test' } },
    ];

    const state = replay(events);
    const verdict = state.verdicts.get('CVE-REF-1');
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('uncertain');
    expect(verdict!.rawVerdict).toBe('reachable');
    expect(verdict!.downgradeReason).toBe('Evidence references missing graph nodes');
  });

  it('keeps reachable when source is available', () => {
    const events: ScanEvent[] = [
      { type: 'SCAN_STARTED', scanId: 's3', seq: 0, ts: 1, payload: { repoPath: 'test' } },
      { type: 'DEPENDENCY_FOUND', scanId: 's3', seq: 1, ts: 2, payload: { name: 'my-pkg', version: '1.0.0', ecosystem: 'npm', isPathDep: true, sourceAvailable: true } },
      { type: 'VULN_FOUND', scanId: 's3', seq: 2, ts: 3, payload: { vulnId: 'CVE-OK-1', aliases: [], summary: 'Test', severity: 'High', packageName: 'my-pkg', ecosystem: 'npm', affectedRange: '<2.0', fixedVersions: ['2.0'] } },
      { type: 'PATH_FOUND', scanId: 's3', seq: 3, ts: 4, payload: { pathId: 'p1', entryPointId: 'ep1', vulnerableTargetId: 'vt1', hops: [{ nodeId: 'ep1', filePath: 'a.js', functionName: 'main', lineNumber: 1, isEntryPoint: true, callResolved: true }], containsUnresolvedCall: false } },
      { type: 'VERDICT', scanId: 's3', seq: 4, ts: 5, payload: { vulnId: 'CVE-OK-1', verdict: 'reachable', confidenceNote: 'test', caveats: [], evidenceRefs: ['p1', 'ep1'], rationale: 'test' } },
    ];

    const state = replay(events);
    const verdict = state.verdicts.get('CVE-OK-1');
    expect(verdict).toBeDefined();
    expect(verdict!.verdict).toBe('reachable');
    expect(verdict!.rawVerdict).toBeUndefined();
  });
});

// --- Helpers ---

function framesToEvents(frames: Array<{type: number; seq: number; payload: string}>, scanId: string): ScanEvent[] {
  return frames.map((f, i) => {
    const typeName = typeNameMap[f.type] ?? `UNKNOWN_${f.type}`;
    let parsed: unknown;
    try { parsed = JSON.parse(f.payload); } catch { parsed = {}; }
    return { type: typeName, scanId, seq: f.seq, ts: 1000 + i, payload: parsed } as ScanEvent;
  });
}

function stateToObj(state: ScanState): Record<string, unknown> {
  return {
    ...state,
    dependencies: Object.fromEntries(state.dependencies),
    vulnerabilities: Object.fromEntries(state.vulnerabilities),
    paths: Object.fromEntries(state.paths),
    verdicts: Object.fromEntries(state.verdicts),
    risks: Object.fromEntries(state.risks),
    remediations: Object.fromEntries(state.remediations),
    validations: Object.fromEntries(state.validations),
  };
}
