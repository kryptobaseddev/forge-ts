---
"@forge-ts/core": minor
"@forge-ts/cli": minor
"@forge-ts/enforcer": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

feat: DX polish — consola logging, tsdoc-config merged into core, spec sync

- Replace hand-rolled logger.ts with consola (UnJS ecosystem)
- Merge @forge-ts/tsdoc-config into @forge-ts/core (tsdoc-preset/tsdoc.json)
- Walker fallback loads bundled preset — custom tags always recognized
- TSDoc spec sync script: 29 tags + 73 message IDs as machine-readable JSON
- 790 tests (3 new), all passing
- Down from 7 packages to 6 (tsdoc-config absorbed into core)
