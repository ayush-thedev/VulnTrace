# VulnTrace AI — Product Requirements Document (PRD)

**Project title:** VulnTrace AI (do not rename)
**Subtitle:** Evidence-Driven Vulnerability Reachability and Assisted Remediation
**Team:** TECHNOVISIONERS — Archita Jha, Ayush Kant, Nisarg Malhotra
**Repository:** https://github.com/ayush-thedev/VulnTrace
**Document status:** Source of truth for the build. If code and this PRD disagree, flag it; do not silently change either.

---

## 0. How to read this document

- **Implemented / Proposed / Future** labels matter. Nothing in this PRD may be presented in the product, demo, README, or UI as "working" until it actually runs end-to-end and has been verified.
- Sections 1–3 explain the project in plain language. Sections 4 onward are the technical requirements.
- Hypothetical examples (ShopApp, ZipTool, `unpack_zip()`) come from the team's pitch deck and are **illustrations only**. Real demo data must be real and verifiable (see §19).

---

## 1. The problem (plain language first)

Software applications are built from **third-party packages and libraries** written by other people. Sometimes a package version has a **publicly known security flaw** (a vulnerability, often tracked as a CVE).

A **vulnerability scanner** can say: *"Your project uses package X, version Y, which has a known vulnerability."*

What that alert **does not necessarily tell the developer** is whether *their application actually reaches or uses the vulnerable functionality*.

This creates a practical developer problem:

1. Security teams get vulnerability alerts **without application-specific reachability context**.
2. Developers must **manually inspect dependency and code relationships** to judge whether the vulnerable functionality may be reachable.
3. They must decide **which findings deserve attention first**.
4. Updating a dependency or applying a patch can **cause compatibility problems**, so any remediation needs **validation**.

**Visual used in the deck:** `Vulnerable dependency detected → developer must investigate code paths → uncertainty and manual triage`

**Hypothetical example (from the deck):** *ShopApp* uses *ZipTool*, which has a known flaw in one function, `unpack_zip()`. The scanner alert is identical whether or not ShopApp ever calls that function.

### Hard constraints on how the problem is described (everywhere: UI copy, README, demo)
- No unsupported statistics, no exaggerated breach claims.
- Never claim that all scanner alerts are false positives.
- Do not open with generic "cybersecurity is growing" framing. Focus on this specific technical gap.

---

## 2. The proposed solution

**The memorable distinction (use verbatim in the UI/README):**

> **A scanner identifies a vulnerable package. VulnTrace investigates whether the application appears to reach the vulnerable functionality — and helps developers decide what to do next.**

VulnTrace AI investigates vulnerability alerts using **dependency and code-analysis evidence**, assesses whether vulnerable functionality **appears** reachable, prioritizes findings, and **assists** with a fix that can be **reviewed and tested**.

### Six-step workflow
1. **Identify** vulnerable dependencies.
2. **Analyze** dependency and code relationships.
3. **Investigate** possible paths to the vulnerable functionality.
4. **Prioritize** findings using evidence and vulnerability context.
5. **Propose** a remediation.
6. **Validate** the proposed change through controlled checks.

### Before / after
- **Traditional alert:** "This package is vulnerable."
- **VulnTrace goal:** "Here is the available reachability evidence, why this finding matters, and a proposed next action."

### What VulnTrace does NOT promise
- No guaranteed exploitability detection.
- No automatic safe patching.
- **An LLM never independently proves reachability.** Reachability assessments are grounded in code-analysis evidence; uncertain cases stay uncertain.

---

## 3. Goals, non-goals, success criteria

### Goals
- G1. Turn a repository + its package manifests into a list of **evidence-linked findings**.
- G2. For each finding, return a **reachability assessment** (`reachable` / `not_reachable` / `uncertain`) with supporting evidence and caveats.
- G3. Explain **why a finding matters** and whether to address it sooner or later (no invented scoring formula).
- G4. Propose a **reviewable remediation** (dependency update or patch) and **validate** it in an isolated environment, reporting honestly what passed, failed, or is unverified.
- G5. Retain **human review** before any change is accepted.
- G6. Visualize candidate paths in an interactive graph UI.

