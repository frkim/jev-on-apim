from __future__ import annotations

from jev_proxy.mock import build_mock_response
from jev_proxy.models import JevRequest
from tests.test_models import valid_payload


def test_mock_is_deterministic_and_shapes_are_valid() -> None:
    request = JevRequest.model_validate(valid_payload())

    first = build_mock_response(request)
    second = build_mock_response(request)

    assert first == second
    assert first["model"] == "jev-mock"
    answers = first["answers"]
    assert 0 <= answers["isIncident"]["noul"] <= 1
    choice_probabilities = answers["route"]["probabilities"]
    assert round(sum(choice_probabilities.values()), 6) == 1
    assert answers["route"]["confidence"] == max(choice_probabilities.values())
    score_probabilities = answers["risk"]["probabilities"]
    assert round(sum(score_probabilities.values()), 6) == 1
    assert answers["risk"]["confidence"] == max(score_probabilities.values())
    assert 0 <= answers["risk"]["score"] <= 2
