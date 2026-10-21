# VulnTrace: Product Requirements Document

**Tagline:** Fewer alerts. Real evidence. Verified fixes. **Version:** 1.0 (Draft) | **Status:** For review | **Date:** October 20, 2026

---

## 1. Overview

VulnTrace is an evidence-driven vulnerability management platform. It connects vulnerability discovery, code-level reachability analysis, risk prioritization, and tested remediation in one workflow.

A user pastes a GitHub link. VulnTrace scans the repository, builds a call graph, checks whether each vulnerable dependency function can actually be reached from the application's entry points, ranks the findings with visible evidence, and, for actionable ones, opens a reviewable pull request with a tested fix.

The product turns a long scanner report into a short, ordered investigation: *what matters, why it matters, and what to do about it.*

## 2. Problem Statement

- Modern apps depend on hundreds of third-party libraries. Scanners flag every known CVE in them.
- A vulnerable dependency is not automatically a vulnerable application. Most flagged functions are never called.
- Security teams drown in alerts, cannot tell urgent risk from noise, and lose trust in the tooling.
- Fixes are slow because developers must research each CVE, find a safe version, and prove nothing breaks.

## 3. Goals and Non-Goals

### Goals

1. Reduce alert overload by separating confirmed reachable risks from the rest.
2. Show evidence (code path, input flow, tests) instead of asking users to trust a score.
3. Explain every finding in plain, simple language.
4. Deliver a verified, reviewable fix for actionable findings.
5. Provide a very clean, minimal, fast experience that anyone can navigate.

### Non-Goals (v1)

- Replacing full SAST or DAST suites.
- Auto-merging pull requests. A human always reviews and merges.
- Exploit development. Proof tests are safe, isolated, and non-weaponized.
- Supporting every language at launch (see Scope).

## 4. Target Users

| Persona | Needs |
| --- | --- |
| **Developer (primary)** | Know which CVEs affect their code, get a ready PR, minimal context switching. |
| **Security engineer** | Ordered backlog, evidence to defend priority, audit trail of validation. |
| **Engineering manager** | Simple summary of risk and progress, fewer wasted cycles. |
| **Judge / evaluator** | See the evidence and the before/after proof within minutes. |

## 5. Product Principles

1. **Evidence over scores.** Every rating links to the path and proof behind it.
2. **Honest verdicts.** Three outcomes only: Confirmed reachable, Not observed reachable, Inconclusive. Never overclaim.
3. **Simple language.** Explain like a helpful colleague, not a CVE database.
4. **Minimal by default.** Show the least needed; reveal detail on demand.
5. **Human in control.** Nothing merges without review. Failed or inconclusive validation is reported plainly.
6. **Fast.** The user should never wonder if something is stuck.

## 6. Scope

**v1 languages/ecosystems:** JavaScript/TypeScript (npm) and Python (pip). Java (Maven) is a stretch goal. **v1 sources:** Public GitHub repositories via URL; private repositories via GitHub OAuth; local ZIP upload as fallback. **v1 output:** In-app investigation, GitHub pull request, exportable report.

## 7. Core User Journey

1. **Land** on a single input: *Paste a GitHub link.*
2. **Scan** starts. A live progress view shows stages, percent complete, and time remaining.
3. **Overview** shows a short ranked list of findings plus three counts (Confirmed, Not observed, Inconclusive).
4. **Investigate** a finding: attack-path graph, plain explanation, evidence, risk reasoning.
5. **Prove** (optional): run an isolated proof-of-reachability test.
6. **Fix:** review the proposed minimal patch.
7. **Validate:** tests and security checks run, results shown.
8. **Pull request** is created with changes, evidence, and verdict. Developer reviews and merges.

## 8. Functional Requirements

Priority: **P0** = must ship, **P1** = should ship, **P2** = nice to have.

### 8.1 Onboarding and Repository Input

| ID | Function | Priority |
| --- | --- | --- |
| F-1.1 | Single prominent input field accepting a GitHub repository URL. | P0 |
| F-1.2 | Validate URL format and show inline, friendly errors (e.g., "That doesn't look like a GitHub repo"). | P0 |
| F-1.3 | Accept variants: `https://github.com/org/repo`, `.git` suffix, `/tree/branch` links, and `org/repo` shorthand. | P0 |
| F-1.4 | Branch or commit selector, defaulting to the default branch. | P1 |
| F-1.5 | Sign in with GitHub (OAuth) to scan private repos and open pull requests. | P0 |
| F-1.6 | Upload a ZIP as an alternative source. | P2 |
| F-1.7 | Recent scans list on the home screen for one-click re-open. | P1 |
| F-1.8 | Monorepo support: detect multiple manifests and let the user pick which project(s) to scan. | P1 |
| F-1.9 | Sample repository button ("Try a demo") so first-time users see results instantly. | P1 |

