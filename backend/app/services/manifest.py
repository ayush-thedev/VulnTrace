import re
import json
import tomllib
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Literal
from pydantic import BaseModel, Field

VersionStatus = Literal["pinned", "range", "unpinned", "transitive", "unknown"]

class ManifestPackage(BaseModel):
    name: str                           # Normalized lowercase name, e.g. "jinja2"
    raw_name: str                       # Original case from manifest, e.g. "Jinja2"
    version: str                        # Declared or resolved version string, e.g. "2.11.3"
    declared_version: Optional[str] = None  # Raw declared version if available
    resolved_version: Optional[str] = None  # Exact pinned/resolved version
    specifier: str = "=="               # "==", "~=", ">=", etc.
    version_status: VersionStatus = "pinned"
    manifest_file: str = "requirements.txt"  # Relative file path
    line_number: int = 1
    raw_line: str = ""
    is_direct: bool = True
    parent_package: Optional[str] = None

from packaging.requirements import Requirement, InvalidRequirement

# Matches standard requirements.txt lines
# e.g.: jinja2==2.11.3, flask>=2.0.1, aiohttp~=3.8.0, requests
REQ_LINE_PATTERN = re.compile(
    r"^\s*([a-zA-Z0-9_\-\.]+)\s*(?:([=~><!^]=?)\s*([a-zA-Z0-9_\-\.\*]+))?(?:\s*;.*)?(?:\s*#.*)?$"
)

def parse_requirements_txt(content: str, filename: str = "requirements.txt") -> List[ManifestPackage]:
    packages: List[ManifestPackage] = []
    lines = content.splitlines()

    for idx, line in enumerate(lines, start=1):
        clean = line.strip()
        if not clean or clean.startswith("#") or clean.startswith("-"):
            continue

        # Strip inline comments and environment markers
        line_no_comment = clean.split("#")[0].strip()
        if not line_no_comment:
            continue

        # First try packaging.requirements.Requirement
        try:
            req = Requirement(line_no_comment)
            raw_name = req.name
            norm_name = raw_name.lower().replace("_", "-")
            spec_str = str(req.specifier)
            if spec_str:
                if spec_str.startswith("==") and "," not in spec_str and "*" not in spec_str:
                    v_status: VersionStatus = "pinned"
                    resolved = spec_str.replace("==", "").strip()
                    decl_version = resolved
                    spec = "=="
                else:
                    v_status = "range"
                    resolved = None
                    decl_version = spec_str
                    spec = spec_str[:2] if len(spec_str) >= 2 and spec_str[1] in "=><" else spec_str[:1]
            else:
                v_status = "unpinned"
                decl_version = ""
                resolved = None
                spec = ""

            packages.append(ManifestPackage(
                name=norm_name,
                raw_name=raw_name,
                version=resolved or decl_version or "unknown",
                declared_version=decl_version,
                resolved_version=resolved,
                specifier=spec,
                version_status=v_status,
                manifest_file=filename,
                line_number=idx,
                raw_line=clean,
                is_direct=True
            ))
            continue
        except (InvalidRequirement, Exception):
            pass

        match = REQ_LINE_PATTERN.match(line_no_comment)
        if match:
            raw_name, specifier, version = match.groups()
            norm_name = raw_name.lower().replace("_", "-")

            if specifier and version:
                if specifier == "==" and "*" not in version:
                    v_status: VersionStatus = "pinned"
                    resolved = version
                else:
                    v_status = "range"
                    resolved = None
                decl_version = version
                spec = specifier
            else:
                v_status = "unpinned"
                decl_version = ""
                resolved = None
                spec = ""
                version = ""

            packages.append(ManifestPackage(
                name=norm_name,
                raw_name=raw_name,
                version=resolved or decl_version or "unknown",
                declared_version=decl_version,
                resolved_version=resolved,
                specifier=spec,
                version_status=v_status,
                manifest_file=filename,
                line_number=idx,
                raw_line=clean,
                is_direct=True
            ))

    return packages

