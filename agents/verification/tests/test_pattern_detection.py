from pattern_detection import detect_repeating_patterns, propose_workflow


def test_detects_three_repetitions():
    decisions = [
        {"action": "edit",  "entity_type": "lyric"},
        {"action": "score", "entity_type": "lyric"},
        {"action": "edit",  "entity_type": "lyric"},
        {"action": "score", "entity_type": "lyric"},
        {"action": "edit",  "entity_type": "lyric"},
        {"action": "score", "entity_type": "lyric"},
    ]
    patterns = detect_repeating_patterns(decisions)
    assert len(patterns) > 0
    assert patterns[0]["count"] == 3
    assert patterns[0]["sequence"] == ["edit:lyric", "score:lyric"]


def test_no_proposal_when_too_few_decisions():
    decisions = [
        {"action": "a", "entity_type": "x"},
        {"action": "b", "entity_type": "y"},
    ]
    result = propose_workflow(decisions)
    assert result["proposed"] is False


def test_proposal_contains_required_fields():
    decisions = [
        {"action": "edit",  "entity_type": "lyric"},
        {"action": "score", "entity_type": "lyric"},
    ] * 3
    result = propose_workflow(decisions)
    assert result["proposed"] is True
    assert "template" in result
    assert "name" in result["template"]
    assert "steps" in result["template"]
    assert result["requires_human_approval"] is True


def test_only_two_repetitions_not_enough():
    decisions = [
        {"action": "edit",  "entity_type": "lyric"},
        {"action": "score", "entity_type": "lyric"},
        {"action": "edit",  "entity_type": "lyric"},
        {"action": "score", "entity_type": "lyric"},
    ]
    result = propose_workflow(decisions)
    assert result["proposed"] is False
