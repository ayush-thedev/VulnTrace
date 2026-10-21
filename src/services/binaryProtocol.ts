// Binary Stream Protocol - Frame encode/decode, FNV-1a, canonical JSON

export const SERVER_TYPES = {
  SCAN_STARTED: 0x01,
  DEPENDENCY_FOUND: 0x02,
  VULN_FOUND: 0x03,
  PATH_FOUND: 0x04,
  VERDICT: 0x05,
  RISK: 0x06,
  REMEDIATION: 0x07,
  VALIDATION: 0x08,
  SCAN_COMPLETED: 0x09,
} as const;

export const CLIENT_TYPES = {
  NACK: 0xf0,
} as const;

export const typeNameMap: Record<number, string> = {
  [SERVER_TYPES.SCAN_STARTED]: 'SCAN_STARTED',
  [SERVER_TYPES.DEPENDENCY_FOUND]: 'DEPENDENCY_FOUND',
  [SERVER_TYPES.VULN_FOUND]: 'VULN_FOUND',
  [SERVER_TYPES.PATH_FOUND]: 'PATH_FOUND',
  [SERVER_TYPES.VERDICT]: 'VERDICT',
  [SERVER_TYPES.RISK]: 'RISK',
  [SERVER_TYPES.REMEDIATION]: 'REMEDIATION',
  [SERVER_TYPES.VALIDATION]: 'VALIDATION',
  [SERVER_TYPES.SCAN_COMPLETED]: 'SCAN_COMPLETED',
  [CLIENT_TYPES.NACK]: 'NACK',
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeFrame(type: number, seq: number, payload: string): ArrayBuffer {
  const payloadBytes = encoder.encode(payload);
  if (payloadBytes.byteLength > 65535) {
    throw new Error(`Payload exceeds 65535 bytes: ${payloadBytes.byteLength}`);
  }
  const buf = new ArrayBuffer(7 + payloadBytes.byteLength);
  const view = new DataView(buf);
  view.setUint8(0, type);
  view.setUint32(1, seq);
  view.setUint16(5, payloadBytes.byteLength);
  new Uint8Array(buf, 7).set(payloadBytes);
  return buf;
}

export interface DecodedFrame {
  type: number;
  seq: number;
  payload: string;
}

export function decodeFrame(buffer: ArrayBuffer): DecodedFrame | null {
  if (buffer.byteLength < 7) return null;
  const view = new DataView(buffer);
  const type = view.getUint8(0);
  const seq = view.getUint32(1);
  const len = view.getUint16(5);
  if (7 + len !== buffer.byteLength) return null;
  const payload = decoder.decode(new Uint8Array(buffer, 7, len));
  return { type, seq, payload };
}

export function encodeNack(missingSeqs: number[]): ArrayBuffer {
  const payloadLen = missingSeqs.length * 4;
  const buf = new ArrayBuffer(7 + payloadLen);
  const view = new DataView(buf);
  view.setUint8(0, CLIENT_TYPES.NACK);
  view.setUint32(1, 0);
  view.setUint16(5, payloadLen);
  for (let i = 0; i < missingSeqs.length; i++) {
    view.setUint32(7 + i * 4, missingSeqs[i]);
  }
  return buf;
}

export function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function canonicalJsonStringify(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(val: unknown): unknown {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(val as Record<string, unknown>).sort()) {
    sorted[k] = sortKeys((val as Record<string, unknown>)[k]);
  }
  return sorted;
}
