# Troubleshooting Shipyard Community

## Quickstart Recap
1. `pnpm install`
2. `pnpm build`
3. `pnpm start`
4. `pnpm test:smoke`

Keep the server running on the default port (8788) unless you override `PORT=`.

## Common Issues

- **Build fails**: confirm Node.js v20+ (`node --version`) and pnpm 9+. Clear `node_modules` and rerun `pnpm install` if dependencies look inconsistent.
- **`pnpm start` stalls**: check `PORT` conflicts (`lsof -i :8788`) or use `PORT=3100 pnpm start`. The bundled UI lives in `ui-dist/`, so rerun `pnpm build` if the folder is missing.
- **Smoke test errors**: `pnpm test:smoke` hits `/health`, `/api/state`, `/api/projects`. If it fails, capture the last 30 lines and note your OS/Node/pnpm version before reporting.
- **501 responses**: Paid-platform endpoints (e.g., `/api/platform/auth/me`, `/api/compliance/passive`) intentionally return HTTP 501 in this open-core snapshot. This means the feature is stubbed rather than broken.

## Where to Report Problems
- Chat about quickstart friction in [GitHub Discussions → Show and tell](https://github.com/wsery558/shipyard-community/discussions).
- Open an issue and reference the `quickstart-problem` template with OS/Node/pnpm details when smoke fails.
- Security-sensitive issues? Email `tsaielectro0628@gmail.com` per [docs/SECURITY.md](docs/SECURITY.md).

## Tips
- Keep your data directory backed up before deleting or resetting anything (`./data`).
- Use the `reports/` and `data/` JSON files as a reference for projects and audit history.
- Run `bash scripts/polite_audit.sh` to check the repo before opening a PR.
