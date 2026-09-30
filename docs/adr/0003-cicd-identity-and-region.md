# ADR 0003 — CI/CD identity and deployment region

- Status: Accepted
- Date: 2026-07

## Context

GitHub Actions has to deploy to Azure. OIDC federated credentials are the recommended approach. Creating
them requires Microsoft Graph permissions on the app registration, which the provided service principal
does not have. Separately, the target subscription does not accept new resources in `westeurope`.

## Decision

- Use the `AZURE_CREDENTIALS` JSON secret with `azure/login`, which is a service principal with a client secret.
- Deploy regional resources to **`swedencentral`**. Override it with the `AZURE_LOCATION` environment variable.
  SWA metadata goes to `eastus2` (an SWA-supported region), because `westeurope` also rejects SWA here.
  Override it with the `SWA_LOCATION` environment variable.

## Consequences

- ➖ The client secret must be rotated manually.
- **Follow-up:** once an admin grants `Application.ReadWrite.OwnedBy`, or creates the federated credential
  directly (`repo:frkim/jev-on-apim:environment:dev`), switch to OIDC. Then delete the secret, add
  `permissions: id-token: write`, and pass `client-id`, `tenant-id` and `subscription-id` to `azure/login`.
