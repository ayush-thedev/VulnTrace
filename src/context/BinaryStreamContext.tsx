import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { ScanClient, InspectorData } from '../services/scanClient';
import { ScanState, INITIAL_STATE, ScanEvent } from '../services/reducer';
import { ParsedDependency } from '../services/lockfileParser';

export type StreamMode = 'binary_ws' | 'rest_sse';

export interface BinaryStreamContextType {
  scanState: ScanState;
  inspectorData: InspectorData;
  eventLog: ScanEvent[];
  streamMode: StreamMode;
  setStreamMode: (mode: StreamMode) => void;
  activeScanId: string | null;
  setActiveScanId: (id: string | null) => void;
  startBinaryScan: (
    scanId: string,
    options?: {
      isDemo?: boolean;
      chaos?: { drop?: boolean; reorder?: boolean; duplicate?: boolean };
      wsUrl?: string;
    }
  ) => Promise<void>;
  ingestLockfile: (fileName: string, deps: ParsedDependency[]) => Promise<void>;
  replayFromZero: () => Promise<void>;
  inspectorVisible: boolean;
  setInspectorVisible: React.Dispatch<React.SetStateAction<boolean>>;
  chaosEnabled: boolean;
  toggleChaos: () => void;
}

const DEFAULT_INSPECTOR: InspectorData = {
  logLength: 0,
  lastOffset: 0,
  nextSeq: 0,
  bufferedFrames: 0,
  dupCount: 0,
  nackCount: 0,
  connectionState: 'disconnected',
  stateHash: '--------',
  replayStateHash: '--------',
  hashMatch: true,
};

const BinaryStreamContext = createContext<BinaryStreamContextType | null>(null);

export const BinaryStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [streamMode, setStreamMode] = useState<StreamMode>('binary_ws');
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>(INITIAL_STATE);
  const [inspectorData, setInspectorData] = useState<InspectorData>(DEFAULT_INSPECTOR);
  const [eventLog, setEventLog] = useState<ScanEvent[]>([]);
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [chaosEnabled, setChaosEnabled] = useState(false);

  const clientRef = useRef<ScanClient | null>(null);

  // Initialize or teardown ScanClient on activeScanId change or streamMode change
  useEffect(() => {
    if (!activeScanId || streamMode !== 'binary_ws') {
      return;
    }

    // If client already active for this scanId, keep it
    if (clientRef.current && (clientRef.current as any).options?.scanId === activeScanId) {
      return;
    }

    if (clientRef.current) {
      clientRef.current.dispose();
      clientRef.current = null;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000`;

    const client = new ScanClient({
      scanId: activeScanId,
      wsUrl,
      chaos: chaosEnabled ? { drop: true, reorder: true, duplicate: true } : undefined,
      onStateUpdate: (state, stats) => {
        setScanState(state);
        setInspectorData(stats);
        if (clientRef.current) {
          setEventLog(clientRef.current.getEventLog());
        }
      },
    });

    clientRef.current = client;
    client.init().catch(() => {});

    return () => {
      client.dispose();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [activeScanId, streamMode, chaosEnabled]);

  const startBinaryScan = useCallback(
    async (
      scanId: string,
      options?: {
        isDemo?: boolean;
        chaos?: { drop?: boolean; reorder?: boolean; duplicate?: boolean };
        wsUrl?: string;
      }
    ) => {
      if (clientRef.current) {
        clientRef.current.dispose();
        clientRef.current = null;
      }

      setActiveScanId(scanId);

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = options?.wsUrl || `${wsProtocol}//${window.location.hostname}:8000`;

      const client = new ScanClient({
        scanId,
        wsUrl,
        isDemo: options?.isDemo,
        chaos: options?.chaos ?? (chaosEnabled ? { drop: true, reorder: true, duplicate: true } : undefined),
        onStateUpdate: (state, stats) => {
          setScanState(state);
          setInspectorData(stats);
          if (clientRef.current) {
            setEventLog(clientRef.current.getEventLog());
          }
        },
      });

      clientRef.current = client;
      await client.init();
      setScanState(client.getState());
      setInspectorData(client.getInspectorData());
      setEventLog(client.getEventLog());
    },
    [chaosEnabled]
  );

  const ingestLockfile = useCallback(
    async (fileName: string, deps: ParsedDependency[]) => {
      const scanId = `lockfile-${Date.now().toString(16)}`;
      await startBinaryScan(scanId, { isDemo: false });
      if (clientRef.current) {
        await clientRef.current.ingestLockfileData(fileName, deps);
        setScanState(clientRef.current.getState());
        setInspectorData(clientRef.current.getInspectorData());
        setEventLog(clientRef.current.getEventLog());
      }
    },
    [startBinaryScan]
  );

  const replayFromZero = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.replayFromZero();
      setScanState(clientRef.current.getState());
      setInspectorData(clientRef.current.getInspectorData());
      setEventLog(clientRef.current.getEventLog());
    }
  }, []);

  const toggleChaos = useCallback(() => {
    setChaosEnabled((prev) => !prev);
  }, []);

  return (
    <BinaryStreamContext.Provider
      value={{
        scanState,
        inspectorData,
        eventLog,
        streamMode,
        setStreamMode,
        activeScanId,
        setActiveScanId,
        startBinaryScan,
        ingestLockfile,
        replayFromZero,
        inspectorVisible,
        setInspectorVisible,
        chaosEnabled,
        toggleChaos,
      }}
    >
      {children}
    </BinaryStreamContext.Provider>
  );
};

export const useBinaryStream = (): BinaryStreamContextType => {
  const context = useContext(BinaryStreamContext);
  if (!context) {
    throw new Error('useBinaryStream must be used within a BinaryStreamProvider');
  }
  return context;
};
