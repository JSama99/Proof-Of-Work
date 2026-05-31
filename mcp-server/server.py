"""POW Ledger MCP Server — exposes ledger API as MCP tools."""
import base64
import hashlib
import hmac
import json
import os
import time

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


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=PORT)
