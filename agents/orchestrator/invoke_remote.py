"""Invoke the deployed Operator Agent for end-to-end testing.

Run from inside agents/operator/:
    cd agents/operator && python invoke_remote.py
"""
import json
import os
import vertexai
from vertexai import agent_engines
from dotenv import load_dotenv

load_dotenv()

vertexai.init(
    project=os.environ["GOOGLE_CLOUD_PROJECT"],
    location=os.environ["GOOGLE_CLOUD_LOCATION"],
)

with open("deployed_resource.txt") as f:
    resource_name = f.read().strip()

print(f"Connecting to: {resource_name}\n")
remote = agent_engines.get(resource_name)

# End-to-end test: capture a decision, then verify it in the same turn.
prompt = (
    "Capture a decision: completed end-to-end deployment of the POW Ledger "
    "Verification System on 2026-06-02. Three agents wired across Vertex AI "
    "Agent Engine: Operator (orchestrator), Capture (writer), Verification "
    "(reader). Tag as architecture milestone, artifact_type=spec. "
    "After capturing, verify the new artifact and report the lineage."
)

print(f"PROMPT: {prompt}\n")
print("=" * 60)

events = []
for event in remote.stream_query(user_id="phase4-e2e", message=prompt):
    print(event)
    events.append(event)

os.makedirs("traces", exist_ok=True)
with open("traces/trace_e2e_operator_capture_verification.json", "w") as f:
    json.dump(events, f, indent=2, default=str)

print(f"\n✅ Captured {len(events)} events to traces/trace_e2e_operator_capture_verification.json")