### Non-goals (do not build / do not claim)
- Automatic pull requests or fully automated patching (not claimed; optional future work only).
- Guaranteed exploit detection or proof of exploitability.
- Multi-language support at launch (narrow initial scope — see §6).
- Any fabricated metric: time saved, detection rate, precision, recall, financial impact.
- PostgreSQL unless a real need appears (accounts, scan history, application records).

### Success criteria (qualitative — no measured claims until measured)
- Less manual investigation effort; more informed triage; clearer explanations of why findings matter; more reviewable remediation proposals.
- A working end-to-end demo on a real, verifiable vulnerable fixture repo (§19) that shows all three verdict types.

---

## 4. Users

- **Primary:** application developers who receive dependency vulnerability alerts.
- **Secondary:** security/AppSec engineers who triage those alerts.
- **Judges/reviewers (hackathon):** must understand the problem and solution in the first two slides/screens.

---

## 5. End-to-end workflow (system view)

`Repository / package manifests → vulnerability identification → code analysis → graph representation & path investigation → agent assessment → remediation proposal → validation / report`

| # | Stage | Nature | Input | Output |
|---|-------|--------|-------|--------|
| 1 | Repository & manifests | Deterministic | Repo path/URL | File inventory, manifests, lockfiles |
| 2 | Vulnerability identification | Deterministic | Package name + version | Known vulnerabilities (OSV API) |
| 3 | Code analysis | Deterministic | Source files | Functions, imports, call relationships (Tree-sitter + language-specific analysis) |
| 4 | Graph & path investigation | Deterministic | Analysis output + CVE records | Graph in FalkorDB; candidate paths entry point → vulnerable function |
| 5 | Agent assessment | **LLM-assisted** | Evidence bundle | Reachability verdict, priority rationale |
| 6 | Remediation proposal | **LLM-assisted** | Ranked finding + evidence | Proposed update/patch as a diff |
| 7 | Validation & report | Deterministic | Proposed diff | Pass / fail / unverified report |

**Rule:** the deterministic stages produce evidence. The LLM stages **interpret and explain** that evidence. **The LLM must never generate call paths, function names, or file locations that are not present in the evidence bundle it was given.**

### Output: one evidence-linked **Finding** per vulnerability
Required fields:
- `vulnerability` — id(s) (OSV/CVE/GHSA), summary, severity, affected package + version range, fixed versions if known.
- `reachability` — verdict, confidence note, caveats.
- `evidence` — the actual candidate paths (ordered list of file/function/line hops), import sites, and the analyzer that produced them.
- `priority` — band + plain-language rationale.
- `remediation` — proposed change (diff), status.
- `validation` — status (`validated` / `failed` / `unverified` / `not_run`), checks run, logs reference.
- `provenance` — which stages were deterministic and which were LLM-written text.

---

## 6. Scope: MVP vs later

**Implemented prototype (as visible in the repo at time of writing):** a Vite + React 18 + TypeScript + Tailwind + lucide-react frontend scaffold (single initial commit). **Backend, graph, agents, analysis, validation: not present as far as can be verified — audit before assuming.**

**MVP (proposed):**
- One language/ecosystem for code analysis. **Default recommendation: Python (PyPI)**, because Tree-sitter grammars and OSV PyPI coverage are mature and it keeps the call-graph analyzer tractable. *Confirm with team; make the language pluggable.*
- Scan a local repo path or uploaded archive.
- Full pipeline for a small number of findings on a demo fixture.
- Remediation limited to **dependency version bumps** in manifest/lockfile (patch-file generation is stretch).
- Validation: re-run OSV lookup on the updated manifest + run the project's test command in a Docker sandbox, if one exists.

