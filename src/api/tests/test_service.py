from __future__ import annotations

import json

import httpx
import pytest
import respx

from jev_proxy.config import Settings
from jev_proxy.service import (
    clamp_timeout,
    health_response,
    models_response,
    process_systemone,
    resolve_correlation_id,
)
from tests.test_models import valid_payload


def apim_settings() -> Settings:
    return Settings(
        apim_gateway_url="https://apim.example.test",
        apim_subscription_key="secret-subscription-key",
        mock_mode=False,
    )


@pytest.mark.asyncio
async def test_process_systemone_happy_path_forwards_headers_without_leaking_key() -> None:
    with respx.mock:
        route = respx.post("https://apim.example.test/jev/v1/systemone").mock(
            return_value=httpx.Response(
                200,
                json={"model": "jev-1.13.0", "answers": {}, "usage": {"input_tokens": 1, "output_tokens": 0}},
                headers={"x-apim-request-id": "apim-123"},
            )
        )
        result = await process_systemone(valid_payload(), apim_settings(), "corr-1", 30, 100)

        request = route.calls.last.request

    assert result.status_code == 200
    assert result.body["meta"]["gateway"] == "apim"
    assert result.body["meta"]["apimRequestId"] == "apim-123"
    assert request.headers["Ocp-Apim-Subscription-Key"] == "secret-subscription-key"
    assert request.headers["x-correlation-id"] == "corr-1"
    assert "secret-subscription-key" not in json.dumps(result.body)


@pytest.mark.asyncio
@pytest.mark.parametrize(("upstream_status", "expected_status"), [(422, 422), (429, 429), (500, 502)])
async def test_upstream_errors_are_mapped_and_retry_after_is_propagated(
    upstream_status: int, expected_status: int
) -> None:
    response_headers = {"retry-after": "7"} if upstream_status == 429 else {}
    with respx.mock:
        respx.post("https://apim.example.test/jev/v1/systemone").mock(
            return_value=httpx.Response(upstream_status, json={"detail": "upstream detail"}, headers=response_headers)
        )
        result = await process_systemone(valid_payload(), apim_settings(), "corr-err", 30, 100)

    assert result.status_code == expected_status
    assert result.body["error"]["type"] == "upstream_error"
    assert result.body["error"]["message"] == "upstream detail"
    assert result.body["meta"]["upstreamStatus"] == upstream_status
    if upstream_status == 429:
        assert result.headers["retry-after"] == "7"


@pytest.mark.asyncio
async def test_timeout_and_connection_errors() -> None:
    with respx.mock:
        respx.post("https://apim.example.test/jev/v1/systemone").mock(side_effect=httpx.TimeoutException("timeout"))
        timeout_result = await process_systemone(valid_payload(), apim_settings(), "corr-timeout", 30, 100)

    with respx.mock:
        respx.post("https://apim.example.test/jev/v1/systemone").mock(side_effect=httpx.ConnectError("connect"))
        connect_result = await process_systemone(valid_payload(), apim_settings(), "corr-connect", 30, 100)

    assert timeout_result.status_code == 504
    assert timeout_result.body["error"]["type"] == "upstream_timeout"
    assert connect_result.status_code == 502
    assert connect_result.body["error"]["type"] == "upstream_unavailable"


@pytest.mark.asyncio
async def test_mock_mode_returns_mock_envelope() -> None:
    result = await process_systemone(valid_payload(), Settings(None, None, True), "corr-mock", 30, 100)

    assert result.status_code == 200
    assert result.body["result"]["model"] == "jev-mock"
    assert result.body["meta"]["gateway"] == "mock"


@pytest.mark.asyncio
async def test_validation_error_response() -> None:
    body = valid_payload()
    body["questions"] = {}

    result = await process_systemone(body, apim_settings(), "corr-validation", 30, 100)

    assert result.status_code == 400
    assert result.body["error"]["type"] == "validation_error"
    assert result.headers["x-correlation-id"] == "corr-validation"


def test_health_models_correlation_and_timeout_helpers() -> None:
    assert resolve_correlation_id("abc-123._") == "abc-123._"
    assert len(resolve_correlation_id("not safe!")) == 36
    assert clamp_timeout(None) == 30
    assert clamp_timeout("1") == 5
    assert clamp_timeout("999") == 120
    assert health_response(Settings(None, None, False), "corr").body["mode"] == "mock"
    assert models_response("corr").body["pricing"]["inputPerMillionUsd"] == 0.042
