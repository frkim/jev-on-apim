"""Deterministic Jev-compatible mock responses."""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from .models import ChoiceQuestion, JevRequest, NoulQuestion, ScoreQuestion


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _fraction(seed: str) -> float:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    integer = int.from_bytes(digest[:8], "big")
    return integer / float(2**64 - 1)


def _probabilities(seed: str, labels: list[str]) -> dict[str, float]:
    weights = [0.05 + _fraction(f"{seed}:{label}") for label in labels]
    total = sum(weights)
    raw = [weight / total for weight in weights]
    rounded = [round(value, 6) for value in raw]
    rounded[-1] = round(1.0 - sum(rounded[:-1]), 6)
    return dict(zip(labels, rounded, strict=True))


def _noul_answer(seed: str) -> dict[str, Any]:
    return {"type": "noul", "noul": round(_fraction(seed), 6)}


def _choice_answer(seed: str, question: ChoiceQuestion) -> dict[str, Any]:
    labels = list(question.criteria.keys())
    probabilities = _probabilities(seed, labels)
    choice = max(probabilities, key=lambda label: probabilities[label])
    confidence = probabilities[choice]
    return {
        "type": "choice",
        "choice": choice,
        "probabilities": probabilities,
        "confidence": confidence,
    }


def _score_answer(seed: str, question: ScoreQuestion) -> dict[str, Any]:
    labels = [str(index) for index in range(len(question.criteria))]
    probabilities = _probabilities(seed, labels)
    score = sum(float(index) * probabilities[str(index)] for index in range(len(question.criteria)))
    confidence = max(probabilities.values())
    return {
        "type": "score",
        "score": round(score, 6),
        "legend": {str(index): description for index, description in enumerate(question.criteria)},
        "probabilities": probabilities,
        "confidence": confidence,
    }


def build_mock_response(request: JevRequest) -> dict[str, Any]:
    payload = request.upstream_payload()
    state_key = _canonical(payload["state"])
    answers: dict[str, dict[str, Any]] = {}
    for question_id, question in request.questions.items():
        seed = f"{state_key}|{question_id}"
        if isinstance(question, NoulQuestion):
            answers[question_id] = _noul_answer(seed)
        elif isinstance(question, ChoiceQuestion):
            answers[question_id] = _choice_answer(seed, question)
        elif isinstance(question, ScoreQuestion):
            answers[question_id] = _score_answer(seed, question)
    return {
        "model": "jev-mock",
        "answers": answers,
        "usage": {
            "input_tokens": max(1, math.ceil(len(_canonical(payload)) / 4)),
            "output_tokens": max(1, len(answers) * 8),
        },
    }