def parse_pyproject_toml(content: str, filename: str = "pyproject.toml") -> List[ManifestPackage]:
    packages: List[ManifestPackage] = []
    try:
        data = tomllib.loads(content)
    except Exception:
        return packages

    # 1. PEP 621 dependencies: [project] dependencies = [...]
    pep621_deps = data.get("project", {}).get("dependencies", [])
    for idx, dep_str in enumerate(pep621_deps, start=1):
        if not isinstance(dep_str, str):
            continue
        clean = dep_str.strip()
        match = REQ_LINE_PATTERN.match(clean)
        if match:
            raw_name, specifier, version = match.groups()
            norm_name = raw_name.lower().replace("_", "-")
            spec = specifier or ""
            decl_version = version or ""
            v_status: VersionStatus = "pinned" if spec == "==" and "*" not in decl_version else ("range" if spec else "unpinned")

            packages.append(ManifestPackage(
                name=norm_name,
                raw_name=raw_name,
                version=decl_version or "unknown",
                declared_version=decl_version,
                resolved_version=decl_version if v_status == "pinned" else None,
                specifier=spec,
                version_status=v_status,
                manifest_file=filename,
                line_number=idx,
                raw_line=clean,
                is_direct=True
            ))

    # 2. Poetry dependencies: [tool.poetry.dependencies]
    poetry_deps = data.get("tool", {}).get("poetry", {}).get("dependencies", {})
    if isinstance(poetry_deps, dict):
        for idx, (raw_name, val) in enumerate(poetry_deps.items(), start=1):
            if raw_name.lower() == "python":
                continue
            norm_name = raw_name.lower().replace("_", "-")
            if isinstance(val, str):
                ver_str = val.strip()
            elif isinstance(val, dict):
                ver_str = str(val.get("version", "")).strip()
            else:
                ver_str = ""

            spec = ""
            decl_version = ver_str
            if ver_str.startswith("^") or ver_str.startswith("~"):
                spec = ver_str[0]
                decl_version = ver_str[1:].strip()
                v_status = "range"
                resolved = None
            elif ver_str.startswith("=="):
                spec = "=="
                decl_version = ver_str[2:].strip()
                v_status = "pinned"
                resolved = decl_version
            elif ver_str.startswith(">=") or ver_str.startswith("<="):
                spec = ver_str[:2]
                decl_version = ver_str[2:].strip()
                v_status = "range"
                resolved = None
            elif ver_str:
                spec = "=="
                decl_version = ver_str
                v_status = "pinned"
                resolved = ver_str
            else:
                v_status = "unpinned"
                resolved = None

            packages.append(ManifestPackage(
                name=norm_name,
                raw_name=raw_name,
                version=resolved or decl_version or "unknown",
                declared_version=decl_version,
                resolved_version=resolved,
                specifier=spec,
                version_status=v_status,
                manifest_file=filename,
                line_number=idx,
                raw_line=f'{raw_name} = "{ver_str}"',
                is_direct=True
            ))

    return packages

def parse_poetry_lock(content: str, filename: str = "poetry.lock") -> List[ManifestPackage]:
    packages: List[ManifestPackage] = []
    try:
        data = tomllib.loads(content)
    except Exception:
        return packages

    raw_pkgs = data.get("package", [])
    if isinstance(raw_pkgs, list):
        for idx, p in enumerate(raw_pkgs, start=1):
            if not isinstance(p, dict):
                continue
            raw_name = p.get("name", "")
            ver = p.get("version", "")
            if raw_name and ver:
                norm_name = raw_name.lower().replace("_", "-")
                packages.append(ManifestPackage(
                    name=norm_name,
                    raw_name=raw_name,
                    version=ver,
                    declared_version=ver,
                    resolved_version=ver,
                    specifier="==",
                    version_status="pinned",
                    manifest_file=filename,
                    line_number=idx,
                    raw_line=f'name = "{raw_name}", version = "{ver}"',
                    is_direct=False  # Lockfile entries might be transitive unless matched with direct
                ))

    return packages

