import os
import json
from urllib.parse import urlparse

import google.auth.transport.requests
from google.oauth2 import id_token
from google.auth.exceptions import DefaultCredentialsError
from dotenv import load_dotenv
from google.adk.agents import LlmAgent

from pattern_detection import propose_workflow_tool

import requests as http_requests

load_dotenv()

MCP_URL = os.environ["MCP_URL"]

# Audience for Google-signed ID tokens is the Cloud Run base URL — no path.
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

    Known limitation: ID tokens expire after 1 hour. The wrapper functions
    below fetch a fresh token on each call, so this is no longer a problem.
    """
    try:
        return id_token.fetch_id_token(
            google.auth.transport.requests.Request(),
            MCP_AUDIENCE,
        )
    except DefaultCredentialsError:
        # Local-dev import only — never executed on Vertex AI.
        return ""


# ── MCP direct-call wrapper ─────────────────────────────────────────
# Bypasses ADK's McpToolset (which fails with TaskGroup errors on
# Vertex AI) and calls the MCP server directly via HTTP using the
# Streamable HTTP protocol: initialize → tools/call.

def _mcp_call(tool_name: str, arguments: dict) -> dict:
    """Call an MCP tool on the POW MCP server via direct HTTP.

    Creates a fresh session per call. Slightly less efficient than a
    persistent session, but completely reliable and avoids the ADK
    McpSessionManager async issues on Vertex AI.
    """
    token = _fetch_mcp_id_token()
    base_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }

    # Step 1: Initialize MCP session
    init_resp = http_requests.post(
        MCP_URL,
        headers=base_headers,
        json={
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "verification-agent", "version": "1.0"},
            },
            "id": 1,
        },
        timeout=30,
    )
    session_id = init_resp.headers.get("Mcp-Session-Id", "")

    if not session_id:
        return {"error": f"MCP initialize failed: no session ID. Status {init_resp.status_code}"}

    # Step 2: Call the tool
    call_headers = {**base_headers, "Mcp-Session-Id": session_id}
    call_resp = http_requests.post(
        MCP_URL,
        headers=call_headers,
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
            "id": 2,
        },
        timeout=60,
    )

    # Parse response — may be SSE (event stream) or plain JSON
    text = call_resp.text
    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                parsed = json.loads(line[6:])
                return parsed.get("result", parsed)
            except json.JSONDecodeError:
                continue

    # Fallback: try parsing as plain JSON
    try:
        parsed = json.loads(text)
        return parsed.get("result", parsed)
    except json.JSONDecodeError:
        return {"error": f"Unparseable MCP response: {text[:500]}"}


# ── Tool wrappers ───────────────────────────────────────────────────
# Each function becomes a tool visible to the LLM via ADK's function-
# tool mechanism. Docstrings and type hints generate the tool schema.

def get_lineage(artifact_id: str) -> dict:
    """Get the full lineage chain for an artifact.

    Returns every ledger entry connected to this artifact — its
    creation, every proof unit added, every state transition,
    and any workflows generalized from it. Each entry is SHA-256
    hash-sealed. Use this to trace how a decision evolved or to
    verify the historical chain before proposing changes.
    """
    return _mcp_call("get_lineage", {"artifact_id": artifact_id})


def verify_entry(entry_id: str) -> dict:
    """Verify the cryptographic integrity of a ledger entry.

    Recomputes the SHA-256 hash for the entry and compares it
    against the stored hash. Returns valid=true if the entry has
    not been tampered with, valid=false if integrity is compromised.
    Use before relying on an entry as evidence in a verification chain.
    """
    return _mcp_call("verify_entry", {"entry_id": entry_id})


def list_artifacts() -> dict:
    """List all artifacts in the POW Ledger.

    Returns the operator's artifacts (decisions, proof units, workflows)
    with type, status, and timestamps. Use this to understand what
    decisions the operator has on file before detecting patterns or
    proposing new workflows.
    """
    return _mcp_call("list_artifacts", {})


# ── Agent ───────────────────────────────────────────────────────────
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
    tools=[get_lineage, verify_entry, list_artifacts, propose_workflow_tool],
)
