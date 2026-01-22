# Shipyard Community v0.2.3

This release is about **activation**: get to a reproducible run, pass verification, and generate shareable proof.

## What’s new
- Docs & branding cleaned up (Shipyard Community terms and links)
- Quickstart problem issue template added (so your setup issues are actionable)
- Polite audit updated to allow the official contact email in required OSS docs

## Quickstart (5 minutes)
1) Clone & install
- git clone https://github.com/wsery558/shipyard-community
- cd shipyard-community
- pnpm install

2) Run
- pnpm dev

## Activation (definition)
You’re “activated” if you can:
- Run the app locally
- Complete the smoke/verification path (per README/docs)
- Produce an evidence output you can paste into an Issue (or attach)

## Troubleshooting (top 5)
1) Node/pnpm version mismatch → verify your Node version and re-install deps
2) Install fails → delete node_modules + lockfile, reinstall
3) Port already in use → change port / kill conflicting process
4) UI build errors → run the recommended build command and paste the first error block
5) Smoke fails → open “Quickstart problem” issue with logs + environment details

## Where to report
- Quickstart problems: use the GitHub issue template
- Security: use GitHub Security Advisories (preferred)
