# Copilot instructions — jev-on-apim

See [`AGENTS.md`](../AGENTS.md) for the full repository guide. Key points:

- Stack: Next.js 15 (static export, TypeScript strict, MUI) · Python 3.11 Azure Functions (SWA managed API,
  `httpx`, `pydantic`) · Bicep · GitHub Actions.
- Request path: Browser → SWA `/api/*` (Functions BFF) → APIM `jev/v1/*` (subscription key) →
  `https://jevmodel.org/v1/systemone` (Bearer key injected by APIM from Key Vault).
- Never expose the Jev API key or APIM subscription key to the browser or source control.
- Prefer small, typed, tested functions. Python: ruff + mypy clean, pytest. TypeScript: ESLint clean, Vitest.
- Keep resources on Free / Consumption / Basic SKUs.
- Pin GitHub Actions by SHA. Use the protected package feeds (`packagefeedproxy.microsoft.io`).
- Use Conventional Commits.
