# @forge-ts/core

## 0.20.0

### Minor Changes

- ## v0.20.0 — TypeScript 6.0, @remarks pipeline, staleness detection, barometer

  ### Breaking Changes

  - Upgraded TypeScript from 5.9.3 to 6.0.2 across all packages
  - Renamed `@cleocode/lafs-protocol` dependency to `@cleocode/lafs`

  ### New Features

  - **@remarks pipeline**: Walker now promotes `@remarks` content to `ForgeSymbol.documentation.remarks`, rendered in `llms-full.txt` and generated docs
  - **Staleness detection rules (W014-W017)**: Detect documentation drift — param name mismatch, param count mismatch, void @returns, placeholder @remarks
  - **`forge-ts barometer` command**: Generate documentation effectiveness Q&A from the AST with codified rubric
  - **`forge-ts version` subcommand**: Also supports `-V` and `-v` flags
  - **Versionguard integration**: Strict config with husky pre-commit/pre-push hooks
  - **Package-grouped llms.txt**: Symbols organized by package with @packageDocumentation summaries
  - **Package descriptions in index.mdx**: Uses @packageDocumentation summaries instead of symbol counts

  ### Fixes

  - Generator project name: uses `config.project.packageName` (was `"."` from rootDir)
  - OpenAPI metadata: title/version/description from config.project (was "API Reference" v0.0.0)
  - llms.txt: named functions (was anonymous signatures), filtered noise
  - Site generator: excludes root config files from package grouping (6 packages, not 7)
  - Hero example selection: prefers index.ts entry-point functions
  - TSDoc coverage: 0 errors across 355 symbols (was 95 errors)
  - EnforceRules TSDoc: documents all 33+ rules (was "E001-E007")

  ### Documentation

  - Full TSDoc coverage across all 6 packages
  - Documentation effectiveness barometer at `.forge/barometer.md`
  - Updated VISION.md with TS 6.0.2 and @cleocode/lafs references
  - Cleaned docs/: removed stale files, kept VISION, ARCHITECTURE, ROADMAP, skill

## 0.19.5

### Patch Changes

- eba8a15: fix: forge-ts passes its own check — 167 violations fixed across 10 files

  forge-ts now dogfoods cleanly: `forge-ts check` reports 0 errors and 0 warnings
  on its own codebase. Fixed: @since on all exported types, @remarks on all
  exported functions, @defaultValue on all optional properties, TSDoc syntax
  escaping, stale @example blocks, tsconfig strict flags, package.json engines.

## 0.19.4

### Patch Changes

- cf8c3d0: fix: E020 false positives — interfaces/types no longer reported as containing `any`

  The walker's buildSignature() used getTypeOfSymbolAtLocation() which returns
  `any` for interface and type alias symbols. Changed to getDeclaredTypeOfSymbol()
  for interfaces, type aliases, and enums. Also added NoTruncation flag to prevent
  TypeScript from collapsing complex types to `any`.

## 0.19.3

### Patch Changes

- a1db045: fix: rename @forge-ignore to @forgeIgnore — hyphen violated TSDoc tag name spec

  The hyphen in @forge-ignore caused TSDocConfigFile to report hasErrors:true,
  poisoning config loading for ALL projects. Custom tags (@since, @route, etc.)
  were silently unrecognized, causing false W006 "tag not defined" and W011
  "missing @since" warnings even when tags were correctly used.

  Also relaxed the hasErrors guard in walker.ts — configureParser is tolerant
  and should always be called when a tsdoc.json exists.

## 0.19.2

### Patch Changes

- 21dc38f: fix: implement per-group TSDoc enforcement + customTags writing to tsdoc.json

  - tsdoc.enforce.core/extended/discretionary now controls rule severity by group
  - Individual enforce.rules overrides always take precedence over group settings
  - Guard rules (E009-E012) unaffected by group settings
  - forge-ts init writes customTags from config into tsdoc.json (tagDefinitions + supportForTags)
  - doctor --fix respects customTags when generating tsdoc.json
  - Updated FORGE-TSDOC-TAGS.md and skill doc to v0.19.1 with all 33 rules and 15 tags
  - 859 tests (18 new), all passing

## 0.19.1

### Patch Changes

- fix: E005 @packageDocumentation now detects tags on first statement

  The walker now checks both the sourceFile node AND sourceFile.statements[0] for @packageDocumentation tags, matching the TSDoc spec behavior where file-level comments attach to the first statement.

## 0.19.0

### Minor Changes