def parse_package_json(content: str, filename: str = "package.json") -> List[ManifestPackage]:
    packages: List[ManifestPackage] = []
    try:
        data = json.loads(content)
    except Exception:
        return packages

    deps = data.get("dependencies", {})
    if isinstance(deps, dict):
        for idx, (raw_name, ver_str) in enumerate(deps.items(), start=1):
            if not isinstance(ver_str, str):
                continue
            clean_ver = re.sub(r"^[~^>=< ]+", "", ver_str).strip()
            norm_name = raw_name.lower()
            packages.append(ManifestPackage(
                name=norm_name,
                raw_name=raw_name,
                version=clean_ver or ver_str,
                declared_version=ver_str,
                resolved_version=clean_ver if clean_ver else None,
                specifier="^" if ver_str.startswith("^") else "~" if ver_str.startswith("~") else "==",
                version_status="pinned" if re.match(r"^\d+\.\d+", ver_str) else "range",
                manifest_file=filename,
                line_number=idx,
                raw_line=f'"{raw_name}": "{ver_str}"',
                is_direct=True
            ))

    dev_deps = data.get("devDependencies", {})
    if isinstance(dev_deps, dict):
        for idx, (raw_name, ver_str) in enumerate(dev_deps.items(), start=len(packages) + 1):
            if not isinstance(ver_str, str) or raw_name.lower() in [p.name for p in packages]:
                continue
            clean_ver = re.sub(r"^[~^>=< ]+", "", ver_str).strip()
            norm_name = raw_name.lower()
            packages.append(ManifestPackage(
                name=norm_name,
                raw_name=raw_name,
                version=clean_ver or ver_str,
                declared_version=ver_str,
                resolved_version=clean_ver if clean_ver else None,
                specifier="^" if ver_str.startswith("^") else "~" if ver_str.startswith("~") else "==",
                version_status="pinned" if re.match(r"^\d+\.\d+", ver_str) else "range",
                manifest_file=filename,
                line_number=idx,
                raw_line=f'"{raw_name}": "{ver_str}"',
                is_direct=True
            ))

    return packages

def parse_manifest_file(file_path: Path) -> List[ManifestPackage]:
    if not file_path.exists():
        raise FileNotFoundError(f"Manifest not found: {file_path}")
    content = file_path.read_text(encoding="utf-8")
    fname = file_path.name.lower()

    if fname == "package.json":
        return parse_package_json(content, file_path.name)
    elif fname.endswith(".toml"):
        if fname == "poetry.lock":
            return parse_poetry_lock(content, file_path.name)
        return parse_pyproject_toml(content, file_path.name)
    elif fname.endswith(".lock"):
        return parse_poetry_lock(content, file_path.name)
    else:
        return parse_requirements_txt(content, file_path.name)

def detect_manifest_packages(repo_path: Path) -> List[ManifestPackage]:
    """
    Scans a repository root for dependency manifests in priority order:
    1. requirements.txt (and requirements/*.txt)
    2. pyproject.toml
    3. package.json (Node.js)
    4. poetry.lock / Pipfile.lock (for resolving transitive versions)
    """
    repo_dir = repo_path.resolve()
    direct_packages: Dict[str, ManifestPackage] = {}
    resolved_lock_packages: Dict[str, ManifestPackage] = {}

    # Check lockfile first for exact resolved versions
    lock_file = repo_dir / "poetry.lock"
    if lock_file.exists():
        try:
            for p in parse_poetry_lock(lock_file.read_text(encoding="utf-8"), "poetry.lock"):
                resolved_lock_packages[p.name] = p
        except Exception:
            pass

    # Check requirements.txt
    req_file = repo_dir / "requirements.txt"
    if req_file.exists():
        for p in parse_manifest_file(req_file):
            if p.name in resolved_lock_packages and not p.resolved_version:
                p.resolved_version = resolved_lock_packages[p.name].version
            direct_packages[p.name] = p

    # Also search for requirements subfolder or requirements-dev.txt
    for sub_req in list(repo_dir.glob("requirements*.txt")) + list(repo_dir.glob("requirements/*.txt")):
        if sub_req.name == "requirements.txt":
            continue
        try:
            rel = str(sub_req.relative_to(repo_dir))
            for p in parse_requirements_txt(sub_req.read_text(encoding="utf-8"), rel):
                if p.name not in direct_packages:
                    direct_packages[p.name] = p
        except Exception:
            pass

    # Check pyproject.toml
    pyproject_file = repo_dir / "pyproject.toml"
    if pyproject_file.exists():
        for p in parse_manifest_file(pyproject_file):
            if p.name not in direct_packages:
                if p.name in resolved_lock_packages and not p.resolved_version:
                    p.resolved_version = resolved_lock_packages[p.name].version
                direct_packages[p.name] = p

    # Check package.json (Node.js / npm)
    pkg_json_file = repo_dir / "package.json"
    if pkg_json_file.exists():
        try:
            for p in parse_manifest_file(pkg_json_file):
                if p.name not in direct_packages:
                    direct_packages[p.name] = p
        except Exception:
            pass

    # If package exists in lockfile but not direct, mark as transitive
    result: List[ManifestPackage] = list(direct_packages.values())
    for name, lock_pkg in resolved_lock_packages.items():
        if name not in direct_packages:
            lock_pkg.is_direct = False
            lock_pkg.version_status = "transitive"
            result.append(lock_pkg)

    return result

