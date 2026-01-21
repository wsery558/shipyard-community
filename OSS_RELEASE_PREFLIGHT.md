# OSS Release Preflight

Run through these commands from the repo root before filing an OSS release PR. Each step uses the open-core-only behavior (platform endpoints return 501 by design); if you hit a 501 it is intentional and safe.

1. `pnpm -s build` – compiles the React UI into `ui-dist`. Expect Vite to finish and report generated chunks (warnings about large chunks are acceptable).
2. `pnpm -s test:smoke` – runs the smoke matrix with `WS_SMOKE=1`. The script launches the server on an ephemeral port (override with `SMOKE_PORT` or other `PORT`), prints the base URL, and then hits `/health`, `/api/state`, and `/api/projects`; all three must return HTTP 200 before it prints `✅ smoke: all checks passed`.
3. `pnpm -s lint` – emits warnings over the JS surface but exits 0 (lint is permissive in this snapshot).
4. `pnpm -s typecheck` – stub: prints `No TypeScript typecheck (JS project)` and exits 0.
5. `pnpm -s start` – serves API + UI on port **8788** unless you override `PORT`. Keep it running while executing the following curls:
   - `curl -fsS http://127.0.0.1:8788/health` (should return HTTP 200 with a small JSON payload such as `{"ok":true,...}`)
   - `curl -fsS http://127.0.0.1:8788/api/state` (should return JSON with orchestrator state)
   - `curl -fsS http://127.0.0.1:8788/api/projects` (should return the project list as JSON)

If any of the above commands fail in a way that contradicts the expected outputs, capture the log and provide context in your PR. Smoke curls confirm the default port and `WS_SMOKE` behavior; 501 responses on paid/platform routes are the intentional boundary for the open-core snapshot.
