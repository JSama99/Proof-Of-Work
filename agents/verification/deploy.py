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

print("Wrapping agent in AdkApp...")
app = AdkApp(agent=root_agent, enable_tracing=True)

print("Creating remote Agent Engine deployment (this takes 5-10 min)...")
remote = agent_engines.create(
    agent_engine=app,
    display_name="pow-verification-agent",
    description="Verifies POW Ledger entries and proposes workflows from repeating decisions.",
    requirements=[
        "google-cloud-aiplatform[adk,agent_engines]>=1.95.0",
        "google-adk>=1.0.0",
        "mcp>=1.0.0",
        "python-dotenv",
        "pyjwt",
    ],
    extra_packages=["./pattern_detection.py", "./agent.py"],
    env_vars={
        "MCP_URL": os.environ["MCP_URL"],
        "MCP_TOKEN": os.environ["MCP_TOKEN"],
    },
)

print(f"\n✅ Deployed!")
print(f"Resource name: {remote.resource_name}")
print(f"\nSave this resource name — you'll need it for invocation.")

# Persist to disk so you don't lose it
with open("deployed_resource.txt", "w") as f:
    f.write(remote.resource_name)