### 8.2 Scan Pipeline

The scan runs as a staged pipeline. Each stage reports its own progress.

| ID | Function | Priority |
| --- | --- | --- |
| F-2.1 | **Fetch:** shallow clone of the repository (depth 1) into an isolated workspace. | P0 |
| F-2.2 | **Detect:** identify language, framework, package manager, manifests, and lockfiles. | P0 |
| F-2.3 | **Inventory:** build the full dependency tree (direct and transitive) with resolved versions from lockfiles. | P0 |
| F-2.4 | **Match:** correlate dependencies against vulnerability databases (OSV, GitHub Advisory, NVD). | P0 |
| F-2.5 | **Map:** link each CVE to the specific vulnerable functions, modules, or APIs (from advisory data, patch diffs, and curated mappings). | P0 |
| F-2.6 | **Graph:** parse application source into ASTs and construct a call graph. | P0 |
| F-2.7 | **Entry points:** detect application entry points (HTTP routes, CLI commands, message handlers, scheduled jobs, main functions, exported public APIs). | P0 |
| F-2.8 | **Reach:** run reachability analysis from entry points to vulnerable functions. | P0 |
| F-2.9 | **Taint:** trace whether untrusted input (request params, body, headers, files, env, queue messages) flows into the vulnerable call. | P0 |
| F-2.10 | **Rank:** compute evidence-based priority for each finding. | P0 |
| F-2.11 | **Explain:** generate plain-language explanations and remediation advice. | P0 |
| F-2.12 | Incremental scanning: cache results by commit hash and only re-analyze changed files and dependencies. | P1 |
| F-2.13 | Cancel a running scan at any time. | P0 |
| F-2.14 | Resume or retry a failed stage without restarting the whole scan. | P1 |
| F-2.15 | Scan history with timestamps, commit, and result summary. | P1 |
| F-2.16 | Re-scan button and optional scheduled re-scan (daily/weekly) or on-push via webhook. | P2 |

### 8.3 Live Scan Progress

Users must always see how much work is done.

| ID | Function | Priority |
| --- | --- | --- |
| F-3.1 | Overall progress bar with percentage, based on weighted stages. | P0 |
| F-3.2 | Stage stepper showing all stages (Fetch, Detect, Inventory, Match, Graph, Reach, Rank, Explain) with states: waiting, running, done, failed. | P0 |
| F-3.3 | Live counters (e.g., "212 of 340 dependencies checked", "1,820 files parsed", "4 findings so far"). | P0 |
| F-3.4 | Estimated time remaining, refined as the scan progresses. | P1 |
| F-3.5 | **Streaming results:** findings appear in the list as soon as they are discovered, before the scan ends. | P0 |
| F-3.6 | Plain-language status line describing the current action ("Tracing paths to lodash.template…"). | P1 |
| F-3.7 | Live graph preview that grows as the call graph is built (optional, collapsible). | P2 |
| F-3.8 | Clear error states with a human-readable reason and a retry action. | P0 |
| F-3.9 | Progress delivered via real-time channel (WebSocket or Server-Sent Events), with polling fallback. | P0 |

### 8.4 Reachability Analysis Engine

| ID | Function | Priority |
| --- | --- | --- |
| F-4.1 | Build intra- and inter-procedural call graphs for the application and its dependencies. | P0 |
| F-4.2 | Handle common dynamic patterns: callbacks, promises/async, decorators, dependency injection, and framework routing conventions. | P1 |
| F-4.3 | Resolve calls into third-party packages down to the vulnerable symbol. | P0 |
| F-4.4 | Compute the shortest and all notable paths from each entry point to the vulnerable function. | P0 |
| F-4.5 | Assign one of three verdicts: **Confirmed reachable**, **Not observed reachable**, **Inconclusive**. | P0 |
| F-4.6 | For Inconclusive, record why (e.g., dynamic dispatch, reflection, `eval`, unresolved import, unsupported framework). | P0 |
| F-4.7 | Attach a confidence level and the assumptions used to every verdict. | P0 |
| F-4.8 | Distinguish direct use, transitive use, and test-only or dev-only use (dev dependencies are ranked lower). | P0 |
| F-4.9 | Detect configuration conditions that gate the vulnerability (feature flags, options, versions of runtime). | P1 |
| F-4.10 | Language-pluggable analyzers so new languages can be added without changing the core. | P1 |

