# AGENTS.md

Guidance for AI coding agents (GitHub Copilot, coding agents, sub-agents) working in this repository.
Follows the conventions in [frkim/ai-coding-standards](https://github.com/frkim/ai-coding-standards).

## Project summary

**Jev on APIM** is a sample that puts **Azure API Management (Consumption)** in front of the
[Jev](https://jevmodel.org) System One decision model and exposes a **Jev Studio** web front end
to evaluate it. The front end is a static Next.js export on **Azure Static Web Apps (Free)** with
**managed Python Azure Functions** as a thin BFF proxy. The Jev API key never leaves Azure Key Vault
and APIM.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/web` | Next.js 15 + MUI static-export front end (Jev Studio) |
| `src/api` | Python 3.11 Azure Functions (SWA managed API) — `/api/health`, `/api/models`, `/api/systemone` |
| `infra` | Bicep (resource-group scope): APIM, Key Vault, Log Analytics, App Insights, SWA |
| `infra/policies` | APIM policy XML (`jev-api.xml`, `jev-health.xml`) |
| `infra/hooks` | azd `preprovision` hooks (sh + pwsh) that ensure `APIM_PUBLISHER_EMAIL` / `JEV_API_KEY` are set |
| `azure.yaml` | Azure Developer CLI project (`azd up`): Bicep infra + `web` SWA service (`src/web/swa-cli.config.json`) |
| `.github/workflows` | `ci.yml`, `deploy.yml`, `codeql.yml` |
| `docs/adr` | Architecture Decision Records |

## Build, test, lint

```powershell
# API
cd src/api
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
ruff check . ; mypy jev_proxy ; pytest -q

# Web
cd src/web
npm ci
npm run lint ; npm run typecheck ; npm test ; npm run build   # output: src/web/out

# Infra
az bicep build --file infra/main.bicep
az bicep lint --file infra/main.bicep
```

## Rules for agents

- **Secrets:** never commit keys, connection strings or `local.settings.json`. The Jev key lives only in
  Key Vault (`jev-api-key`) and GitHub secret `JEV_API_KEY`. The browser never sees the Jev key or the
  APIM subscription key.
- **Package feeds:** use the protected Microsoft feeds (`packagefeedproxy.microsoft.io`) configured in
  `src/web/.npmrc` and CI. Never point restores at public PyPI/NuGet.
- **Contracts:** the web ↔ API contract (`{result, meta}` / `{error, meta}`) is shared; update both
  `src/api/jev_proxy/service.py` and `src/web/src/lib/api.ts` together, with tests.
- **Cost:** keep Free/Consumption/Basic SKUs. Discuss before introducing any paid-tier resource.
- **Actions:** pin third-party GitHub Actions to a full commit SHA with the tag in a comment.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `infra:`...). Small, focused PRs.
- **Validation:** run the relevant lint/test/build before proposing changes; don't disable tests.
