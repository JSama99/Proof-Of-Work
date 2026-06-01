"""Smoke test the two new write tools against deployed POW Ledger."""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from server import append_decision, record_event

async def main():
    print("→ append_decision...")
    res1 = await append_decision(
        title="Day 4 smoke test — write tools online",
        body="Verifying append_decision tool wires through to POST /api/artifacts.",
    )
    artifact_id = res1["artifact"]["id"]
    print(f"  ✓ created artifact {artifact_id}")

    print("→ record_event...")
    res2 = await record_event(
        terminal_source="capture-agent",
        event_type="decision_checkpoint",
        artifact_id=artifact_id,
        metadata={"smoke_test": True, "phase": "day-4-phase-1"},
    )
    print(f"  ✓ logged entry {res2.get('entry', {}).get('id', '?')}")

asyncio.run(main())