### 8.5 Input Flow (Taint) Analysis

| ID | Function | Priority |
| --- | --- | --- |
| F-5.1 | Identify untrusted sources: HTTP params/body/headers/cookies, uploaded files, CLI args, env vars, database reads, message queues. | P0 |
| F-5.2 | Identify sanitizers and validators along the path (e.g., schema validation, escaping) and mark whether they break the flow. | P1 |
| F-5.3 | Mark each path as **attacker-controlled input reaches function**, **internal data only**, or **unknown**. | P0 |
| F-5.4 | Highlight the tainted flow on the graph and in the code view. | P0 |
| F-5.5 | Record exposure context: public endpoint, authenticated endpoint, internal job, or CLI. | P0 |

### 8.6 Evidence-Based Risk Prioritization

| ID | Function | Priority |
| --- | --- | --- |
| F-6.1 | Combine four signals: reachability verdict, input exposure, CVE severity (CVSS), and exploit information (EPSS, CISA KEV, public PoC availability). | P0 |
| F-6.2 | Output a simple priority label: **Fix now**, **Fix soon**, **Monitor**, **Informational**. | P0 |
| F-6.3 | Show a "Why this priority" panel listing each signal and how it influenced the label. | P0 |
| F-6.4 | Display raw CVSS and EPSS values alongside, but never as the only justification. | P0 |
| F-6.5 | Sort the finding list by priority by default; allow sorting by severity, package, or newest. | P0 |
| F-6.6 | Allow users to override a priority or dismiss a finding with a required reason (audit logged). | P1 |
| F-6.7 | Support suppression rules (e.g., ignore dev-only dependencies) via a settings page or config file. | P2 |

**Default prioritization logic (v1):**

| Reachability | Input flow | Exploit info | Label |
| --- | --- | --- | --- |
| Confirmed | Attacker-controlled | Known exploited or high EPSS | Fix now |
| Confirmed | Attacker-controlled | None known | Fix now / Fix soon (by severity) |
| Confirmed | Internal only | Any | Fix soon |
| Inconclusive | Any | Known exploited | Fix soon |
| Inconclusive | Any | None known | Monitor |
| Not observed | Any | Any | Informational |

### 8.7 Visual Attack-Path Graph

The graph is a flagship feature and must feel like a professional tool, not a basic diagram.

| ID | Function | Priority |
| --- | --- | --- |
| F-7.1 | Interactive node-link graph rendered with GPU-accelerated rendering (WebGL/Canvas) to stay smooth with thousands of nodes. | P0 |
| F-7.2 | Left-to-right layered layout: entry point → application code → library code → vulnerable function. | P0 |
| F-7.3 | Distinct, minimal node styles for entry point, app function, library function, and vulnerable sink. | P0 |
| F-7.4 | Highlight the attack path; fade unrelated nodes. | P0 |
| F-7.5 | Show tainted data flow as an animated or distinctly styled edge. | P0 |
| F-7.6 | Click a node to open a side panel with the function name, file, line, and a code snippet. | P0 |
| F-7.7 | "Open in GitHub" deep link to the exact file and line on the scanned commit. | P0 |
| F-7.8 | Pan, zoom, fit-to-screen, and a minimap. | P0 |
| F-7.9 | Collapse and expand node groups (e.g., collapse library internals into one node). | P0 |
| F-7.10 | Switch between a single path view and an all-paths view. | P1 |
| F-7.11 | Search nodes by function or file name. | P1 |
| F-7.12 | Step-through mode that walks the path one hop at a time with a one-line explanation per hop. | P1 |
| F-7.13 | Keyboard navigation and accessible labels. | P1 |
| F-7.14 | Light and dark themes with accessible contrast. | P1 |
| F-7.15 | Export graph as SVG or PNG for reports. | P1 |
| F-7.16 | Level-of-detail rendering: show labels only when zoomed in; keep a clean overview when zoomed out. | P0 |
| F-7.17 | Whole-application graph overview (secondary view) with vulnerable areas marked. | P2 |
| F-7.18 | Before/after graph comparison after a fix, showing the path is closed. | P2 |

### 8.8 Plain-Language Explanations

