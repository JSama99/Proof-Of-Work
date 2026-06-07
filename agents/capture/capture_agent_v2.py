"""POW Ledger Capture Agent.

Single-writer agent: takes natural-language decision statements from the
operator and records them as hash-sealed artifacts in the POW Ledger.

Uses direct HTTP wrappers to call the MCP server — bypasses the McpToolset
TaskGroup crash on Vertex AI Agent Engine.  Each call mints a fresh ID token,
fixing the 1-hour expiry that hit the old approach.
"""

import json
import os
from typing import Optional
from urllib.parse import urlparse

import requests
import google.auth.transport.requests
from google.oauth2 import id_token
from google.auth.exceptions import DefaultCredentialsError
from dotenv import load_dotenv
from google.adk.agents import LlmAgent

load_dotenv()

MCP_URL = os.environ["MCP_URL"]
_parsed = urlparse(MCP_URL)
MCP_AUDIENCE = f"{_parsed.scheme}://{_parsed.netloc}"


# ──────────────────────────────────────────────────────────────
# MCP plumbing — direct Streamable HTTP, no McpToolset
# ──────────────────────────────────────────────────────────────

def _mint_id_token() -> str:
    """Mint a fresh Google-signed ID token for the MCP server.

    Succeeds on Vertex AI Agent Engine (metadata server present).
    Returns empty string locally so deploy.py can import the module.
    """
    try:
        return id_token.fetch_id_token(
            google.auth.transport.requests.Request(),
            MCP_AUDIENCE,
        )
    except DefaultCredentialsError:
        return ""


def _extract_mcp_result(result: dict) -> dict:
    """Pull text from MCP content array, attempt JSON parse."""
    if "content" in result:
        texts = [
            c["text"]
            for c in result["content"]
            if c.get("type") == "text"
        ]
        combined = "\n".join(texts)
        try:
            return json.loads(combined)
        except (json.JSONDecodeError, TypeError):
            return {"result": combined}
    return result


def _call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """Call an MCP tool via Streamable HTTP with a fresh token.

    Protocol:
      1. POST initialize  → extract mcp-session-id from response header
      2. POST tools/call   → parse JSON or SSE response for the result
    """
    token = _mint_id_token()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    # --- Step 1: Initialize MCP session --------------------------------
    init_resp = requests.post(
        MCP_URL,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "capture-agent", "version": "1.0.0"},
            },
        },
        headers=headers,
        timeout=30,
    )
    init_resp.raise_for_status()
    session_id = init_resp.headers.get("mcp-session-id")

    # --- Step 2: Call the tool -----------------------------------------
    call_headers = {**headers}
    if session_id:
        call_headers["mcp-session-id"] = session_id

    call_resp = requests.post(
        MCP_URL,
        json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        },
        headers=call_headers,
        timeout=30,
    )
    call_resp.raise_for_status()

    # --- Step 3: Parse response (JSON or SSE) --------------------------
    content_type = call_resp.headers.get("content-type", "")

    if "text/event-stream" in content_type:
        for line in call_resp.text.splitlines():
            if line.startswith("data: "):
                try:
                    parsed = json.loads(line[6:])
                    if "result" in parsed:
                        return _extract_mcp_result(parsed["result"])
                except json.JSONDecodeError:
                    continue
        return {"error": "No result in SSE stream", "raw": call_resp.text[:500]}

    # Direct JSON
    body = call_resp.json()
    if "result" in body:
        return _extract_mcp_result(body["result"])
    return body


# ──────────────────────────────────────────────────────────────
# ADK Tool wrappers — plain functions, no McpToolset
# ──────────────────────────────────────────────────────────────

def append_decision(title: str, body: str, artifact_type: str = "journal") -> dict:
    """Append a new decision to the POW Ledger as a hash-sealed artifact.

    Args:
        title: Concise summary of the decision (under 100 chars).
        body: Full decision statement with context.
        artifact_type: One of 'journal', 'spec', 'playbook', or 'principles'.

    Returns:
        The created artifact record including its ID and hash.
    """
    return _call_mcp_tool("append_decision", {
        "title": title,
        "body": body,
        "artifact_type": artifact_type,
    })


def record_event(
    terminal_source: str,
    event_type: str,
    artifact_id: str,
    metadata: Optional[str] = None,
) -> dict:
    """Record an event in the POW Ledger linked to an artifact.

    Args:
        terminal_source: Source system (e.g. 'capture-agent').
        event_type: Type of event (e.g. 'decision_checkpoint').
        artifact_id: ID of the related artifact.
        metadata: Optional JSON string with extra context
                  (reasoning, stakeholders, deadlines).

    Returns:
        The created event record.
    """
    args = {
        "terminal_source": terminal_source,
        "event_type": event_type,
        "artifact_id": artifact_id,
    }
    if metadata:
        if isinstance(metadata, str):
            try:
                args["metadata"] = json.loads(metadata)
            except json.JSONDecodeError:
                args["metadata"] = {"raw": metadata}
        else:
            args["metadata"] = metadata
    return _call_mcp_tool("record_event", args)


def list_artifacts() -> dict:
    """List all artifacts currently in the POW Ledger.

    Returns:
        Artifact summaries with IDs, titles, and types.
    """
    return _call_mcp_tool("list_artifacts", {})


# ──────────────────────────────────────────────────────────────
# Agent definition
# ──────────────────────────────────────────────────────────────

root_agent = LlmAgent(
    name="capture_agent",
    model="gemini-2.5-flash",
    description=(
        "Captures operator decisions and writes them to the POW Ledger "
        "as hash-sealed artifacts. Sole writer in the system."
    ),
    instruction=(
        "IMPORTANT: You have access to tools via function calling. "
        "Call them DIRECTLY using the function-calling interface. "
        "NEVER generate Python code. NEVER use print() statements. "
        "NEVER wrap tool calls in code blocks. Simply invoke the tool.\n\n"
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
        "   - metadata: JSON string with reasoning, stakeholders, "
        "deadlines if mentioned\n\n"
        "3. Confirm to the operator what was captured, including the "
        "artifact ID.\n\n"
        "You can also call list_artifacts to see what is already in the "
        "ledger before adding new entries.\n\n"
        "If the operator's input is a question, casual conversation, or not "
        "actually a decision, ask for clarification — do NOT fabricate "
        "artifacts. Be concise. The operator values their time."
    ),
    tools=[append_decision, record_event, list_artifacts],
)
