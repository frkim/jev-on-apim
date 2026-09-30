# Security policy

## Reporting a vulnerability

Please **do not** open a public issue. Report privately through
[GitHub private vulnerability reporting](https://github.com/frkim/jev-on-apim/security/advisories/new).
We aim to acknowledge reports within 5 business days.

## Security design

| Concern | Control |
| --- | --- |
| Jev API key | Stored only in Azure Key Vault (RBAC, soft delete, purge protection). APIM reads it through a Key Vault–backed named value using a user-assigned managed identity. |
| APIM subscription key | Injected as a Static Web Apps app setting at deploy time; used only server-side by the Functions BFF. Stripped by APIM before forwarding upstream. |
| Browser exposure | The browser only calls same-origin `/api/*`. No keys are shipped in the static bundle. |
| Abuse / cost | APIM `rate-limit` (60 calls/min per subscription), request size limit (256 KB) and timeout clamping in the BFF. |
| Transport | HTTPS only (SWA, APIM, Jev). Strict security headers via `staticwebapp.config.json`. |
| Logging | Correlation IDs end to end; prompts and keys are not logged. |
| Supply chain | Actions pinned by SHA, Dependabot, CodeQL, protected package feeds. |
| CI/CD identity | Service principal in the `AZURE_CREDENTIALS` secret, scoped to the subscription. Prefer migrating to OIDC federated credentials (see ADR 0003). |

## Secret rotation

1. Rotate the Jev key at <https://jevmodel.org>, then update the `JEV_API_KEY` GitHub secret and re-run **Deploy**
   (or `az keyvault secret set --vault-name <kv> -n jev-api-key --value <new>`; APIM refreshes within 4 h, or
   immediately via *Named values → Refresh secret*).
2. Regenerate the APIM `jev-web-studio` subscription keys, then re-run **Deploy** to push the new key into SWA.
3. Rotate the service principal secret and update `AZURE_CREDENTIALS`.
