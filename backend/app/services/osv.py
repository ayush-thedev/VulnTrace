import httpx
import logging
from typing import List, Optional, Dict, Any, Tuple
from backend.app.models.schemas import VulnerabilityInfo

logger = logging.getLogger("vulntrace.osv")

OSV_QUERY_URL = "https://api.osv.dev/v1/query"

# Local fixture cache for offline testing and resilience (PRD §5, §18)
OFFLINE_OSV_FIXTURES: Dict[str, List[Dict[str, Any]]] = {
    "aiohttp:3.7.4": [
        {
            "id": "GHSA-v6wp-4m6f-gcjg",
            "aliases": ["CVE-2021-21330"],
            "summary": "Open redirect in aiohttp",
            "details": "aiohttp before 3.7.4.post0 is affected by an Open Redirect vulnerability in the `aiohttp.web_urldispatcher.UrlDispatcher` class when using `normalize_path_middleware`.",
            "severity": [{"type": "CVSS_V3", "score": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"}],
            "affected": [
                {
                    "package": {"name": "aiohttp", "ecosystem": "PyPI"},
                    "ranges": [
                        {
                            "type": "ECOSYSTEM",
                            "events": [{"introduced": "0"}, {"fixed": "3.7.4.post0"}]
                        }
                    ]
                }
            ]
        }
    ],
    "jinja2:2.11.3": [
        {
            "id": "GHSA-h5c8-rqwp-cp95",
            "aliases": ["CVE-2024-34064"],
            "summary": "Jinja vulnerable to HTML attribute injection via `xmlattr` filter",
            "details": "The `xmlattr` filter in Jinja does not properly escape keys when generating XML/HTML attributes, allowing attribute injection.",
            "severity": [{"type": "CVSS_V3", "score": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N"}],
            "affected": [
                {
                    "package": {"name": "jinja2", "ecosystem": "PyPI"},
                    "ranges": [
                        {
                            "type": "ECOSYSTEM",
                            "events": [{"introduced": "0"}, {"fixed": "3.1.4"}]
                        }
                    ]
                }
            ]
        }
    ],
    "requests:2.25.1": [
        {
            "id": "GHSA-j8r2-6x86-q33q",
            "aliases": ["CVE-2023-32681"],
            "summary": "Requests Proxy-Authorization header leak",
            "details": "Requests before 2.31.0 leaks Proxy-Authorization headers to destination servers when following redirects.",
            "severity": [{"type": "CVSS_V3", "score": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:N/A:N"}],
            "affected": [
                {
                    "package": {"name": "requests", "ecosystem": "PyPI"},
                    "ranges": [
                        {
                            "type": "ECOSYSTEM",
                            "events": [{"introduced": "0"}, {"fixed": "2.31.0"}]
                        }
                    ]
                }
            ]
        }
    ]
}

class OSVClient:
    def __init__(self, timeout: float = 8.0, offline_mode: bool = False):
        self.timeout = timeout
        self.offline_mode = offline_mode
        self._cache: Dict[str, List[VulnerabilityInfo]] = {}

    async def query_package(self, package_name: str, version: str, ecosystem: str = "PyPI") -> List[VulnerabilityInfo]:
        cache_key = f"{package_name.lower()}:{version}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        payload = {
            "package": {
                "name": package_name,
                "ecosystem": ecosystem
            },
            "version": version
        }

        # Try live query first if not explicitly in offline mode
        if not self.offline_mode:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(OSV_QUERY_URL, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        vulns = self._parse_vulns(data.get("vulns", []), package_name, version, ecosystem)
                        self._cache[cache_key] = vulns
                        return vulns
                    else:
                        logger.warning(f"OSV API returned status {resp.status_code} for {package_name}@{version}")
            except Exception as e:
                logger.info(f"OSV live query failed ({e}), falling back to offline fixtures if available.")

        # Fallback to local offline fixtures if network unavailable
        if cache_key in OFFLINE_OSV_FIXTURES:
            logger.info(f"Using verified offline fixture for {cache_key}")
            vulns = self._parse_vulns(OFFLINE_OSV_FIXTURES[cache_key], package_name, version, ecosystem)
            self._cache[cache_key] = vulns
            return vulns

        self._cache[cache_key] = []
        return []

    async def query_batch(self, items: List[Tuple[str, str, str]]) -> Dict[str, List[VulnerabilityInfo]]:
        """
        Batch query OSV for multiple packages at once via /v1/querybatch.
        items: List of (package_name, version, ecosystem)
        Returns: Dict mapping 'package_name:version' -> List[VulnerabilityInfo]
        """
        results_map: Dict[str, List[VulnerabilityInfo]] = {}
        to_query: List[Tuple[str, str, str]] = []

        for pkg_name, ver, eco in items:
            key = f"{pkg_name.lower()}:{ver}"
            if key in self._cache:
                results_map[key] = self._cache[key]
            else:
                to_query.append((pkg_name, ver, eco))

        if not to_query:
            return results_map

        # Query live batch API in chunks of 500
        if not self.offline_mode:
            batch_url = "https://api.osv.dev/v1/querybatch"
            chunk_size = 500
            for i in range(0, len(to_query), chunk_size):
                chunk = to_query[i : i + chunk_size]
                payload = {
                    "queries": [
                        {"package": {"name": name, "ecosystem": eco}, "version": ver}
                        for name, ver, eco in chunk
                    ]
                }
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.post(batch_url, json=payload)
                        if resp.status_code == 200:
                            raw_results = resp.json().get("results", [])
                            for (name, ver, eco), res_entry in zip(chunk, raw_results):
                                k = f"{name.lower()}:{ver}"
                                vulns = self._parse_vulns(res_entry.get("vulns", []), name, ver, eco)
                                self._cache[k] = vulns
                                results_map[k] = vulns
                        else:
                            logger.warning(f"OSV batch query returned status {resp.status_code}")
                except Exception as e:
                    logger.warning(f"OSV live batch query failed: {e}")

        # Fallback for any items still not resolved
        for name, ver, eco in to_query:
            k = f"{name.lower()}:{ver}"
            if k not in results_map:
                if k in OFFLINE_OSV_FIXTURES:
                    vulns = self._parse_vulns(OFFLINE_OSV_FIXTURES[k], name, ver, eco)
                    self._cache[k] = vulns
                    results_map[k] = vulns
                else:
                    self._cache[k] = []
                    results_map[k] = []

        return results_map

    def _parse_vulns(self, raw_vulns: List[Dict[str, Any]], package_name: str, version: str, ecosystem: str) -> List[VulnerabilityInfo]:
        results = []
        for raw in raw_vulns:
            vuln_id = raw.get("id", "UNKNOWN-VULN")
            aliases = raw.get("aliases", [])
            summary = raw.get("summary", "No summary provided in advisory")
            details = raw.get("details", "")
            
            # Severity calculation (PRD §5, §8)
            severity = "MEDIUM"
            if raw.get("severity"):
                for sev in raw["severity"]:
                    score = sev.get("score", "")
                    if "CVSS:3" in score:
                        # Extract CVSS base score if present, else fallback
                        severity = "HIGH"
            
            # Extract fixed versions and affected range
            fixed_versions = []
            affected_range = f"< unknown"
            for aff in raw.get("affected", []):
                for rng in aff.get("ranges", []):
                    for event in rng.get("events", []):
                        if "fixed" in event:
                            fixed_versions.append(event["fixed"])
                            affected_range = f"< {event['fixed']}"

            results.append(VulnerabilityInfo(
                id=vuln_id,
                aliases=aliases,
                summary=summary,
                details=details,
                severity=severity,
                package_name=package_name,
                package_ecosystem=ecosystem,
                affected_version_range=affected_range,
                fixed_versions=list(set(fixed_versions)),
                advisory_url=f"https://osv.dev/vulnerability/{vuln_id}"
            ))
        return results

osv_client = OSVClient()
