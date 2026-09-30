# Jev Evaluation Studio

Static Next.js frontend for evaluating TypeSafe AI's Jev System One decision model through Azure API Management.

## Scripts

```powershell
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

The production build is a static export in `out/` for Azure Static Web Apps Free.

## Configuration

`NEXT_PUBLIC_API_BASE=/api` is the build-time default. In local development you can point the Settings page to `http://localhost:7071/api` when running the managed API with `func start`, or set a different same-origin APIM proxy path.

No secrets belong in the browser. APIM subscription keys and Jev provider keys should stay in the API/APIM layer.
