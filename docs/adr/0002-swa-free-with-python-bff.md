# ADR 0002 — Static Web Apps (Free) with a managed Python Functions BFF

- Status: Accepted
- Date: 2026-07

## Context

The evaluation UI needs a host, and the APIM subscription key must stay server-side. The budget targets
free SKUs.

## Decision

- The UI is a Next.js **static export** hosted on **Azure Static Web Apps, Free**.
- SWA **managed Functions (Python 3.11)** act as a backend-for-frontend under `/api/*`. They validate
  input with pydantic, add correlation IDs, forward calls to APIM with the subscription key, and return a
  stable `{result, meta}` / `{error, meta}` envelope.
- A **mock mode** (`JEV_MOCK_MODE=true`, or no APIM URL configured) enables offline development and
  demos.

## Consequences

- ➕ No hosting cost, a global CDN, and same-origin API calls (no CORS).
- ➖ Managed functions allow HTTP triggers only, with a ~45 s request limit. SWA Free is limited to 2 custom domains and
  0.5 GB of storage.
- ➖ SWA is available in only a few regions (we use `westeurope` for SWA metadata; content is served
  globally).
