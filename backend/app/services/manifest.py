import re
from pathlib import Path
from typing import Dict, List
from pydantic import BaseModel

class ManifestPackage(BaseModel):
    name: str
    version: str
    specifier: str
    line_number: int
    raw_line: str

def parse_requirements_txt(content: str) -> List[ManifestPackage]:
    packages = []
    lines = content.splitlines()
    
    # Matches packages like `package==1.2.3`, `package~=1.2.3`, `package>=1.2.3`
    req_pattern = re.compile(r"^\s*([a-zA-Z0-9_\-\.]+)\s*([=~><!]=?)\s*([a-zA-Z0-9_\-\.]+)")

    for idx, line in enumerate(lines, start=1):
        clean = line.strip()
        if not clean or clean.startswith("#") or clean.startswith("-"):
            continue
        
        match = req_pattern.match(clean)
        if match:
            pkg_name, specifier, version = match.groups()
            packages.append(ManifestPackage(
                name=pkg_name.lower().replace("_", "-"),
                version=version,
                specifier=specifier,
                line_number=idx,
                raw_line=clean
            ))
    return packages

def parse_manifest_file(file_path: Path) -> List[ManifestPackage]:
    if not file_path.exists():
        raise FileNotFoundError(f"Manifest not found: {file_path}")
    content = file_path.read_text(encoding="utf-8")
    return parse_requirements_txt(content)
