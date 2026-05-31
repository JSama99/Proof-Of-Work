from collections import defaultdict
from typing import Any
from google.adk.tools import FunctionTool


def _fingerprint(decision: dict[str, Any]) -> str:
    action = decision.get("action") or decision.get("type") or "unknown"
    entity = decision.get("entity_type") or decision.get("target_kind") or "any"
    return f"{action}:{entity}"


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
            patterns.append(
                {
                    "sequence": list(seq),
                    "occurrences": non_overlap,
                    "count": len(non_overlap),
                    "length": len(seq),
                }
            )

    return sorted(patterns, key=lambda p: (p["count"], p["length"]), reverse=True)


def propose_workflow(decisions: list[dict]) -> dict:
    patterns = detect_repeating_patterns(decisions)
    if not patterns:
        return {
            "proposed": False,
            "reason": "No pattern repeated 3+ times in this chain.",
        }

    top = patterns[0]
    name_hint = top["sequence"][0].replace(":", "_")
    return {
        "proposed": True,
        "pattern_length": top["length"],
        "occurrences": top["count"],
        "occurrence_indices": top["occurrences"],
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
