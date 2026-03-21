---
"@forge-ts/core": minor
"@forge-ts/enforcer": minor
"@forge-ts/cli": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
"@forge-ts/tsdoc-config": patch
---

feat: dev layer enforcement — E013, E014, E015, W005, @concept/@guide tags

- E013: require @remarks on exported functions and classes (default: error)
- E014: require @defaultValue on optional interface properties (default: warn)
- E015: require @typeParam on generic symbols (default: error)
- W005: warn when {@link} references exist but no @see tags (default: warn)
- Parse @concept and @guide custom TSDoc tags in walker for guide generation pipeline
- Walker now extracts @remarks, @see, @typeParam, @defaultValue from TSDoc comments
- 597 tests (44 new), all passing
