// Binary frame receiver with reordering, dedup, gap detection, NACK support
// Pure module — all functions return new state, never mutate.

export interface BufferedFrame {
  type: number;
  payload: string;
  receivedAt: number;
}

export interface NackTimer {
  attempts: number;
  lastSent: number;
}

export interface ReceiverState {
  nextSeq: number;
  buffer: ReadonlyMap<number, BufferedFrame>;
  dupCount: number;
  dropCount: number;
  nackCount: number;
  nackTimers: ReadonlyMap<number, NackTimer>;
  stalled: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'stalled';
}

export interface Deliverable {
  type: number;
  seq: number;
  payload: string;
}

export interface ProcessResult {
  newState: ReceiverState;
  deliverable: Deliverable[];
  sendNack: number[] | null;
}

export function createReceiverState(startSeq = 0): ReceiverState {
  return {
    nextSeq: startSeq,
    buffer: new Map(),
    dupCount: 0,
    dropCount: 0,
    nackCount: 0,
    nackTimers: new Map(),
    stalled: false,
    connectionState: 'disconnected',
  };
}

const MAX_BUFFER = 1024;
const GAP_TIMEOUT_MS = 300;
const NACK_RETRY_MS = 500;
const MAX_NACK_ATTEMPTS = 5;

export function processFrame(
  state: ReceiverState,
  frameType: number,
  frameSeq: number,
  framePayload: string,
  now: number
): ProcessResult {
  // Duplicate: seq < nextSeq or already buffered
  if (frameSeq < state.nextSeq) {
    return {
      newState: { ...state, dupCount: state.dupCount + 1 },
      deliverable: [],
      sendNack: null,
    };
  }

  const buf = new Map(state.buffer);

  if (frameSeq > state.nextSeq && buf.has(frameSeq)) {
    return {
      newState: { ...state, dupCount: state.dupCount + 1, buffer: buf },
      deliverable: [],
      sendNack: null,
    };
  }

  // In-order or future frame
  if (frameSeq === state.nextSeq) {
    // Deliver this frame + drain consecutive buffered frames
    const deliverable: Deliverable[] = [{ type: frameType, seq: frameSeq, payload: framePayload }];
    let next = state.nextSeq + 1;
    while (buf.has(next)) {
      const buffered = buf.get(next)!;
      deliverable.push({ type: buffered.type, seq: next, payload: buffered.payload });
      buf.delete(next);
      next++;
    }
    // Clear nack timers for delivered seqs
    const timers = new Map(state.nackTimers);
    for (const d of deliverable) {
      timers.delete(d.seq);
    }
    return {
      newState: {
        ...state,
        nextSeq: next,
        buffer: buf,
        nackTimers: timers,
        stalled: false,
        connectionState: 'connected',
      },
      deliverable,
      sendNack: null,
    };
  }

  // Future frame (frameSeq > nextSeq): buffer it
  if (buf.size >= MAX_BUFFER) {
    // Drop oldest buffered frame
    let minKey = Infinity;
    for (const k of buf.keys()) { if (k < minKey) minKey = k; }
    if (minKey < Infinity) buf.delete(minKey);
  }
  buf.set(frameSeq, { type: frameType, payload: framePayload, receivedAt: now });

  // Check if we should NACK
  const timers = new Map(state.nackTimers);
  let sendNack: number[] | null = null;
  let stalled = state.stalled;

  const gapSeqs: number[] = [];
  for (let s = state.nextSeq; s < frameSeq; s++) {
    if (!buf.has(s)) gapSeqs.push(s);
  }

  if (gapSeqs.length > 0 && (buf.size >= 8 || shouldNackByTimeout(timers, state.nextSeq, now))) {
    const nacksToSend: number[] = [];
    for (const gs of gapSeqs) {
      const existing = timers.get(gs);
      if (!existing) {
        timers.set(gs, { attempts: 1, lastSent: now });
        nacksToSend.push(gs);
      } else if (existing.attempts >= MAX_NACK_ATTEMPTS) {
        stalled = true;
      } else if (now - existing.lastSent >= NACK_RETRY_MS) {
        timers.set(gs, { attempts: existing.attempts + 1, lastSent: now });
        nacksToSend.push(gs);
      }
    }
    if (nacksToSend.length > 0) {
      sendNack = nacksToSend;
    }
  }

  return {
    newState: {
      ...state,
      buffer: buf,
      nackTimers: timers,
      stalled,
      nackCount: state.nackCount + (sendNack ? 1 : 0),
      connectionState: stalled ? 'stalled' : 'connected',
    },
    deliverable: [],
    sendNack,
  };
}

function shouldNackByTimeout(timers: Map<number, NackTimer>, nextSeq: number, now: number): boolean {
  const t = timers.get(nextSeq);
  if (!t) return true; // First time seeing this gap
  return now - t.lastSent >= NACK_RETRY_MS;
}

export function checkGapTimeout(state: ReceiverState, now: number): { newState: ReceiverState; sendNack: number[] | null } {
  if (state.buffer.size === 0) return { newState: state, sendNack: null };

  const timers = new Map(state.nackTimers);
  const firstTimer = timers.get(state.nextSeq);
  let stalled = state.stalled;

  // Check if gap has persisted > GAP_TIMEOUT_MS
  if (!firstTimer || now - firstTimer.lastSent >= GAP_TIMEOUT_MS) {
    const gapSeqs: number[] = [];
    let maxBuffered = state.nextSeq;
    for (const k of state.buffer.keys()) { if (k > maxBuffered) maxBuffered = k; }

    for (let s = state.nextSeq; s <= maxBuffered; s++) {
      if (!state.buffer.has(s)) {
        const existing = timers.get(s);
        if (!existing) {
          timers.set(s, { attempts: 1, lastSent: now });
          gapSeqs.push(s);
        } else if (existing.attempts >= MAX_NACK_ATTEMPTS) {
          stalled = true;
        } else if (now - existing.lastSent >= NACK_RETRY_MS) {
          timers.set(s, { attempts: existing.attempts + 1, lastSent: now });
          gapSeqs.push(s);
        }
      }
    }

    if (gapSeqs.length > 0) {
      return {
        newState: {
          ...state,
          nackTimers: timers,
          nackCount: state.nackCount + 1,
          stalled,
          connectionState: stalled ? 'stalled' : state.connectionState,
        },
        sendNack: gapSeqs,
      };
    }
  }

  return { newState: { ...state, stalled, nackTimers: timers, connectionState: stalled ? 'stalled' : state.connectionState }, sendNack: null };
}

export interface ReceiverStats {
  nextSeq: number;
  bufferedFrames: number;
  dupCount: number;
  dropCount: number;
  nackCount: number;
  stalled: boolean;
  connectionState: string;
}

export function getReceiverStats(state: ReceiverState): ReceiverStats {
  return {
    nextSeq: state.nextSeq,
    bufferedFrames: state.buffer.size,
    dupCount: state.dupCount,
    dropCount: state.dropCount,
    nackCount: state.nackCount,
    stalled: state.stalled,
    connectionState: state.connectionState,
  };
}
