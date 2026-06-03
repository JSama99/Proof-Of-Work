"""Deploy POW Operator Agent to Vertex AI Agent Engine.

Run from inside agents/operator/:
    cd agents/operator && python deploy.py

Prerequisites:
- CAPTURE_RESOURCE_NAME and VERIFICATION_RESOURCE_NAME must be set in .env
- Both sub-agents must be deployed and accessible from the Operator's runtime
"""
import os
import vertexai
from vertexai import agent_engines
from vertexai.preview.reasoning_engines import AdkApp
from dotenv import load_dotenv

from agent import root_agent

load_dotenv()

PROJECT_ID = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ["GOOGLE_CLOUD_LOCATION"]
STAGING_BUCKET = f"gs://{PROJECT_ID}-agent-staging"

print(f"Initializing Vertex AI: project={PROJECT_ID}, location={LOCATION}")
vertexai.init(
    project=PROJECT_ID,
    location=LOCATION,
    staging_bucket=STAGING_BUCKET,
)

print("Wrapping operator in AdkApp...")
app = AdkApp(agent=root_agent, enable_tracing=True)

print("Creating remote Agent Engine deployment (this takes 5-10 min)...")
remote = agent_engines.create(
    agent_engine=app,
    display_name="pow-orchestrator-agent",
    description="Orchestrator for the POW Ledger Verification System. Routes user intent to Capture (writes) and Verification (reads) sub-agents via A2A. No direct ledger access.",
    requirements=[
        "google-cloud-aiplatform[adk,agent_engines]>=1.95.0",
        "google-adk>=1.0.0",
        "python-dotenv",
    ],
    extra_packages=["./agent.py"],
    env_vars={
        "CAPTURE_RESOURCE_NAME": os.environ["CAPTURE_RESOURCE_NAME"],
        "VERIFICATION_RESOURCE_NAME": os.environ["VERIFICATION_RESOURCE_NAME"],
    },
)

print(f"\n✅ Deployed!")
print(f"Resource name: {remote.resource_name}")

with open("deployed_resource.txt", "w") as f:
    f.write(remote.resource_name)

print("Resource name saved to deployed_resource.txt")
