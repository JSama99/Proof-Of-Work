"""POW Operator Agent — orchestrator for the POW Ledger Verification System.

Routes user intent to specialist sub-agents:
- capture_agent (deployed): writes decisions and events to the ledger
- verification_agent (deployed): reads, verifies, detects patterns

Architecture principle: Operator has NO direct ledger access.
All ledger I/O is delegated via A2A to deployed sub-agents.
"""
import os
import vertexai
from vertexai import agent_engines
from dotenv import load_dotenv
from google.adk.agents import Agent

load_dotenv()

# Initialize Vertex AI before resolving any deployed engines
vertexai.init(
    project=os.environ["GOOGLE_CLOUD_PROJECT"],
    location=os.environ["GOOGLE_CLOUD_LOCATION"],
)

CAPTURE_RESOURCE_NAME = os.environ["CAPTURE_RESOURCE_NAME"]
VERIFICATION_RESOURCE_NAME = os.environ["VERIFICATION_RESOURCE_NAME"]

# Lazy-init the remote engine handles. Calling agent_engines.get() at module
# import time fails in the deployed runtime if the service account doesn't
# yet have permission or the cold-start is slow. Defer to first use.
_capture_engine = None
_verification_engine = None


def _get_capture():
    global _capture_engine
    if _capture_engine is None:
        _capture_engine = agent_engines.get(CAPTURE_RESOURCE_NAME)
    return _capture_engine


def _get_verification():
    global _verification_engine
    if _verification_engine is None:
        _verification_engine = agent_engines.get(VERIFICATION_RESOURCE_NAME)
    return _verification_engine


def _final_model_text(stream) -> str:
    """Walk a stream_query generator and return the last model text response."""
    final_text = None
    for event in stream:
        content = event.get("content") or {}
        if content.get("role") != "model":
            continue
        for part in content.get("parts", []) or []:
            text = part.get("text")
            if text:
                final_text = text
    return final_text or "(sub-agent returned no text response)"


def capture_decision(content: str) -> str:
    """Delegate to the deployed Capture Agent to write a decision or event to the POW Ledger.

    Use this when the user wants to record, capture, log, or note any decision,
    event, milestone, or piece of context that should be persisted in the ledger.
    Capture handles the single-writer protocol (append_decision + record_event)
    internally.

    Args:
        content: A complete natural-language instruction for the Capture Agent.
                 Include the decision/event content, any reasoning or context,
                 and relevant tags (artifact_type, event_type, etc.).

    Returns:
        The Capture Agent's response, which will include the artifact_id and
        confirmation. Forward this back to the user verbatim — do not fabricate
        or modify artifact IDs.
    """
    stream = _get_capture().stream_query(user_id="orchestrator-agent", message=content)
    return _final_model_text(stream)


def verify_artifact(artifact_id: str) -> str:
    """Delegate to the deployed Verification Agent to verify an artifact in the POW Ledger.

    Use this when the user wants to verify, check, audit, look up, or examine
    the integrity of an existing artifact. The Verification Agent fetches the
    artifact's lineage and cryptographically verifies each entry.

    Args:
        artifact_id: The artifact ID to verify (e.g., '3Tzo0OJPLjeMC0KbTUG0Q').

    Returns:
        The Verification Agent's response with lineage details and validity for
        each entry. Forward this back to the user verbatim.
    """
    prompt = f"verify artifact {artifact_id}"
    stream = _get_verification().stream_query(user_id="orchestrator-agent", message=prompt)
    return _final_model_text(stream)


OPERATOR_INSTRUCTION = """You are the POW Operator Agent — the orchestrator of the POW Ledger Verification System.

## Your role
You coordinate two specialist sub-agents to fulfill user requests about the POW Ledger:

- **capture_decision**: writes decisions and events to the ledger (single-writer architecture)
- **verify_artifact**: reads, retrieves lineage, and verifies cryptographic integrity

You have NO direct ledger access. All ledger interactions MUST go through these tools.

## Routing rules
- User wants to record a decision, capture context, log a milestone, or note an event → call `capture_decision` with a complete, natural-language instruction
- User wants to verify, audit, check, or examine an artifact → call `verify_artifact` with the artifact_id
- "Capture X and then verify it" → call `capture_decision` first, extract the artifact_id from its response, then call `verify_artifact` with that ID
- User asks something unrelated to the ledger → answer directly, do not call any tools

## Output protocol
- Forward artifact IDs, event IDs, signatures, and verification results faithfully. Never fabricate or modify them.
- If a sub-agent returns an error, surface it transparently rather than hiding it.
- Do not invent details the sub-agent did not provide.
- When a request requires both tools, perform them in sequence and present the chained result clearly.

## Architecture principle
You are a router, not a writer. Trust your sub-agents to handle their domains. Your job is to translate user intent into the right sub-agent invocation and relay the truth back."""


root_agent = Agent(
    model="gemini-2.5-flash",
    name="operator_agent",
    instruction=OPERATOR_INSTRUCTION,
    tools=[capture_decision, verify_artifact],
)
