# POW Ledger Verification System

A multi-agent AI system that captures organizational decisions as cryptographically sealed artifacts and verifies their integrity through an immutable ledger.

Built with Google ADK, Gemini 2.5 Flash, and Vertex AI Agent Engine for the Google for Startups AI Agents Challenge 2026 (Track 1).

---

## What it does

Organizations make thousands of decisions — architecture choices, policy changes, strategic pivots — but rarely have a system of record for *why* those decisions were made, *who* made them, or *whether* the record has been tampered with. POW Ledger solves this.

A user describes a decision in natural language. The system captures it as a cryptographically hashed artifact, links events to it over time, and later verifies that no entry in the decision's lineage has been altered. Three specialized agents collaborate through a single orchestrator, enforcing a strict single-writer protocol: only one agent can mutate the ledger, while another independently verifies integrity.

**Example flow:**

```
User: "Capture this decision: We are standardizing on PCOMJR architecture
       across all TalonSight terminals for consistent artifact provenance tracking"

System: Decision captured.
        Artifact ID: art_7f3a...
        SHA-256 hash: e4b2c9...
        Event recorded with signature verification.

User: "Verify artifact art_7f3a..."

System: Entry 1 — Valid ✅ (hash recomputed, matches stored)
        Entry 2 — Valid ✅ (event signature verified)
        No automatable workflow patterns detected (< 3 similar decisions).
```

---

## Architecture

```
User → Orchestrator Agent (router, no direct ledger access)
         ├── capture_decision → Capture Agent (single-writer)
         │      └── append_decision + record_event → MCP Server → Ledger API → Cloud SQL
         └── verify_artifact → Verification Agent (reader)
                └── get_lineage + verify_entry + propose_workflow → MCP Server → Ledger API
```

Three agents deployed on **Vertex AI Agent Engine**, communicating via **Agent-to-Agent (A2A)** protocol. Each agent runs **Gemini 2.5 Flash** with specialized instructions and tool access.

An **MCP Server** on Cloud Run implements the **Streamable HTTP** protocol, exposing 5 tools. The server mints a fresh Google ID token per request, solving the 1-hour token expiry problem inherent to long-running agent sessions.

A **Ledger API** on Cloud Run handles decision persistence, SHA-256 hash computation, and integrity verification against a **Cloud SQL (PostgreSQL)** database.

### Architecture diagram

Open `architecture_diagram.html` in a browser for the full interactive diagram, or see the rendered version in the submission.

### Key design decisions

**Single-writer protocol.** Only the Capture Agent can mutate the ledger (`append_decision`, `record_event`). The Verification Agent has read-only access (`get_lineage`, `verify_entry`, `propose_workflow`). The Orchestrator has no direct ledger access at all — it routes via A2A. This separation prevents write conflicts and makes the integrity model auditable.

**MCP over direct function calls.** Rather than giving each agent direct database access, all ledger operations go through an MCP Server that implements the Streamable HTTP protocol. This provides a clean tool interface, centralizes authentication, and makes the system extensible — new tools can be added to the MCP server without redeploying agents.

**Fresh ID tokens per request.** The ADK's built-in `McpToolset` crashes on Vertex AI Agent Engine with a `TaskGroup` error. We replaced it with direct HTTP wrapper functions that implement the MCP Streamable HTTP protocol manually, minting a fresh Google ID token for each call. This also fixes the 1-hour token expiry issue that would otherwise break long-running sessions.

**Anti-code-generation instructions.** Gemini 2.5 Flash occasionally generates Python code instead of calling tools when invoked directly (not through the Orchestrator). Adding explicit instructions ("NEVER generate Python code, NEVER use `print()`") to each sub-agent's system prompt eliminates the `UNEXPECTED_TOOL_CALL` errors.

---

## Technology stack

| Component | Technology | Purpose |
|---|---|---|
| Agent framework | Google ADK (Python) | Agent definition, tool binding, A2A routing |
| Model | Gemini 2.5 Flash | Reasoning for all three agents |
| Agent hosting | Vertex AI Agent Engine | Production deployment, session management |
| MCP Server | FastMCP + Cloud Run | Streamable HTTP tool server (5 tools) |
| Ledger API | Flask + Cloud Run | Decision storage, SHA-256 hashing |
| Database | Cloud SQL (PostgreSQL) | Persistent ledger store |
| Frontend | React + D3.js | POW Constellation visualization |
| Eval | Python (custom harness) | 6 automated test scenarios |

**GCP Project:** `proof-of-work-497822`
**Region:** `us-central1`

---

## Agent inventory

