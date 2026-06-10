#!/usr/bin/env python3
"""Seed the POW Ledger with decisions that trigger pattern detection.

The propose_workflow tool needs 6+ decisions with matching fingerprints
(min_length=2 × min_repetitions=3). This script captures 6 architecture
standardization decisions through the live Orchestrator so all SHA-256
hashes and event signatures are legitimate.

Usage:
    source agents/verification/.venv/bin/activate
    python seed_demo_data.py
"""
import sys
import time
import vertexai
from vertexai import agent_engines

PROJECT = "proof-of-work-497822"
LOCATION = "us-central1"

# Decisions designed to produce matching fingerprints in pattern detection.
# All will be captured as "journal" or "sop" type by the Capture Agent,
# creating a repeating pattern that propose_workflow can detect.
SEED_DECISIONS = [
    "Capture this decision: We are adopting a microservices architecture for the Sonic Genesis terminal to enable independent scaling of audio processing pipelines",
    "Capture this decision: We are adopting a microservices architecture for the TalonVision terminal to enable independent scaling of image generation pipelines",
    "Capture this decision: We are adopting a microservices architecture for the Da Cypher terminal to enable independent scaling of real-time transcription services",
    "Capture this decision: We are adopting a microservices architecture for the TalonMotion terminal to enable independent scaling of video rendering pipelines",
    "Capture this decision: We are adopting a microservices architecture for the TalonFly terminal to enable independent scaling of marketplace transaction services",
    "Capture this decision: We are adopting a microservices architecture for the POW Ledger terminal to enable independent scaling of verification workloads",
]


def main():
    vertexai.init(project=PROJECT, location=LOCATION)

    # Load Orchestrator resource name
    try:
        with open("agents/orchestrator/deployed_resource.txt") as f:
            orch_resource = f.read().strip()
    except FileNotFoundError:
        print("ERROR: agents/orchestrator/deployed_resource.txt not found")
        print("       Run this script from the repo root: cd ~/Downloads/Proof-Of-Work")
        sys.exit(1)

    print(f"Orchestrator: {orch_resource}")
    orch = agent_engines.get(orch_resource)

    artifact_ids = []

    for i, decision in enumerate(SEED_DECISIONS, 1):
        print(f"\n{'='*60}")
        print(f"Seeding decision {i}/{len(SEED_DECISIONS)}...")
        print(f"{'='*60}")

        session = orch.create_session(user_id="demo-user")
        response_text = ""

        for event in orch.stream_query(
            user_id="demo-user",
            session_id=session["id"],
            message=decision,
        ):
            content = event.get("content", {})
            for part in content.get("parts", []):
                if "text" in part:
                    text = part["text"]
                    print(text)
                    response_text += text

        # Try to extract artifact ID from response
        for word in response_text.split():
            if word.startswith("art_") or (len(word) > 30 and "-" in word):
                clean = word.strip(".,;:!?\"'()")
                artifact_ids.append(clean)
                break

        # Brief pause between calls to avoid rate limiting
        if i < len(SEED_DECISIONS):
            print("\nWaiting 3s before next capture...")
            time.sleep(3)

    print(f"\n{'='*60}")
    print(f"SEEDING COMPLETE")
    print(f"{'='*60}")
    print(f"Captured {len(SEED_DECISIONS)} decisions")
    if artifact_ids:
        print(f"Artifact IDs collected: {len(artifact_ids)}")
        for aid in artifact_ids:
            print(f"  - {aid}")
        print(f"\nUse this ID to demo verification with pattern detection:")
        print(f"  Verify artifact {artifact_ids[-1]}")
    else:
        print("Note: Could not auto-extract artifact IDs from responses.")
        print("Check the output above for artifact IDs manually.")

    print(f"\nThe propose_workflow tool should now detect the repeating")
    print(f"'microservices architecture adoption' pattern across 6 decisions.")


if __name__ == "__main__":
    main()
