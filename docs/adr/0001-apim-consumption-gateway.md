# ADR 0001 — APIM Consumption in front of Jev

- Status: Accepted
- Date: 2026-07

## Context

The Jev System One API (`https://jevmodel.org/v1/systemone`) uses a Bearer API key. A web front end should
evaluate the model without exposing that key. We also want throttling, observability and a single
governance point, at the lowest possible cost.

## Decision

Put **Azure API Management, Consumption tier**, in front of Jev:

- The Jev key sits in Key Vault. APIM reads it through a Key Vault–backed named value using a
  user-assigned managed identity, then injects `Authorization: Bearer`.
- Clients authenticate to APIM with a subscription key on product `jev-evaluation`.
- Policies apply `rate-limit`, correlation IDs, retries on 429/503/529, header hygiene and a JSON error
  envelope.
- Request logs go to Application Insights.

## Consequences

- ➕ Pay-per-call (first 1M calls per month are free), no fixed cost, and fast provisioning (~1–3 min).
- ➖ The Consumption tier has no `rate-limit-by-key`, `quota-by-key`, `llm-token-limit` or built-in cache. We use plain
  `rate-limit`. If per-user quotas are needed, upgrade to Basic v2.
- ➖ Cold starts can add latency to the first call.
