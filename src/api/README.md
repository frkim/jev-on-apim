# Jev APIM proxy API

Python 3.11 Azure Functions v2 API for the sample app. It keeps the APIM subscription key server-side while forwarding validated System One requests to:

`{APIM_GATEWAY_URL}/jev/v1/systemone`

## Endpoints

- `GET /api/health` returns mode, configuration state, and version.
- `GET /api/models` returns the supported Jev model IDs and pricing.
- `POST /api/systemone?timeout=30` validates a Jev request and returns the upstream result with proxy metadata.

If `JEV_MOCK_MODE=true` or `APIM_GATEWAY_URL` is empty, `/api/systemone` returns deterministic mock answers.

## Environment variables

- `APIM_GATEWAY_URL`: APIM gateway base URL.
- `APIM_SUBSCRIPTION_KEY`: APIM subscription key sent only from the backend.
- `JEV_MOCK_MODE`: set to `true` to force mock responses.
- `FUNCTIONS_WORKER_RUNTIME`: `python`.

Do not put secrets in `local.settings.sample.json`.

## Local setup

```powershell
cd src\api
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
```

Copy `local.settings.sample.json` to `local.settings.json` and fill local values as needed.

## Run

```powershell
func start
```

## Test and validate

```powershell
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m mypy jev_proxy
.\.venv\Scripts\python -m pytest -q
```