- f8aa477: feat: advanced enforcement — Knip ignore, stale DocTest, LLM anti-patterns, orphaned links

  - Knip integration: ignoreFile config + @forge-ignore tag to skip enforcement on dead exports
  - W013: detect stale @example blocks (arg count mismatch vs function signature)
  - E019: flag @ts-ignore/@ts-expect-error in non-test files (default: error)
  - E020: flag `any` type in exported symbol signatures (default: warn)
  - W012: detect orphaned {@link} display text that doesn't match target summary
  - Walker extracts {@link} display text for W012 validation
  - @forge-ignore custom tag added to tsdoc preset
  - 841 tests (29 new), all passing
  - 33 enforcer rules total (E001-E020, W001-W013)

## 0.18.0

### Patch Changes

- feat: husky full integration, check --staged, shared pkg-json utility

  - forge-ts init hooks: pre-commit + pre-push, prepare script, husky v9 format
  - forge-ts check --staged: only check git-staged .ts/.tsx files
  - forge-ts doctor: validates husky installed, prepare script, both hooks active
  - Shared pkg-json.ts utility: DRY read-modify-write for package.json operations
  - 812 tests (25 new), all passing

## 0.17.0

### Minor Changes

- fix: critical DX bugs — defineConfig, minVisibility strings, init script wiring

  - Add defineConfig() to @forge-ts/core for type-safe config authoring
  - minVisibility now accepts string literals ("public"/"beta"/"internal"/"private")
  - Init template simplified: only overrides what differs from defaults
  - Init wires forge-ts scripts into package.json (forge:check, forge:test, forge:build, forge:doctor, prepublishOnly)
  - Script wiring is idempotent — existing scripts never overwritten
  - 797 tests (7 new), all passing

## 0.16.0

### Minor Changes

- aa58c8f: feat: DX polish — consola logging, tsdoc-config merged into core, spec sync

  - Replace hand-rolled logger.ts with consola (UnJS ecosystem)
  - Merge @forge-ts/tsdoc-config into @forge-ts/core (tsdoc-preset/tsdoc.json)
  - Walker fallback loads bundled preset — custom tags always recognized
  - TSDoc spec sync script: 29 tags + 73 message IDs as machine-readable JSON
  - 790 tests (3 new), all passing
  - Down from 7 packages to 6 (tsdoc-config absorbed into core)

## 0.15.0

### Patch Changes

- d3f5350: feat: forge-ts init (full project setup) + forge-ts doctor (integrity check)

  - `forge-ts init setup` — full project setup: writes forge-ts.config.ts, tsdoc.json, validates tsconfig/package.json, reports environment
  - `forge-ts init docs` / `forge-ts init hooks` — unchanged, now subcommands of init
  - `forge-ts doctor` — 10-point integrity check: config, tsdoc.json, TypeScript, tsconfig strict, biome, lock, audit, bypass, git hooks
  - `forge-ts doctor --fix` — auto-creates missing forge-ts.config.ts and tsdoc.json
  - Idempotent: existing files never overwritten, running twice produces same result
  - Actionable output: every warning includes the exact command to fix it
  - 787 tests (36 new), all passing

## 0.14.0

### Minor Changes

- f29584f: feat: complete tag system — all 14 custom tags, 27 enforcer rules, zero PLANNED items

  - Fix: @category and @since extraction was broken (defined in tsdoc.json but never extracted by walker)
  - Add 9 new custom tags: @response, @query, @header, @body, @quickstart, @faq, @breaking, @migration, @complexity
  - Add 5 new enforcer rules: E017 (internal re-export), E018 (route without response), W009 (inheritDoc source), W010 (breaking without migration), W011 (since on public exports)
  - Extract {@inheritDoc} targets in walker for W009 validation
  - tsdoc.json preset: 14 custom tags, 38 total supported tags
  - 751 tests (21 new), all passing
  - FORGE-TSDOC-TAGS.md: zero PLANNED items — everything is ACTIVE

## 0.13.0

### Minor Changes

- 6d0fa89: feat: safety pipeline + ecosystem integration — init --hooks, prepublish, E011/E012/E016

  - forge-ts init hooks: detect husky/lefthook and scaffold pre-commit hooks with forge-ts check
  - forge-ts prepublish: combined check+build gate for npm prepublishOnly lifecycle
  - E011 rule: Biome config weakening detection (error->warn/off drift against locked state)
  - E012 rule: package.json engine field tampering (Node.js version downgrade detection)
  - E016 rule: require release tag (@public/@beta/@internal) on all exported symbols
  - 730 tests (65 new), all passing
  - Complete enforcement suite: 22 rules across 4 layers (API, Dev, Consumer, Config Guard)

## 0.12.0

### Minor Changes

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

### Minor Changes

- aa5af65: feat: dev layer enforcement — E013, E014, E015, W005, @concept/@guide tags

  - E013: require @remarks on exported functions and classes (default: error)
  - E014: require @defaultValue on optional interface properties (default: warn)
  - E015: require @typeParam on generic symbols (default: error)
  - W005: warn when {@link} references exist but no @see tags (default: warn)
  - Parse @concept and @guide custom TSDoc tags in walker for guide generation pipeline
  - Walker now extracts @remarks, @see, @typeParam, @defaultValue from TSDoc comments
  - 597 tests (44 new), all passing

