# Changelog

## Unreleased

- Replace the placeholder unit-test command with behavioral budget, plan,
  command-policy and package-script tests.
- Recognize whitespace in the standard fork-bomb pattern in both the built-in
  policy and the shipped policy file, preserving the earlier matches.
- Run script-target validation, boundary checks, unit tests and server smoke
  checks through `pnpm test` and CI.
- Repair plan and policy regression aliases; remove absent snapshot-only
  command targets and the message-only typecheck.
- Document the actual scope of verification and known numeric-input limits.
