# @forge-ts/doctest

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

- Updated dependencies [aa5af65]
  - @forge-ts/core@0.11.0

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

- Updated dependencies [5d4a328]
  - @forge-ts/core@0.10.0

## 0.9.0

### Patch Changes

- 49da7c5: feat: TSDoc ecosystem foundation — tsdoc-config integration, W006 rule, ForgeConfig expansion

  - Integrate @microsoft/tsdoc-config into walker.ts (replaces bare `new TSDocConfiguration()`)
  - Create @forge-ts/tsdoc-config package with opinionated tsdoc.json preset
  - Custom TSDoc tags: @route, @category, @since, @guide, @concept
  - Add W006 rule: surfaces 70+ TSDoc parser-level syntax errors as configurable warnings
  - Expand ForgeConfig with `tsdoc` section (writeConfig, customTags, enforce per standardization group)
  - Expand ForgeConfig with `guards` section (tsconfig, biome, packageJson drift detection config)
  - forge-ts init now writes tsdoc.json with extends to @forge-ts/tsdoc-config
  - 468 tests (27 new), all passing

- Updated dependencies [49da7c5]
  - @forge-ts/core@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.8.0

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.7.0

## 0.6.6

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.5

## 0.6.4

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.2

## 0.6.1

### Patch Changes

- fix: CLI version SSoT, actionable error envelopes, config validation

  - Read CLI version from package.json at runtime instead of hardcoding (prevents version mismatch between published package and --help output)
  - Populate top-level errors on check/test CommandOutput so LAFS JSON envelopes include actionable error codes and messages instead of generic "Command failed"
  - Reconcile doctest exit code with TAP-parsed failures: when node:test exits non-zero but no test failures were parsed (compilation/import error), report failed >= 1 with D002 diagnostic including runner output
  - Add config schema validation that warns on unknown top-level keys and unknown enforce rules (no longer silently ignored)
  - Update skill docs and scripts to reflect agent-first defaults (non-TTY auto-selects JSON, no --json flag needed)

- Updated dependencies []:
  - @forge-ts/core@0.6.1

## 0.6.0

### Minor Changes

- Skill generator v2 with stub idempotency, progressive enrichment, and config-driven customization.

  **New features:**

  - `ForgeConfig.skill` section: inject `customSections` and `extraGotchas` into generated SKILL.md
  - `--force-stubs` CLI flag to reset stub pages to scaffolding state
  - Progressive stub enrichment via `FORGE:AUTO-START`/`FORGE:AUTO-END` markers
  - `GeneratedFile.stub` flag propagated through all SSG adapters
  - `ForgeConfig.project` extended with `description`, `version`, `bin`, `scripts`, `keywords`
  - CLI detection from `bin` field generates purpose-built scripts and `-D` install flag
  - Numbered trigger scenarios in SKILL.md description

  **Bug fixes:**

  - `{@link Target}` tags in TSDoc summaries now render as `` `Target` `` instead of being silently stripped
  - Configuration type columns show correct types (`string` instead of empty, `{ enabled: boolean; ... }` instead of `boolean; ...}`)
  - Stub pages (concepts, guides, faq, contributing, changelog) no longer overwritten on rebuild
  - `configuration.mdx` correctly classified as auto-generated (not stub)

  **Breaking changes:** None. All new fields are optional with backwards-compatible defaults.

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.0

## 0.5.0

### Patch Changes

- [`7c300b2`](https://github.com/kryptobaseddev/forge-ts/commit/7c300b21199f6f2c2a7e6ae3b7f2ba0b30e757c5) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - SSG adapter system with `forge-ts init docs` command.

  - Central SSGAdapter interface with registry pattern (DRY/SOLID)
  - 4 first-class providers: Mintlify (docs.json), Docusaurus v3, Nextra v4, VitePress v2
  - `forge-ts init docs --target mintlify` scaffolds complete doc site
  - Safety checks for existing scaffold, cross-target collision detection
  - Default target: Mintlify
  - LAFS JSON output on init command
  - generate() refactored to use adapter system

- Updated dependencies [[`7c300b2`](https://github.com/kryptobaseddev/forge-ts/commit/7c300b21199f6f2c2a7e6ae3b7f2ba0b30e757c5)]:
  - @forge-ts/core@0.5.0

## 0.4.0

### Patch Changes

- [`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - v0.4 release: configurable rules, dead link validation, OpenAPI path extraction, deprecation tracking.

  - Per-rule configuration: toggle E001-E008 individually as error/warn/off
  - E008: {@link} dead link validation against the project symbol graph
  - @route TSDoc tag → OpenAPI path entries with parameters and responses
  - W004: cross-monorepo deprecation tracking for @deprecated imports

- Updated dependencies [[`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f)]:
  - @forge-ts/core@0.4.0

## 0.3.1

### Patch Changes

- Complete TSDoc coverage across all packages. Every exported symbol, interface member, and function now has documentation with @example blocks. forge-ts check passes with 0 errors on all 6 packages (229 symbols). Fixed @packageDocumentation tag extraction in walker.

- Updated dependencies []:
  - @forge-ts/core@0.3.1

## 0.3.0

### Patch Changes

- [`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Upgrade OpenAPI spec output from 3.1.0 to 3.2.0. Added new type contracts for 3.2 features: query method, additionalOperations, querystring parameters, MediaType/Encoding objects. Upgraded TypeScript to 6.0.1-rc, vite to v8, pnpm to 10.32.1. True dogfood with published @forge-ts/cli from npm.

- [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Opinionated SSoT release: multi-page doc site generation, strict enforcement (E004-E007), SSG config generation (Mintlify/Docusaurus/Nextra/VitePress), LAFS MVI progressive disclosure for agent guidance. llms.txt now defaults to enabled.

- Updated dependencies [[`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805), [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361)]:
  - @forge-ts/core@0.3.0

## 0.2.1

### Patch Changes

- Fix package metadata: add per-package READMEs, correct repository URLs to kryptobaseddev/forge-ts, remove stale codluv references.

- Updated dependencies []:
  - @forge-ts/core@0.2.1

## 0.2.0

### Minor Changes

- [`0ce2f3e`](https://github.com/kryptobaseddev/forge-ts/commit/0ce2f3eca6e67e18d9baba867bcd4ac6236b1ae6) - Initial release of forge-ts - the universal TypeScript documentation compiler.
