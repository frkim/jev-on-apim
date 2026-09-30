"""Service layer for validating, mocking, and forwarding Jev requests."""

from __future__ import annotations

import json
import re
import time
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

import httpx
from pydantic import ValidationError

from .config import Settings, SettingsError
from .logging import log_event, log_request_summary
from .mock import build_mock_response
from .models import JevRequest, validation_details

SAFE_CORRELATION_ID = re.compile(r"^[A-Za-z0-9\-_.]{1,64}$")
MAX_REQUEST_BYTES = 256 * 1024
PASSTHROUGH_ERROR_STATUSES = {401, 403, 404, 422, 429, 529}
SYSTEMONE_PATH = "/jev/v1/systemone"


@dataclass(slots=True)
class ServiceResult:
    status_code: int
    body: dict[str, Any]
    headers: dict[str, str] = field(default_factory=dict)


def resolve_correlation_id(candidate: str | None) -> str:
    if candidate and SAFE_CORRELATION_ID.fullmatch(candidate):
        return candidate
    return str(uuid.uuid4())


def clamp_timeout(value: str | None) -> int:
    if value is None:
        return 30
    try:
        parsed = int(value)
    except ValueError:
        return 30
    return min(120, max(5, parsed))


def envelope_headers(correlation_id: str, extra: Mapping[str, str] | None = None) -> dict[str, str]:
    headers = {"content-type": "application/json", "x-correlation-id": correlation_id}
    if extra:
        headers.update(extra)
    return headers


def models_response(correlation_id: str) -> ServiceResult:
    return ServiceResult(
        status_code=200,
        body={
            "data": [
                {"id": "jev-latest", "description": "Current stable System One decision model."},
                {"id": "jev-preview", "description": "Preview System One model for early evaluation."},
                {"id": "jev-1.13.0", "description": "Pinned System One model version 1.13.0."},
            ],
            "pricing": {"inputPerMillionUsd": 0.042, "outputPerMillionUsd": 0},
        },
        headers=envelope_headers(correlation_id),
    )


def health_response(settings: Settings, correlation_id: str) -> ServiceResult:
    return ServiceResult(
        status_code=200,
        body={
            "status": "ok",
            "mode": settings.gateway_mode,
            "apimConfigured": settings.apim_configured,
            "version": "1.0.0",
        },
        headers=envelope_headers(correlation_id),
    )


def validation_error_response(exc: ValidationError, correlation_id: str) -> ServiceResult:
    return ServiceResult(
        status_code=400,
        body={
            "error": {
                "type": "validation_error",
                "message": "Request validation failed",
                "details": validation_details(exc),
            },
            "meta": {"correlationId": correlation_id},
        },
        headers=envelope_headers(correlation_id),
    )


def invalid_json_response(correlation_id: str) -> ServiceResult:
    return ServiceResult(
        status_code=400,
        body={
            "error": {"type": "invalid_json", "message": "Request body must be valid JSON", "details": []},
            "meta": {"correlationId": correlation_id},
        },
        headers=envelope_headers(correlation_id),
    )


def payload_too_large_response(correlation_id: str) -> ServiceResult:
    return ServiceResult(
        status_code=413,
        body={
            "error": {
                "type": "payload_too_large",
                "message": f"Request body must be at most {MAX_REQUEST_BYTES} bytes",
            },
            "meta": {"correlationId": correlation_id},
        },
        headers=envelope_headers(correlation_id),
    )


async def process_systemone(
    payload: Mapping[str, Any],
    settings: Settings,
    correlation_id: str,
    timeout_seconds: int,
    payload_bytes: int,
) -> ServiceResult:
    start = time.perf_counter()
    try:
        request = JevRequest.model_validate(payload)
    except ValidationError as exc:
        return validation_error_response(exc, correlation_id)

    gateway = settings.gateway_mode
    log_request_summary(request, correlation_id, gateway, payload_bytes)
    if gateway == "mock":
        result = build_mock_response(request)
        latency_ms = _latency_ms(start)
        return ServiceResult(
            status_code=200,
            body={
                "result": result,
                "meta": {
                    "correlationId": correlation_id,
                    "latencyMs": latency_ms,
                    "upstreamStatus": 200,
                    "apimRequestId": None,
                    "gateway": "mock",
                },
            },
            headers=envelope_headers(correlation_id),
        )

    try:
        gateway_url, subscription_key = settings.require_apim()
    except SettingsError as exc:
        return _configuration_error(str(exc), correlation_id)

    return await _forward_to_apim(request, gateway_url, subscription_key, correlation_id, timeout_seconds, start)


