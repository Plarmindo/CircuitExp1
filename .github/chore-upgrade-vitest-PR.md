Title: chore(deps): propose Vitest & related dependency upgrades (branch: chore/upgrade-vitest)

## Summary

This branch isolates dependency bumps and audit artifacts related to the test/tooling stack. It contains:

- An initial set of package manifest changes targeting Vitest and related coverage tooling.
- `licenses-summary.json` and `npm-audit.json` produced during the audit run.
- Minor docs updates (README Features & Architecture and `docs/architecture-overview.md`).

## Why

- `npm audit` reported a set of moderate issues; a notable suggested fix is bumping `@vitest/coverage-v8` to v3.2.4.
- Upgrading test tooling will keep the repo current and resolve known advisory recommendations.

## What changed (high-level)

- package.json / package-lock.json: dependency bumps (see package diffs in this PR)
- docs: `README.md` (Features & Architecture), `docs/architecture-overview.md`
- audits: `licenses-summary.json`, `npm-audit.json`

## Test & Verification

- Unit & E2E summary (latest run on this branch): All unit tests passed; full suite reported: 85 passed, 2 skipped.
- Security tests: IPC validation tests passed after introducing `ipc-validation.cjs`.
- Coverage & QA gates: no regressions observed in local coverage run used for CI.

## Audit Findings (from `npm-audit.json`)

- Moderate: `@vitest/coverage-v8` — suggested fix: upgrade to 3.2.4.
- Moderate: `esbuild` and other transitive deps — see `npm-audit.json` for details and remediation suggestions.

## Recommended next steps

1. Review diff for `package.json`/`package-lock.json` and approve targeted dependency bumps.
2. If acceptable, run CI to validate builds and packaging steps (packager/signer jobs may be required for artifact
   generation).
3. Address audit suggestions in order of severity; propose follow-up PRs for non-trivial upgrades requiring code
   changes.

## Notes & Caveats

- Local packaging on Windows encountered symlink/privilege errors while producing NSIS/portable installers; CI (GitHub
  Actions) is recommended for producing signed installers.
- `gh` CLI is not available in this environment; open the PR using the GitHub web UI and paste the prepared title/body
  below.

## Prepared PR body (copy & paste to GitHub PR form)

Title: chore(deps): propose Vitest & related dependency upgrades

Body: This PR proposes updating test/tooling dependencies (Vitest coverage helpers and related transitive deps).
Summary:

- Reason: fix advisories reported by `npm audit` and keep test toolchain current.
- Files changed: package.json, package-lock.json (see file diff).
- Artifacts: `licenses-summary.json`, `npm-audit.json` added for reviewer inspection.

Test results on branch: unit tests passing (full suite: 85 passed, 2 skipped). IPC validation tests included and
passing.

Audit notes:

- `@vitest/coverage-v8` flagged: recommended upgrade to v3.2.4.
- Please inspect `npm-audit.json` for other moderate issues.

Recommended reviewers: build/test maintainers, security owner.

If accepted, run CI and verify packaging artifacts are produced in the `dist/` job (packaging on Windows may require
elevated privileges or CI runner).
