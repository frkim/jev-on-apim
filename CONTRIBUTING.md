# Contributing

1. Create a branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Make focused changes. Keep the web ↔ API contract in sync and add or update tests.
3. Run the checks listed in [`AGENTS.md`](AGENTS.md#build-test-lint) locally.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles.
5. Open a pull request. CI (`ci.yml`) and CodeQL must pass. Merging to `main` triggers **Deploy**.

## Local development

```powershell
# Terminal 1 – API (mock mode by default, no Azure needed)
cd src/api
Copy-Item local.settings.sample.json local.settings.json
func start

# Terminal 2 – web
cd src/web
npm ci
npm run dev   # http://localhost:3000, /api proxied to http://localhost:7071
```

To call the real model locally through APIM, set `APIM_GATEWAY_URL`, `APIM_SUBSCRIPTION_KEY` and
`JEV_MOCK_MODE=false` in `src/api/local.settings.json` (never commit that file).
