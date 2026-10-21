# VulnTrace AI ✱

**Evidence-Driven Vulnerability Reachability and Assisted Remediation**  
  
*(Archita Jha, Ayush Kant, Nisarg Malhotra)*

---

> **"A scanner identifies a vulnerable package. VulnTrace investigates whether the application appears to reach the vulnerable functionality — and helps developers decide what to do next."**

---

## 1. The Problem

Modern software applications rely heavily on third-party libraries and packages. When a package version has a publicly known security flaw (CVE), automated vulnerability scanners flag an alert:

> *"Your repository uses package X at version Y, which has a known vulnerability."*

What standard scanners do **not** tell developers is whether their application code actually reaches or executes the vulnerable function. This creates significant friction:
1. **Alert fatigue without reachability context:** Security teams triage hundreds of dependency warnings without knowing which flaws are actually accessible.
2. **Time-consuming manual investigation:** Developers must trace imports, call chains, and routes manually to determine if vulnerable functions are reachable.
3. **Patch anxiety & breaking changes:** Bumping dependencies or applying patches can break backwards compatibility or introduce regression bugs unless changes are validated in isolation.

---

## 2. The Solution: Evidence-Driven Reachability

VulnTrace AI bridges the gap between vulnerability alerts and actionable remediation by separating **deterministic code evidence** from **AI explanation**:

1. **Deterministic Code Intelligence:** Tree-sitter AST parsing and language-specific call-graph analysis build a topological knowledge graph in **FalkorDB** (openCypher). Bounded queries trace candidate execution routes from application entry points to vulnerable functions.
2. **Grounded Multi-Agent Interpretation:** Three specialized LLM agents (Reachability Analyst, Risk Prioritizer, Remediation Agent) running on Groq (`openai/gpt-oss-120b`) interpret verified evidence bundles using strict JSON schemas. Agents are strictly prohibited from hallucinating call paths or evidence IDs.
3. **Controlled Sandboxed Validation:** Proposed dependency upgrades (unified diffs) are applied in an isolated sandbox, re-scanned against OSV to verify advisory resolution, and verified against project regression test suites.
4. **Human-in-the-Loop:** Automated pull request creation is explicitly **not claimed**; human engineers retain final review and sign-off.

---

## 3. Tech Stack

> **Pipeline Flow:** `UI` → `API` → `analysis + graph` → `agents` → `proposal` → `validation` → `results back in UI` *(Proposed architecture)*

| # | Layer | Component / Tool | Role in VulnTrace |
| :---: | :--- | :--- | :--- |
| **1** | **Frontend**<br>*Interface & graph view* | **Vite + React 18**<br>**TypeScript**<br>**Tailwind CSS**<br>**React Flow** (`@xyflow/react`) | App framework<br>Typed code<br>Styling (Navy `#1E338C`, Georgia bold, ✱ motif)<br>Graph & path view |
| **2** | **Backend**<br>*API & orchestration* | **Python**<br>**FastAPI**<br>**Pydantic**<br>**LangGraph** | Core language<br>REST API + WebSocket (`/ws/scans/{id}`)<br>Typed schemas mirrored to TypeScript<br>Agent coordination & state machine |
| **3** | **Vuln. data**<br>*Known flaws* | **OSV API** (`api.osv.dev`)<br>**Manifests & lockfiles** | Known vulnerabilities per package version<br>Dependency inventory (`requirements.txt`, `package-lock.json`, etc.) |
| **4** | **Code intelligence**<br>*Evidence source* | **Tree-sitter**<br>**Call-graph analysis** | Parses source code into ASTs<br>Language-specific; supplies the reachability evidence |
| **5** | **Knowledge graph**<br>*Relationships & paths* | **FalkorDB**<br>**Graph entities**<br>**Path queries** | Graph database (openCypher over Redis protocol)<br>Repos, packages, files, functions, CVEs<br>Entry point → vulnerable function (`1..10` hops) |
| **6** | **AI / LLM**<br>*Shared by 3 agents* | **Groq API**<br>**One shared LLM**<br>**`openai/gpt-oss-120b`** | Hosted low-latency inference<br>Shared by Reachability, Risk, and Remediation agents<br>Candidate model (configurable via `GROQ_MODEL`) |
| **7** | **Patch validation**<br>*Controlled checks* | **Git**<br>**Docker sandbox**<br>**Test runner** | Diffs & branches<br>Isolated test execution with stripped host secrets<br>Project-appropriate runner (`pytest`) |
| **8** | **Real-time streaming**<br>*Binary protocol* | **WebSocket**<br>**IndexedDB**<br>**BroadcastChannel** | 7-byte binary frame protocol<br>Append-only event log with replay<br>Multi-tab sync & navigator.locks |