### Orchestrator Agent
- **Role:** Router. Receives user prompts, classifies intent, and routes to the appropriate sub-agent via A2A.
- **Tools:** `capture_decision` (calls Capture Agent), `verify_artifact` (calls Verification Agent)
- **Ledger access:** None. Cannot read or write the ledger directly.
- **Key behavior:** Never generates code. Returns sub-agent responses verbatim with artifact IDs and verification results.

### Capture Agent
- **Role:** Single-writer. The only agent authorized to mutate the ledger.
- **Tools:** `append_decision` (creates new artifact with SHA-256 hash), `record_event` (links event to existing artifact with signature), `list_artifacts` (reads artifact index)
- **MCP calls:** Direct HTTP to MCP Server with per-request ID token auth
- **Key behavior:** Extracts decision title, description, and type from natural language. Rejects non-decision inputs.

### Verification Agent
- **Role:** Reader. Independently verifies ledger integrity without write access.
- **Tools:** `get_lineage` (retrieves full entry chain for an artifact), `verify_entry` (recomputes SHA-256 hash and compares), `propose_workflow` (analyzes patterns across 3+ similar decisions)
- **MCP calls:** Direct HTTP to MCP Server with per-request ID token auth
- **Key behavior:** Reports pass/fail per entry with hash details. Proposes workflow automation when repeated decision patterns are detected.

---

## MCP tool reference

| Tool | Agent | Direction | Description |
|---|---|---|---|
| `append_decision` | Capture | Write | Create a new decision artifact with SHA-256 hash |
| `record_event` | Capture | Write | Link an event to an existing artifact with signature |
| `list_artifacts` | Capture | Read | List all artifacts in the ledger |
| `get_lineage` | Verification | Read | Get full entry chain for a given artifact ID |
| `verify_entry` | Verification | Read | Recompute SHA-256 and compare against stored hash |
| `propose_workflow` | Verification | Read | Detect repeated patterns across similar decisions |

All tools are served via a single MCP Server implementing **Streamable HTTP** (not SSE, not stdio). Authentication uses Google Cloud ID tokens with `allAuthenticatedUsers` invoker binding as a challenge-deadline workaround (to be tightened to explicit SA binding post-submission).

---

## Running locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Cloud CLI (`gcloud`)
- Authenticated GCP session: `gcloud auth application-default login`

### Start the frontend
```bash
cd ~/Downloads/Proof-Of-Work
npm install
npm run dev
# → http://localhost:3000
```

### Run the eval harness
```bash
cd ~/Downloads/Proof-Of-Work
source agents/verification/.venv/bin/activate
python eval_harness.py
# → eval_report.json (6/6 scenarios, ~54s)
```

### Test Orchestrator → Capture
```bash
ORCH=$(cat agents/orchestrator/deployed_resource.txt)
python -c "
import vertexai
from vertexai import agent_engines
vertexai.init(project='proof-of-work-497822', location='us-central1')
orch = agent_engines.get('$ORCH')
session = orch.create_session(user_id='demo-user')
for event in orch.stream_query(user_id='demo-user', session_id=session['id'],
    message='Capture this decision: We are standardizing on PCOMJR architecture across all TalonSight terminals'):
    content = event.get('content', {})
    for part in content.get('parts', []):
        if 'text' in part: print(part['text'])
"
```

### Test Orchestrator → Verify
```bash
# Replace ARTIFACT_ID with a real artifact ID from the capture step
python -c "
import vertexai
from vertexai import agent_engines
vertexai.init(project='proof-of-work-497822', location='us-central1')
orch = agent_engines.get('$ORCH')
session = orch.create_session(user_id='demo-user')
for event in orch.stream_query(user_id='demo-user', session_id=session['id'],
    message='Verify artifact ARTIFACT_ID'):
    content = event.get('content', {})
    for part in content.get('parts', []):
        if 'text' in part: print(part['text'])
"
```

---

## Eval harness

`eval_harness.py` runs 6 automated test scenarios:

| # | Scenario | What it tests |
|---|---|---|
| 1 | Round-trip E2E | Capture a decision, then verify the resulting artifact |
| 2 | Routing: capture | Orchestrator correctly routes decision capture requests |
| 3 | Routing: verify | Orchestrator correctly routes verification requests |
| 4 | Non-decision rejection | System rejects casual conversation that isn't a decision |
| 5 | Invalid ID handling | System handles verification of non-existent artifact IDs |
| 6 | List artifacts | Capture Agent's `list_artifacts` tool returns artifact data |

All 6 scenarios pass as of the last eval run (6/6, ~54s total). Results are saved to `eval_report.json`.

---

## Repository structure

