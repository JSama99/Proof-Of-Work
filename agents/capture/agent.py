"""POW Ledger Capture Agent — direct HTTP MCP wrappers."""

import base64
import json
import os
import traceback
from typing import Optional
from urllib.parse import urlparse

import requests
import google.auth
import google.auth.transport.requests
from google.oauth2 import id_token
from dotenv import load_dotenv
from google.adk.agents import Agent

load_dotenv()

MCP_URL = os.environ["MCP_URL"]
_parsed = urlparse(MCP_URL)
MCP_AUDIENCE = f"{_parsed.scheme}://{_parsed.netloc}"


def _mint_id_token() -> str:
    auth_req = google.auth.transport.requests.Request()
    try:
        return id_token.fetch_id_token(auth_req, MCP_AUDIENCE)
    except Exception:
        pass
    try:
        creds, _ = google.auth.default()
        if hasattr(creds, "with_target_audience"):
            id_creds = creds.with_target_audience(MCP_AUDIENCE)
            id_creds.refresh(auth_req)
            return id_creds.token
    except Exception:
        pass
    try:
        from google.auth import compute_engine
        creds = compute_engine.IDTokenCredentials(
            request=auth_req, target_audience=MCP_AUDIENCE,
            use_metadata_identity_endpoint=True)
        creds.refresh(auth_req)
        return creds.token
    except Exception:
        pass
    return ""


def _extract_mcp_result(result):
    if "content" in result:
        texts = [c["text"] for c in result["content"] if c.get("type") == "text"]
        combined = "\n".join(texts)
        try:
            return json.loads(combined)
        except (json.JSONDecodeError, TypeError):
            return {"result": combined}
    return result


def _call_mcp_tool(tool_name, arguments):
    try:
        token = _mint_id_token()
        if not token:
            return {"error": "NoToken", "message": "All token methods failed"}

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {token}",
        }

        init_resp = requests.post(MCP_URL, json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                       "clientInfo": {"name": "capture-agent", "version": "1.0.0"}}
        }, headers=headers, timeout=30)
        init_resp.raise_for_status()
        session_id = init_resp.headers.get("mcp-session-id")

        call_headers = {**headers}
        if session_id:
            call_headers["mcp-session-id"] = session_id

        call_resp = requests.post(MCP_URL, json={
            "jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments}
        }, headers=call_headers, timeout=30)
        call_resp.raise_for_status()

        ct = call_resp.headers.get("content-type", "")
        if "text/event-stream" in ct:
            for line in call_resp.text.splitlines():
                if line.startswith("data: "):
                    try:
                        parsed = json.loads(line[6:])
                        if "result" in parsed:
                            return _extract_mcp_result(parsed["result"])
                    except json.JSONDecodeError:
                        continue
            return {"error": "No result in SSE", "raw": call_resp.text[:500]}

        body = call_resp.json()
        if "result" in body:
            return _extract_mcp_result(body["result"])
        return body

    except Exception as e:
        return {"error": type(e).__name__, "message": str(e),
                "traceback": traceback.format_exc()}


def append_decision(title: str, body: str, artifact_type: str = "journal") -> dict:
    """Append a new decision to the POW Ledger as a hash-sealed artifact.

    Args:
        title: Concise summary of the decision (under 100 chars).
        body: Full decision statement with context.
        artifact_type: One of journal, spec, playbook, or principles.

    Returns:
        The created artifact record including its ID and hash.
    """
    return _call_mcp_tool("append_decision", {
        "title": title, "body": body, "artifact_type": artifact_type})


def record_event(terminal_source: str, event_type: str, artifact_id: str,
                 metadata: Optional[str] = None) -> dict:
    """Record an event in the POW Ledger linked to an artifact.

    Args:
        terminal_source: Source system (e.g. capture-agent).
        event_type: Type of event (e.g. decision_checkpoint).
        artifact_id: ID of the related artifact.
        metadata: Optional JSON string with extra context.

    Returns:
        The created event record.
    """
    args = {"terminal_source": terminal_source, "event_type": event_type,
            "artifact_id": artifact_id}
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


root_agent = Agent(
    name="capture_agent",
    model="gemini-2.5-flash",
    description="Captures operator decisions and writes them to the POW Ledger as hash-sealed artifacts.",
    instruction=(
        "IMPORTANT: You have access to tools via function calling. "
        "Call them DIRECTLY using the function-calling interface. "
        "NEVER generate Python code. NEVER use print() statements. "
        "NEVER wrap tool calls in code blocks. Simply invoke the tool.\n\n"
        "You are the Capture Agent for the POW Ledger. Your job is to record "
        "operator decisions as immutable, hash-sealed artifacts.\n\n"
        "When the operator states a decision:\n"
        "1. Call append_decision with title, body, and artifact_type\n"
        "2. Call record_event with terminal_source=capture-agent, "
        "event_type=decision_checkpoint, artifact_id from step 1\n"
        "3. Confirm what was captured including the artifact ID.\n\n"
        "You can call list_artifacts to check existing entries.\n"
        "If the input is not a decision, ask for clarification. Be concise."
    ),
    tools=[append_decision, record_event, list_artifacts],
)