> *Tree-sitter parses code; the language-specific call-graph analysis supplies the reachability evidence. Tree-sitter alone does not prove reachability.*

---

## 4. Getting Started

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ & npm
- Docker (optional, for FalkorDB container and containerized sandbox)

### Step 1: Start FalkorDB (Optional)
```bash
docker compose up -d falkordb
```
*(If FalkorDB is not running, VulnTrace automatically utilizes its built-in in-memory graph driver with zero configuration).*

### Step 2: Configure Environment
```bash
cp .env.example .env
# Edit .env to add your GROQ_API_KEY (optional; offline mock fixtures available for tests)
```

### Step 3: Setup & Run Backend
```bash
# Create virtualenv and install dependencies
python -m venv backend/venv
backend/venv/Scripts/pip install -r backend/requirements.txt   # Windows
# or: source backend/venv/bin/activate && pip install -r backend/requirements.txt

# Run pytest suite (37 unit & acceptance tests)
backend/venv/Scripts/pytest.exe backend/tests

# Start FastAPI server on port 8000
backend\venv\Scripts\uvicorn.exe backend.app.main:app --reload --port 8000
```

### Step 4: Setup & Run Frontend
```bash
# Install npm dependencies
npm install

# Build for production (verifies TypeScript & Vite bundle)
npm run build

# Run vitest test suite (13 tests)
npm test

# Start Vite dev server on http://localhost:3000
npm run dev
```

---

## 5. Deterministic vs. LLM Split

| Stage | Mechanism | Nature | Grounding Rule |
| :--- | :--- | :--- | :--- |
| **Manifest & Lockfiles** | Python regex & requirements parser | Deterministic | Exact package versions extracted directly from source manifests. |
| **Vulnerability Lookup** | OSV REST API (`api.osv.dev`) | Deterministic | Grounded in verified CVE/GHSA advisories and version ranges. |
| **Code Intelligence** | Tree-sitter Python AST Parser | Deterministic | Extracts functions, decorators, call sites, and import mappings. |
| **Graph Path Traversal** | FalkorDB openCypher (`1..10` hops) | Deterministic | Graph queries establish bounded candidate routes from entry points. |
| **Reachability Analyst** | Groq (`openai/gpt-oss-120b`) | LLM-assisted | Evaluates candidate paths; **may only cite verified graph node IDs**. |
| **Risk Prioritizer** | Groq (`openai/gpt-oss-120b`) | LLM-assisted | Categorical priority bands (`Fix now`, `Schedule fix`, `Monitor`, `Human review`). **No invented scoring formulas**. |
| **Remediation Agent** | Groq (`openai/gpt-oss-120b`) | LLM-assisted | Proposes unified diff for manifest upgrade. **Status remains `proposed` until validated**. |
| **Controlled Validation** | Sandbox runner + OSV re-scan | Deterministic | Verifies test regression passing and vulnerability resolution in isolation. |

---

## 6. Reachability Semantics

VulnTrace enforces exact semantic definitions:
- **`reachable`**: The static analyzer discovered at least one candidate execution route from an application entry point to the vulnerable package function. *(Does not prove the flaw can be exploited).*
- **`not_reachable`**: No candidate route was found by the static analyzer. *(Not a guarantee of safety; analyzer can be incomplete).*
- **`uncertain`**: The analyzer detected dynamic features (`getattr`, `eval`, dynamic dispatch), unresolved imports, or missing symbol information in the advisory. Requires human review.

---

## 7. Real Demo Fixture

The repository includes a verifiable demo application in [`demo-fixture/`](./demo-fixture) utilizing a real, OSV-listed vulnerable package:
- **Package:** `jinja2==2.11.3` (affected by CVE-2024-34064 / GHSA-h5c8-rqwp-cp95, vulnerable function `xmlattr`, fixed in `3.1.4`).
- **Scenario 1 (Reachable):** `@app.get("/export-profile")` calls `build_xml_attributes()` which invokes `jinja2.xmlattr()`.
- **Scenario 2 (Not Reachable):** `@app.get("/system-status")` calls safe local logic with zero route to Jinja.
- **Scenario 3 (Uncertain):** `@app.post("/plugins/dispatch")` utilizes dynamic reflection (`getattr`) requiring human review.

---

## 8. Binary Stream & Resilience Engine

A full event-sourced architecture with a custom binary WebSocket protocol, local persistence, multi-tab sync, and network fault tolerance — making the scan experience real-time, resilient, and fully auditable.

### 8.1 Binary WebSocket Protocol