```
Proof-Of-Work/
├── agents/
│   ├── orchestrator/          # Orchestrator agent definition + deploy script
│   │   ├── agent.py           # ADK agent with capture_decision + verify_artifact tools
│   │   ├── deploy.py          # Vertex AI Agent Engine deployment
│   │   └── deployed_resource.txt
│   ├── capture/               # Capture agent definition + deploy script
│   │   ├── agent.py           # ADK agent with MCP tool wrappers (append, record, list)
│   │   ├── deploy.py
│   │   └── deployed_resource.txt
│   └── verification/          # Verification agent definition + deploy script
│       ├── agent.py           # ADK agent with MCP tool wrappers (lineage, verify, workflow)
│       ├── deploy.py
│       └── deployed_resource.txt
├── mcp-server/                # FastMCP server (Streamable HTTP)
│   ├── server.py              # 5 MCP tools
│   ├── Dockerfile
│   └── requirements.txt
├── ledger-api/                # Ledger backend (Flask + Cloud SQL)
│   ├── app.py
│   ├── Dockerfile
│   └── requirements.txt
├── src/                       # React frontend
│   └── components/
│       └── POWConstellation.tsx  # D3 force-directed graph visualization
├── eval_harness.py            # Automated evaluation (6 scenarios)
├── eval_report.json           # Latest eval results
├── architecture_diagram.html  # Interactive architecture diagram
├── package.json
└── README.md
```

---

## Deployment

All three agents are deployed to Vertex AI Agent Engine. The MCP Server and Ledger API are deployed to Cloud Run.

```
Orchestrator   → projects/878967828995/locations/us-central1/reasoningEngines/1392182381636485120
Capture        → projects/878967828995/locations/us-central1/reasoningEngines/3575852056818221056
Verification   → projects/878967828995/locations/us-central1/reasoningEngines/5023772531157368832
MCP Server     → pow-mcp-server-878967828995.us-central1.run.app/mcp
Ledger API     → pow-ledger-878967828995.us-central1.run.app
```

---

## Findings and learnings

### What worked
- **Single-writer protocol** is a strong architectural pattern for multi-agent systems. It eliminates race conditions and makes integrity verification meaningful — you can't verify what you can also overwrite.
- **Vertex AI Agent Engine** provides production-grade session management and streaming out of the box, with no custom infrastructure for agent hosting.
- **Streamable HTTP for MCP** is more reliable than SSE for Cloud Run deployments. No connection timeout issues, cleaner error handling.

### What we learned the hard way
- **ADK's `McpToolset` doesn't work on Agent Engine.** It crashes with a `TaskGroup` error due to async event loop conflicts in the Reasoning Engine runtime. The fix: replace `McpToolset` with direct HTTP wrapper functions that implement the MCP Streamable HTTP protocol manually.
- **Token expiry is a silent killer.** ID tokens expire after 1 hour. Long agent sessions that reuse a cached token will fail with 401s on MCP calls. Minting a fresh token per request adds ~50ms latency but eliminates the failure mode entirely.
- **Gemini generates code instead of calling tools.** When sub-agents are called directly (not through the Orchestrator), Gemini 2.5 Flash sometimes generates Python code (`print(...)`) instead of invoking the defined tools. Adding explicit anti-code-generation instructions to the system prompt fixes this.
- **Import-time `agent_engines.get()` causes fatal startup.** If an agent's module-level code calls `agent_engines.get()` to resolve sub-agent references, the Reasoning Engine fails to start because the Vertex AI SDK isn't initialized yet at import time. Lazy accessors (`_get_capture()`, `_get_verification()`) solve this.

### What we'd do differently
- Build the MCP Server with explicit tool schemas from day one, rather than evolving them during agent development.
- Add structured logging (Cloud Logging) to MCP tool invocations for observability.
- Implement a dead-letter queue for failed ledger writes.

---

## Business case

POW Ledger addresses a gap in organizational decision management. Today, decisions are scattered across Slack threads, meeting notes, email chains, and undocumented institutional memory. When questions arise — "Why did we choose this vendor?", "Who approved this architecture change?", "Was this policy decision tampered with?" — there's no system of record to consult.

**Target users:** Engineering teams, compliance-sensitive organizations, startups building auditable AI systems (where provenance of AI-generated decisions matters).

**Revenue model:** SaaS with per-seat pricing, tiered by ledger volume and verification frequency. Enterprise tier adds SSO, audit exports, and configurable retention policies.

**Competitive advantage:** Unlike document management tools (Notion, Confluence) that store decisions as unstructured text, POW Ledger provides cryptographic integrity verification — you can prove a decision record hasn't been altered since capture. Unlike blockchain-based solutions, it runs on standard cloud infrastructure with sub-second latency.

---

## License

MIT

---

*Built by Jermaine Nelson (TalonSight Technologies) for the Google for Startups AI Agents Challenge 2026.*
