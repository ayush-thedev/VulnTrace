import { useBinaryStream } from '../context/BinaryStreamContext';

export function useScanClient() {
  return useBinaryStream();
}
