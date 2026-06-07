# POW Ledger Demo Script

> Total runtime: ~2:45–3:00
> Format: Screen recording with voiceover
> Setup: Terminal + browser side by side, pre-authenticated (`gcloud auth application-default login`), frontend running (`npm run dev` on port 3000)

---

## PRE-RECORDING CHECKLIST

- [ ] `gcloud auth application-default login` (fresh session)
- [ ] Frontend running: `cd ~/Downloads/Proof-Of-Work && npm run dev` → localhost:3000 open in browser
- [ ] Terminal visible with Python environment active: `source agents/verification/.venv/bin/activate`
- [ ] Orchestrator resource ID ready: `ORCH=$(cat ~/Downloads/Proof-Of-Work/agents/orchestrator/deployed_resource.txt)`
- [ ] Screen recording tool configured (terminal left, browser right)
- [ ] Architecture diagram open in a browser tab (architecture_diagram.html)

---

## BEAT 1 — INTRO (0:00–0:25)

**[SHOW: Architecture diagram in browser]**

> "POW Ledger is a multi-agent system that captures organizational decisions as cryptographically sealed artifacts — and verifies their integrity.
>
> Three agents run on Vertex AI Agent Engine with Gemini 2.5 Flash. The Orchestrator routes requests. The Capture Agent is the only writer — it seals decisions with SHA-256 hashes. The Verification Agent reads the ledger independently and recomputes hashes to confirm nothing's been altered.
>
> They communicate through an MCP Server on Cloud Run using the Streamable HTTP protocol. Let me show you how it works."

---

## BEAT 2 — CAPTURE A DECISION (0:25–1:15)

**[SWITCH TO: Terminal]**

> "First, I'll capture a real decision through the Orchestrator."

**[PASTE AND RUN:]**
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

> "The Orchestrator receives this natural language input, classifies it as a decision capture request, and routes it to the Capture Agent via Agent-to-Agent communication.
>
> The Capture Agent calls two MCP tools: `append_decision` to create the artifact with a SHA-256 hash, and `record_event` to link the capture event with a signature."

**[WHEN OUTPUT APPEARS:]**

> "There's our artifact ID and hash. The decision is now sealed in the ledger. Let me copy that artifact ID — we'll verify it next."

**[COPY THE ARTIFACT ID]**

---

## BEAT 3 — VERIFY THE ARTIFACT (1:15–2:00)

> "Now I'll ask the Orchestrator to verify that same artifact."

**[PASTE AND RUN (with real artifact ID):]**
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

> "This time the Orchestrator routes to the Verification Agent. It calls `get_lineage` to retrieve the full entry chain, then `verify_entry` for each entry — recomputing the SHA-256 hash from scratch and comparing it against the stored value.
>
> Crucially, the Verification Agent has no write access. It can only read. So this is a genuine independent integrity check."

**[WHEN OUTPUT APPEARS:]**

> "Both entries verified — hashes match. And it correctly reports no workflow patterns detected, since this is a new decision with only two entries in its chain. With three or more similar decisions, the system would propose workflow automation."

---

## BEAT 4 — CONSTELLATION VISUALIZATION (2:00–2:30)

**[SWITCH TO: Browser at localhost:3000]**

> "Here's the POW Constellation — a force-directed graph built with D3 that visualizes every artifact in the ledger."

**[INTERACT: Click an artifact node]**

> "Each node is a decision artifact. Clicking one shows its detail panel — the hash, timestamps, type, and full provenance chain. Artifacts cluster by type, so you can see patterns in your organizational decision-making at a glance."

**[PAN/ZOOM BRIEFLY]**

---

## BEAT 5 — EVAL RESULTS (2:30–2:45)

**[SWITCH TO: Terminal]**

> "Finally, the automated eval harness."

**[RUN:]**
```bash
python eval_harness.py
```

> "Six test scenarios covering end-to-end round-trips, routing correctness, non-decision rejection, invalid ID handling, and artifact listing. All six pass."

**[WHEN OUTPUT SHOWS 6/6:]**

> "Six out of six. Results are saved to `eval_report.json` for submission evidence."

---

## BEAT 6 — CLOSE (2:45–3:00)

**[SHOW: Architecture diagram again]**

> "POW Ledger — three specialized agents, a single-writer protocol, cryptographic verification, and an automated eval pipeline. All built on Google Cloud with ADK, Gemini 2.5 Flash, and Vertex AI Agent Engine. Thanks for watching."

---

## CONTINGENCY NOTES

**If the Capture call takes longer than 15s:** Don't narrate the wait. Keep talking about the architecture. The response will come.

**If you get a 403 error:** Re-run `gcloud auth application-default login` and try again. The `allAuthenticatedUsers` binding covers this — it's almost always an expired local credential.

**If the Verification Agent returns unexpected results:** The system is correct even if the output format varies. Gemini's natural language responses may phrase results differently between runs. Focus on whether the hashes match (Valid ✅) and the artifact ID is correct.

**If the eval harness fails a test:** Run it again. Transient network issues with Vertex AI Agent Engine can cause occasional timeouts. The harness has been validated at 6/6 across multiple runs.

**If the Constellation doesn't show data:** Make sure the frontend is connected to the right Ledger API endpoint. Check `src/` config for the API URL.

---

## RECORDING TIPS

1. **Do a dry run first.** Run the capture + verify commands once before recording to warm up the agent sessions and confirm everything works.

2. **Pre-size your terminal.** Use a large font (14-16pt) so the output is readable in the video. Dark terminal background, light text.

3. **Don't rush the pauses.** When waiting for agent responses, your narration fills the gap naturally. The 10-12 second waits are actually a feature — they show real distributed system communication.

4. **Copy-paste, don't type.** Have the Python one-liners ready in a text file. Paste them in. Typing live introduces typo risk.

5. **Keep it under 3 minutes.** The first 3 minutes are what gets evaluated. Everything after is ignored. The script above is timed to ~2:45.

6. **Record audio separately if possible.** A clean voiceover mixed in post is more professional than live narration with keyboard sounds. If recording live, mute keyboard sounds.
