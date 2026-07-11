# automation-service

A mini-service that runs Playwright Firefox automations on behalf of the
Browser Automation Framework dashboard (Next.js app on port 3000).

- **Port:** 3003 (hardcoded, not from env)
- **HTTP (Hono):**
  - `GET /health` → `{ ok, uptime }`
  - `POST /run` → body `{ runId, callbackUrl, profile, tasks }`; returns `200 { ok: true }`
    immediately and runs the automation async.
- **Socket.io (path `/`, required by Caddy):** emits `log`, `screenshot`,
  `extract`, `status` events to room `run:<runId>`. Late-joining clients
  emit `replay { runId }` to receive buffered past events.

## Run

```bash
cd mini-services/automation-service
bun install
bun run dev          # bun --hot index.ts  (auto-reload)
```

## Architecture

Stateless — no DB access. After a run finishes it POSTs the final state
(logs/screenshots/extracts/sessionState) back to the Next.js callback URL
provided in the run request, which persists it to SQLite via Prisma.

In-memory per-run event buffers are garbage-collected 30 minutes after the
run ends (for late-join replay).
