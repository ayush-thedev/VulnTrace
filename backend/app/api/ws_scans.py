"""WebSocket endpoint for binary stream protocol."""
import struct
import json
import asyncio
import logging
import random
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.api.scans import SCANS_STORE, SCAN_FINDINGS_STORE

logger = logging.getLogger("vulntrace.api.ws_scans")

router = APIRouter(tags=["WebSocket"])

# Frame type constants
SCAN_STARTED = 0x01
DEPENDENCY_FOUND = 0x02
VULN_FOUND = 0x03
PATH_FOUND = 0x04
VERDICT = 0x05
RISK = 0x06
REMEDIATION = 0x07
VALIDATION = 0x08
SCAN_COMPLETED = 0x09
NACK = 0xF0


def encode_frame(frame_type: int, seq: int, payload: str) -> bytes:
    """Encode a binary frame: 7-byte header + UTF-8 payload."""
    payload_bytes = payload.encode("utf-8")
    if len(payload_bytes) > 65535:
        raise ValueError(f"Payload exceeds 65535 bytes: {len(payload_bytes)}")
    header = struct.pack(">BIH", frame_type, seq, len(payload_bytes))
    return header + payload_bytes


def decode_nack(data: bytes) -> List[int]:
    """Decode NACK payload: concatenated u32 BE missing seqs."""
    if len(data) < 7:
        return []
    payload_len = struct.unpack(">H", data[5:7])[0]
    payload = data[7:7 + payload_len]
    seqs = []
    for i in range(0, len(payload), 4):
        if i + 4 <= len(payload):
            seqs.append(struct.unpack(">I", payload[i:i + 4])[0])
    return seqs


def build_scan_frames(scan_id: str) -> List[bytes]:
    """Build all binary frames from stored scan findings."""
    scan = SCANS_STORE.get(scan_id)
    if not scan:
        return []

    findings = SCAN_FINDINGS_STORE.get(scan_id, [])
    frames: List[bytes] = []
    seq = 0

    # SCAN_STARTED
    started_payload = json.dumps({
        "repoPath": scan.repo_path,
        "repoUrl": scan.repo_url or "",
    })
    frames.append(encode_frame(SCAN_STARTED, seq, started_payload))
    seq += 1

    # DEPENDENCY_FOUND: collect unique packages
    seen_pkgs = set()
    for f in findings:
        pkg = f.vulnerability.package_name
        if pkg not in seen_pkgs:
            seen_pkgs.add(pkg)
            dep_payload = json.dumps({
                "name": pkg,
                "version": f.evidence.declared_version or "unknown",
                "ecosystem": f.vulnerability.package_ecosystem,
                "source": f.evidence.manifest_file or "requirements.txt",
            })
            frames.append(encode_frame(DEPENDENCY_FOUND, seq, dep_payload))
            seq += 1

    # VULN_FOUND
    for f in findings:
        vuln_payload = json.dumps({
            "vulnId": f.vulnerability.id,
            "aliases": f.vulnerability.aliases,
            "summary": f.vulnerability.summary,
            "severity": f.vulnerability.severity,
            "packageName": f.vulnerability.package_name,
            "ecosystem": f.vulnerability.package_ecosystem,
            "affectedRange": f.vulnerability.affected_version_range,
            "fixedVersions": f.vulnerability.fixed_versions,
            "advisoryUrl": f.vulnerability.advisory_url,
        })
        frames.append(encode_frame(VULN_FOUND, seq, vuln_payload))
        seq += 1

    # PATH_FOUND
    for f in findings:
        for path in f.evidence.candidate_paths:
            hops = []
            for hop in path.hops:
                hops.append({
                    "nodeId": hop.node_id,
                    "filePath": hop.file_path,
                    "functionName": hop.function_name,
                    "lineNumber": hop.line_number,
                    "isEntryPoint": hop.is_entry_point,
                    "callResolved": hop.call_resolved,
                })
            path_payload = json.dumps({
                "pathId": path.path_id,
                "entryPointId": path.entry_point_id,
                "vulnerableTargetId": path.vulnerable_target_id,
                "hops": hops,
                "containsUnresolvedCall": path.contains_unresolved_call,
            })
            frames.append(encode_frame(PATH_FOUND, seq, path_payload))
            seq += 1

    # VERDICT
    for f in findings:
        verdict_payload = json.dumps({
            "vulnId": f.vulnerability.id,
            "verdict": f.reachability.verdict,
            "confidenceNote": f.reachability.confidence_note,
            "caveats": f.reachability.caveats,
            "evidenceRefs": f.reachability.evidence_refs,
            "rationale": f.reachability.rationale,
        })
        frames.append(encode_frame(VERDICT, seq, verdict_payload))
        seq += 1

    # RISK
    for f in findings:
        risk_payload = json.dumps({
            "vulnId": f.vulnerability.id,
            "band": f.priority.band,
            "rationale": f.priority.rationale,
        })
        frames.append(encode_frame(RISK, seq, risk_payload))
        seq += 1

    # REMEDIATION
    for f in findings:
        rem_payload = json.dumps({
            "vulnId": f.vulnerability.id,
            "diff": f.remediation.diff,
            "targetFile": f.remediation.target_file,
            "originalVersion": f.remediation.original_version,
            "targetVersion": f.remediation.target_version,
            "rationale": f.remediation.rationale,
            "status": f.remediation.status,
        })
        frames.append(encode_frame(REMEDIATION, seq, rem_payload))
        seq += 1

    # VALIDATION
    for f in findings:
        checks = []
        for c in f.validation.checks_run:
            checks.append({
                "checkName": c.check_name,
                "passed": c.passed,
                "category": c.category,
                "durationSeconds": c.duration_seconds,
            })
        val_payload = json.dumps({
            "vulnId": f.vulnerability.id,
            "status": f.validation.status,
            "checks": checks,
            "executedInSandbox": f.validation.executed_in_sandbox,
        })
        frames.append(encode_frame(VALIDATION, seq, val_payload))
        seq += 1

    # SCAN_COMPLETED
    completed_payload = json.dumps({"findingsCount": len(findings)})
    frames.append(encode_frame(SCAN_COMPLETED, seq, completed_payload))

    return frames