| ID | Function | Priority |
| --- | --- | --- |
| F-8.1 | Each finding has a three-part explanation: **What it is**, **Why it matters here**, **What to do**. | P0 |
| F-8.2 | Written at a simple reading level, avoiding jargon; technical terms get a short tooltip definition. | P0 |
| F-8.3 | Explanation is specific to this application (names the actual route, function, and input), not generic CVE text. | P0 |
| F-8.4 | Summary is limited to roughly 3 short sentences by default, with "Show technical details" expansion. | P0 |
| F-8.5 | Explanations cite the evidence (path, file, line) and never state facts the analysis did not establish. | P0 |
| F-8.6 | Each Inconclusive verdict explains plainly what is missing and what a human could check. | P0 |
| F-8.7 | Optional "Explain it simpler" toggle for a non-technical version. | P2 |

*Example:* "Your `/upload` route passes the file name from the user directly into `tar.extract()`. In the version you use, that can let someone write files outside the intended folder. Upgrading to 6.2.1 removes the problem."

### 8.9 Proof-of-Reachability Testing

| ID | Function | Priority |
| --- | --- | --- |
| F-9.1 | For eligible findings, generate a safe test that exercises the path to the vulnerable behavior. | P1 |
| F-9.2 | Run tests in an isolated sandbox: no network egress, no secrets, resource and time limits, throwaway filesystem. | P0 (if feature ships) |
| F-9.3 | Tests use harmless payloads that demonstrate the behavior (e.g., a marker file written inside the sandbox) and are never weaponized. | P0 (if feature ships) |
| F-9.4 | Capture a result: Reproduced, Not reproduced, or Could not test (with reason). | P1 |
| F-9.5 | After patching, re-run the identical test and show a before/after comparison. | P1 |
| F-9.6 | Display test code, logs, and result inside the finding. | P1 |
| F-9.7 | Mark findings as **Proof pending**, **Proven**, or **Not provable** when no safe test can be built. | P1 |
| F-9.8 | Exclude classes of vulnerabilities where safe testing is not possible; state this clearly. | P0 |

### 8.10 Remediation Recommendation

| ID | Function | Priority |
| --- | --- | --- |
| F-10.1 | Recommend the smallest appropriate fix: minimal version bump, patch release, override/resolution for transitive deps, or code-level change. | P0 |
| F-10.2 | Identify the lowest fixed version that resolves the CVE while preserving semantic-version compatibility where possible. | P0 |
| F-10.3 | Flag breaking-change risk (major version bump) using changelogs and API diff. | P1 |
| F-10.4 | Group multiple CVEs fixed by the same upgrade into one recommendation. | P0 |
| F-10.5 | When no fix exists upstream, suggest mitigations (remove usage, validate input, replace library, feature flag) and label them as mitigations. | P1 |
| F-10.6 | Show a plain-language reason for the chosen fix and alternatives considered. | P0 |

### 8.11 Patch Generation

| ID | Function | Priority |
| --- | --- | --- |
| F-11.1 | Generate a dependency upgrade by editing the manifest and regenerating the lockfile with the native package manager. | P0 |
| F-11.2 | Generate transitive-dependency overrides where direct upgrade is not possible. | P1 |
| F-11.3 | Generate minimal code patches for API changes caused by the upgrade or for application-level sanitization. | P1 |
| F-11.4 | Show a diff viewer with syntax highlighting before any PR is created. | P0 |
| F-11.5 | Patch is applied on a new branch (e.g., `vulntrace/fix-CVE-XXXX-NNNN`); the default branch is never modified directly. | P0 |
| F-11.6 | Keep changes minimal: no unrelated formatting, refactors, or upgrades. | P0 |

### 8.12 Validation

| ID | Function | Priority |
| --- | --- | --- |
| F-12.1 | Detect the project's existing test, build, and lint commands. | P0 |
| F-12.2 | Run build and tests in an isolated environment on the patched branch; run a baseline on the unpatched code for comparison. | P0 |
| F-12.3 | Re-run vulnerability matching to confirm the CVE no longer applies. | P0 |
| F-12.4 | Re-run reachability analysis to confirm no new vulnerable paths were introduced. | P0 |
| F-12.5 | Run available security checks (e.g., audit tooling, static analysis). | P1 |
| F-12.6 | Re-run the proof-of-reachability test, if one exists. | P1 |
| F-12.7 | Produce a validation verdict: **Verified**, **Failed**, or **Inconclusive** (e.g., no tests available, flaky tests, baseline already failing). | P0 |
| F-12.8 | Failed or inconclusive validation is shown prominently and is never presented as a successful fix. | P0 |
| F-12.9 | Show a per-check checklist with pass/fail/skipped and logs on demand. | P0 |
| F-12.10 | If a patch fails, optionally attempt an alternative fix and report each attempt. | P2 |

### 8.13 Pull Request Creation

