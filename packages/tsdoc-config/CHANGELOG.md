# @forge-ts/tsdoc-config

## 0.12.0

### Patch Changes

- cdd850b: feat: intelligent guide generation — code-derived guides, FORGE:STUB zones, W007/W008

  - Guide discovery heuristics: config interfaces, error types, @guide tags, @category grouping, entry points
  - FORGE:STUB zones with hash-based modification detection (preserve user edits, regenerate untouched stubs)
  - Guide page rendering with FORGE:AUTO sections (config property tables, error catalogs, function signatures)
  - W007 rule: detect stale guide FORGE:AUTO references to removed symbols
  - W008 rule: warn on public symbols not documented in any guide
  - ForgeConfig.guides section with enabled, autoDiscover, and custom guide definitions
  - Dogfood generates 3 guide pages automatically (configuration, error-handling, getting-started)
  - 665 tests (68 new), all passing

## 0.11.0

### Patch Changes

- aa5af65: feat: dev layer enforcement — E013, E014, E015, W005, @concept/@guide tags

  - E013: require @remarks on exported functions and classes (default: error)
  - E014: require @defaultValue on optional interface properties (default: warn)
  - E015: require @typeParam on generic symbols (default: error)
  - W005: warn when {@link} references exist but no @see tags (default: warn)
  - Parse @concept and @guide custom TSDoc tags in walker for guide generation pipeline
  - Walker now extracts @remarks, @see, @typeParam, @defaultValue from TSDoc comments
  - 597 tests (44 new), all passing

## 0.10.0

### Patch Changes

- 5d4a328: feat: agent-proof guardrails — config locking, audit trail, bypass budget, E009/E010

  - Config locking system: `forge-ts lock` / `forge-ts unlock --reason="..."`
  - Append-only audit trail: `.forge-audit.jsonl` with `forge-ts audit` command
  - Bypass budget: `forge-ts bypass --reason="..."` with configurable daily limit (default 3/day)
  - E009 rule: tsconfig.json strictness regression detection
  - E010 rule: forge-ts config drift detection against locked state
  - Lock/unlock events recorded in audit trail
  - Bypassed E009/E010 violations downgraded to warnings with [BYPASSED] prefix
  - ForgeConfig.bypass section with dailyBudget and durationHours
  - 553 tests (85 new), all passing

## 0.9.0

### Minor Changes

- 49da7c5: feat: TSDoc ecosystem foundation — tsdoc-config integration, W006 rule, ForgeConfig expansion

  - Integrate @microsoft/tsdoc-config into walker.ts (replaces bare `new TSDocConfiguration()`)
  - Create @forge-ts/tsdoc-config package with opinionated tsdoc.json preset
  - Custom TSDoc tags: @route, @category, @since, @guide, @concept
  - Add W006 rule: surfaces 70+ TSDoc parser-level syntax errors as configurable warnings
  - Expand ForgeConfig with `tsdoc` section (writeConfig, customTags, enforce per standardization group)
  - Expand ForgeConfig with `guards` section (tsconfig, biome, packageJson drift detection config)
  - forge-ts init now writes tsdoc.json with extends to @forge-ts/tsdoc-config
  - 468 tests (27 new), all passing
