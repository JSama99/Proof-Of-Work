import os
from urllib.parse import urlparse

import google.auth.transport.requests
from google.oauth2 import id_token
from google.auth.exceptions import DefaultCredentialsError
from dotenv import load_dotenv
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPServerParams

from pattern_detection import propose_workflow_tool

load_dotenv()

MCP_URL = os.environ["MCP_URL"]

# Audience for Google-signed ID tokens is the Cloud Run base URL — no path.
# urlparse handles trailing /mcp, /, or no path uniformly.
_parsed = urlparse(MCP_URL)
MCP_AUDIENCE = f"{_parsed.scheme}://{_parsed.netloc}"


def _fetch_mcp_id_token() -> str:
    """Fetch a Google-signed ID token scoped to the MCP server's audience.

    On Vertex AI Agent Engine, ADC resolves to the runtime service account
    via the metadata server and this returns a valid ID token. Locally,
    ADC from `gcloud auth application-default login` is USER credentials,
    which `id_token.fetch_id_token` does not accept (it requires service
    account creds or a metadata server). In that case we return "" so
    `deploy.py`'s `from agent import root_agent` can succeed; agent.py
    is uploaded as an extra_package and re-imported on Vertex AI where
    the real token is minted.

    Known limitation: ID tokens expire after 1 hour. If a runtime container
    stays warm past that window, MCP calls will start returning 401.
    For demo / submission workloads with short-lived invocations this is
    fine. Production hardening would require subclassing McpSessionManager
    to expose httpx's auth callback — see google/adk-python#2759.
    """
    try:
        return id_token.fetch_id_token(
            google.auth.transport.requests.Request(),
            MCP_AUDIENCE,
        )
    except DefaultCredentialsError:
        # Local-dev import only — never executed on Vertex AI.
        return ""


mcp_toolset = McpToolset(
    connection_params=StreamableHTTPServerParams(
        url=MCP_URL,
        headers={"Authorization": f"Bearer {_fetch_mcp_id_token()}"},
    ),
)

INSTRUCTION = """\
You are the POW Ledger Verification Agent. You verify provenance entries and
detect repeating decision patterns that should be promoted into reusable workflows.

WORKFLOW:
1. When asked about an artifact, call get_lineage to fetch its decision chain.
2. For each entry in the chain, call verify_entry to confirm cryptographic integrity.
3. After verification, ALWAYS call propose_workflow on the full decision list.
4. If propose_workflow returns proposed=true, surface the template to the user
   with: pattern length, number of occurrences, suggested name, and steps.
   Frame it as a PROPOSAL requiring human approval — never as an executed action.
5. If integrity verification fails on any entry, stop and report the failure
   prominently. Do not propose workflows from a corrupted chain.

Be concise. Use bullet points for verification results. Always cite entry IDs.
"""

root_agent = LlmAgent(
    name="verification_agent",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[mcp_toolset, propose_workflow_tool],
)
