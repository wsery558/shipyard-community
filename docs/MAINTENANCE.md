# Maintenance checks

Run these checks from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

`pnpm test` runs, in order:

1. Script-target validation: explicit local entry files and `pnpm run` aliases.
2. Open-core boundary scanning.
3. Node unit tests: budget thresholds, plan identity/status preservation,
   weighted progress, policy decisions, policy reloads and script-check failures.
4. Server smoke checks: `/health`, `/api/state` and `/api/projects`.

The command-policy tests pass strings to the classifier. They never execute the
destructive or approval-required example commands. Policy fixtures live in
disposable temporary directories, so tests do not change the user's policy file.

The project and CI pin the Node 20-compatible pnpm 9.15.9. CI installs with
`--frozen-lockfile --ignore-scripts`. Smoke tests set `DISABLE_PTY=1` and do not
exercise the optional native terminal. Installation lifecycle scripts are not
approved or run by that CI job; native terminal support needs separate validation.

## Command cleanup

The plan and command-policy regression aliases now invoke their actual test files.
The following commands have been removed because their referenced scripts were
absent: `test:unit:quarantine`, `test:integration:sprint5`, `test:production`,
`pr:update:rc1`, `staging:sanity`, `artifact:health`, `artifact:monitor`,
`artifact:report`, `deploy:validate`, `deploy:setup-monitoring` and `pack:open`.
`typecheck` was also removed: it only printed a message in this JavaScript project.

## Coverage limits

- These tests verify the listed behaviors, not every API route or UI interaction.
- Command rules are regex-based classifiers, not a shell parser or sandbox. The
  whitespace regression fix recognizes the standard fork-bomb spelling; it does
  not establish complete detection of every possible equivalent command.
- Budget helpers expect valid finite numbers. Existing handling of `NaN` and
  infinities is not covered as a supported input contract. A budget check is not
  a reservation of future spending.
- Plan progress expects finite, nonnegative point weights. Invalid negative
  weights can currently produce an out-of-range percentage.
- Lint remains warning-based. The legacy open-release audit is a static check,
  not a security certification or live validation of every paid route.

Keep these limits visible when describing releases. Record actual check results
and link the reviewed change and CI run when a maintenance release is published.