VulnTrace streams scan events over a custom **7-byte binary frame** format instead of plain JSON, cutting network overhead and enabling packet-level reliability:

```
┌──────────┬──────────┬──────────────┬─────────────────────┐
│ Type u8  │ Seq u32  │ PayLen u16   │ Payload (UTF-8 JSON)│
│ (1 byte) │ (4 bytes)│ (2 bytes)    │ (0–65535 bytes)     │
└──────────┴──────────┴──────────────┴─────────────────────┘
```

**Server → Client frame types:**

| Code | Event | Description |
|:---:|:---|:---|
| `0x01` | `SCAN_STARTED` | Scan initialized with repo path |
| `0x02` | `DEPENDENCY_FOUND` | Package dependency detected |
| `0x03` | `VULN_FOUND` | Known vulnerability matched |
| `0x04` | `PATH_FOUND` | Call-graph execution path traced |
| `0x05` | `VERDICT` | Reachability verdict issued |
| `0x06` | `RISK` | Priority band assigned |
| `0x07` | `REMEDIATION` | Patch diff proposed |
| `0x08` | `VALIDATION` | Sandbox validation result |
| `0x09` | `SCAN_COMPLETED` | Scan finished |

**Client → Server:** `0xF0 NACK` — requests retransmission of missing sequence numbers.

**Backend endpoint:** `GET /ws/scans/{scanId}?from=N&chaos=drop,reorder,dup&seed=S`

### 8.2 IndexedDB Event Log (Append-Only)

Every scan event is persisted in the browser's IndexedDB (`vulntrace-events` database) as an **append-only ledger**:
- Events are stored with a unique `[scanId, seq]` compound index.
- On page reload, the app replays all events to instantly rebuild the full dashboard state — even offline.
- "Reset" is itself an event (never a destructive delete/clear).

### 8.3 Receiver: Reorder, Dedup & Self-Healing

A pure, unit-testable receiver module handles unreliable network conditions:
- **Reordering:** Out-of-order frames are buffered (bounded at 1024) and delivered in-sequence.
- **Deduplication:** Duplicate frames are silently dropped.
- **NACK retransmit:** If a gap persists >300ms or the buffer reaches 8 frames, the client sends a NACK requesting the missing sequence numbers. Retries up to 5 times at 500ms intervals before marking the scan as "stalled".

### 8.4 Multi-Tab Sync

- **BroadcastChannel** (`vulntrace-events`): Announces new event offsets to all open tabs in real time.
- **navigator.locks**: Only one tab owns the WebSocket connection; others tail the shared IndexedDB log.
- All tabs converge to identical state, verified by a live FNV-1a state hash.

### 8.5 Chaos / Fault Simulation

A built-in **chaos mode** (seeded, deterministic) for testing resilience:
- **Drop:** ~10% of frames randomly skipped.
- **Reorder:** Frames shuffled within windows of 4–6.
- **Duplicate:** ~5% of frames sent twice.
- Available on both the backend WebSocket endpoint (`?chaos=drop,reorder,dup&seed=42`) and the local demo producer.

### 8.6 Inspector Panel

A live diagnostic panel showing:
- Event log length, last offset, next expected sequence.
- Buffered frames, duplicate count, NACK count, connection state.
- **State hash** (FNV-1a over canonical JSON) comparing live state vs. replayed state — shows ✅ match or ❌ mismatch.
- **"Replay from offset 0"** button for on-demand state reconstruction.

### 8.7 Lockfile Drop Zone

Drag-and-drop (or click-to-select) a `package-lock.json` file directly into the browser:
- Parses **lockfileVersion 1, 2, and 3** entirely client-side (nothing is uploaded).
- Detects **path dependencies** (`link:true`, `file:` or `link:` resolved/version, workspace entries).
- Runs a best-effort **OSV batch query** (npm ecosystem, 5s timeout, non-fatal) to find known vulnerabilities.
- npm findings receive an `Uncertain` verdict by default ("no static call graph for JS dependencies").

### 8.8 Fallback Grace (Downgrade Rule)

A pure reducer-level rule ensures no false confidence in findings:
- A `Reachable` verdict is **automatically downgraded to `Uncertain`** when:
  - The vulnerable dependency is a **path dependency** whose target source is missing, OR
  - Its evidence path references **nodes/IDs absent from the graph**.
- The raw verdict is preserved (`rawVerdict: 'reachable'`) alongside the downgrade reason.
- This logic lives inside the reducer, so it applies consistently during both live scans and historical replays.

### 8.9 Demo Producer (Offline Mode)

