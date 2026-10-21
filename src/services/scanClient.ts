// WebSocket scan client + multi-tab coordination via navigator.locks + BroadcastChannel

import { decodeFrame, encodeNack, typeNameMap } from './binaryProtocol';
import { openEventDB, appendEvent, loadAllEvents, getLastEventForScan, createEventChannel, announceOffset } from './eventStore';
import { createReceiverState, processFrame, checkGapTimeout, getReceiverStats, type ReceiverState } from './receiver';
import { reduce, replay, INITIAL_STATE, type ScanState, type ScanEvent } from './reducer';
import { generateDemoFrames, applyLocalChaos } from './demoProducer';
import { fnv1aHash, canonicalJsonStringify } from './binaryProtocol';

export interface ScanClientOptions {
  scanId: string;
  wsUrl?: string;
  chaos?: { drop?: boolean; reorder?: boolean; duplicate?: boolean };
  chaosSeed?: number;
  isDemo?: boolean;
  onStateUpdate?: (state: ScanState, stats: InspectorData) => void;
}

export interface InspectorData {
  logLength: number;
  lastOffset: number;
  nextSeq: number;
  bufferedFrames: number;
  dupCount: number;
  nackCount: number;
  connectionState: string;
  stateHash: string;
  replayStateHash: string;
  hashMatch: boolean;
}

export class ScanClient {
  private db: IDBDatabase | null = null;
  private channel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private receiverState: ReceiverState;
  private scanState: ScanState;
  private eventLog: ScanEvent[] = [];
  private lastOffset = -1;
  private gapCheckInterval: ReturnType<typeof setInterval> | null = null;
  private options: ScanClientOptions;
  private lockHeld = false;
  private disposed = false;

  constructor(options: ScanClientOptions) {
    this.options = options;
    this.receiverState = createReceiverState(0);
    this.scanState = INITIAL_STATE;
  }

  async init(): Promise<void> {
    this.db = await openEventDB();
    this.channel = createEventChannel();

    // Replay all events from IndexedDB
    const allEvents = await loadAllEvents(this.db);
    const scanEvents: ScanEvent[] = [];
    for (const stored of allEvents) {
      const evt = { type: stored.type, scanId: stored.scanId, seq: stored.seq, ts: stored.ts, payload: stored.payload } as ScanEvent;
      scanEvents.push(evt);
      if (stored.offset !== undefined && stored.offset > this.lastOffset) {
        this.lastOffset = stored.offset;
      }
    }
    this.eventLog = scanEvents;
    this.scanState = replay(scanEvents);

    // Figure out where to resume
    let startSeq = 0;
    if (this.options.scanId) {
      const last = await getLastEventForScan(this.db, this.options.scanId);
      if (last && last.type !== 'SCAN_COMPLETED') {
        startSeq = last.seq + 1;
      }
    }
    this.receiverState = createReceiverState(startSeq);

    // Listen for cross-tab offset announcements
    this.channel.onmessage = (msg) => {
      const data = msg.data as { type: string; offset: number };
      if (data.type === 'NEW_OFFSET' && this.db) {
        this.handleCrossTabOffset(data.offset);
      }
    };

    this.emitUpdate();

    // Try to acquire socket lock
    if (this.options.isDemo) {
      await this.runDemoScan();
    } else {
      await this.tryAcquireSocketLock();
    }
  }

