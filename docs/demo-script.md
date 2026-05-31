# POW Ledger Verification System — Demo Script (1:45)

**Submission track:** Track 1 (Build · Net-New Agents)
**Tagline:** Two collaborating agents turn a founder's scattered workspace decisions into cryptographically verifiable, reusable workflows.
**Hard runtime ceiling:** 2:00 (only the first 2 minutes are evaluated).
**Target:** 1:45 with a 15-second buffer.
**Demo environment:** Live Cloud Run URL, judge login provisioned, seeded founder account with 3 weeks of decision history.

---

## Pre-Recording Setup

Seed the founder account so the agents have real signal to reason over. Across three weeks, the founder has done the **same decision sequence three times** — pipeline review email → vendor spend Slack message → calendar event titled "decision: vendor approval" → Drive doc with rationale. Pre-seed the first two occurrences. Leave the third occurrence's final Drive doc unwritten, so when you trigger the demo live, the Capture Agent picks it up in real time.

---

## The Cut (1:45 target)

**[0:00–0:12] Problem.**
"Founders make dozens of consequential decisions a week across email, calendar, and chat — and almost none of it ends up as a verifiable, reusable record. We built two agents that fix that." Cut to live app.

**[0:12–0:35] Capture Agent in action.**
Show the founder's Gmail (open via the Workspace MCP connection). The Capture Agent picks up the latest decision-shaped email — vendor approval thread. Cut to the agent's reasoning panel: "Detected decision event in Gmail. Drafted ledger entry. Sending to Verification Agent over A2A." Visual: the A2A handoff is animated in the agent panel so judges *see* the protocol fire.

**[0:35–1:00] Verification Agent reasoning.**
The Verification Agent receives the proposal, queries the POW Ledger via MCP, and reasons over the founder's history. Show the agent's chain of thought condensed: "This is the third occurrence of the sequence [pipeline review → vendor decision → rationale doc]. Pattern threshold met. Proposing reusable 'Vendor Approval Workflow' artifact." This is the **hero moment** — visible multi-agent reasoning grounded in real ledger data.

**[1:00–1:20] Founder approval.**
The Verification Agent's proposal surfaces in the POW Ledger UI. Founder reviews the proposed workflow (clear step list) and clicks **Approve**. Key line: "Two agents collaborate, but nothing enters the verified record without human approval. The agents propose. The founder decides."

**[1:20–1:40] Payoff — verification, lineage, export.**
The approved workflow is now a ledger entry. Click into it: show the SHA-256 hash, the `modelId` and `modelVersion` of both contributing agents, and the lineage chain back to the three source decisions the workflow was generalized from. Hit **Black Box export** — a sealed, integrity-hashed audit artifact the founder owns.

**[1:40–1:45] Close.**
"Verifiable decision infrastructure for the modern operator. Two agents, one ledger, every decision provable."

---

## Beat-to-Rubric Mapping

- **Capture Agent + Workspace MCPs** → Track 1's "MCP to securely connect to external tools" requirement, made visible
- **A2A handoff animated** → Multi-agent collaboration the judges are explicitly looking for
- **Verification Agent reasoning over ledger** → Grounding in real data (the rubric's RAG/grounding emphasis)
- **Founder approval** → Human-in-the-loop governance
- **Hash + lineage + Black Box** → Production reliability, artifact lifecycle, audit infrastructure
- **modelId / modelVersion logged** → Agent provenance, auditability

---

## Hard Guardrails

- **Hit 1:45 exactly.** Anything over 2:00 is invisible to judges. Rehearse with a stopwatch.
- **Never say** blockchain, token, crypto, web3, mint, or wallet — even casually. Use verifiable, tamper-evident, audit trail, provenance.
- **Show the A2A protocol firing.** It's the multi-agent moment that distinguishes this submission. If it's not visually obvious, the multi-agent advantage evaporates.
- **No platform vision.** Don't mention TalonSight, PCOMJR, or other terminals in the video. One product, one demo, one minute forty-five.
- **Record a backup take.** Live demos break. Have the recorded version ready to submit as the actual video.

---

## Pre-Day-6 Checklist

- [ ] Seeded founder account with 3 weeks of decision data, third occurrence left incomplete
- [ ] Capture Agent reliably picks up the staged Gmail thread within 5 seconds of trigger
- [ ] Verification Agent's reasoning panel is human-readable (not raw JSON dump)
- [ ] A2A handoff is visually represented in the UI (animation, status indicator, or trace view)
- [ ] modelId / modelVersion are visible in the ledger entry detail view
- [ ] Black Box export button works end-to-end
- [ ] Judge login provisioned on Cloud Run deployment with sample data
