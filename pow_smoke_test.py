#!/usr/bin/env python3
"""
POW Ledger E2E Smoke Test — Day 6 (REST + ADK class_method)
============================================================
ADK agents on Vertex AI Agent Engine don't expose a default `query` method.
They use: create_session → stream_query. This script calls the correct
class_method endpoints.

Usage:
  python pow_smoke_test.py                  # full suite
  python pow_smoke_test.py --direct-only    # bypass Orchestrator
  python pow_smoke_test.py --orchestrator-only
"""

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import google.auth
import google.auth.transport.requests
import requests as req

# ── Config ──────────────────────────────────────────────────────────
PROJECT_NUMBER = "878967828995"
PROJECT_ID = "proof-of-work-497822"
LOCATION = "us-central1"

ENGINE_IDS = {
    "Orchestrator": "6569479171624402944",
    "Capture":      "7231508316847865856",
    "Verification": "7742666874554417152",
}

API_BASE = f"https://{LOCATION}-aiplatform.googleapis.com/v1beta1"
MCP_SERVER = f"pow-mcp-server-{PROJECT_NUMBER}.{LOCATION}.run.app"

# ── Display ─────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"
B = "\033[1m";  D = "\033[2m";  X = "\033[0m"

def banner(text):
    print(f"\n{B}{C}{'─'*60}\n  {text}\n{'─'*60}{X}\n")

def log_pass(name, detail=""):
    print(f"  {G}✓{X} {name}")
    if detail: print(f"    {D}{detail}{X}")

def log_fail(name, detail=""):
    print(f"  {R}✗{X} {name}")
    if detail: print(f"    {detail}")

def log_warn(name, detail=""):
    print(f"  {Y}⚠{X} {name}")
    if detail: print(f"    {D}{detail}{X}")

def log_info(text):
    print(f"    {D}{text}{X}")


# ── Auth ────────────────────────────────────────────────────────────
def get_access_token() -> str:
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(google.auth.transport.requests.Request())
    return credentials.token


# ── Engine Client ───────────────────────────────────────────────────
def engine_resource(engine_id: str) -> str:
    return (
        f"projects/{PROJECT_NUMBER}/locations/{LOCATION}"
        f"/reasoningEngines/{engine_id}"
    )

def engine_url(engine_id: str) -> str:
    return f"{API_BASE}/{engine_resource(engine_id)}"

def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def check_engine_exists(engine_id: str, token: str) -> tuple[bool, str]:
    resp = req.get(engine_url(engine_id), headers=headers(token), timeout=30)
    if resp.status_code == 200:
        return True, resp.json().get("displayName", "(no name)")
    return False, f"HTTP {resp.status_code}: {resp.text[:150]}"


def discover_methods(engine_id: str, token: str) -> list[str]:
    """Call :query with no class_method to get the error listing available methods."""
    url = f"{engine_url(engine_id)}:query"
    resp = req.post(url, json={"input": {}}, headers=headers(token), timeout=30)
    if resp.status_code == 400:
        text = resp.text
        # Parse method list from error: "Available methods are: ['method1', 'method2', ...]"
        m = re.search(r"Available methods are: \[([^\]]+)\]", text)
        if m:
            methods = [s.strip().strip("'\"") for s in m.group(1).split(",")]
            return methods
    return []