A local producer (`demoProducer.ts`) generates 25 realistic binary frames (5 deps, 3 vulns, 3 paths, 3 verdicts, 3 risk bands, 3 remediations, 3 validations, 1 scan-completed) and feeds them through the identical decode → reorder → append → reduce path. Works completely offline with optional local chaos shuffle.

### 8.10 Test Suite

**13 vitest tests** covering:
- Binary frame encode/decode round-trip (header integrity, payload fidelity, edge cases).
- Receiver reordering and consecutive drain.
- Chaos resilience: disordered + dropped + duplicated delivery yields the same final state as in-order delivery.
- Reducer determinism: incremental reduce === full replay from scratch.
- Path-dependency downgrade: `Reachable` → `Uncertain` for missing source and missing evidence references.

---

## 9. Implementation Status Matrix (PRD §17)

All features are audited and verified honestly against test suites and live execution:

| Component | Status | Verification & Notes |
| :--- | :--- | :--- |
| **Frontend Scaffold** | **Implemented** | Vite + React 18 + TS + Tailwind. Clean design system: Navy `#1E338C`, Georgia bold, subtle ✱ motif. |
| **Interactive Graph UI** | **Implemented** | Built with `@xyflow/react` (React Flow). Visualizes hops, line numbers, and candidate routes. |
| **FastAPI Backend & API** | **Implemented** | Modular FastAPI service (`/api/scans`, `/api/findings`, `/api/health`) with Pydantic v2 schemas. |
| **OSV API Integration** | **Implemented** | Deterministic live queries to `api.osv.dev` with offline fixture resilience. |
| **Tree-sitter Code Analysis** | **Implemented** | Python AST parser with HTTP route decorator detection and dynamic call identification. |
| **FalkorDB Graph Storage** | **Implemented** | Bounded openCypher path traversal (`1..10` hops) + in-memory graph driver fallback. |
| **LangGraph Orchestration** | **Implemented** | Stateful 7-stage coordinator pipeline passing validated evidence bundles between agents. |
| **Groq Multi-Agent System** | **Implemented** | 3 agent roles with structured outputs & evidence reference validation (`openai/gpt-oss-120b`). |
| **Remediation Diff Generator** | **Implemented** | Generates reviewable unified diffs; status remains `proposed` until validated. |
| **Docker-Sandbox Validation** | **Implemented** | Isolated directory sandbox with stripped host secrets, OSV re-scan, and test execution. |
| **Binary Stream Protocol** | **Implemented** | 7-byte binary WebSocket frames, receiver with reorder/dedup/NACK, chaos simulation. |
| **Event-Sourced State** | **Implemented** | IndexedDB append-only log, pure reducer with replay, multi-tab BroadcastChannel sync. |
| **Lockfile Drop Zone** | **Implemented** | Client-side `package-lock.json` v1/v2/v3 parser with OSV batch vulnerability lookup. |
| **Inspector Panel** | **Implemented** | Live diagnostics: event counts, connection state, FNV-1a state hash match verification. |
| **Fallback Grace Downgrade** | **Implemented** | Auto-downgrades `Reachable` → `Uncertain` for path deps with missing source or evidence. |
| **Automated Pull Requests** | **Out of Scope** | Intentionally **not claimed** (PRD §3, §12, §17); human review retained. |

---

## 10. Supported Ecosystems & Known Blind Spots

### Supported at Launch (MVP)
- **Language / Ecosystem:** Python (`requirements.txt`, PyPI packages) and npm (`package-lock.json` v1/v2/v3 via client-side drop zone).
- **Entry Points:** Configurable detection of HTTP route decorators (`@app.get`, `@app.post`, `@router...`, `@bp.route...`), CLI entry blocks (`if __name__ == '__main__':`), and standard handler functions (`main`, `handler`).
- **Graph Queries:** Bounded simple paths up to 10 hops deep.

### Known Blind Spots & Limitations (PRD §11)
- **Dynamic Reflection:** Calls constructed via `getattr(obj, var)()`, `eval()`, or `locals()[]` cannot be statically proven; these explicitly produce an **`uncertain`** verdict with caveats.
- **Monkey-Patching & Dynamic Imports:** Runtime modification of imported modules is outside static analysis scope.
- **Missing Advisory Symbols:** Advisories that do not identify the vulnerable function degrade to package-level analysis and are marked with an explicit caveat.
- **npm/JS Call Graphs:** Lockfile drop zone provides dependency + vulnerability detection but no static call-graph analysis for JavaScript; all npm findings default to `Uncertain`.

---

## 11. Team TECHNOVISIONERS

- **Archita Jha**
- **Ayush Kant**
- **Nisarg Malhotra**