**Future work (label as such in UI/docs):** more languages, automatic PR creation, richer symbol-level advisory mapping, scan history/accounts (PostgreSQL), CI integration.

---

## 7. Reachability semantics (critical)

Verdict meanings — use these exact definitions in UI tooltips:

- **Reachable** — the analyzer found at least one candidate route from an application entry point to the vulnerable function. *It does not prove the flaw can be exploited.*
- **Not reachable** — *no route was found by the analyzer.* **It is not a guarantee of safety** (the analyzer can be incomplete).
- **Uncertain** — the analyzer cannot tell (e.g., dynamic dispatch, reflection, `eval`, plugin loading, unresolved imports, call decided at run time, missing vulnerable-symbol data). A person reviews it.

Rules:
1. A verdict is only produced from analyzer evidence. If evidence is thin, the verdict is `uncertain`, not a guess.
2. **No fabricated call paths.** Every hop shown in the UI must trace to a real node in the graph.
3. **Vulnerable-symbol availability caveat:** advisories do not always name the vulnerable function. When the vulnerable symbol is unknown, the system must say so and degrade to package-level evidence (is the package imported? which of its APIs does the code call?) and set verdict to `uncertain` or clearly label it "package-level only". Optionally support a **curated symbols file** (e.g. `vulnerable_symbols.yaml`) that the team maintains for the demo. Never invent a symbol.
4. Static analysis limits must be surfaced as caveats on the finding.

---

## 8. Multi-agent architecture

**Three cooperating agents + a workflow coordinator.** The coordinator is **ordinary orchestration code (not an LLM agent)** that passes evidence between agents.

All three agents may share **one Groq-hosted LLM**, each with a distinct role prompt, inputs, tools, and **structured output**. Candidate model: **`openai/gpt-oss-120b`** (proposed — configurable via env var; not to be described as "integrated and tested" until it is).

### Agent 1 — Reachability Analyst
- **Input:** code/dependency-analysis evidence (paths, import sites, symbol info, analyzer caveats).
- **Task:** assess whether the vulnerable functionality *appears* reachable.
- **Output (structured JSON):** `verdict` ∈ {`reachable`,`not_reachable`,`uncertain`}, `evidence_refs` (IDs of graph nodes/paths used), `rationale`, `caveats`.
- **Constraint:** may only cite evidence IDs provided in its input; the coordinator validates every `evidence_ref` and rejects the output if any is unknown.

### Agent 2 — Risk Prioritizer
- **Input:** vulnerability severity, reachability verdict + evidence, available application context (e.g., whether the path starts at a user-input entry point such as an upload/HTTP route vs. internal-only use).
- **Task:** explain why a finding should be addressed sooner or later.
- **Output:** `priority_band`, `rationale` (plain language).
- **Constraint:** **do not invent an undocumented scoring formula.** Use categorical bands with stated reasons. Guidance bands (illustrative, from the deck):

| What the investigation found | Outcome |
|---|---|
| Reachable, and user input can reach it | Fix now |
| Reachable, internal use only | Schedule fix |
| Not reachable | Monitor |
| Uncertain | Human review |

### Agent 3 — Remediation Agent
- **Input:** ranked finding + evidence + manifest/lockfile context.
- **Task:** suggest a dependency update or patch.
- **Output:** proposed change as a unified diff + rationale; hands off to controlled validation.
- **Constraint:** **never claims a fix succeeded** unless validation actually confirms it. Status stays `proposed` until validation runs.

### Orchestration (LangGraph — proposed)
Stateful graph: `ingest → osv_lookup → code_analysis → graph_build → path_query → reachability_agent → prioritizer_agent → remediation_agent → validation → report → human_review (interrupt)`.
- Typed shared state (Pydantic models).
- Conditional edges: skip LLM stages when there are no findings; route `uncertain` to human review.
- Retries and structured-output validation around every LLM call; on repeated failure, mark the finding "agent output unavailable" rather than inventing content.

---

## 9. Technology stack (layered — treat as **Proposed architecture** unless verified)