| ID | Function | Priority |
| --- | --- | --- |
| F-13.1 | Create a PR on GitHub from the fix branch via the user's authorized account or GitHub App. | P0 |
| F-13.2 | PR title is clear and short (e.g., "Fix CVE-2026-1234: upgrade tar to 6.2.1"). | P0 |
| F-13.3 | PR body includes: summary, plain-language explanation, attack path (image and link), input-flow note, priority reasoning, changes made, validation results with verdict, proof-test before/after, and rollback notes. | P0 |
| F-13.4 | PR body clearly labels the verdict and any caveats, including failures or inconclusive checks. | P0 |
| F-13.5 | Apply labels (e.g., `security`, `vulntrace`, priority) and request reviewers if configured. | P1 |
| F-13.6 | Preview the PR before creating it; user confirms with one click. | P0 |
| F-13.7 | Link back to the VulnTrace finding page from the PR. | P1 |
| F-13.8 | Track PR status (open, merged, closed) in the app; after merge, trigger a verification re-scan. | P1 |
| F-13.9 | Never auto-merge. Merge is always a human action. | P0 |
| F-13.10 | Fallback when PR creation is not permitted: download a patch file or copy the branch instructions. | P1 |

### 8.14 Findings List and Navigation

| ID | Function | Priority |
| --- | --- | --- |
| F-14.1 | Overview screen with three summary counts (Confirmed, Inconclusive, Not observed) and a risk-reduction line ("38 alerts reduced to 3 that need action"). | P0 |
| F-14.2 | Findings list with priority label, package, CVE id, and one-line reason per row. | P0 |
| F-14.3 | Filters: priority, verdict, package, direct/transitive, fix available, status. | P0 |
| F-14.4 | Tabs for Confirmed, Inconclusive, Not observed, and All. | P0 |
| F-14.5 | Search by CVE, package, or file. | P1 |
| F-14.6 | Finding detail page with sections: Summary, Attack path, Evidence, Why this priority, Fix, Validation, Pull request. | P0 |
| F-14.7 | Persistent left navigation (Scans, Findings, Fixes, Settings) and breadcrumbs. | P0 |
| F-14.8 | Status workflow per finding: Open, In progress, Fixed, Dismissed. | P1 |
| F-14.9 | Keyboard shortcuts for moving between findings and opening the graph. | P2 |
| F-14.10 | Deep-linkable URLs for every scan and finding so they can be shared. | P0 |

### 8.15 Reporting and Export

| ID | Function | Priority |
| --- | --- | --- |
| F-15.1 | Exportable report (PDF and Markdown) of a scan with summary, findings, evidence, and fixes. | P1 |
| F-15.2 | JSON and SARIF export for integration with other tools. | P1 |
| F-15.3 | Shareable read-only link to a scan result. | P2 |
| F-15.4 | Before/after summary for a scan after fixes are merged. | P2 |

### 8.16 Settings and Integrations

| ID | Function | Priority |
| --- | --- | --- |
| F-16.1 | GitHub connection management (connect, disconnect, repository permissions). | P0 |
| F-16.2 | Configuration file (`vulntrace.yml`) for ignore rules, entry-point hints, and custom sanitizers. | P2 |
| F-16.3 | Notification preferences (email, Slack) for new Fix-now findings. | P2 |
| F-16.4 | CI integration (GitHub Action) to scan on pull requests and comment results. | P2 |
| F-16.5 | Delete scan data and disconnect account, with confirmation. | P0 |

## 9. User Experience and Design

### 9.1 Design Language: Very Clean and Minimal

- **Whitespace first.** Generous spacing; one primary idea per screen.
- **Neutral palette.** White or near-white background (and a true dark mode), grayscale text, one single accent color for actions and highlights.
- **Semantic color only where it carries meaning:** a restrained red for Fix now, amber for Fix soon, gray for Monitor/Informational, green for Verified.
- **Typography:** one modern sans-serif family for UI, one monospace for code. Limited sizes (about four) and weights (regular, medium).
- **No clutter:** no heavy borders, shadows, or gradients; thin 1px dividers and subtle hover states.
- **Icons:** one consistent thin-line icon set, used sparingly.
- **Motion:** short, purposeful transitions (150 to 250 ms); respects reduced-motion settings.
- **Progressive disclosure:** summaries first, technical detail behind "Show details".
- **Plain copy:** short sentences, friendly tone, no security jargon in headlines.

### 9.2 Key Screens

