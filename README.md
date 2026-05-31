# POW Ledger Verification System

**Verifiable decision infrastructure for modern operators — powered by two collaborating agents over the Agent-to-Agent (A2A) protocol.**

> **Status:** In active development for the [Google for Startups AI Agents Challenge 2026](https://devpost.team/google-cloud-for-startups/hackathons/3197) (Track 1 · Build). The standalone POW Ledger application is deployed and operational; the multi-agent verification layer ships by submission deadline (June 5, 2026).

---

## What it does

POW Ledger captures, verifies, and reuses the daily operating decisions that knowledge workers normally lose. Two agents collaborate:

- **Decision Capture Agent** watches Gmail, Calendar, and Drive via Google's Workspace MCP servers, detecting decision-shaped signals as they happen.
- **Verification Agent** receives proposed entries over the A2A protocol, validates them against the existing ledger, detects patterns across repeated decision sequences, and synthesizes reusable workflows when a pattern crosses threshold.

Every record is SHA-256 hash-sealed. Every agent contribution is provenanced with `modelId` and `modelVersion`. The operator approves; the agents do the structuring. Decision capture becomes ambient — and every codified workflow makes the next decision faster, more defensible, and auditable.

---

## Try it

- **Live demo:** [https://pow-ledger-xxxxx.run.app](https://pow-ledger-xxxxx.run.app) *(replace with actual Cloud Run URL)*
- **Judge login:** `judge` / *(see Devpost submission)*
- **Demo video (1:45):** *uploaded by June 5*
- **Devpost submission:** *link added once registered*

---

## Architecture

![POW Ledger Verification System — Multi-Agent Architecture](docs/architecture.svg)

Two agents on Vertex AI Gemini, deployed on Cloud Run. The existing POW Ledger backend exposes its API as MCP tools via a FastMCP server. The Verification Agent uses those tools to read ledger state and write verified entries. The Decision Capture Agent uses Google's Workspace MCP servers to watch external signals. The two agents communicate over A2A.

**The approval gate is structural.** Nothing enters the verified record without explicit human approval. The agents propose; the founder decides.

---

## Technology

| Layer | Choice |
|-------|--------|
| Reasoning | **Gemini** via **Vertex AI** (us-central1) |
| Agent orchestration | **Agent Development Kit (ADK)** |
| Multi-agent communication | **Agent-to-Agent (A2A) protocol** |
| Tool boundary | **Model Context Protocol (MCP)** — via **FastMCP** |
| External tool servers | **Google Workspace MCPs** (Gmail, Calendar, Drive) |
| Runtime | **Cloud Run** (multi-service) |
| Persistence | **Cloud SQL Postgres** + **Drizzle ORM** |
| Frontend | React, Vite, shadcn/ui, Tailwind |
| Backend | Express, TypeScript |
| Verification primitive | SHA-256 hash-sealed ledger entries |

---

## Repository structure

```
pow-ledger/
├── client/              React frontend (shadcn/ui, dark theme)
├── server/              Express backend + ledger API + verification logic
├── shared/              Drizzle schema (artifacts, proof units, ledger entries)
├── mcp-server/          FastMCP server exposing ledger API as MCP tools
├── agents/
│   ├── capture/         Decision Capture Agent (ADK + Vertex AI Gemini)
│   └── verification/    Verification Agent (ADK + Vertex AI Gemini)
├── docs/
│   ├── architecture.svg
│   ├── business-case.md
│   └── demo-script.md
├── drizzle.config.ts
└── package.json
```

---

## How the multi-agent flow works

1. **Operator acts in their workspace.** Sends an email, accepts a calendar invite, writes a doc.
2. **Decision Capture Agent observes via MCP.** Connects to Gmail / Calendar / Drive MCP servers, identifies decision-shaped signals, drafts a proposed ledger entry.
3. **A2A handoff.** Capture sends the proposal to Verification over the A2A protocol — a real protocol boundary, not an internal function call. This mirrors enterprise separation-of-duties.
4. **Verification reasons over the ledger.** Verification calls the POW MCP Server (`list_artifacts`, `get_lineage`, `detect_patterns`) to validate the proposal, check for duplicates, and detect whether this decision is part of a repeating sequence.
5. **Pattern threshold + workflow synthesis.** When a sequence repeats (default: 3 times), Verification synthesizes a reusable workflow artifact and surfaces it to the operator.
6. **Human approval gate.** The operator reviews in the POW Ledger UI. Approval emits a new ledger entry with the contributing `modelId` and `modelVersion` recorded.
7. **Verifiable record.** The new entry is SHA-256 hash-sealed and lineage-linked to the source decisions it was generalized from. Exportable as a Black Box audit artifact the operator owns.

---

## Why multi-agent

Two design pressures shaped the architecture:

**Separation of duties.** A single agent that both captures workspace signals and certifies the ledger creates a structural trust problem — the same system that ingests data also vouches for it. Splitting Capture (proposes) from Verification (validates and writes) mirrors the audit pattern enterprises already trust. The A2A protocol boundary makes this separation explicit and verifiable rather than implicit.

**Enterprise interoperability.** The Verification Agent speaks A2A, which means it can be discovered and addressed by other enterprise agents in the Gemini Enterprise and Google Cloud Marketplace ecosystem. An HR agent capturing hiring decisions, a sales agent capturing pricing decisions, a compliance agent monitoring policy adherence — all of these can flow decisions into POW Ledger as a shared verification substrate. POW becomes the verification layer that other agents trust.

---

## Run locally

**Prerequisites:**
- Node.js 20+
- Python 3.11+ (for the MCP server and agents)
- Postgres 15+ (local or Cloud SQL Proxy)
- Google Cloud project with Vertex AI, Cloud Run, Cloud SQL APIs enabled
- Application Default Credentials configured (`gcloud auth application-default login`)

**Frontend + backend (existing POW Ledger):**

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, SESSION_SECRET
npm run db:push            # apply Drizzle schema
npm run dev                # http://localhost:5000
```

**MCP server:**

```bash
cd mcp-server
pip install -r requirements.txt
python server.py           # default port 8081
```

**Agents:**

```bash
cd agents/verification
pip install -r requirements.txt
python -m verification_agent

cd agents/capture
pip install -r requirements.txt
python -m capture_agent
```

Local development uses A2A over loopback. Production routes A2A through Cloud Run service-to-service authentication.

---

## Deployment

Both agents and the MCP server deploy as separate Cloud Run services. The POW Ledger app is a third Cloud Run service. Cloud SQL Postgres backs the ledger.

```bash
# Deploy POW Ledger app
gcloud run deploy pow-ledger \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi

# Deploy MCP server
gcloud run deploy pow-mcp-server \
  --source ./mcp-server \
  --region us-central1 \
  --no-allow-unauthenticated

# Deploy agents
gcloud run deploy pow-verification-agent \
  --source ./agents/verification \
  --region us-central1 \
  --no-allow-unauthenticated

gcloud run deploy pow-capture-agent \
  --source ./agents/capture \
  --region us-central1 \
  --no-allow-unauthenticated
```

Service-to-service auth uses Cloud Run's native IAM identity tokens. Secrets (database URL, API keys) come from Google Secret Manager.

---

## Track 1 implementation notes

This submission targets **Track 1 · Build (Net-New Agents)**. The Track 1 requirements and where each lives in this repo:

| Requirement | Implementation |
|-------------|----------------|
| Net-new autonomous agent | `agents/capture/` and `agents/verification/` (both built during contest period) |
| Built with ADK | Both agents use the Agent Development Kit for orchestration |
| Gemini-powered | Both agents call Gemini via Vertex AI (not AI Studio) |
| MCP for external tool connection | Verification connects to `mcp-server/` (POW Ledger tools); Capture connects to Google Workspace MCPs |
| Move from static code to declarative intent | Agents reason over ledger state and propose workflows rather than executing predefined logic |
| Multi-agent collaboration | A2A protocol between Capture and Verification |
| Grounding / RAG | Verification agent grounds responses in the operator's own ledger history via MCP |
| Human-in-the-loop governance | Founder approval gate before any verified ledger write |

---

## Business case

See [`docs/business-case.md`](docs/business-case.md) for the full business case: customer segments, pricing, wedge, market sizing, and the platform-extension story via A2A interoperability.

Short version: verifiable decision infrastructure for SMB operators — independent consultancies, fractional executives, compliance-conscious small businesses, and bootstrapped founders — priced from $29/month (solo) to $299/month (compliance tier), with a platform/A2A usage tier for embedding POW Ledger inside other enterprise agents.

---

## License

Source code in this repository: see `LICENSE`.

---

## About

POW Ledger is the operations and verification layer of [TalonSight Technologies](https://talonsight.tech) — a Creative Intelligence Operating System. The multi-agent verification pattern submitted here generalizes across the broader platform.

Built by Jermaine Nelson, Atlanta GA.
