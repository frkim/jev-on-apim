from __future__ import annotations

import pytest
from pydantic import ValidationError

from jev_proxy.models import JevRequest


def valid_payload() -> dict[str, object]:
    return {
        "model": "jev-latest",
        "state": {"ticket": "The service is intermittently unavailable."},
        "questions": {
            "isIncident": {"type": "noul", "instructions": "Is this an incident?"},
            "route": {
                "type": "choice",
                "instructions": "Pick a route.",
                "criteria": {"support": "Support team", "sales": None},
            },
            "risk": {
                "type": "score",
                "instructions": "Score urgency.",
                "criteria": ["low", "medium", "high"],
            },
        },
    }


def test_valid_payload_normalizes_noul_without_criteria() -> None:
    request = JevRequest.model_validate(valid_payload())

    payload = request.upstream_payload()

    assert payload["questions"]["isIncident"] == {"type": "noul", "instructions": "Is this an incident?"}
    assert payload["questions"]["route"]["criteria"]["sales"] is None


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda body: body.update({"model": "bad-model"}), "string_pattern_mismatch"),
        (lambda body: body["questions"].update({"bad": {"type": "unknown", "instructions": "x"}}), "union_tag_invalid"),
        (
            lambda body: body["questions"].update({"bad": {"type": "choice", "instructions": "x"}}),
            "Field required",
        ),
        (
            lambda body: body["questions"].update(
                {"bad": {"type": "choice", "instructions": "x", "criteria": {"a": "A"}}}
            ),
            "2 to 255",
        ),
        (
            lambda body: body["questions"].update(
                {"bad": {"type": "score", "instructions": "x", "criteria": [str(i) for i in range(11)]}}
            ),
            "2 to 10",
        ),
    ],
)
def test_invalid_payloads_fail_validation(mutation: object, message: str) -> None:
    body = valid_payload()
    mutation(body)  # type: ignore[operator]

    with pytest.raises(ValidationError) as exc:
        JevRequest.model_validate(body)

    assert message in str(exc.value)
