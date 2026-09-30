from __future__ import annotations

import json

import azure.functions as func
import pytest

from function_app import health, models, systemone


def request(
    method: str,
    url: str,
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
) -> func.HttpRequest:
    return func.HttpRequest(
        method=method,
        url=url,
        body=body,
        headers=headers or {},
        params=params or {},
    )


def response_json(response: func.HttpResponse) -> dict[str, object]:
    return json.loads(response.get_body().decode("utf-8"))


def test_health_and_models_handlers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JEV_MOCK_MODE", "true")
    correlation_id = "test-correlation"

    health_response = health(
        request("GET", "http://localhost/api/health", headers={"x-correlation-id": correlation_id})
    )
    models_response = models(
        request("GET", "http://localhost/api/models", headers={"x-correlation-id": correlation_id})
    )

    assert health_response.status_code == 200
    assert health_response.headers["x-correlation-id"] == correlation_id
    assert response_json(health_response)["mode"] == "mock"
    assert models_response.status_code == 200
    assert response_json(models_response)["data"]


@pytest.mark.asyncio
async def test_systemone_handler_validation_and_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JEV_MOCK_MODE", "true")
    body = {
        "model": "jev-latest",
        "state": "hello",
        "questions": {"yes": {"type": "noul", "instructions": "Is it positive?"}},
    }

    response = await systemone(
        request(
            "POST",
            "http://localhost/api/systemone",
            body=json.dumps(body).encode("utf-8"),
            headers={"x-correlation-id": "direct-test"},
            params={"timeout": "3"},
        )
    )

    assert response.status_code == 200
    payload = response_json(response)
    assert payload["meta"]["gateway"] == "mock"
    assert payload["result"]["model"] == "jev-mock"


@pytest.mark.asyncio
async def test_systemone_handler_rejects_invalid_json() -> None:
    response = await systemone(request("POST", "http://localhost/api/systemone", body=b"{"))

    assert response.status_code == 400
    assert response_json(response)["error"]["type"] == "invalid_json"