**Flow:** Frontend → Backend/orchestrator → analysis + graph → agents/LLM → remediation proposal → validation → results in UI.

| # | Layer | Technologies | Purpose |
|---|---|---|---|
| 1 | **Frontend** | React + TypeScript + Tailwind CSS (**existing repo uses Vite**; the deck says Next.js — see note), **React Flow** | UI, interactive graph/path visualization |
| 2 | **Backend / API + orchestration** | Python, **FastAPI**, **Pydantic**, **LangGraph** | API, typed schemas, stateful agent coordination, handoffs, review/validation stages |
| 2b | *Optional* relational DB | PostgreSQL | **Only if needed** (accounts, scan history, app records). Do not add to pad the stack. |
| 3 | **Vulnerability intelligence** | **OSV API** (`api.osv.dev`), package manifests & lockfiles | Known vulnerabilities per package version |
| 4 | **Code intelligence** | **Tree-sitter**, language-specific call-graph analysis | Parsing + the actual reachability *evidence*. **Tree-sitter alone does not prove reachability.** |
| 5 | **Graph database / knowledge graph** | **FalkorDB** (openCypher over the Redis protocol; Docker image `falkordb/falkordb`; Python client `falkordb`) | Stores repos, packages, files, functions, CVEs, findings and their relationships; supports path queries |
| 6 | **AI / LLM** | **Groq API**, one shared LLM, **`openai/gpt-oss-120b`** (candidate) | Powers the three agents; JSON-schema structured output |
| 7 | **Patch validation** | **Git**, isolated test execution / **Docker sandbox**, project-appropriate test runner | Apply proposed diff and verify in isolation |

> **Repo vs. deck discrepancy — Next.js vs Vite:** the deck lists Next.js; the repo is a Vite + React app. **Do not migrate frameworks.** Keep Vite, add React Flow and the missing pieces. (The team will decide whether to update the deck wording to "React + Vite".)

---

## 10. Graph model (FalkorDB)

**Purpose:** store relationships and support **path queries**; it does **not** by itself guarantee a path is executable or exploitable. Accuracy depends on the language-aware analysis.

**Nodes:** `Repository`, `Package`, `File`, `Function`, `CVE`, `Finding`.
**Edges:** `DEPENDS_ON` (Repository→Package), `CONTAINS` (Repository→File, File→Function, Package→Function), `CALLS` (Function→Function), `AFFECTED_BY` (Function/Package→CVE), `CANDIDATE_REACHABILITY_PATH` (entry Function→vulnerable Function; materialized from query results, with ordered hop list), plus `HAS_FINDING` linking Finding to its CVE and evidence.

**Illustrative chain (conceptual):** `Application Entry Point → Application Function → Dependency Function → Vulnerable Function`.

**Properties to keep (minimum):** file path, line range, qualified name, language, `is_entry_point`, package name/version, CVE ids/severity, `resolved: bool` on call edges (unresolved/dynamic calls are recorded, not dropped — they drive `uncertain`).

**Example path query shape (verify syntax against FalkorDB docs):**
```cypher
MATCH p = (e:Function {is_entry_point: true})-[:CALLS*1..10]->(v:Function {id: $vulnerable_function_id})
RETURN p LIMIT 5
```
Use bounded depth and a result limit; record when limits truncate the search (a caveat).

**Entry points (MVP, Python):** configurable detection of HTTP route handlers (e.g., Flask/FastAPI decorators), `__main__` blocks, CLI entry functions. Make the entry-point heuristics explicit and visible in the UI.

---

## 11. Code analysis requirements (the evidence source)

- Use **Tree-sitter** to parse source into syntax trees; extract function/method definitions, imports, and call expressions.
- Build a **language-specific call graph** with import resolution; mark each edge `resolved` or `unresolved`.
- Emit an **evidence bundle** per finding: candidate paths (ordered hops with file:line), import sites of the vulnerable package, whether the vulnerable symbol is known, and **caveats** (unresolved calls on candidate routes, dynamic features detected, depth truncation).
- Pluggable analyzer interface so more languages can be added later. Document supported constructs and known blind spots in the README.
- Never let the LLM stand in for this step.

