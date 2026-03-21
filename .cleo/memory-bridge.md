# CLEO Memory Bridge

> Auto-generated at 2026-03-21T21:11:04
> Do not edit manually. Regenerate with `cleo refresh-memory`.

## Last Session

- **Session**: ses_20260318193947_42d200
- **Last focused task**: T001

## Key Learnings

- [L-24bac51b] Completed: v0.10.0 integration tests and release validation — Full test suite for lock/unlock, audit trail, bypass budget, E009, E010. Dogfood. CI gre (confidence: 0.70)
- [L-af26b520] Completed: Implement bypass budget system — Configurable daily bypass limit (default 3/day). --reason required. Budget exhaustion blocks further bypas (confidence: 0.70)
- [L-601c1bb9] Completed: Implement config locking system (forge-ts lock/unlock) — forge-ts lock creates .forge-lock.json manifest of current config state. forge-ts  (confidence: 0.70)
- [L-f468a2f2] Completed: Add E010 rule: forge-ts config drift detection — Compare current forge-ts.config.ts rule severities against .forge-lock.json. Error if rule (confidence: 0.70)
- [L-717d4634] Completed: Add E009 rule: tsconfig strictness regression detection — Read tsconfig.json, validate required strict flags from guards.tsconfig.requiredF (confidence: 0.70)
- [L-a82e30e8] Completed: Implement append-only audit trail (.forge-audit.jsonl) — JSON Lines audit log. Events: lock/unlock, rule changes, bypass events, config dri (confidence: 0.70)
- [L-4d4485cd] Completed: Allow result on error envelopes + TTY-aware format default — Three protocol improvements for better CLI tool support:
1. Allow result along (confidence: 0.69)
- [L-83bf4771] Completed: Refactor existing SSG code to use adapter system — Replace ssg-config.ts and markdown.ts SSG-specific code with adapter calls. generate() u (confidence: 0.69)
