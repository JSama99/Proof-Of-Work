# POW Ledger Demo Script

> Total runtime: 1:45 target · 2:00 hard ceiling (only the first 2 minutes are evaluated)
> Format: Screen recording with voiceover
> Setup: Terminal + browser side by side

---

## PRE-RECORDING CHECKLIST

- [ ] `gcloud auth application-default login` (fresh session)
- [ ] Frontend running: `cd ~/Downloads/Proof-Of-Work && npm run dev` → localhost:3000
- [ ] Terminal ready: `source agents/verification/.venv/bin/activate`
- [ ] Orchestrator ID: `ORCH=$(cat ~/Downloads/Proof-Of-Work/agents/orchestrator/deployed_resource.txt)`
- [ ] Architecture diagram open in a browser tab
- [ ] Dry-run the capture + verify commands once before recording

---

## BEAT 1 — INTRO (0:00–0:12)

**[SHOW: Architecture diagram]**

> "POW Ledger captures organizational decisions as cryptographically sealed artifacts and verifies their integrity. Three agents on Vertex AI Agent Engine — an Orchestrator that routes, a Capture Agent that's the only writer, and a Verification Agent that independently checks hashes. Let me show you."

---

## BEAT 2 — CAPTURE A DECISION (0:12–0:45)

**[SWITCH TO: Terminal. PASTE AND RUN:]**

```bash
python -c "
import vertexai
from vertexai import agent_engines
vertexai.init(project='proof-of-work-497822', location='us-central1')
orch = agent_engines.get('$ORCH')
session = orch.create_session(user_id='demo-user')
for event in orch.stream_query(user_id='demo-user', session_id=session['id'],
    message='Capture this decision: We are standardizing on PCOMJR architecture across all TalonSight terminals for consistent artifact provenance tracking'):
    content = event.get('content', {})
    for part in content.get('parts', []):
        if 'text' in part: print(part['text'])
"
```

**[WHILE WAITING ~10s:]**

> "The Orchestrator classifies this as a capture request and routes to the Capture Agent over A2A. The Capture Agent calls two MCP tools — `append_decision` creates the artifact with a SHA-256 hash, `record_event` links the capture event."

**[WHEN OUTPUT APPEARS:]**

> "Decision sealed. I'll grab that artifact ID and verify it."

**[COPY THE ARTIFACT ID]**

---

## BEAT 3 — VERIFY (0:45–1:10)

**[PASTE AND RUN with real artifact ID:]**

```bash
python -c "
import vertexai
from vertexai import agent_engines
vertexai.init(project='proof-of-work-497822', location='us-central1')
orch = agent_engines.get('$ORCH')
session = orch.create_session(user_id='demo-user')
for event in orch.stream_query(user_id='demo-user', session_id=session['id'],
    message='Verify artifact PASTE_ARTIFACT_ID_HERE'):
    content = event.get('content', {})
    for part in content.get('parts', []):
        if 'text' in part: print(part['text'])
"
```

**[WHILE WAITING ~12s:]**

> "Now the Orchestrator routes to the Verification Agent — which has read-only access. It recomputes every SHA-256 hash from scratch and compares. This is a genuine independent integrity check."

**[WHEN OUTPUT APPEARS:]**

> "Both entries verified, hashes match. The system correctly reports no workflow patterns yet — that triggers after three similar decisions."

---

## BEAT 4 — VISUALIZATION + EVAL (1:10–1:40)

**[SWITCH TO: Browser at localhost:3000]**

> "The ledger dashboard shows every artifact with hashes, timestamps, and provenance."

**[CLICK AN ARTIFACT — show detail panel. Then SWITCH TO: Terminal.]**

> "And the automated eval harness —"

**[RUN:]**

```bash
python eval_harness.py
```

> "Six test scenarios: end-to-end round-trips, routing, non-decision rejection, invalid ID handling, artifact listing."

**[WHEN 6/6 SHOWS:]**

> "Six out of six."

---

## BEAT 5 — CLOSE (1:40–1:45)

**[SHOW: Architecture diagram]**

> "Three agents, single-writer protocol, cryptographic verification — all on Google Cloud with ADK and Gemini. POW Ledger."

---

## CONTINGENCY NOTES

**403 error:** Re-run `gcloud auth application-default login`. Almost always an expired local credential.

**Slow response (>15s):** Keep narrating the architecture. The response will come.

**Eval fails a test:** Re-run. Transient Agent Engine timeouts happen occasionally. The harness is validated at 6/6 across multiple runs.

## HARD GUARDRAILS

- **Hit 1:45.** Anything past 2:00 is invisible to judges. Rehearse with a stopwatch.
- **Never say** blockchain, token, crypto, web3, mint, or wallet. Use: verifiable, tamper-evident, audit trail, provenance.
- **No platform vision.** Don't mention TalonSight, PCOMJR, Echoverse, or other terminals. One product, one demo.
- **Copy-paste commands, don't type.** Zero typo risk.
- **Record a backup take.**