async def _forward_to_apim(
    request: JevRequest,
    gateway_url: str,
    subscription_key: str,
    correlation_id: str,
    timeout_seconds: int,
    start: float,
) -> ServiceResult:
    url = f"{gateway_url}{SYSTEMONE_PATH}"
    headers = {
        "Ocp-Apim-Subscription-Key": subscription_key,
        "Content-Type": "application/json",
        "x-correlation-id": correlation_id,
    }
    try:
        async with httpx.AsyncClient(timeout=float(timeout_seconds)) as client:
            response = await client.post(url, json=request.upstream_payload(), headers=headers)
    except httpx.TimeoutException:
        log_event("systemone.upstream_timeout", correlation_id, gateway="apim")
        return _upstream_transport_error("upstream_timeout", "Timed out while calling APIM", correlation_id, start, 504)
    except httpx.TransportError:
        log_event("systemone.upstream_unavailable", correlation_id, gateway="apim")
        return _upstream_transport_error("upstream_unavailable", "Unable to reach APIM", correlation_id, start, 502)

    latency_ms = _latency_ms(start)
    apim_request_id = response.headers.get("x-apim-request-id")
    if 200 <= response.status_code < 300:
        parsed = _parse_response_json(response)
        return ServiceResult(
            status_code=200,
            body={
                "result": parsed,
                "meta": _meta(correlation_id, latency_ms, response.status_code, apim_request_id, "apim"),
            },
            headers=envelope_headers(correlation_id),
        )
    return _upstream_error_response(response, correlation_id, latency_ms, apim_request_id)


def _configuration_error(message: str, correlation_id: str) -> ServiceResult:
    return ServiceResult(
        status_code=500,
        body={
            "error": {"type": "configuration_error", "message": message},
            "meta": {"correlationId": correlation_id},
        },
        headers=envelope_headers(correlation_id),
    )


def _upstream_transport_error(
    error_type: str,
    message: str,
    correlation_id: str,
    start: float,
    status_code: int,
) -> ServiceResult:
    return ServiceResult(
        status_code=status_code,
        body={
            "error": {"type": error_type, "message": message},
            "meta": _meta(correlation_id, _latency_ms(start), None, None, "apim"),
        },
        headers=envelope_headers(correlation_id),
    )


def _upstream_error_response(
    response: httpx.Response,
    correlation_id: str,
    latency_ms: float,
    apim_request_id: str | None,
) -> ServiceResult:
    upstream = _parse_response_json(response)
    response_status = response.status_code
    status_code = response_status if response_status in PASSTHROUGH_ERROR_STATUSES or response_status < 500 else 502
    extra_headers = {}
    retry_after = response.headers.get("retry-after")
    if retry_after:
        extra_headers["retry-after"] = retry_after
    return ServiceResult(
        status_code=status_code,
        body={
            "error": {
                "type": "upstream_error",
                "message": _extract_upstream_message(upstream, response.text),
                "upstream": upstream if isinstance(upstream, dict | list) else None,
            },
            "meta": _meta(correlation_id, latency_ms, response_status, apim_request_id, "apim"),
        },
        headers=envelope_headers(correlation_id, extra_headers),
    )


def _parse_response_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except json.JSONDecodeError:
        return None


def _extract_upstream_message(upstream: Any, text: str) -> str:
    message: Any = None
    if isinstance(upstream, dict):
        message = upstream.get("detail") or upstream.get("message") or upstream.get("error")
    if message is None:
        message = text or "Upstream request failed"
    message_text = message if isinstance(message, str) else json.dumps(message, ensure_ascii=False, default=str)
    return message_text[:1000]


def _meta(
    correlation_id: str,
    latency_ms: float,
    upstream_status: int | None,
    apim_request_id: str | None,
    gateway: str,
) -> dict[str, Any]:
    return {
        "correlationId": correlation_id,
        "latencyMs": latency_ms,
        "upstreamStatus": upstream_status,
        "apimRequestId": apim_request_id,
        "gateway": gateway,
    }


def _latency_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 3)
