from collections import defaultdict
from typing import Any
from google.adk.tools import FunctionTool


def _fingerprint(decision: dict[str, Any]) -> str:
    """Extract a stable fingerprint from a decision dict.

    Handles multiple possible field names since Gemini may reformat
    the data when passing it from list_artifacts to propose_workflow.
    Checks camelCase, snake_case, and common variants.
    """
    action = (
        decision.get("action")
        or decision.get("type")
        or decision.get("artifactType")
        or decision.get("artifact_type")
        or decision.get("eventType")
        or decision.get("event_type")
        or decision.get("category")
        or decision.get("decision_type")
        or decision.get("kind")
        or "general"
    )
    entity = (
        decision.get("entity_type")
        or decision.get("entityType")
        or decision.get("target_kind")
        or decision.get("target")
        or decision.get("terminal")
        or decision.get("domain")
        or "decision"
    )
    return f"{action}:{entity}"


def _extract_title(decision: dict[str, Any]) -> str:
    """Extract a human-readable title from a decision dict."""
    return (
        decision.get("title")
        or decision.get("name")
        or decision.get("summary")
        or decision.get("description", "")[:60]
        or "untitled"
    )


def detect_repeating_patterns(
    decisions: list[dict],
    min_length: int = 2,
    min_repetitions: int = 3,
    max_length: int = 8,
) -> list[dict]:
    if len(decisions) < min_length * min_repetitions:
        return []

    fps = [_fingerprint(d) for d in decisions]
    candidates: dict[tuple, list[int]] = defaultdict(list)

    upper = min(max_length, len(fps) // min_repetitions) + 1
    for length in range(min_length, upper):
        for i in range(len(fps) - length + 1):
            seq = tuple(fps[i : i + length])
            candidates[seq].append(i)

    patterns = []
    for seq, positions in candidates.items():
        non_overlap = []
        last = -1
        for p in positions:
            if p >= last:
                non_overlap.append(p)
                last = p + len(seq)
        if len(non_overlap) >= min_repetitions:
            # Extract sample titles from matched decisions
            sample_titles = []
            for pos in non_overlap[:3]:
                if pos < len(decisions):
                    sample_titles.append(_extract_title(decisions[pos]))

            patterns.append(
                {
                    "sequence": list(seq),
                    "occurrences": non_overlap,
                    "count": len(non_overlap),
                    "length": len(seq),
                    "sample_titles": sample_titles,
                }
            )

    return sorted(patterns, key=lambda p: (p["count"], p["length"]), reverse=True)


def propose_workflow(decisions: list[dict]) -> dict:
    """Analyze a list of decisions and propose reusable workflows from repeating patterns.

    Pass the FULL list of artifacts from list_artifacts (not lineage entries).
    Detects sequences of similar decision types that repeat 3+ times and proposes
    them as automatable workflow templates.

    Args:
        decisions: A list of decision dicts, each with fields like 'type', 'title',
                   'artifactType', etc. Pass the artifacts array from list_artifacts.
    """
    patterns = detect_repeating_patterns(decisions)
    if not patterns:
        return {
            "proposed": False,
            "reason": "No pattern repeated 3+ times across the decision set.",
        }

    top = patterns[0]
    # Build a readable workflow name from the fingerprint
    fp_parts = top["sequence"][0].split(":")
    action_label = fp_parts[0] if fp_parts[0] != "general" else "decision"
    entity_label = fp_parts[1] if len(fp_parts) > 1 and fp_parts[1] != "decision" else "artifact"
    name_hint = f"{action_label}_{entity_label}"

    return {
        "proposed": True,
        "pattern_length": top["length"],
        "occurrences": top["count"],
        "occurrence_indices": top["occurrences"],
        "sample_decisions": top.get("sample_titles", []),
        "template": {
            "name": f"workflow_{name_hint}_x{top['count']}",
            "steps": [
                {"action": s.split(":")[0], "entity_type": s.split(":")[1]}
                for s in top["sequence"]
            ],
        },
        "alternatives": [
            {
                "name": f"workflow_alt_{i}",
                "steps": p["sequence"],
                "occurrences": p["count"],
            }
            for i, p in enumerate(patterns[1:3], start=1)
        ],
        "requires_human_approval": True,
    }


propose_workflow_tool = FunctionTool(func=propose_workflow)
