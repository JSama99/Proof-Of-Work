"""POW Ledger MCP Server — exposes ledger API as MCP tools."""
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, Optional

import httpx
from fastmcp import FastMCP

POW_LEDGER_URL = os.environ["POW_LEDGER_URL"].rstrip("/")
POW_AUTH_SECRET = os.environ["POW_AUTH_SECRET"]
MCP_USER_ID = os.environ.get("MCP_USER_ID", "mcp-server-agent")
PORT = int(os.environ.get("PORT", 8080))


def sign_token(user_id: str = MCP_USER_ID, ttl_seconds: int = 60 * 60) -> str:
    """Mirror of server/auth.ts signToken — HMAC-SHA256 over base64url payload."""
    now = int(time.time())
    payload = {"sub": user_id, "iat": now, "exp": now + ttl_seconds, "v": 1}
    body = (
        base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
        )
        .rstrip(b"=")
        .decode("ascii")
    )
    sig = hmac.new(
        POW_AUTH_SECRET.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return f"{body}.{sig_b64}"


async def call_ledger(method: str, path: str, **kwargs):
    """Call POW Ledger API with a fresh signed auth token."""
    token = sign_token()
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.request(
            method, f"{POW_LEDGER_URL}{path}", headers=headers, **kwargs
        )
        resp.raise_for_status()
        return resp.json()


mcp = FastMCP("pow-ledger-mcp")


@mcp.tool()
async def list_artifacts() -> dict:
    """List all artifacts in the POW Ledger.

    Returns the operator's artifacts (decisions, proof units, workflows)
    with type, status, and timestamps. The Verification Agent uses this
    to understand what decisions the operator has on file before
    detecting patterns or proposing new workflows.
    """
    artifacts = await call_ledger("GET", "/api/artifacts")
    return {"artifacts": artifacts}


@mcp.tool()
async def get_lineage(artifact_id: str) -> dict:
    """Get the full lineage chain for an artifact.

    Returns every ledger entry connected to this artifact — its
    creation, every proof unit added, every state transition,
    and any workflows generalized from it. Each entry is SHA-256
    hash-sealed. Use this to trace how a decision evolved or to
    verify the historical chain before proposing changes.

    Args:
        artifact_id: The UUID of the artifact to trace.
    """
    lineage = await call_ledger("GET", f"/api/ledger/lineage/{artifact_id}")
    return {"artifact_id": artifact_id, "lineage": lineage}


@mcp.tool()
async def verify_entry(entry_id: str) -> dict:
    """Verify the cryptographic integrity of a ledger entry.

    Recomputes the SHA-256 hash for the entry and compares it
    against the stored hash. Returns valid=true if the entry has
    not been tampered with, valid=false if integrity is compromised.
    Use before relying on an entry as evidence in a verification chain.

    Args:
        entry_id: The UUID of the ledger entry to verify.
    """
    result = await call_ledger("GET", f"/api/ledger/verify/{entry_id}")
    return result


@mcp.tool()
async def append_decision(
    title: str,
    body: str = "",
    artifact_type: str = "journal",
) -> Dict[str, Any]:
    """Create a new decision artifact in the POW Ledger.

    Records the operator's decision as a SHA-256 hash-sealed artifact.
    The Capture Agent uses this when the operator states a decision
    worth preserving. POW Ledger automatically logs an artifact_created
    ledger entry on creation, so this single call produces both the
    entity and its first audit event.

    Args:
        title: Short title for the decision (1-500 chars).
        body: Full context, reasoning, and constraints (max 100000 chars).
        artifact_type: One of: note, sop, checklist, playbook, template,
            workflow, spec, principles, journal, other. Default: journal.
    """
    payload = {"title": title, "type": artifact_type, "body": body}
    artifact = await call_ledger("POST", "/api/artifacts", json=payload)
    return artifact


@mcp.tool()
async def record_event(
    terminal_source: str,
    event_type: str,
    artifact_id: Optional[str] = None,
    artifact_type: Optional[str] = None,
    parent_artifact_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Append an immutable event to the POW Ledger.

    Each call writes a SHA-256 hash-sealed entry. Use to log state
    transitions, decision checkpoints, model usage, or any audit event
    tied to an existing artifact. The ledger is append-only — entries
    cannot be modified after creation.

    Args:
        terminal_source: Which terminal/agent originated the event
            (e.g. "capture-agent", "sonic-genesis", "talon-vision").
        event_type: One of: artifact_created, artifact_revised,
            artifact_approved, prompt_used, model_version_recorded,
            collaborator_contribution, ownership_transfer,
            export_published, deliverable_completed, decision_checkpoint.
        artifact_id: UUID of the artifact this event relates to.
        artifact_type: Type of the artifact (matches artifactTypeEnum).
        parent_artifact_id: UUID of a parent artifact (for lineage).
        metadata: Arbitrary additional context as a JSON object — use for
            modelId, modelVersion, prompt text, or any field not surfaced
            as a named argument.
    """
    payload: Dict[str, Any] = {
        "terminalSource": terminal_source,
        "eventType": event_type,
    }
    if artifact_id:
        payload["artifactId"] = artifact_id
    if artifact_type:
        payload["artifactType"] = artifact_type
    if parent_artifact_id:
        payload["parentArtifactId"] = parent_artifact_id
    if metadata:
        payload["metadata"] = metadata
    result = await call_ledger("POST", "/api/ledger/record", json=payload)
    return result


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=PORT)
