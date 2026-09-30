from __future__ import annotations

import json
from typing import Any

import azure.functions as func

from jev_proxy.config import get_settings
from jev_proxy.logging import configure_logging
from jev_proxy.service import (
    MAX_REQUEST_BYTES,
    ServiceResult,
    clamp_timeout,
    health_response,
    invalid_json_response,
    models_response,
    payload_too_large_response,
    process_systemone,
    resolve_correlation_id,
)

configure_logging()

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


def _to_http_response(result: ServiceResult) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps(result.body, ensure_ascii=False),
        status_code=result.status_code,
        headers=result.headers,
        mimetype="application/json",
    )


def _correlation_id(req: func.HttpRequest) -> str:
    return resolve_correlation_id(req.headers.get("x-correlation-id"))


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    correlation_id = _correlation_id(req)
    return _to_http_response(health_response(get_settings(), correlation_id))


@app.route(route="models", methods=["GET"])
def models(req: func.HttpRequest) -> func.HttpResponse:
    correlation_id = _correlation_id(req)
    return _to_http_response(models_response(correlation_id))


@app.route(route="systemone", methods=["POST"])
async def systemone(req: func.HttpRequest) -> func.HttpResponse:
    correlation_id = _correlation_id(req)
    raw_body = req.get_body()
    if len(raw_body) > MAX_REQUEST_BYTES:
        return _to_http_response(payload_too_large_response(correlation_id))
    try:
        payload: Any = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return _to_http_response(invalid_json_response(correlation_id))
    if not isinstance(payload, dict):
        return _to_http_response(invalid_json_response(correlation_id))
    timeout_seconds = clamp_timeout(req.params.get("timeout"))
    result = await process_systemone(
        payload=payload,
        settings=get_settings(),
        correlation_id=correlation_id,
        timeout_seconds=timeout_seconds,
        payload_bytes=len(raw_body),
    )
    return _to_http_response(result)
