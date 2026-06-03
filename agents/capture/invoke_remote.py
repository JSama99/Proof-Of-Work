"""Invoke the deployed Capture Agent and capture the event trace.

Run from inside agents/capture/:
    cd agents/capture && python invoke_remote.py
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

prompt = (
    "Capture a decision: POW Capture Agent successfully deployed to Vertex AI "
    "Agent Engine on 2026-06-02 for the Google AI Agents Challenge Track 1 "
    "submission. This confirms env-var propagation and end-to-end real tool "
    "calls from the deployed reasoning engine. Tag as deployment milestone, "
    "artifact_type=spec."
)

print(f"PROMPT: {prompt}\n")
print("=" * 60)

events = []
for event in remote.stream_query(user_id="phase2-deploy-verify", message=prompt):
    print(event)
    events.append(event)

os.makedirs("traces", exist_ok=True)
with open("traces/trace_04_remote_deploy_verification.json", "w") as f:
    json.dump(events, f, indent=2, default=str)

print(f"\n✅ Captured {len(events)} events to traces/trace_04_remote_deploy_verification.json")
print("\nNext: pull the artifact_id from above, then verify it's real with:")
print("  adk run agents/verification   → 'verify artifact <id>'")
