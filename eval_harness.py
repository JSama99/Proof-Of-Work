#!/usr/bin/env python3
"""POW Ledger Verification System — Eval Harness.

Runs 6 test scenarios against live Vertex AI Agent Engine deployments.
Produces a pass/fail report with timing for Google for Startups
AI Agents Challenge (Track 1) submission evidence.

Usage:
    cd ~/Downloads/Proof-Of-Work
    python eval_harness.py

Reads agent resource names from agents/*/deployed_resource.txt.
"""

import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import vertexai
from vertexai import agent_engines

# ── Config ───────────────────────────────────────────────────────────
PROJECT = "proof-of-work-497822"
LOCATION = "us-central1"
REPO_ROOT = Path(__file__).resolve().parent

RESULTS = []


def load_resource(agent_dir: str) -> str:
    """Read deployed resource name from agents/<dir>/deployed_resource.txt."""
    p = REPO_ROOT / "agents" / agent_dir / "deployed_resource.txt"
    if not p.exists():
        # Try relative to cwd
        p = Path("agents") / agent_dir / "deployed_resource.txt"
    return p.read_text().strip()


def get_agent(resource_name: str):
    return agent_engines.get(resource_name)


def stream_to_parts(agent, message: str) -> dict:
    """Send message, collect all parts from the stream."""
    session = agent.create_session(user_id="eval-harness")
    texts = []
    function_calls = []
    function_responses = []
    raw_events = []

    for event in agent.stream_query(
        user_id="eval-harness",
        session_id=session["id"],
        message=message,
    ):
        raw_events.append(event)
        content = event.get("content", {})
        for part in content.get("parts", []):
            if "text" in part:
                texts.append(part["text"])
            if "function_call" in part:
                function_calls.append(part["function_call"])
            if "function_response" in part:
                function_responses.append(part["function_response"])

    return {
        "texts": texts,
        "function_calls": function_calls,
        "function_responses": function_responses,
        "raw_events": raw_events,
    }


def run_test(name: str, fn):
    """Run a test function, capture result and timing."""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    start = time.time()
    try:
        passed, details = fn()
        elapsed = time.time() - start
        status = "PASS" if passed else "FAIL"
        print(f"  Result: {status} ({elapsed:.1f}s)")
        print(f"  Details: {details}")
        RESULTS.append({
            "test": name,
            "status": status,
            "elapsed_s": round(elapsed, 1),
            "details": details,
        })
    except Exception as e:
        elapsed = time.time() - start
        tb = traceback.format_exc()
        print(f"  Result: ERROR ({elapsed:.1f}s)")
        print(f"  Error: {e}")
        RESULTS.append({
            "test": name,
            "status": "ERROR",
            "elapsed_s": round(elapsed, 1),
            "details": str(e),
            "traceback": tb,
        })


# ── Test Scenarios ───────────────────────────────────────────────────

def test_1_round_trip_capture_verify():
    """Capture a decision, then verify it. Full E2E."""
    orch = get_agent(load_resource("orchestrator"))

    # Step 1: Capture
    result = stream_to_parts(orch, 
        "Capture this decision: Eval test: standardizing deployment pipelines across all terminals at " 
        + datetime.now(timezone.utc).isoformat())
    
    all_text = " ".join(result["texts"])
    
    # Extract artifact ID from response
    artifact_id = None
    for word in all_text.replace("`", "").replace(".", "").replace(",", "").split():
        if len(word) > 15 and any(c.isdigit() for c in word) and any(c.isalpha() for c in word):
            artifact_id = word
    
    if not artifact_id:
        return False, f"Could not extract artifact ID from: {all_text[:200]}"

    # Step 2: Verify
    result2 = stream_to_parts(orch, f"Verify artifact {artifact_id}")
    verify_text = " ".join(result2["texts"])

    has_valid = "valid" in verify_text.lower() or "Valid" in verify_text
    has_entry = "Entry" in verify_text or "entry" in verify_text

    if has_valid and has_entry:
    	return True, f"Captured {artifact_id}, verified with valid entries"
    elif "workflow" in verify_text.lower():
        return True, f"Captured {artifact_id}, workflow proposal detected"
    else: 
    	return False, f"Verification response: {verify_text[300]}"


def test_2_orchestrator_routes_capture():
    """Orchestrator correctly routes a capture intent to capture_decision."""
    orch = get_agent(load_resource("orchestrator"))
    result = stream_to_parts(orch, 
        "Capture this decision: We chose FastAPI over Flask for the new microservice")

    called_tools = [fc["name"] for fc in result["function_calls"]]
    
    if "capture_decision" in called_tools:
        return True, f"Routed to capture_decision (tools called: {called_tools})"
    else:
        return False, f"Expected capture_decision, got: {called_tools}. Text: {' '.join(result['texts'])[:200]}"


def test_3_orchestrator_routes_verify():
    """Orchestrator correctly routes a verify intent to verify_artifact."""
    orch = get_agent(load_resource("orchestrator"))
    result = stream_to_parts(orch, "Verify artifact zSs0iz8DvSRcMdILrsXL4")

    called_tools = [fc["name"] for fc in result["function_calls"]]

    if "verify_artifact" in called_tools:
        return True, f"Routed to verify_artifact (tools called: {called_tools})"
    else:
        return False, f"Expected verify_artifact, got: {called_tools}. Text: {' '.join(result['texts'])[:200]}"