1. **Home:** centered logo, one input ("Paste a GitHub link"), a Scan button, recent scans below, "Try a demo" link.
2. **Scan progress:** large percentage, stage stepper, live counters, streaming findings preview, cancel button.
3. **Scan overview:** three counts, risk-reduction line, ranked findings list, filters.
4. **Finding detail:** split layout with the attack-path graph (about 60%) and an explanation panel (about 40%). Tabs: Evidence, Fix, Validation.
5. **Fix review:** diff viewer, validation checklist, proof-test before/after, PR preview, Create PR button.
6. **Settings:** connections, preferences, data controls.

### 9.3 Navigation

- Slim persistent left sidebar: Scans, Findings, Fixes, Settings.
- Breadcrumbs: Scan > Finding > Fix.
- Back and forward behave predictably; every state has a URL.
- Empty, loading, and error states are designed for every screen.

### 9.4 Accessibility

- WCAG 2.1 AA contrast, keyboard operability, visible focus states, screen-reader labels on graph nodes, and non-color indicators (icons and text) alongside color.

## 10. Non-Functional Requirements

### 10.1 Performance (the system should be fast)

| Metric | Target |
| --- | --- |
| First streamed finding | Under 20 seconds for a typical repo |
| Full scan, small repo (under 50k LOC) | Under 60 seconds |
| Full scan, medium repo (50k to 500k LOC) | Under 5 minutes |
| Cached or incremental re-scan | Under 15 seconds |
| UI interaction response | Under 100 ms |
| Graph rendering | 60 fps with up to 5,000 visible nodes |
| Page load (cold) | Under 2 seconds |

Techniques: shallow clones, parallel dependency matching, parallel file parsing, advisory database cached locally, commit-hash result caching, pruning the call graph to relevant subgraphs, and streaming partial results.

### 10.2 Security and Privacy

- All analysis and test execution run in isolated, ephemeral sandboxes with no access to other users' data.
- Minimum-scope GitHub permissions; tokens encrypted at rest.
- Source code is deleted after the scan unless the user opts to retain it; retention period is configurable.
- Proof tests run with no network, no secrets, strict CPU, memory, and time limits.
- No source code is used to train models without explicit consent.
- Audit log of scans, overrides, dismissals, and PR creation.

### 10.3 Reliability

- Failed stages degrade gracefully: partial results remain visible with a clear note about what is missing.
- Idempotent scan jobs with retries.
- Target availability of 99.5% for the web app.

### 10.4 Accuracy and Trust

- Reachability analysis is conservative: if it cannot decide, it says **Inconclusive** rather than guessing.
- Every verdict records its method, assumptions, and confidence.
- Precision and recall are measured on a benchmark set of known vulnerable apps (see Metrics).

### 10.5 Scalability

- Stateless workers behind a job queue; horizontal scaling of analysis workers.
- Repository size limits with a clear message and graceful handling above them.

## 11. Technology Stack & System Architecture

### 11.1 Proposed Architecture & Pipeline Flow

The system operates across a 7-layer pipeline where results stream back to the UI:

$$\text{UI} \longrightarrow \text{API} \longrightarrow \text{Analysis + Graph} \longrightarrow \text{Agents} \longrightarrow \text{Proposal} \longrightarrow \text{Validation} \longrightarrow \text{Results in UI}$$

| # | Layer | Component / Tool | Role in VulnTrace |
| :---: | :--- | :--- | :--- |
| **1** | **Frontend**<br>*Interface & graph view* | **Next.js** *(Deck)* / **Vite + React 18** *(Repo)*<br>**React**<br>**TypeScript**<br>**Tailwind CSS**<br>**React Flow** (`@xyflow/react`) | App framework for responsive user experience<br>UI components<br>Strictly typed frontend codebase<br>Clean, minimal styling & design system<br>Interactive attack-path & dependency graph view |
| **2** | **Backend**<br>*API & orchestration* | **Python**<br>**FastAPI**<br>**Pydantic**<br>**LangGraph**<br>*PostgreSQL* | Core backend language<br>High-performance REST API & SSE streaming endpoints<br>Typed data contracts & schemas shared with frontend<br>Stateful multi-agent coordination & workflow graph<br>*(Optional: relational storage for user accounts & history)* |
| **3** | **Vuln. Data**<br>*Known flaws* | **OSV API** (`api.osv.dev`)<br>**Manifests & lockfiles** | Authoritative source of known vulnerabilities per package version<br>Dependency inventory extracted from lockfiles (e.g. `package-lock.json`, `requirements.txt`) |
| **4** | **Code Intelligence**<br>*Evidence source* | **Tree-sitter**<br>**Call-graph analysis** | Robust AST parser for source code syntax<br>Language-specific analysis that produces concrete reachability evidence |
| **5** | **Knowledge Graph**<br>*Relationships & paths* | **FalkorDB**<br>**Graph entities**<br>**Path queries** | High-speed graph database (openCypher over Redis protocol)<br>Models Repos, Packages, Files, Functions, CVEs, and Call Edges<br>Graph path queries from Entry Points to Vulnerable Functions (`1..10` hops) |
| **6** | **AI / LLM**<br>*Shared by 3 agents* | **Groq API**<br>**One shared LLM**<br>**`openai/gpt-oss-120b`** | Hosted ultra-fast inference<br>Shared model utilized by all three agents with distinct system prompts<br>Candidate model for structured reasoning and JSON output |
| **7** | **Patch Validation**<br>*Controlled checks* | **Git**<br>**Docker sandbox**<br>**Test runner** | Branch management, diff generation, and patch staging<br>Isolated, ephemeral environment with stripped secrets<br>Project-appropriate test execution (`pytest`, `npm test`) |