  private async tryAcquireSocketLock(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      try {
        await navigator.locks.request(
          `vulntrace-ws-${this.options.scanId}`,
          { mode: 'exclusive', ifAvailable: true },
          async (lock) => {
            if (lock && !this.disposed) {
              this.lockHeld = true;
              this.connectWebSocket();
              // Hold the lock until disposed
              await new Promise<void>((resolve) => {
                const check = setInterval(() => {
                  if (this.disposed) { clearInterval(check); resolve(); }
                }, 500);
              });
            }
          }
        );
      } catch {
        // Fallback: connect anyway
        this.connectWebSocket();
      }
    } else {
      this.connectWebSocket();
    }
  }

  private connectWebSocket(): void {
    if (this.disposed) return;
    const base = this.options.wsUrl ?? `ws://${window.location.hostname}:8000`;
    const params = new URLSearchParams();
    params.set('from', String(this.receiverState.nextSeq));
    if (this.options.chaos) {
      const parts: string[] = [];
      if (this.options.chaos.drop) parts.push('drop');
      if (this.options.chaos.reorder) parts.push('reorder');
      if (this.options.chaos.duplicate) parts.push('dup');
      if (parts.length > 0) params.set('chaos', parts.join(','));
    }
    if (this.options.chaosSeed !== undefined) params.set('seed', String(this.options.chaosSeed));

    const url = `${base}/ws/scans/${this.options.scanId}?${params.toString()}`;
    this.receiverState = { ...this.receiverState, connectionState: 'connecting' };

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.receiverState = { ...this.receiverState, connectionState: 'connected' };
        this.startGapCheck();
        this.emitUpdate();
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleBinaryFrame(event.data);
        }
      };

      this.ws.onclose = () => {
        this.receiverState = { ...this.receiverState, connectionState: 'disconnected' };
        this.stopGapCheck();
        this.emitUpdate();
      };

      this.ws.onerror = () => {
        this.receiverState = { ...this.receiverState, connectionState: 'disconnected' };
      };
    } catch {
      this.receiverState = { ...this.receiverState, connectionState: 'disconnected' };
    }
  }

  private async runDemoScan(): Promise<void> {
    const frames = generateDemoFrames(this.options.scanId);
    const processed = this.options.chaos
      ? applyLocalChaos(frames, this.options.chaosSeed ?? 42, this.options.chaos)
      : frames;

    this.receiverState = { ...this.receiverState, connectionState: 'connected' };

    for (const frame of processed) {
      if (this.disposed) break;
      await this.deliverRawFrame(frame.type, frame.seq, frame.payload);
      // Stagger delivery for visual effect
      await sleep(80 + Math.floor(Math.random() * 40));
    }

    this.receiverState = { ...this.receiverState, connectionState: 'disconnected' };
    this.emitUpdate();
  }

  private handleBinaryFrame(buffer: ArrayBuffer): void {
    const decoded = decodeFrame(buffer);
    if (!decoded) {
      this.receiverState = { ...this.receiverState, dropCount: this.receiverState.dropCount + 1 };
      return;
    }
    this.deliverRawFrame(decoded.type, decoded.seq, decoded.payload);
  }

  private async deliverRawFrame(type: number, seq: number, payload: string): Promise<void> {
    const now = Date.now();
    const result = processFrame(this.receiverState, type, seq, payload, now);
    this.receiverState = result.newState;

    // Send NACK if needed
    if (result.sendNack && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeNack(result.sendNack));
    }

    // Process deliverable events in order
    for (const d of result.deliverable) {
      const typeName = typeNameMap[d.type] ?? `UNKNOWN_${d.type}`;
      let parsedPayload: unknown;
      try { parsedPayload = JSON.parse(d.payload); } catch { parsedPayload = {}; }

      const event: ScanEvent = {
        type: typeName,
        scanId: this.options.scanId,
        seq: d.seq,
        ts: now,
        payload: parsedPayload,
      } as ScanEvent;

      // Append to IndexedDB
      if (this.db) {
        const offset = await appendEvent(this.db, {
          scanId: this.options.scanId,
          seq: d.seq,
          type: typeName,
          payload: parsedPayload,
          ts: now,
        });
        if (offset > 0) {
          this.lastOffset = offset;
          if (this.channel) announceOffset(this.channel, offset);
        }
      }

      // Update reducer state
      this.eventLog.push(event);
      this.scanState = reduce(this.scanState, event);
    }

    if (result.deliverable.length > 0) {
      this.emitUpdate();
    }
  }

  private async handleCrossTabOffset(offset: number): Promise<void> {
    if (!this.db || offset <= this.lastOffset) return;
    // Reload and replay from scratch for consistency
    const allEvents = await loadAllEvents(this.db);
    const scanEvents: ScanEvent[] = allEvents.map(e => ({
      type: e.type, scanId: e.scanId, seq: e.seq, ts: e.ts, payload: e.payload
    } as ScanEvent));
    this.eventLog = scanEvents;
    this.scanState = replay(scanEvents);
    this.lastOffset = offset;
    this.emitUpdate();
  }

  private startGapCheck(): void {
    this.gapCheckInterval = setInterval(() => {
      const result = checkGapTimeout(this.receiverState, Date.now());
      this.receiverState = result.newState;
      if (result.sendNack && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(encodeNack(result.sendNack));
      }
      if (this.receiverState.stalled) {
        this.scanState = { ...this.scanState, status: 'stalled' };
        this.emitUpdate();
      }
    }, 300);
  }

  private stopGapCheck(): void {
    if (this.gapCheckInterval) {
      clearInterval(this.gapCheckInterval);
      this.gapCheckInterval = null;
    }
  }

  private emitUpdate(): void {
    if (this.options.onStateUpdate) {
      const stats = getReceiverStats(this.receiverState);
      const stateStr = canonicalJsonStringify(mapToObj(this.scanState));
      const stateHash = fnv1aHash(stateStr);
      // Replay hash for comparison
      const replayState = replay(this.eventLog);
      const replayStr = canonicalJsonStringify(mapToObj(replayState));
      const replayHash = fnv1aHash(replayStr);

      this.options.onStateUpdate(this.scanState, {
        logLength: this.eventLog.length,
        lastOffset: this.lastOffset,
        nextSeq: stats.nextSeq,
        bufferedFrames: stats.bufferedFrames,
        dupCount: stats.dupCount,
        nackCount: stats.nackCount,
        connectionState: stats.connectionState,
        stateHash,
        replayStateHash: replayHash,
        hashMatch: stateHash === replayHash,
      });
    }
  }

  async replayFromZero(): Promise<void> {
    if (!this.db) return;
    const allEvents = await loadAllEvents(this.db);
    const scanEvents: ScanEvent[] = allEvents.map(e => ({
      type: e.type, scanId: e.scanId, seq: e.seq, ts: e.ts, payload: e.payload
    } as ScanEvent));
    this.eventLog = scanEvents;
    this.scanState = replay(scanEvents);
    this.emitUpdate();
  }

  getState(): ScanState { return this.scanState; }
  isSocketOwner(): boolean { return this.lockHeld; }
  getInspectorData(): InspectorData {
    const stats = getReceiverStats(this.receiverState);
    const stateStr = canonicalJsonStringify(mapToObj(this.scanState));
    const stateHash = fnv1aHash(stateStr);
    const replayState = replay(this.eventLog);
    const replayStr = canonicalJsonStringify(mapToObj(replayState));
    const replayHash = fnv1aHash(replayStr);
    return {
      logLength: this.eventLog.length,
      lastOffset: this.lastOffset,
      nextSeq: stats.nextSeq,
      bufferedFrames: stats.bufferedFrames,
      dupCount: stats.dupCount,
      nackCount: stats.nackCount,
      connectionState: stats.connectionState,
      stateHash,
      replayStateHash: replayHash,
      hashMatch: stateHash === replayHash,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.stopGapCheck();
    if (this.ws) { try { this.ws.close(); } catch { /* */ } }
    if (this.channel) { try { this.channel.close(); } catch { /* */ } }
    if (this.db) { try { this.db.close(); } catch { /* */ } }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Convert Maps in ScanState to plain objects for hashing
function mapToObj(state: ScanState): Record<string, unknown> {
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
