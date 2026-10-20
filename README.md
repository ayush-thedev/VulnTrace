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
| **1** | **Frontend**<br>*Interface & graph view* | **Next.js** *(Deck)* / **Vite + React 18** *(Repo)*<br>**React**<br>**TypeScript**<br>**Tailwind CSS**<br>**React Flow** (`@xyflow/react`) | App framework (prototype uses Vite + React 18 scaffold)<br>UI components<br>Typed code<br>Styling (Navy `#1E338C`, Georgia bold, ✱ motif)<br>Graph & path view |
| **2** | **Backend**<br>*API & orchestration* | **Python**<br>**FastAPI**<br>**Pydantic**<br>**LangGraph**<br>*PostgreSQL* | Core language<br>REST API (`/api/scans`, `/api/findings`, `/api/health`)<br>Typed schemas mirrored to TypeScript<br>Agent coordination & state machine<br>*(Optional, if needed for accounts/history)* |
| **3** | **Vuln. data**<br>*Known flaws* | **OSV API** (`api.osv.dev`)<br>**Manifests & lockfiles** | Known vulnerabilities per package version<br>Dependency inventory (`requirements.txt`, etc.) |
| **4** | **Code intelligence**<br>*Evidence source* | **Tree-sitter**<br>**Call-graph analysis** | Parses source code into ASTs<br>Language-specific; supplies the reachability evidence |
| **5** | **Knowledge graph**<br>*Relationships & paths* | **FalkorDB**<br>**Graph entities**<br>**Path queries** | Graph database (openCypher over Redis protocol)<br>Repos, packages, files, functions, CVEs<br>Entry point → vulnerable function (`1..10` hops) |
| **6** | **AI / LLM**<br>*Shared by 3 agents* | **Groq API**<br>**One shared LLM**<br>**`openai/gpt-oss-120b`** | Hosted low-latency inference<br>Shared by Reachability, Risk, and Remediation agents<br>Candidate model (configurable via `GROQ_MODEL`) |
| **7** | **Patch validation**<br>*Controlled checks* | **Git**<br>**Docker sandbox**<br>**Test runner** | Diffs & branches<br>Isolated test execution with stripped host secrets<br>Project-appropriate runner (`pytest`) |

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

# Run pytest suite (all 26 unit & acceptance tests)
backend/venv/Scripts/pytest.exe backend/tests

# Start FastAPI server on port 8000
backend\venv\Scripts\uvicorn.exe backend.app.main:app --reload --port 8001
```

### Step 4: Setup & Run Frontend
```bash
# Install npm dependencies
npm install

# Build for production (verifies TypeScript & Vite bundle)
npm run build

# Start Vite dev server on http://localhost:5173
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

## 8. Implementation Status Matrix (PRD §17)

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
| **Automated Pull Requests** | **Out of Scope** | Intentionally **not claimed** (PRD §3, §12, §17); human review retained. |

---

## 9. Supported Ecosystems & Known Blind Spots

### Supported at Launch (MVP)
- **Language / Ecosystem:** Python (`requirements.txt`, PyPI packages).
- **Entry Points:** Configurable detection of HTTP route decorators (`@app.get`, `@app.post`, `@router...`, `@bp.route...`), CLI entry blocks (`if __name__ == '__main__':`), and standard handler functions (`main`, `handler`).
- **Graph Queries:** Bounded simple paths up to 10 hops deep.

### Known Blind Spots & Limitations (PRD §11)
- **Dynamic Reflection:** Calls constructed via `getattr(obj, var)()`, `eval()`, or `locals()[]` cannot be statically proven; these explicitly produce an **`uncertain`** verdict with caveats.
- **Monkey-Patching & Dynamic Imports:** Runtime modification of imported modules is outside static analysis scope.
- **Missing Advisory Symbols:** Advisories that do not identify the vulnerable function degrade to package-level analysis and are marked with an explicit caveat.

---

## 10. Team TECHNOVISIONERS

- **Archita Jha**
- **Ayush Kant**
- **Nisarg Malhotra**