def create_session(engine_id: str, token: str, user_id: str) -> tuple[Optional[str], int, Any]:
    """Create a session on the agent. Returns (session_id, status_code, response)."""
    url = f"{engine_url(engine_id)}:query"
    payload = {
        "class_method": "create_session",
        "input": {"user_id": user_id},
    }

    resp = req.post(url, json=payload, headers=headers(token), timeout=60)
    body = resp.json() if resp.status_code == 200 else {"error": resp.text[:500]}

    session_id = None
    if resp.status_code == 200:
        # Session ID might be in the response at various paths
        body_str = json.dumps(body, default=str)
        # Look for session ID — could be in "output", "id", "session_id", etc.
        # ADK typically returns the session object with an "id" field
        if isinstance(body, dict):
            output = body.get("output", body)
            if isinstance(output, str):
                try:
                    output = json.loads(output)
                except (json.JSONDecodeError, TypeError):
                    pass
            if isinstance(output, dict):
                session_id = output.get("id") or output.get("session_id") or output.get("name")

        # Fallback: regex for session-like ID
        if not session_id:
            m = re.search(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', body_str)
            if m:
                session_id = m.group(0)

    return session_id, resp.status_code, body


def stream_query(engine_id: str, token: str, user_id: str,
                 session_id: str, message: str) -> tuple[Any, float, int]:
    """Send a message via stream_query. Collects streamed response."""
    url = f"{engine_url(engine_id)}:streamQuery"
    payload = {
        "class_method": "stream_query",
        "input": {
            "user_id": user_id,
            "session_id": session_id,
            "message": message,
        },
    }

    start = time.time()
    resp = req.post(url, json=payload, headers=headers(token), timeout=120, stream=True)
    
    # Collect streamed response
    chunks = []
    for line in resp.iter_lines(decode_unicode=True):
        if line:
            chunks.append(line)

    elapsed = time.time() - start

    # Parse collected response
    # Streaming responses are typically newline-delimited JSON
    events = []
    final_text = []
    for chunk in chunks:
        try:
            parsed = json.loads(chunk)
            events.append(parsed)
            # Extract text content from various ADK event shapes
            if isinstance(parsed, dict):
                # Check common ADK event structures
                content = parsed.get("content", {})
                if isinstance(content, dict):
                    parts = content.get("parts", [])
                    for part in parts:
                        if isinstance(part, dict) and "text" in part:
                            final_text.append(part["text"])
                # Direct text field
                if "text" in parsed:
                    final_text.append(parsed["text"])
                # Output field
                if "output" in parsed:
                    out = parsed["output"]
                    if isinstance(out, str):
                        final_text.append(out)
        except json.JSONDecodeError:
            # Might be SSE format: "data: {...}"
            if chunk.startswith("data: "):
                try:
                    parsed = json.loads(chunk[6:])
                    events.append(parsed)
                except json.JSONDecodeError:
                    pass
            chunks_raw = chunk  # keep raw for debugging

    result = {
        "events": events,
        "text": "\n".join(final_text) if final_text else None,
        "raw_chunks": len(chunks),
        "status_code": resp.status_code,
    }

    return result, elapsed, resp.status_code


# ── Helpers ─────────────────────────────────────────────────────────
def truncate(obj, limit=500):
    s = json.dumps(obj, indent=2, default=str) if isinstance(obj, (dict, list)) else str(obj)
    return s[:limit] + f"... ({len(s)} chars)" if len(s) > limit else s

def extract_artifact_id(response) -> Optional[str]:
    resp_str = json.dumps(response, default=str) if isinstance(response, (dict, list)) else str(response)
    for pattern in [
        r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
        r'art_[a-zA-Z0-9_-]+',
        r'pow_[a-zA-Z0-9_-]+',
    ]:
        m = re.search(pattern, resp_str)
        if m:
            return m.group(0)
    return None

def classify_http(status_code):
    if status_code in (401, 403): return "AUTH"
    if status_code == 404: return "NOT_FOUND"
    if status_code == 429: return "RATE_LIMIT"
    if status_code >= 500: return "SERVER_ERROR"
    if status_code == 200: return "OK"
    return f"HTTP_{status_code}"


# ── Test Suite ──────────────────────────────────────────────────────
@dataclass
class TestResult:
    name: str
    passed: bool
    detail: str = ""
    artifact_id: Optional[str] = None
    elapsed: float = 0.0

@dataclass
class TestSuite:
    results: list = field(default_factory=list)
    def record(self, r):
        self.results.append(r)
        (log_pass if r.passed else log_fail)(r.name, r.detail)
    @property
    def passed(self): return sum(1 for r in self.results if r.passed)
    @property
    def failed(self): return sum(1 for r in self.results if not r.passed)
    @property
    def total(self): return len(self.results)


# ── Tests ───────────────────────────────────────────────────────────
def test_auth(suite):
    banner("TEST 0 · Authentication & Connectivity")
    try:
        token = get_access_token()
        suite.record(TestResult("Access token acquired", True, f"token: {token[:20]}..."))
        return token
    except Exception as e:
        suite.record(TestResult("Access token", False, str(e)[:200]))
        return None


def test_connectivity(suite, token):
    reachable = {}
    for name, eid in ENGINE_IDS.items():
        exists, detail = check_engine_exists(eid, token)
        if exists:
            suite.record(TestResult(f"{name} exists", True, f"'{detail}' (id: {eid})"))
            reachable[name] = eid
        else:
            suite.record(TestResult(f"{name} exists", False, detail))
    return reachable


def test_discover_methods(suite, token, engines):
    """Discover available methods on each engine."""
    banner("TEST 0b · Discover Agent Methods")
    engine_methods = {}
    for name, eid in engines.items():
        methods = discover_methods(eid, token)
        if methods:
            engine_methods[name] = methods
            suite.record(TestResult(
                f"{name} methods",
                True,
                ", ".join(methods),
            ))
        else:
            suite.record(TestResult(f"{name} methods", False, "Could not discover methods"))
    return engine_methods


def test_agent_flow(suite, token, engine_name, engine_id, message, test_label):
    """Run the full create_session → stream_query flow against one engine."""
    user_id = "smoke-test"

    # Step 1: Create session
    log_info(f"Creating session on {engine_name}...")
    session_id, status, resp = create_session(engine_id, token, user_id)

    if status != 200 or not session_id:
        err = classify_http(status)
        suite.record(TestResult(
            f"{test_label} → create_session",
            False,
            f"[{err}] status={status}, session_id={session_id}\n    {truncate(resp, 200)}",
        ))
        return None

    log_pass(f"{test_label} → create_session", f"session_id={session_id}")

    # Step 2: Stream query
    log_info(f"Sending message via stream_query...")
    log_info(f"message: {message[:80]}...")
    print()

    try:
        result, elapsed, status = stream_query(engine_id, token, user_id, session_id, message)

        print(f"    HTTP {status} ({elapsed:.1f}s, {result.get('raw_chunks', 0)} chunks):")

        # Show text if extracted, otherwise show events
        if result.get("text"):
            print(f"    Text: {truncate(result['text'], 400)}")
        elif result.get("events"):
            print(f"    Events: {truncate(result['events'], 400)}")
        else:
            print(f"    {Y}No parseable content in response{X}")
        print()

        if status != 200:
            err = classify_http(status)
            suite.record(TestResult(f"{test_label} → stream_query", False,
                                    f"[{err}] HTTP {status}"))
            return None

        # Look for artifact ID in full response
        artifact_id = extract_artifact_id(result)

        suite.record(TestResult(
            f"{test_label} → stream_query",
            True,
            f"({elapsed:.1f}s)" + (f" artifact_id={artifact_id}" if artifact_id else ""),
            artifact_id=artifact_id,
            elapsed=elapsed,
        ))
        return artifact_id

    except req.exceptions.Timeout:
        suite.record(TestResult(f"{test_label} → stream_query", False,
                                "Timeout (120s) — cold start? Retry once."))
        return None
    except Exception as e:
        suite.record(TestResult(f"{test_label} → stream_query", False, str(e)[:200]))
        return None


# ── Main ────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="POW Ledger E2E Smoke Test")
    parser.add_argument("--orchestrator-only", action="store_true")
    parser.add_argument("--direct-only", action="store_true")
    args = parser.parse_args()

    print(f"\n{B}POW Ledger E2E Smoke Test{X}")
    print(f"{D}Day 6 · {time.strftime('%Y-%m-%d %H:%M:%S')}{X}")
    print(f"{D}Project: {PROJECT_ID} · Region: {LOCATION}{X}")
    print(f"{D}MCP Server: {MCP_SERVER}{X}")

    suite = TestSuite()

    # Auth
    token = test_auth(suite)
    if not token:
        print(f"\n{R}Cannot proceed without credentials.{X}")
        sys.exit(1)

    # Connectivity
    engines = test_connectivity(suite, token)
    if not engines:
        print(f"\n{R}No engines reachable.{X}")
        sys.exit(1)

    # Discover methods
    engine_methods = test_discover_methods(suite, token, engines)

    artifact_id = None

    if not args.direct_only:
        # TEST 1: Orchestrator → Capture
        banner("TEST 1 · Orchestrator → Capture Path")
        artifact_id = test_agent_flow(
            suite, token, "Orchestrator", engines.get("Orchestrator", ""),
            message=(
                "Capture this decision: Selected PCOMJR as the canonical "
                "architecture pattern for all TalonSight terminals. Rationale: "
                "unified pipeline ensures consistent artifact provenance across "
                "Sonic Genesis, TalonVision, and Da Cypher."
            ),
            test_label="Orch→Capture",
        )

        # TEST 2: Orchestrator → Verification
        banner("TEST 2 · Orchestrator → Verification Path")
        target = artifact_id or "smoke-test-placeholder-id"
        test_agent_flow(
            suite, token, "Orchestrator", engines.get("Orchestrator", ""),
            message=f"Verify the integrity of artifact {target}",
            test_label="Orch→Verify",
        )

    if not args.orchestrator_only:
        # TEST 3: Direct agent calls
        banner("TEST 3 · Direct Agent Calls")

        if "Capture" in engines:
            direct_art = test_agent_flow(
                suite, token, "Capture", engines["Capture"],
                message="Capture this decision: Direct smoke test validates agent reachability.",
                test_label="Direct→Capture",
            )
            if not artifact_id:
                artifact_id = direct_art

        if "Verification" in engines:
            target = artifact_id or "smoke-test-placeholder-id"
            test_agent_flow(
                suite, token, "Verification", engines["Verification"],
                message=f"Verify artifact {target}",
                test_label="Direct→Verify",
            )

    # Summary
    banner("SUMMARY")
    for r in suite.results:
        status = f"{G}✓{X}" if r.passed else f"{R}✗{X}"
        timing = f" ({r.elapsed:.1f}s)" if r.elapsed > 0 else ""
        print(f"  {status} {r.name}{timing}")

    print(f"\n  {B}{suite.passed}/{suite.total} passed{X}", end="")
    if suite.failed:
        print(f"  ·  {R}{suite.failed} failed{X}")
    else:
        print(f"  ·  {G}ALL CLEAR{X}")

    if artifact_id:
        print(f"\n  {C}Captured artifact: {artifact_id}{X}")
        print(f"  Use this for Block 3 click-to-verify.")

    print()
    return 0 if suite.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
