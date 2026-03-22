# CLEO Memory Bridge

> Auto-generated at 2026-03-22T02:15:50
> Do not edit manually. Regenerate with `cleo refresh-memory`.

## Last Session

- **Session**: ses_20260321201444_a858fc

## Key Learnings

- [L-0787af6f] Completed: Merge @forge-ts/tsdoc-config into @forge-ts/core — Move tsdoc.json from packages/tsdoc-config into packages/core/tsdoc-preset/tsdoc.json. U (confidence: 0.70)
- [L-53db5b76] Completed: Add TSDoc spec sync script — Create scripts/sync-tsdoc-spec.ts that reads StandardTags and TSDocMessageId from installed @microsoft/tsdoc,  (confidence: 0.70)
- [L-07d62cd5] Completed: Replace custom logger.ts with consola — Add consola dependency. Create centralized createForgeLogger() that respects TTY/JSON/quiet modes.  (confidence: 0.70)
- [L-58569e0c] Completed: v0.13.0 integration tests and release validation — Full test suite for hooks, prepublish, E011-E012, E016. Dogfood. CI green. Changeset. (confidence: 0.70)
- [L-3132ae05] Completed: Add E016 rule: release tag required on public symbols — Require @public, @beta, or @internal on all exported symbols. Prevents accidental e (confidence: 0.70)
- [L-8a5f1a12] Completed: Add E012 rule: package.json engine field tampering — Validate engines.node field in package.json against guards.packageJson.minNodeVersion. (confidence: 0.70)
- [L-b32b4e1c] Completed: Add E011 rule: Biome config weakening detection — Read biome.json, compare against locked rules in .forge-lock.json. Error if rules switche (confidence: 0.70)
- [L-acb81647] Completed: Implement forge-ts prepublish gate command — Single command that runs check + build. Integrates with npm prepublishOnly lifecycle. Non-zero (confidence: 0.70)