> **Important Architectural Principle:** *Tree-sitter parses code; the language-specific call-graph analysis supplies the reachability evidence. Tree-sitter alone does not prove reachability.*

---

### 11.2 Multi-Agent Architecture (LangGraph Coordination)

The system coordinates three specialized agents driven by one shared Groq-hosted LLM:

1. **Reachability Analyst Agent:** Receives deterministic graph path evidence and symbol context; assigns a grounded reachability verdict (`reachable`, `not_reachable`, or `uncertain`). Never hallucinates paths not in FalkorDB.
2. **Risk Prioritizer Agent:** Evaluates entry point exposure (e.g., untrusted user input vs. internal background job), vulnerability CVSS/EPSS signals, and reachability to assign actionable priority categories (Fix now, Schedule fix, Monitor, Human review).
3. **Remediation Agent:** Proposes minimal version bump or patch diffs based on fixed version ranges, passing candidates to the isolated validation sandbox.

---

### 11.3 System Component Responsibilities

| Component | Responsibility |
| --- | --- |
| **Web App & Graph UI** | Next.js / Vite React frontend, React Flow visualization, real-time SSE progress. |
| **API Service** | FastAPI backend, schema validation via Pydantic, orchestration endpoints. |
| **Repo Fetcher & Dependency Resolver** | Clones repo shallowly; parses manifests & lockfiles into dependency tree. |
| **Vulnerability Intelligence** | Queries OSV API, correlates CVEs/GHSAs, resolves affected version ranges. |
| **Analysis Engine (Tree-sitter)** | Language-specific AST parsing, call graph construction, entry-point and sink resolution. |
| **Graph Store (FalkorDB)** | Cypher-queried knowledge graph storing code topology, dependencies, and path reachability. |
| **Agent Coordinator (LangGraph)** | Orchestrates the stateful pipeline, invokes LLM agents, and validates outputs. |
| **Sandbox Runner** | Docker-based isolated environment executing project builds and test verification. |
| **Remediation Service** | Generates candidate unified diffs and stages GitHub PR creation. |

> **Design note on explanations:** The explanation and agent services must strictly ground their reasoning in deterministic graph evidence. Agents must never invent call paths, function names, or file locations not present in the FalkorDB evidence bundle.

## 12. Core Data Model (Summary)

- **Scan:** id, repo, commit, status, stage progress, timestamps, summary counts.
- **Dependency:** name, version, ecosystem, direct/transitive, dev/prod, parent chain.
- **Vulnerability:** CVE/GHSA id, severity, CVSS, EPSS, KEV flag, affected range, fixed versions, vulnerable symbols.
- **Finding:** scan, dependency, vulnerability, verdict, confidence, priority, input-flow status, exposure, status.
- **Evidence:** list of paths (nodes and edges), source and sink locations, taint flow, assumptions, reasons for inconclusive.
- **Graph:** nodes (function, file, line, type) and edges (call, data flow).
- **Proof test:** code, environment, before result, after result.
- **Fix:** strategy, diff, branch, validation results, verdict.
- **Pull request:** URL, status, linked finding.
- **Audit event:** actor, action, target, time.

## 13. API Surface (Summary)

| Endpoint | Purpose |
| --- | --- |
| `POST /scans` | Start a scan from a GitHub URL. |
| `GET /scans/:id` | Scan status and summary. |
| `GET /scans/:id/stream` | Real-time progress and streamed findings. |
| `POST /scans/:id/cancel` | Cancel a scan. |
| `GET /scans/:id/findings` | List and filter findings. |
| `GET /findings/:id` | Finding detail with evidence and explanation. |
| `GET /findings/:id/graph` | Graph data for rendering. |
| `POST /findings/:id/proof` | Run proof-of-reachability test. |
| `POST /findings/:id/fix` | Generate patch and run validation. |
| `POST /fixes/:id/pull-request` | Create the pull request. |
| `GET /scans/:id/export` | Export report (PDF, MD, JSON, SARIF). |
| `DELETE /scans/:id` | Delete scan data. |

