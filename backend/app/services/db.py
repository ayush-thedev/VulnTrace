import sqlite3
import re
import uuid
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "vulntrace.db"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY,
            url TEXT UNIQUE,
            owner TEXT,
            name TEXT,
            default_branch TEXT,
            language TEXT,
            created_at TEXT,
            last_scan_id TEXT,
            last_scan_at TEXT,
            status TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            finding_id TEXT,
            action TEXT,
            reason TEXT,
            notes TEXT,
            timestamp TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            repo_url TEXT,
            repo_path TEXT,
            status TEXT,
            findings_count INTEGER,
            created_at TEXT,
            completed_at TEXT,
            commit_sha TEXT,
            data_json TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_findings (
            id TEXT PRIMARY KEY,
            scan_id TEXT,
            data_json TEXT
        )
    """)
    conn.commit()
    conn.close()

# Initialize DB on module import
init_db()

def normalize_github_url(raw_url: str) -> Dict[str, str]:
    """
    Normalizes GitHub URLs:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - https://github.com/owner/repo/tree/branch
    - owner/repo shorthand
    """
    clean = raw_url.strip()
    branch = None

    # Handle tree/branch
    tree_match = re.search(r"github\.com/([^/]+)/([^/]+)/tree/([^/]+)", clean)
    if tree_match:
        owner = tree_match.group(1)
        name = tree_match.group(2).removesuffix(".git")
        branch = tree_match.group(3)
        canonical_url = f"https://github.com/{owner}/{name}"
        return {"owner": owner, "name": name, "canonical_url": canonical_url, "branch": branch}

    # Handle full https://github.com/owner/repo(.git)
    full_match = re.search(r"github\.com/([^/]+)/([^/]+)", clean)
    if full_match:
        owner = full_match.group(1)
        name = full_match.group(2).removesuffix(".git").split("#")[0].split("?")[0]
        canonical_url = f"https://github.com/{owner}/{name}"
        return {"owner": owner, "name": name, "canonical_url": canonical_url, "branch": "main"}

    # Handle owner/repo shorthand
    short_match = re.match(r"^([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)$", clean)
    if short_match:
        owner = short_match.group(1)
        name = short_match.group(2).removesuffix(".git")
        canonical_url = f"https://github.com/{owner}/{name}"
        return {"owner": owner, "name": name, "canonical_url": canonical_url, "branch": "main"}

    # Fallback / Local fixture support (e.g. "demo-fixture")
    if clean in ["demo-fixture", "sample_repo"] or Path(clean).exists():
        path_name = Path(clean).name
        return {"owner": "local", "name": path_name, "canonical_url": clean, "branch": "main"}

    raise ValueError(f"Invalid GitHub repository URL or shorthand: '{raw_url}'")

def add_repository(url: str, branch: Optional[str] = None) -> Dict[str, Any]:
    norm = normalize_github_url(url)
    owner = norm["owner"]
    name = norm["name"]
    canonical_url = norm["canonical_url"]
    default_branch = branch or norm.get("branch") or "main"

    conn = get_connection()
    cursor = conn.cursor()

    # Check if exists
    cursor.execute("SELECT * FROM repositories WHERE url = ?", (canonical_url,))
    row = cursor.fetchone()
    if row:
        conn.close()
        return dict(row)

    repo_id = f"repo-{uuid.uuid4().hex[:8]}"
    created_at = datetime.now(timezone.utc).isoformat()
    language = "Python"

    cursor.execute("""
        INSERT INTO repositories (id, url, owner, name, default_branch, language, created_at, last_scan_id, last_scan_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (repo_id, canonical_url, owner, name, default_branch, language, created_at, None, None, "connected"))
    conn.commit()

    cursor.execute("SELECT * FROM repositories WHERE id = ?", (repo_id,))
    new_row = dict(cursor.fetchone())
    conn.close()
    return new_row

def list_repositories() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM repositories ORDER BY created_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_repository(repo_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM repositories WHERE id = ? OR url = ?", (repo_id, repo_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_repository(repo_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM repositories WHERE id = ?", (repo_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def update_repository_scan(repo_id: str, scan_id: str, scan_time: str, status: str = "active"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE repositories
        SET last_scan_id = ?, last_scan_at = ?, status = ?
        WHERE id = ? OR url = ?
    """, (scan_id, scan_time, status, repo_id, repo_id))
    conn.commit()
    conn.close()

def log_audit_dismissal(finding_id: str, reason: str, notes: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    ts = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO audit_logs (id, finding_id, action, reason, notes, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (audit_id, finding_id, "dismiss", reason, notes or "", ts))
    conn.commit()
    conn.close()

def save_scan_record(scan_data: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    s_id = scan_data["id"]
    cursor.execute("""
        INSERT OR REPLACE INTO scans (id, repo_url, repo_path, status, findings_count, created_at, completed_at, commit_sha, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        s_id,
        scan_data.get("repo_url"),
        scan_data.get("repo_path"),
        scan_data.get("status"),
        scan_data.get("findings_count", 0),
        str(scan_data.get("created_at") or ""),
        str(scan_data.get("completed_at") or ""),
        scan_data.get("commit_sha"),
        json.dumps(scan_data)
    ))
    conn.commit()
    conn.close()

def get_scan_record(scan_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json FROM scans WHERE id = ?", (scan_id,))
    row = cursor.fetchone()
    conn.close()
    if row and row["data_json"]:
        try:
            return json.loads(row["data_json"])
        except Exception:
            pass
    return None

def list_scan_records() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json FROM scans ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        if r["data_json"]:
            try:
                result.append(json.loads(r["data_json"]))
            except Exception:
                pass
    return result

def save_scan_findings_records(scan_id: str, findings_list: List[Dict[str, Any]]):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM scan_findings WHERE scan_id = ?", (scan_id,))
    for f in findings_list:
        f_id = f["id"]
        cursor.execute("""
            INSERT OR REPLACE INTO scan_findings (id, scan_id, data_json)
            VALUES (?, ?, ?)
        """, (f_id, scan_id, json.dumps(f)))
    conn.commit()
    conn.close()

def get_scan_findings_records(scan_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json FROM scan_findings WHERE scan_id = ?", (scan_id,))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        if r["data_json"]:
            try:
                result.append(json.loads(r["data_json"]))
            except Exception:
                pass
    return result

def get_all_findings_records() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json FROM scan_findings")
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        if r["data_json"]:
            try:
                result.append(json.loads(r["data_json"]))
            except Exception:
                pass
    return result

