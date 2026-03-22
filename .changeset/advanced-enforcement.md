---
"@forge-ts/core": minor
"@forge-ts/enforcer": minor
"@forge-ts/cli": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

feat: advanced enforcement — Knip ignore, stale DocTest, LLM anti-patterns, orphaned links

- Knip integration: ignoreFile config + @forge-ignore tag to skip enforcement on dead exports
- W013: detect stale @example blocks (arg count mismatch vs function signature)
- E019: flag @ts-ignore/@ts-expect-error in non-test files (default: error)
- E020: flag `any` type in exported symbol signatures (default: warn)
- W012: detect orphaned {@link} display text that doesn't match target summary
- Walker extracts {@link} display text for W012 validation
- @forge-ignore custom tag added to tsdoc preset
- 841 tests (29 new), all passing
- 33 enforcer rules total (E001-E020, W001-W013)