## 14. Success Metrics

| Metric | Target |
| --- | --- |
| Alert reduction (flagged vs. needing action) | 70% or more on benchmark repos |
| Reachability precision on confirmed findings | 90% or more |
| Reachability recall on known reachable CVEs | 85% or more |
| Inconclusive rate | Under 15% of findings |
| Fix validation pass rate (patches that reach Verified) | 70% or more |
| Time from paste to first finding | Under 20 seconds |
| Time from finding to PR | Under 3 minutes |
| PR acceptance rate | 60% or more |
| User comprehension ("I understood why this mattered") | 4.5 / 5 or higher |

## 15. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Static analysis misses dynamic behavior, causing false negatives | Use the Inconclusive verdict; never claim safety without evidence; label "Not observed" rather than "Safe". |
| False positives erode trust | Conservative confirmation, visible evidence, easy dismissal with reason. |
| Unsafe proof tests | Strict sandboxing, harmless payloads, class exclusions, human-reviewable test code. |
| Auto-patches break the application | Baseline vs. patched testing; failed validation clearly reported; no auto-merge. |
| Poor test coverage makes validation weak | Report validation as Inconclusive when coverage is missing. |
| Large repos are slow | Incremental scanning, caching, pruning, size limits. |
| CVE-to-function mapping is incomplete | Combine advisory data, patch diff analysis, and curated mappings; fall back to package-level with a lower confidence. |
| LLM explanations hallucinate | Ground explanations strictly in structured evidence; validate output against the evidence. |
| Handling private source code | Ephemeral workspaces, minimal retention, clear privacy controls. |

## 16. Milestones

| Phase | Deliverables |
| --- | --- |
| **Phase 1: Foundation (weeks 1-3)** | GitHub URL input, clone, dependency inventory, vulnerability matching, scan progress UI, findings list. |
| **Phase 2: Reachability (weeks 4-6)** | Call graph, entry points, reachability verdicts, attack-path graph, plain explanations. |
| **Phase 3: Prioritization (weeks 7-8)** | Taint analysis, exploit signals, priority labels, "Why this priority" panel. |
| **Phase 4: Remediation (weeks 9-11)** | Fix recommendation, patch generation, sandbox validation, PR creation. |
| **Phase 5: Proof and polish (weeks 12-14)** | Proof-of-reachability tests with before/after, exports, performance tuning, accessibility, design polish. |

**Hackathon/demo cut:** Phases 1 to 4 for JavaScript/npm with one polished demo repository, a full graph experience, and one end-to-end fix with a proof test.

## 17. Demo Script (3 Minutes)

1. Paste a GitHub link to a demo repo. Show live progress and findings streaming in.
2. Overview: "41 alerts reduced to 3 that need action."
3. Open the top finding. Show the attack-path graph from `POST /upload` to the vulnerable function, with the tainted input highlighted.
4. Read the three-sentence explanation and the "Why this priority" panel.
5. Run the proof test: **Reproduced**.
6. Generate the fix; show the minimal diff; show validation passing and the proof test now **Not reproduced**.
7. Create the pull request and show its evidence-rich description.
8. Show an Inconclusive finding and how VulnTrace honestly explains what it could not determine.

## 18. Open Questions

1. Which languages beyond JavaScript and Python should be prioritized after launch?
2. Hosted SaaS only, or also a self-hosted option for sensitive codebases?
3. Should proof-of-reachability tests be generated for all vulnerability classes or a vetted allowlist at first?
4. What retention default is acceptable for source code and graphs?
5. Is GitHub the only source host for v1, or should GitLab and Bitbucket be planned?

## 19. Glossary

- **CVE:** a publicly listed security vulnerability identifier.
- **Call graph:** a map of which functions call which other functions.
- **Entry point:** where outside input enters the app (a route, CLI command, job).
- **Reachability:** whether code execution can get from an entry point to a vulnerable function.
- **Taint analysis:** tracking whether untrusted input flows into a sensitive function.
- **CVSS:** a standard severity score for vulnerabilities.
- **EPSS:** a probability estimate that a vulnerability will be exploited.
- **KEV:** CISA's catalog of vulnerabilities known to be exploited in the wild.
- **SARIF:** a standard format for static analysis results.
