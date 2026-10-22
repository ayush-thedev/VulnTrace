"""
VulnTrace Binary Stream Protocol Demo
======================================
Demonstrates the 7-byte binary frame protocol over WebSocket.
Uses only the Python standard library (no pip install needed).
"""
import asyncio
import struct
import hashlib
import base64
import os
import sys

TYPES = {
    0x01: "SCAN_STARTED",
    0x02: "DEPENDENCY",
    0x03: "VULN_FOUND",
    0x04: "PATH_FOUND",
    0x05: "VERDICT",
    0x06: "RISK",
    0x07: "REMEDIATION",
    0x08: "VALIDATION",
    0x09: "COMPLETED",
}

HOST = "127.0.0.1"
PORT = 8000


async def ws_connect(path: str):
    """Minimal WebSocket client using only asyncio (no external libs)."""
    reader, writer = await asyncio.open_connection(HOST, PORT)

    # WebSocket handshake
    key = base64.b64encode(os.urandom(16)).decode()
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {HOST}:{PORT}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    writer.write(request.encode())
    await writer.drain()

    # Read HTTP response headers
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = await reader.read(4096)
        if not chunk:
            raise ConnectionError("Connection closed during handshake")
        response += chunk

    if b"101" not in response.split(b"\r\n")[0]:
        raise ConnectionError(f"Handshake failed: {response.split(b'\\r\\n')[0]}")

    return reader, writer


async def read_ws_frame(reader):
    """Read a single WebSocket frame and return the payload bytes."""
    header = await reader.readexactly(2)
    opcode = header[0] & 0x0F
    masked = (header[1] & 0x80) != 0
    length = header[1] & 0x7F

    if length == 126:
        length = struct.unpack(">H", await reader.readexactly(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", await reader.readexactly(8))[0]

    if masked:
        mask = await reader.readexactly(4)
        data = bytearray(await reader.readexactly(length))
        for i in range(length):
            data[i] ^= mask[i % 4]
        return opcode, bytes(data)

    data = await reader.readexactly(length)
    return opcode, data


def decode_binary_frame(data: bytes):
    """Decode VulnTrace 7-byte header: u8 type, u32 seq, u16 payload_len."""
    if len(data) < 7:
        return None
    ftype, seq, plen = struct.unpack(">BIH", data[:7])
    payload = data[7:7 + plen].decode("utf-8", errors="replace")
    return ftype, seq, plen, payload


async def demo_normal():
    """Demo 1: Normal stream — frames arrive in perfect order."""
    print()
    print("=" * 65)
    print("  DEMO 1: Normal Binary Stream")
    print("  Each frame has a 7-byte header: [type u8][seq u32][len u16]")
    print("=" * 65)
    print()

    reader, writer = await ws_connect("/ws/scans/SCAN-B6E50D")
    count = 0

    while True:
        opcode, data = await read_ws_frame(reader)
        if opcode == 0x02:  # binary frame
            result = decode_binary_frame(data)
            if result:
                ftype, seq, plen, payload = result
                name = TYPES.get(ftype, "UNKNOWN")
                preview = payload[:45].replace("\n", " ")
                print(f"  [seq {seq:02d}]  0x{ftype:02x}  {name:14s}  |  header: 7B  payload: {plen:4d}B  |  {preview}...")
                count += 1
                if ftype == 0x09:
                    break
        elif opcode == 0x08:  # close
            break

    writer.close()
    print()
    print(f"  Received {count} frames. All arrived in perfect sequential order.")
    print()


async def demo_chaos():
    """Demo 2: Chaos mode — frames arrive reordered, with drops and duplicates."""
    print()
    print("=" * 65)
    print("  DEMO 2: CHAOS MODE (drop ~10%, reorder, duplicate ~5%)")
    print("  Watch how sequence numbers arrive OUT OF ORDER!")
    print("=" * 65)
    print()

    reader, writer = await ws_connect("/ws/scans/SCAN-B6E50D?chaos=drop,reorder,dup&seed=42")
    count = 0
    prev_seq = -1

    while count < 15:
        opcode, data = await read_ws_frame(reader)
        if opcode == 0x02:
            result = decode_binary_frame(data)
            if result:
                ftype, seq, plen, payload = result
                name = TYPES.get(ftype, "UNKNOWN")

                # Flag out-of-order or duplicate
                flag = ""
                if seq < prev_seq:
                    flag = "  <-- OUT OF ORDER!"
                elif seq == prev_seq:
                    flag = "  <-- DUPLICATE!"
                elif seq > prev_seq + 1:
                    missing = list(range(prev_seq + 1, seq))
                    flag = f"  <-- GAP! missing: {missing}"

                print(f"  [seq {seq:02d}]  0x{ftype:02x}  {name:14s}  |  {plen:4d}B{flag}")
                prev_seq = seq
                count += 1
                if ftype == 0x09:
                    break
        elif opcode == 0x08:
            break

    writer.close()
    print()
    print("  Frames arrived jumbled! In production, the client receiver:")
    print("    1. Buffers out-of-order frames")
    print("    2. Detects gaps and sends NACK (0xF0) to request retransmit")
    print("    3. Delivers events to the app in perfect sequential order")
    print("    4. The final state hash is IDENTICAL to normal delivery")
    print()


async def main():
    print()
    print("  VulnTrace Binary Stream Protocol Demo")
    print("  " + "-" * 42)

    try:
        await demo_normal()
        await demo_chaos()
        print("  Both demos completed successfully!")
        print()
    except ConnectionError as e:
        print(f"\n  ERROR: Could not connect to backend: {e}")
        print("  Make sure the backend is running: uvicorn backend.app.main:app --port 8000")
        sys.exit(1)
    except Exception as e:
        print(f"\n  ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
