# Triaige Dashboard

Next.js review dashboard for human-in-the-loop regression decisions.

## Development

```bash
# From monorepo root
pnpm --filter @triaige/dashboard dev

# Or from this directory
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `RUNNER_BASE_URL` | URL of the FastAPI runner service (default: `http://localhost:8000`) |

## API Proxy

The dashboard proxies requests to the runner service via `/api/runner/*` routes.
This keeps the runner URL server-side and avoids CORS issues.

Example: `GET /api/runner/healthz` → `GET http://localhost:8000/healthz`
