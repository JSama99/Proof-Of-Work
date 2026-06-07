# POW Ledger — Devpost Submission Text

> Copy-paste the sections below into the Devpost submission form fields.

---

## Project Title

POW Ledger Verification System

---

## Tagline

A multi-agent system that captures organizational decisions as cryptographically sealed artifacts and verifies their integrity.

---

## Text Description (Features, Functionality, Technologies)

### What it does

POW Ledger is a multi-agent AI system that captures organizational decisions as cryptographically sealed artifacts and verifies their integrity through an immutable ledger. Users describe decisions in natural language; the system stores them with SHA-256 hashes, links events over time, and independently verifies that no entry has been tampered with.

### How it works

Three agents collaborate through a single Orchestrator:

**Orchestrator Agent** — Receives user prompts, classifies intent (capture vs. verify), and routes to the appropriate sub-agent. It has no direct ledger access, enforcing separation of concerns.

**Capture Agent (single-writer)** — The only agent authorized to mutate the ledger. It extracts decision metadata from natural language, creates cryptographically hashed artifacts via `append_decision`, and links events via `record_event`. It rejects inputs that aren't actionable decisions.

**Verification Agent (reader)** — Independently verifies ledger integrity without write access. It retrieves an artifact's full entry chain via `get_lineage`, recomputes SHA-256 hashes via `verify_entry`, and proposes workflow automation when it detects repeated decision patterns via `propose_workflow`.

All three agents run on Vertex AI Agent Engine with Gemini 2.5 Flash. They communicate via Agent-to-Agent (A2A) protocol using `stream_query`. An MCP Server on Cloud Run implements the Streamable HTTP protocol, exposing 5 tools that bridge the agents to a Ledger API backed by Cloud SQL (PostgreSQL).

### Key technical innovation

**Single-writer protocol**: Only one agent can mutate the ledger, while another independently verifies integrity. This pattern eliminates write conflicts in multi-agent systems and makes cryptographic verification meaningful — you can't verify what you can also overwrite.

**McpToolset bypass**: Google ADK's built-in `McpToolset` crashes on Vertex AI Agent Engine due to async event loop conflicts. We replaced it with direct HTTP wrapper functions implementing the MCP Streamable HTTP protocol manually, minting a fresh Google ID token per request. This also solves the 1-hour token expiry problem inherent to long-running agent sessions.

### Technologies used

- Google ADK (Python) — agent definition and tool binding
- Gemini 2.5 Flash — reasoning model for all three agents
- Vertex AI Agent Engine — production agent hosting and session management
- FastMCP — MCP server implementing Streamable HTTP protocol
- Cloud Run — hosting for MCP Server and Ledger API
- Cloud SQL (PostgreSQL) — persistent ledger store
- React + D3.js — POW Constellation force-directed graph visualization
- SHA-256 — cryptographic hashing for decision integrity
- Python — eval harness (6 automated test scenarios)

### Data sources

All data is generated through system usage — decisions captured by users are stored in Cloud SQL. No external datasets are used.

### Findings and learnings

The biggest surprise was how much production hardening the agent-to-MCP communication layer required. ADK's `McpToolset` works perfectly in local development but fails on Agent Engine due to async runtime constraints. We learned that building direct HTTP wrappers for MCP tools — while more work upfront — gives full control over authentication, error handling, and token lifecycle, making the system more robust than the SDK abstraction it replaced.

We also discovered that Gemini 2.5 Flash occasionally generates Python code instead of calling tools when sub-agents are invoked directly (outside the Orchestrator). Adding explicit anti-code-generation instructions to each agent's system prompt eliminates this failure mode entirely.

The single-writer protocol proved to be the most important architectural decision. It transformed the system from "three agents that share a database" into "a verifiable decision ledger with cryptographic integrity guarantees" — which is a fundamentally different value proposition.

---

## How to test

### Hosted project URL

The agents are deployed on Vertex AI Agent Engine (requires GCP authentication):

```
Orchestrator: projects/878967828995/locations/us-central1/reasoningEngines/1392182381636485120
MCP Server:   pow-mcp-server-878967828995.us-central1.run.app/mcp
Ledger API:   pow-ledger-878967828995.us-central1.run.app
```

### Testing with the eval harness

```bash
git clone https://github.com/Jsama99/Proof-Of-Work
cd Proof-Of-Work
gcloud auth application-default login
source agents/verification/.venv/bin/activate
python eval_harness.py
# → 6/6 passed, ~54s
```

### Running the frontend

```bash
npm install && npm run dev
# → http://localhost:3000 (POW Constellation visualization)
```

---

## Code Repository URL

https://github.com/Jsama99/Proof-Of-Work

---

## Architecture Diagram

See `architecture_diagram.html` in the repository root, or the embedded image in the demo video.

The system follows a strict layered architecture:

```
User → Orchestrator (router) → Capture Agent (writer) or Verification Agent (reader)
         ↓ A2A                    ↓ MCP Streamable HTTP
                              MCP Server (Cloud Run, 5 tools)
                                    ↓ REST API
                              Ledger API (Cloud Run)
                                    ↓
                              Cloud SQL (PostgreSQL)
```

---

## Demo Video Description (for YouTube/Vimeo)

POW Ledger Verification System — a multi-agent AI system built with Google ADK and Gemini 2.5 Flash on Vertex AI Agent Engine.

Three agents collaborate through a single Orchestrator to capture organizational decisions as cryptographically sealed artifacts and verify their integrity. The system enforces a single-writer protocol: only the Capture Agent can mutate the ledger, while the Verification Agent independently verifies integrity by recomputing SHA-256 hashes.

Built for the Google for Startups AI Agents Challenge 2026, Track 1.

Technologies: Google ADK, Gemini 2.5 Flash, Vertex AI Agent Engine, Cloud Run, Cloud SQL, FastMCP, React, D3.js.

GitHub: https://github.com/Jsama99/Proof-Of-Work

---

## Category

Automation of Complex Processes

---

## Additional notes for submission form

If the form asks about:

**Business case**: Organizations make thousands of decisions — architecture choices, policy changes, strategic pivots — but rarely have a system of record for why those decisions were made or whether the record has been tampered with. POW Ledger provides cryptographic integrity verification for organizational decisions, targeting engineering teams and compliance-sensitive organizations. Revenue model: SaaS with per-seat pricing, tiered by ledger volume and verification frequency.

**Innovation**: The single-writer protocol is a novel architectural pattern for multi-agent systems. Unlike existing approaches where agents share database access, POW Ledger separates mutation authority from verification authority at the agent level, enabling true cryptographic integrity guarantees. The McpToolset bypass technique (replacing ADK's built-in MCP integration with direct HTTP wrappers) is a production-hardening contribution that other teams building on Vertex AI Agent Engine can benefit from.

**What makes this different from existing solutions**: Unlike document management tools (Notion, Confluence) that store decisions as unstructured text, POW Ledger provides cryptographic integrity verification — you can prove a decision record hasn't been altered since capture. Unlike blockchain-based solutions, it runs on standard cloud infrastructure with sub-second latency and no consensus overhead.
