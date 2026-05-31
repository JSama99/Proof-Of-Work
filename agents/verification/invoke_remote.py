from vertexai import agent_engines
import vertexai
import os
from dotenv import load_dotenv

load_dotenv()

vertexai.init(
    project=os.environ["GOOGLE_CLOUD_PROJECT"],
    location=os.environ["GOOGLE_CLOUD_LOCATION"],
)

# Read the resource name saved by deploy.py
with open("deployed_resource.txt") as f:
    resource_name = f.read().strip()

print(f"Connecting to: {resource_name}\n")
remote = agent_engines.get(resource_name)

prompt = (
    "List all artifacts in the ledger. For the first one, get its lineage, "
    "verify each entry, and check for repeating decision patterns. "
    "If a workflow is proposed, present it for my approval."
)

print(f"PROMPT: {prompt}\n")
print("=" * 60)

events = []
for event in remote.stream_query(user_id="day3-demo", message=prompt):
    print(event)
    events.append(event)

# Save the full trace for Day 6's demo video
import json
with open("traces/day3_baseline.json", "w") as f:
    json.dump(events, f, indent=2, default=str)

print(f"\n✅ Captured {len(events)} events to traces/day3_baseline.json")
