"""POW Ledger Capture Agent.

Single-writer agent: takes natural-language decision statements from the
operator and records them as hash-sealed artifacts in the POW Ledger.
Restricted to write tools only via tool_filter — enforces the architectural
principle that only Capture can mutate the ledger.
"""
import os
from urllib.parse import urlparse

import google.auth.transport.requests
from google.oauth2 import id_token
from google.auth.exceptions import DefaultCredentialsError
from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.tools.mcp_tool import McpToolset, StreamableHTTPConnectionParams

load_dotenv()

MCP_URL = os.environ["MCP_URL"]
_parsed = urlparse(MCP_URL)
MCP_AUDIENCE = f"{_parsed.scheme}://{_parsed.netloc}"


def _fetch_mcp_id_token() -> str:
    """Fetch a Google-signed ID token for the MCP server.

    Succeeds on Vertex AI Agent Engine (metadata server present).
    Falls back to "" locally so deploy.py can import this module;
    agent.py is re-imported on Vertex AI where the real token is minted.
    """
    try:
        return id_token.fetch_id_token(
            google.auth.transport.requests.Request(),
            MCP_AUDIENCE,
        )
    except DefaultCredentialsError:
        return ""


mcp_toolset = McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url=MCP_URL,
        headers={"Authorization": f"Bearer {_fetch_mcp_id_token()}"},
    ),
    tool_filter=["append_decision", "record_event"],
)

root_agent = Agent(
    name="capture_agent",
    model="gemini-2.5-flash",
    description=(
        "Captures operator decisions and writes them to the POW Ledger "
        "as hash-sealed artifacts. Sole writer in the system."
    ),
    instruction=(
        "You are the Capture Agent for the POW Ledger. Your job is to record "
        "operator decisions as immutable, hash-sealed artifacts.\n\n"
        "When the operator states a decision (e.g., 'I decided to ship v2 "
        "next Tuesday', 'We're going with Postgres over Mongo', 'Going to "
        "hire two more engineers this quarter'), you:\n\n"
        "1. Call append_decision with:\n"
        "   - title: a concise summary of the decision (under 100 chars)\n"
        "   - body: the operator's full statement plus any context\n"
        "   - artifact_type: 'journal' for general decisions, 'spec' for "
        "technical decisions, 'playbook' for repeatable processes, "
        "'principles' for value/policy decisions\n\n"
        "2. Then call record_event with:\n"
        "   - terminal_source: 'capture-agent'\n"
        "   - event_type: 'decision_checkpoint'\n"
        "   - artifact_id: the ID returned from step 1 (found at "
        "result['artifact']['id'])\n"
        "   - metadata: reasoning, stakeholders, deadlines if mentioned\n\n"
        "3. Confirm to the operator what was captured, including the "
        "artifact ID.\n\n"
        "If the operator's input is a question, casual conversation, or not "
        "actually a decision, ask for clarification — do NOT fabricate "
        "artifacts. Be concise. The operator values their time."
    ),
    tools=[mcp_toolset],
)