---

## 12. Remediation, validation, and trust

After a finding is prioritized:
1. **Remediation Agent proposes** a dependency update or patch.
2. The change is shown as a **reviewable diff**.
3. **Tests or rescans run in a controlled environment** (if implemented).
4. The system **reports what passed, failed, or remains unverified.**
5. **Human review is retained** before accepting/merging a change.

**Validation statuses:**
- ✓ **Validated** — checks ran and passed; recommended for review.
- ✕ **Failed** — reported with logs; never shown as a fix.
- ? **Unverified / inconclusive** — missing evidence listed; a developer decides.
- `not_run` — nothing executed yet.

**Safeguards (each must be testable):**
- S1. Evidence-linked findings (every claim traces to graph evidence).
- S2. Explicit uncertainty (`uncertain` is a first-class outcome).
- S3. No fabricated call paths.
- S4. No claim of successful patching without validation.
- S5. Isolated execution of repository tests (Docker; no host mounts beyond the working copy; resource and time limits; network disabled or restricted during test run; no host secrets/env passed in; never execute untrusted repo code on the host).

**Do not claim:** automatic pull requests or fully automated patching (state clearly in UI/README that PR creation is **not** implemented unless it is).

---

## 13. Backend API (proposed)

FastAPI, Pydantic models, async where useful. Suggested endpoints:
- `POST /api/scans` — start a scan (repo path/archive, options). Returns `scan_id`.
- `GET /api/scans/{id}` — status + stage progress.
- `GET /api/scans/{id}/findings` — list findings (priority, verdict, remediation/validation status).
- `GET /api/findings/{id}` — full finding: vulnerability, evidence, agent outputs, provenance.
- `GET /api/findings/{id}/graph` — nodes/edges formatted for React Flow.
- `POST /api/findings/{id}/remediation/validate` — run controlled validation on the proposed diff.
- `POST /api/findings/{id}/review` — record human decision (accept / reject / needs more info).
- `GET /api/health` — includes dependency checks (FalkorDB reachable, Groq key present, Docker available) and an honest `capabilities` map so the UI can show "Proposed/Not available" instead of faking features.

Config via env vars: `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-120b`), `FALKORDB_HOST/PORT`, sandbox limits. **Never commit secrets.** Provide `.env.example`.

Streaming progress (SSE/WebSocket) is a nice-to-have.

---

## 14. Frontend requirements

Keep the existing Vite + React + TS + Tailwind scaffold; add **React Flow**. Audit existing `src/` first and reuse what exists.

**Screens:**
1. **Scan** — choose repo/archive, start scan, see stage-by-stage progress (the 7-stage workflow).
2. **Findings** — ranked list: package, vulnerability, severity, **verdict badge**, **priority band + one-line reason**, validation status badge.
3. **Finding detail** — plain-language summary; vulnerability details; **interactive path graph (React Flow)** showing candidate route hops with file:line; verdict explanation with caveats; priority rationale; remediation diff viewer; validation report (passed/failed/unverified); human review actions.
4. **How it works / status (optional)** — shows deterministic vs LLM-assisted stages and an honest implementation-status panel.

**UI labelling rules:** every LLM-written text is visibly tagged as "AI-generated explanation"; every evidence element is tagged with its source (analyzer/OSV). Verdict tooltips use §7 definitions. Show "Proposed", "Conceptual", or "Not implemented" labels where applicable.