def find_package_declaration(repo_path: Path, package_name: str) -> Optional[ManifestPackage]:
    packages = detect_manifest_packages(repo_path)
    norm = package_name.lower().replace("_", "-")
    for p in packages:
        if p.name == norm:
            return p
    return None

def update_manifest_file(
    manifest_path: Path,
    package_name: str,
    target_version: str
) -> Tuple[bool, str, str]:
    """
    Applies a clean, syntax-preserving update to a manifest file for the target package.
    Returns: (success, status_message, new_raw_line)
    """
    if not manifest_path.exists():
        return False, f"Manifest file '{manifest_path.name}' does not exist", ""

    content = manifest_path.read_text(encoding="utf-8")
    lines = content.splitlines(keepends=True)
    norm_target = package_name.lower().replace("_", "-")
    fname = manifest_path.name.lower()

    if fname.endswith(".toml"):
        # Match inside TOML dependencies
        # e.g.: jinja2 = "^2.11.3" or "jinja2==2.11.3"
        pattern = re.compile(
            rf'^(\s*["\']?{re.escape(norm_target)}["\']?\s*[:=]\s*["\'])([^"\']+)(["\'].*)$',
            re.IGNORECASE
        )
        for i, line in enumerate(lines):
            match = pattern.match(line.rstrip("\r\n"))
            if match:
                prefix, old_ver, suffix = match.groups()
                # If poetry caret or tilde, preserve specifier
                if old_ver.startswith("^") or old_ver.startswith("~"):
                    new_ver_spec = f"{old_ver[0]}{target_version}"
                else:
                    new_ver_spec = target_version
                new_line = f"{prefix}{new_ver_spec}{suffix}\n"
                lines[i] = new_line
                manifest_path.write_text("".join(lines), encoding="utf-8")
                return True, f"Updated {package_name} in {manifest_path.name} to {target_version}", new_line.strip()

        # Check PEP 621 array string: "jinja2==2.11.3"
        arr_pattern = re.compile(
            rf'^(\s*["\']{re.escape(norm_target)}\s*([=~><!]=?)\s*)([0-9a-zA-Z_.-]+)(["\'].*)$',
            re.IGNORECASE
        )
        for i, line in enumerate(lines):
            match = arr_pattern.match(line.rstrip("\r\n"))
            if match:
                prefix, spec, old_ver, suffix = match.groups()
                new_line = f"{prefix}{target_version}{suffix}\n"
                lines[i] = new_line
                manifest_path.write_text("".join(lines), encoding="utf-8")
                return True, f"Updated {package_name} in {manifest_path.name} to {target_version}", new_line.strip()

        return False, f"Could not find dependency declaration for '{package_name}' in {manifest_path.name}", ""

    else:
        # requirements.txt format
        for i, line in enumerate(lines):
            line_str = line.rstrip("\r\n")
            if not line_str or line_str.strip().startswith("#"):
                continue

            comment_part = ""
            if "#" in line_str:
                idx = line_str.index("#")
                comment_part = "  " + line_str[idx:]
                code_part = line_str[:idx].rstrip()
            else:
                code_part = line_str.rstrip()

            marker_part = ""
            if ";" in code_part:
                idx = code_part.index(";")
                marker_part = " " + code_part[idx:]
                code_part = code_part[:idx].rstrip()

            # Match package name at start
            match = re.match(
                rf"^(\s*{re.escape(norm_target)}\s*)(?:([=~><!^]=?)\s*(.*))?$",
                code_part,
                re.IGNORECASE
            )
            if match:
                prefix, spec, old_ver = match.groups()
                new_spec = spec if spec in ("~=", "==") else "=="
                new_line = f"{prefix}{new_spec}{target_version}{marker_part}{comment_part}\n"
                lines[i] = new_line
                manifest_path.write_text("".join(lines), encoding="utf-8")
                return True, f"Updated {package_name} in {manifest_path.name} to {target_version}", new_line.strip()

        return False, f"Could not find dependency declaration for '{package_name}' in {manifest_path.name}", ""
