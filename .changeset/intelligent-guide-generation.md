---
"@forge-ts/gen": minor
"@forge-ts/core": minor
"@forge-ts/enforcer": minor
"@forge-ts/cli": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
"@forge-ts/tsdoc-config": patch
---

feat: intelligent guide generation — code-derived guides, FORGE:STUB zones, W007/W008

- Guide discovery heuristics: config interfaces, error types, @guide tags, @category grouping, entry points
- FORGE:STUB zones with hash-based modification detection (preserve user edits, regenerate untouched stubs)
- Guide page rendering with FORGE:AUTO sections (config property tables, error catalogs, function signatures)
- W007 rule: detect stale guide FORGE:AUTO references to removed symbols
- W008 rule: warn on public symbols not documented in any guide
- ForgeConfig.guides section with enabled, autoDiscover, and custom guide definitions
- Dogfood generates 3 guide pages automatically (configuration, error-handling, getting-started)
- 665 tests (68 new), all passing
