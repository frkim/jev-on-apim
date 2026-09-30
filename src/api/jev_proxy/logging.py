"""Structured logging helpers that avoid logging prompts, state, or secrets."""

from __future__ import annotations

import json
import logging
from typing import Any

from .models import JevRequest

logger = logging.getLogger("jev_proxy")


def configure_logging() -> None:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO)


def log_event(event: str, correlation_id: str, **fields: Any) -> None:
    safe_fields = {"event": event, "correlationId": correlation_id, **fields}
    logger.info(json.dumps(safe_fields, sort_keys=True, separators=(",", ":")))


def log_request_summary(request: JevRequest, correlation_id: str, gateway: str, payload_bytes: int) -> None:
    question_types: dict[str, int] = {}
    for question in request.questions.values():
        question_types[question.type] = question_types.get(question.type, 0) + 1
    state_size = len(json.dumps(request.state, default=str, ensure_ascii=False))
    log_event(
        "systemone.request",
        correlation_id,
        gateway=gateway,
        model=request.model,
        questionCount=len(request.questions),
        questionTypes=question_types,
        stateBytes=state_size,
        payloadBytes=payload_bytes,
    )
