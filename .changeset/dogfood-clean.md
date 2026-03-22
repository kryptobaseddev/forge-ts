---
"@forge-ts/core": patch
"@forge-ts/enforcer": patch
"@forge-ts/cli": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

fix: forge-ts passes its own check — 167 violations fixed across 10 files

forge-ts now dogfoods cleanly: `forge-ts check` reports 0 errors and 0 warnings
on its own codebase. Fixed: @since on all exported types, @remarks on all
exported functions, @defaultValue on all optional properties, TSDoc syntax
escaping, stale @example blocks, tsconfig strict flags, package.json engines.
