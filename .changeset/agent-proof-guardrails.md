---
"@forge-ts/core": minor
"@forge-ts/enforcer": minor
"@forge-ts/cli": minor
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
"@forge-ts/tsdoc-config": patch
---

feat: agent-proof guardrails — config locking, audit trail, bypass budget, E009/E010

- Config locking system: `forge-ts lock` / `forge-ts unlock --reason="..."`
- Append-only audit trail: `.forge-audit.jsonl` with `forge-ts audit` command
- Bypass budget: `forge-ts bypass --reason="..."` with configurable daily limit (default 3/day)
- E009 rule: tsconfig.json strictness regression detection
- E010 rule: forge-ts config drift detection against locked state
- Lock/unlock events recorded in audit trail
- Bypassed E009/E010 violations downgraded to warnings with [BYPASSED] prefix
- ForgeConfig.bypass section with dailyBudget and durationHours
- 553 tests (85 new), all passing
