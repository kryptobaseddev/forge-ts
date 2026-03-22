---
"@forge-ts/cli": minor
"@forge-ts/core": patch
"@forge-ts/enforcer": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
"@forge-ts/tsdoc-config": patch
---

feat: forge-ts init (full project setup) + forge-ts doctor (integrity check)

- `forge-ts init setup` — full project setup: writes forge-ts.config.ts, tsdoc.json, validates tsconfig/package.json, reports environment
- `forge-ts init docs` / `forge-ts init hooks` — unchanged, now subcommands of init
- `forge-ts doctor` — 10-point integrity check: config, tsdoc.json, TypeScript, tsconfig strict, biome, lock, audit, bypass, git hooks
- `forge-ts doctor --fix` — auto-creates missing forge-ts.config.ts and tsdoc.json
- Idempotent: existing files never overwritten, running twice produces same result
- Actionable output: every warning includes the exact command to fix it
- 787 tests (36 new), all passing