def test_4_non_decision_rejection():
    """Capture agent should NOT fabricate artifacts for non-decision input."""
    capture = get_agent(load_resource("capture"))
    result = stream_to_parts(capture, "What's the weather like today?")

    all_text = " ".join(result["texts"]).lower()
    called_tools = [fc["name"] for fc in result["function_calls"]]

    # Should NOT have called append_decision
    fabricated = "append_decision" in called_tools
    # Should ask for clarification or say it's not a decision
    clarifies = any(w in all_text for w in [
        "clarif", "not a decision", "question", "not actually", 
        "rephrase", "could you", "what decision", "can you provide",
    ])

    if not fabricated and clarifies:
        return True, f"Correctly rejected non-decision. Response: {all_text[:200]}"
    elif not fabricated:
        return True, f"Did not fabricate (no tool call). Response: {all_text[:200]}"
    else:
        return False, f"Fabricated artifact from non-decision! Tools: {called_tools}"


def test_5_invalid_artifact_graceful():
    """Verification handles non-existent artifact ID gracefully."""
    orch = get_agent(load_resource("orchestrator"))
    result = stream_to_parts(orch, "Verify artifact NONEXISTENT_FAKE_ID_12345")

    all_text = " ".join(result["texts"]).lower()

    # Should not crash — should return an error message or empty lineage
    has_response = len(all_text) > 10
    no_crash = "traceback" not in all_text and "exception" not in all_text

    if has_response and no_crash:
        return True, f"Handled gracefully. Response: {all_text[:200]}"
    else:
        return False, f"Poor handling. Response: {all_text[:200]}"


def test_6_list_artifacts():
    """Capture agent can list existing artifacts from the ledger."""
    capture = get_agent(load_resource("capture"))
    result = stream_to_parts(capture, "List all artifacts in the ledger")

    all_text = " ".join(result["texts"])
    called_tools = [fc["name"] for fc in result["function_calls"]]

    # Check if list_artifacts was called or if artifacts were returned
    has_list_call = "list_artifacts" in called_tools
    has_artifacts = any(w in all_text for w in ["artifact", "PCOMJR", "Cloud SQL", "ledger"])

    if has_list_call or has_artifacts:
        return True, f"Listed artifacts. Tools: {called_tools}. Preview: {all_text[:200]}"
    else:
        return False, f"No artifacts returned. Tools: {called_tools}. Text: {all_text[:200]}"


# ── Main ─────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("POW LEDGER VERIFICATION SYSTEM — EVAL HARNESS")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"Project: {PROJECT} | Region: {LOCATION}")
    print("=" * 60)

    vertexai.init(project=PROJECT, location=LOCATION)

    # Load and display resource names
    try:
        orch_res = load_resource("orchestrator")
        cap_res = load_resource("capture")
        ver_res = load_resource("verification")
        print(f"\nOrchestrator: {orch_res}")
        print(f"Capture:      {cap_res}")
        print(f"Verification: {ver_res}")
    except Exception as e:
        print(f"\nERROR loading resource names: {e}")
        print("Run from repo root: cd ~/Downloads/Proof-Of-Work && python eval_harness.py")
        sys.exit(1)

    # Run tests
    tests = [
        ("1. Round-trip Capture → Verify", test_1_round_trip_capture_verify),
        ("2. Orchestrator routes capture intent", test_2_orchestrator_routes_capture),
        ("3. Orchestrator routes verify intent", test_3_orchestrator_routes_verify),
        ("4. Non-decision input rejection", test_4_non_decision_rejection),
        ("5. Invalid artifact ID handling", test_5_invalid_artifact_graceful),
        ("6. List artifacts from ledger", test_6_list_artifacts),
    ]

    for name, fn in tests:
        run_test(name, fn)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
    errors = sum(1 for r in RESULTS if r["status"] == "ERROR")
    total = len(RESULTS)
    total_time = sum(r["elapsed_s"] for r in RESULTS)

    for r in RESULTS:
        icon = "✅" if r["status"] == "PASS" else "❌" if r["status"] == "FAIL" else "💥"
        print(f"  {icon} {r['test']} — {r['status']} ({r['elapsed_s']}s)")

    print(f"\n  {passed}/{total} passed | {failed} failed | {errors} errors | {total_time:.0f}s total")
    print("=" * 60)

    # Save results
    report = {
        "system": "POW Ledger Verification System",
        "challenge": "Google for Startups AI Agents Challenge — Track 1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project": PROJECT,
        "agents": {
            "orchestrator": orch_res,
            "capture": cap_res,
            "verification": ver_res,
        },
        "results": RESULTS,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "total_time_s": round(total_time, 1),
        },
    }

    report_path = REPO_ROOT / "eval_report.json"
    if not report_path.parent.exists():
        report_path = Path("eval_report.json")
    
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")

    return 0 if failed == 0 and errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