def apply_chaos(frames: List[bytes], rng: random.Random, chaos_modes: set) -> List[bytes]:
    """Apply deterministic chaos to frame list."""
    result = list(frames)

    # Drop ~10%
    if "drop" in chaos_modes:
        result = [f for f in result if rng.random() > 0.1]

    # Reorder in windows of 4-6
    if "reorder" in chaos_modes:
        reordered: List[bytes] = []
        i = 0
        while i < len(result):
            window_size = rng.randint(4, 6)
            window = result[i:i + window_size]
            rng.shuffle(window)
            reordered.extend(window)
            i += window_size
        result = reordered

    # Duplicate ~5%
    if "dup" in chaos_modes:
        with_dups: List[bytes] = []
        for f in result:
            with_dups.append(f)
            if rng.random() < 0.05:
                with_dups.append(f)
        result = with_dups

    return result


@router.websocket("/ws/scans/{scan_id}")
async def ws_scan(websocket: WebSocket, scan_id: str):
    """WebSocket endpoint for binary stream protocol."""
    await websocket.accept()

    if scan_id not in SCANS_STORE:
        await websocket.close(code=1008, reason=f"Scan '{scan_id}' not found")
        return

    # Parse query params
    from_seq = 0
    chaos_modes: set = set()
    seed = 42

    query_params = websocket.query_params
    if "from" in query_params:
        try:
            from_seq = int(query_params["from"])
        except ValueError:
            pass
    if "chaos" in query_params:
        chaos_modes = set(query_params["chaos"].split(","))
    if "seed" in query_params:
        try:
            seed = int(query_params["seed"])
        except ValueError:
            pass

    rng = random.Random(seed)

    # Build frame history
    all_frames = build_scan_frames(scan_id)
    if not all_frames:
        await websocket.close(code=1008, reason="No frames available")
        return

    # Apply chaos
    frames_to_send = list(all_frames)
    if chaos_modes:
        frames_to_send = apply_chaos(frames_to_send, rng, chaos_modes)

    # Filter by from_seq (send frames with seq >= from_seq)
    filtered: List[bytes] = []
    for f in frames_to_send:
        if len(f) >= 7:
            frame_seq = struct.unpack(">I", f[1:5])[0]
            if frame_seq >= from_seq:
                filtered.append(f)
    frames_to_send = filtered

    try:
        # Send frames with slight delay for realism
        for frame in frames_to_send:
            await websocket.send_bytes(frame)
            await asyncio.sleep(0.05)

        # Listen for NACKs and retransmit
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=30.0)
                if len(data) >= 7:
                    frame_type = struct.unpack(">B", data[0:1])[0]
                    if frame_type == NACK:
                        missing_seqs = decode_nack(data)
                        logger.info(f"NACK received for seqs: {missing_seqs}")
                        for ms in missing_seqs:
                            if ms < len(all_frames):
                                await websocket.send_bytes(all_frames[ms])
                                await asyncio.sleep(0.02)
            except asyncio.TimeoutError:
                break

    except WebSocketDisconnect:
        logger.info(f"WS client disconnected for scan {scan_id}")
    except Exception as e:
        logger.error(f"WS error for scan {scan_id}: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