**Design system (match the team's pitch deck — do not drift):**
- Clean, modern, professional cybersecurity/developer-tool look. **No** neon-green terminals, skulls, hoodies, glowing circuit patterns, or heavy gradients.
- Palette: primary navy `#1E338C`, deep navy `#14246B` (chips/buttons), ink `#1A1A2E` (text), muted `#5A6070`, light tint `#E4E7F3`, border `#C9CCD6`, card `#F8F8F8`, white; semantic: green `#2E7D5B` (validated/passed), red `#C0392B` (failed/vulnerable), amber `#B7791F` on `#FBF3E2` (caveat/unverified/placeholder), light-red `#FBE9E6`.
- Typography: **Georgia (bold) for titles/card headings**, Calibri/system sans for body. Large readable text, ample spacing, consistent rounded cards with navy outlines, light textured grey background, asterisk (✱) as a subtle brand motif.
- Avoid generic AI-template elements, fake version labels, decorative agent cards without meaningful content, and vague marketing slogans.

---

## 15. Feasibility, risks, mitigations

**Why feasible:** each layer maps to an existing, documented tool (OSV, Tree-sitter, FalkorDB, LangGraph, FastAPI, Groq), so a focused prototype can integrate them.

| Challenge | Mitigation |
|---|---|
| Language coverage | Narrow initial language scope; pluggable analyzer |
| Incomplete call graphs | Record unresolved edges; report `uncertain` rather than guess |
| False reachability conclusions | Every assessment tied to analyzer evidence; validate `evidence_refs`; caveats shown |
| Model-generated patch errors | Reviewable diff; developer decides; validation before any "validated" label |
| Test compatibility | Run project tests; flag anything unverified when tests cannot run |
| Execution security | Sandboxed, isolated validation runs (§12 S5) |
| Missing vulnerable-symbol data in advisories | Package-level fallback + curated symbols file; never invent symbols |

**Expected benefits (qualitative only):** less manual investigation effort; more informed vulnerability triage; clearer explanations of why findings matter; more reviewable remediation proposals. **Do not fabricate** time saved, detection rates, precision, recall, or financial impact.

---

## 16. Innovation / differentiation (keep in README + demo narrative)

- Goes beyond listing vulnerable dependencies by investigating **application-specific reachability evidence**.
- Uses a **graph** to represent dependency and code relationships.
- Uses **specialized agent roles** for analysis, prioritization, and remediation assistance.
- Connects findings to **evidence and validation status**.

Closing line: *Scanners say what is present. VulnTrace AI investigates what appears reachable, why it matters, and what to do next.*

---

## 17. Implementation status matrix (Antigravity must audit and update this)

| Component | Status | Notes |
|---|---|---|
| Frontend scaffold (Vite, React 18, TS, Tailwind, lucide-react, clsx) | **Implemented** | Redesigned per PRD §14 palette (#1E338C, Georgia bold, ✱ motif); builds cleanly |
| React Flow graph view | **Implemented** | Interactive candidate route visualization with hops, file:line indicators & layout |
| FastAPI backend + Pydantic schemas | **Implemented (Skeleton & Schemas)** | `/backend` established; schemas mirrored in TS; `/api/health` verified by pytest |
| OSV integration | **Implemented** | Deterministic live client with offline fixture fallback; verified by tests |
| Tree-sitter + call-graph analysis | **Implemented** | Python AST, route entry points, call resolution, dynamic dispatch tracking |
| FalkorDB graph storage + path queries | **Implemented** | OpenCypher bounded path queries + resilient graph driver; verified by tests |
| LangGraph orchestration | **Implemented** | Stateful coordinator pipeline (gather -> assess -> prioritize -> remediate); verified by tests |
| Groq LLM integration (`openai/gpt-oss-120b`) | **Implemented** | 3 agent roles with structured outputs & evidence reference validator; verified by tests |
| Remediation proposal (diff) | **Implemented** | Unified diff generator; status stays proposed until validation; verified by tests |
| Docker-sandbox validation | **Implemented** | Controlled sandbox, stripped host secrets, OSV re-scan check; verified by tests |
| Pull request creation | **Not claimed / out of scope** | PRD §3, §12, §17 explicit non-goal |

---

## 18. Phased delivery plan

- **Phase 0 — Audit & plan:** read the whole repo, fill §17 truthfully, produce an implementation plan and task list. No feature coding yet.
- **Phase 1 — Skeleton:** monorepo layout (`/backend` added beside the existing frontend; do not restructure destructively), Docker Compose (FalkorDB + backend), `.env.example`, health endpoint, shared Pydantic schemas mirrored as TS types.
- **Phase 2 — Evidence pipeline:** manifest parsing → OSV lookup → Tree-sitter analysis → call graph → FalkorDB load → path queries → evidence bundles. Unit tests on a tiny hand-written fixture with known answers (one reachable, one not reachable, one uncertain).
- **Phase 3 — Agents:** Groq client with JSON-schema outputs, three agent nodes, evidence-ref validation, LangGraph wiring, caching/recorded fixtures so tests don't need network.
- **Phase 4 — Remediation & validation:** diff generation for version bumps, Docker sandbox runner, OSV rescan, status reporting, human-review endpoint.
- **Phase 5 — UI:** screens in §14, React Flow path view, diff viewer, validation report, honest status labels.
- **Phase 6 — Demo & hardening:** real demo fixture (§19), README, demo script, safeguards tests (§20), final status matrix.

---

## 19. Demo fixture requirements

- Build a **small, real demo application** whose dependencies include a **real, OSV-listed vulnerable package version**. **Select it by querying the OSV API and verifying the advisory — do not invent a CVE, package, or function name.**
- The fixture must produce **three scenarios** mirroring the deck: **Reachable** (e.g., an upload/HTTP route → helper → vulnerable function), **Not reachable** (e.g., a health-check route with no route to it), **Uncertain** (e.g., a plugin/dynamic call decided at run time).
- Include a test suite so validation can truly pass/fail.
- Keep the fixture's provenance documented. The ShopApp/ZipTool names from the deck may be used as *labels* only if the code is honestly a demo stand-in; otherwise use real names.

---

## 20. Acceptance tests (honesty & safety)

1. Every `evidence_ref` shown in the UI resolves to a real graph node/path (automated check).
2. A finding with only unresolved routes is `uncertain`, never `not_reachable`.
3. An LLM output citing an unknown evidence ID is rejected and not displayed as fact.
4. No finding is labelled "validated" unless a validation run record with passing checks exists.
5. A failed or unrunnable test run yields `failed`/`unverified`, never `validated`.
6. Sandbox cannot access host filesystem outside its working copy and cannot read host environment secrets.
7. UI/README contain no unverifiable metrics and no claims of automatic PRs or guaranteed exploit detection.
8. With Groq/FalkorDB/Docker unavailable, the app degrades gracefully and the capabilities map says so.

---

## 21. Open questions for the team (do not guess — ask or leave a clearly marked placeholder)

1. SIH Problem Statement ID, title, theme, category, Team ID (placeholders only).
2. MVP language/ecosystem (default proposal: Python/PyPI).
3. Is `openai/gpt-oss-120b` actually integrated/tested, or only a candidate?
4. Next.js (deck) vs Vite (repo) — update the deck or the code? (Default: keep Vite.)
5. Which validation checks can realistically run for the demo (tests vs rescan only)?
6. Is PostgreSQL needed at all? (Default: no.)
7. How is entry-point/“user input can reach it” determined for prioritization context?

---

## 22. References (official documentation for the proposed components)

- OSV: https://google.github.io/osv.dev/ (API at https://api.osv.dev; endpoints `/v1/query`, `/v1/querybatch`, `/v1/vulns/{id}`)
- FalkorDB: https://docs.falkordb.com
- Groq `openai/gpt-oss-120b`: https://console.groq.com/docs/model/openai/gpt-oss-120b
- LangGraph: https://docs.langchain.com/oss/python/langgraph
- Tree-sitter: https://tree-sitter.github.io

Verify any API detail against these sources while implementing; do not rely on memory for versions, syntax, or limits.