## 0.10.0

### Minor Changes

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

## 0.8.0

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.6

### Patch Changes

- fix: surface config load failures instead of silently falling back to defaults

  Config files that exist but fail to import (e.g. `.ts` config in a CommonJS project without `"type": "module"`) now produce a warning to stderr and in `_configWarnings` on the config object. Previously the error was silently swallowed, causing forge-ts to run with default config while the user's config file was ignored with no feedback.

## 0.6.5

### Patch Changes

- fix: SKILL-{project} directory naming, skill references, config warnings in envelope

  - Generated skill directory uses `SKILL-{project}` prefix convention (e.g. `SKILL-core` instead of `core`)
  - Config warnings surfaced in JSON envelope under `result._warnings` for agent visibility
  - New skill references: `references/skill-config.md` (skill package configuration), `references/guides.md` (auto-generated vs stub pages, editing strategy)
  - Updated `references/configuration.md` with skill config, project metadata fields, and unknown-key warning behavior
  - Deduplicated `generatedFiles` via Set

## 0.6.4

### Patch Changes

- fix: surface config warnings in JSON envelope, deduplicate generatedFiles

  - Config warnings (unknown keys, invalid rules) now appear in the JSON envelope under `result._warnings` so agents in non-TTY contexts can read them (previously only emitted to stderr which agents often cannot see)
  - Each CLI command (check, test, build) surfaces `_configWarnings` from loadConfig as `CONFIG_WARNING` entries in the output
  - Deduplicate writtenFiles via Set to prevent duplicates with multi-format builds
  - Sync skill doc SSoT with agent-verified behavior

## 0.6.3

## 0.6.2

### Patch Changes

- fix: docs init help text, build file reporting, skill accuracy

  - Fix `docs init --help` showing "docs docs" instead of "docs init" (citty meta.name was "docs" instead of "init")
  - Build command now reports ALL written files in `generatedFiles` (pages, stubs, SSG config, skill package) instead of only api-reference and llms.txt
  - Add `writtenFiles` to ForgeResult so generate() can return actual file paths
  - Update skill doc to clarify build vs docs init, accurate docs init description

## 0.6.1

### Patch Changes

- fix: CLI version SSoT, actionable error envelopes, config validation

  - Read CLI version from package.json at runtime instead of hardcoding (prevents version mismatch between published package and --help output)
  - Populate top-level errors on check/test CommandOutput so LAFS JSON envelopes include actionable error codes and messages instead of generic "Command failed"
  - Reconcile doctest exit code with TAP-parsed failures: when node:test exits non-zero but no test failures were parsed (compilation/import error), report failed >= 1 with D002 diagnostic including runner output
  - Add config schema validation that warns on unknown top-level keys and unknown enforce rules (no longer silently ignored)
  - Update skill docs and scripts to reflect agent-first defaults (non-TTY auto-selects JSON, no --json flag needed)

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

## 0.4.0

### Minor Changes

- [`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - v0.4 release: configurable rules, dead link validation, OpenAPI path extraction, deprecation tracking.

  - Per-rule configuration: toggle E001-E008 individually as error/warn/off
  - E008: {@link} dead link validation against the project symbol graph
  - @route TSDoc tag → OpenAPI path entries with parameters and responses
  - W004: cross-monorepo deprecation tracking for @deprecated imports

## 0.3.1

### Patch Changes

- Complete TSDoc coverage across all packages. Every exported symbol, interface member, and function now has documentation with @example blocks. forge-ts check passes with 0 errors on all 6 packages (229 symbols). Fixed @packageDocumentation tag extraction in walker.

## 0.3.0

### Minor Changes

- [`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Upgrade OpenAPI spec output from 3.1.0 to 3.2.0. Added new type contracts for 3.2 features: query method, additionalOperations, querystring parameters, MediaType/Encoding objects. Upgraded TypeScript to 6.0.1-rc, vite to v8, pnpm to 10.32.1. True dogfood with published @forge-ts/cli from npm.

- [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Opinionated SSoT release: multi-page doc site generation, strict enforcement (E004-E007), SSG config generation (Mintlify/Docusaurus/Nextra/VitePress), LAFS MVI progressive disclosure for agent guidance. llms.txt now defaults to enabled.

## 0.2.1

### Patch Changes

- Fix package metadata: add per-package READMEs, correct repository URLs to kryptobaseddev/forge-ts, remove stale codluv references.

## 0.2.0

### Minor Changes

- [`0ce2f3e`](https://github.com/kryptobaseddev/forge-ts/commit/0ce2f3eca6e67e18d9baba867bcd4ac6236b1ae6) - Initial release of forge-ts - the universal TypeScript documentation compiler.
