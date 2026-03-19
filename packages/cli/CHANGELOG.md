# @forge-ts/cli

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @forge-ts/gen@0.7.2
  - @forge-ts/core@0.7.2
  - @forge-ts/enforcer@0.7.2
  - @forge-ts/doctest@0.7.2
  - @forge-ts/api@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @forge-ts/gen@0.7.1
  - @forge-ts/core@0.7.1
  - @forge-ts/enforcer@0.7.1
  - @forge-ts/doctest@0.7.1
  - @forge-ts/api@0.7.1

## 0.7.0

### Minor Changes

- feat: progressive disclosure for check command — triage, filtering, pagination

  The check command now provides context-window-friendly output for LLM agents working with large codebases:

  **Triage section** (always present when errors > 0, bounded by rule count + top 20 files):

  - `byRule`: every rule code with violation count and file count
  - `topFiles`: top 20 files by error count
  - `fixOrder`: rules sorted by fewest files affected (quick wins first)

  **CLI filters** for targeted drill-down:

  - `--rule E001`: filter to a specific rule code
  - `--file src/types.ts`: filter to files matching a substring
  - `--limit 20` / `--offset 0`: paginate file groups

  **MVI level differentiation**:

  - `minimal`: summary counts only (~50 tokens)
  - `standard` (new default): summary + triage + paginated byFile WITHOUT suggestedFix (~500-2000 tokens)
  - `full`: same + suggestedFix per error (~2000-5000 tokens per page)

  **`nextCommand` hint**: tells the agent exactly what CLI command to run next (drill into quick-win rule, next page, or re-check after fixes).

  **Agent workflow**: overview (standard) → drill into rule (full + --rule) → fix batch → re-check (minimal) → repeat.

  suggestedFix is also automatically included when `--rule` or `--file` filters are active, regardless of MVI level, since filtered output is already small.

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.7.0
  - @forge-ts/enforcer@0.7.0
  - @forge-ts/doctest@0.7.0
  - @forge-ts/api@0.7.0
  - @forge-ts/gen@0.7.0

## 0.6.6

### Patch Changes

- Updated dependencies []:
  - @forge-ts/core@0.6.6
  - @forge-ts/api@0.6.6
  - @forge-ts/doctest@0.6.6
  - @forge-ts/enforcer@0.6.6
  - @forge-ts/gen@0.6.6

## 0.6.5

### Patch Changes

- fix: SKILL-{project} directory naming, skill references, config warnings in envelope

  - Generated skill directory uses `SKILL-{project}` prefix convention (e.g. `SKILL-core` instead of `core`)
  - Config warnings surfaced in JSON envelope under `result._warnings` for agent visibility
  - New skill references: `references/skill-config.md` (skill package configuration), `references/guides.md` (auto-generated vs stub pages, editing strategy)
  - Updated `references/configuration.md` with skill config, project metadata fields, and unknown-key warning behavior
  - Deduplicated `generatedFiles` via Set

- Updated dependencies []:
  - @forge-ts/core@0.6.5
  - @forge-ts/gen@0.6.5
  - @forge-ts/api@0.6.5
  - @forge-ts/doctest@0.6.5
  - @forge-ts/enforcer@0.6.5

## 0.6.4

### Patch Changes

- fix: surface config warnings in JSON envelope, deduplicate generatedFiles

  - Config warnings (unknown keys, invalid rules) now appear in the JSON envelope under `result._warnings` so agents in non-TTY contexts can read them (previously only emitted to stderr which agents often cannot see)
  - Each CLI command (check, test, build) surfaces `_configWarnings` from loadConfig as `CONFIG_WARNING` entries in the output
  - Deduplicate writtenFiles via Set to prevent duplicates with multi-format builds
  - Sync skill doc SSoT with agent-verified behavior

- Updated dependencies []:
  - @forge-ts/core@0.6.4
  - @forge-ts/gen@0.6.4
  - @forge-ts/api@0.6.4
  - @forge-ts/doctest@0.6.4
  - @forge-ts/enforcer@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies []:
  - @forge-ts/gen@0.6.3
  - @forge-ts/core@0.6.3
  - @forge-ts/enforcer@0.6.3
  - @forge-ts/doctest@0.6.3
  - @forge-ts/api@0.6.3

## 0.6.2

### Patch Changes

- fix: docs init help text, build file reporting, skill accuracy

  - Fix `docs init --help` showing "docs docs" instead of "docs init" (citty meta.name was "docs" instead of "init")
  - Build command now reports ALL written files in `generatedFiles` (pages, stubs, SSG config, skill package) instead of only api-reference and llms.txt
  - Add `writtenFiles` to ForgeResult so generate() can return actual file paths
  - Update skill doc to clarify build vs docs init, accurate docs init description

- Updated dependencies []:
  - @forge-ts/core@0.6.2
  - @forge-ts/gen@0.6.2
  - @forge-ts/api@0.6.2
  - @forge-ts/doctest@0.6.2
  - @forge-ts/enforcer@0.6.2

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
  - @forge-ts/doctest@0.6.1
  - @forge-ts/api@0.6.1
  - @forge-ts/enforcer@0.6.1
  - @forge-ts/gen@0.6.1

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
  - @forge-ts/gen@0.6.0
  - @forge-ts/enforcer@0.6.0
  - @forge-ts/doctest@0.6.0
  - @forge-ts/api@0.6.0

## 0.5.0

### Minor Changes

- [`7c300b2`](https://github.com/kryptobaseddev/forge-ts/commit/7c300b21199f6f2c2a7e6ae3b7f2ba0b30e757c5) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - SSG adapter system with `forge-ts init docs` command.

  - Central SSGAdapter interface with registry pattern (DRY/SOLID)
  - 4 first-class providers: Mintlify (docs.json), Docusaurus v3, Nextra v4, VitePress v2
  - `forge-ts init docs --target mintlify` scaffolds complete doc site
  - Safety checks for existing scaffold, cross-target collision detection
  - Default target: Mintlify
  - LAFS JSON output on init command
  - generate() refactored to use adapter system

### Patch Changes

- Updated dependencies [[`7c300b2`](https://github.com/kryptobaseddev/forge-ts/commit/7c300b21199f6f2c2a7e6ae3b7f2ba0b30e757c5)]:
  - @forge-ts/gen@0.5.0
  - @forge-ts/core@0.5.0
  - @forge-ts/enforcer@0.5.0
  - @forge-ts/api@0.5.0
  - @forge-ts/doctest@0.5.0

## 0.4.0

### Patch Changes

- [`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - v0.4 release: configurable rules, dead link validation, OpenAPI path extraction, deprecation tracking.

  - Per-rule configuration: toggle E001-E008 individually as error/warn/off
  - E008: {@link} dead link validation against the project symbol graph
  - @route TSDoc tag → OpenAPI path entries with parameters and responses
  - W004: cross-monorepo deprecation tracking for @deprecated imports

- Updated dependencies [[`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f)]:
  - @forge-ts/core@0.4.0
  - @forge-ts/enforcer@0.4.0
  - @forge-ts/api@0.4.0
  - @forge-ts/doctest@0.4.0
  - @forge-ts/gen@0.4.0

## 0.3.1

### Patch Changes

- Complete TSDoc coverage across all packages. Every exported symbol, interface member, and function now has documentation with @example blocks. forge-ts check passes with 0 errors on all 6 packages (229 symbols). Fixed @packageDocumentation tag extraction in walker.

- Updated dependencies []:
  - @forge-ts/core@0.3.1
  - @forge-ts/enforcer@0.3.1
  - @forge-ts/doctest@0.3.1
  - @forge-ts/api@0.3.1
  - @forge-ts/gen@0.3.1

## 0.3.0

### Minor Changes

- [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Opinionated SSoT release: multi-page doc site generation, strict enforcement (E004-E007), SSG config generation (Mintlify/Docusaurus/Nextra/VitePress), LAFS MVI progressive disclosure for agent guidance. llms.txt now defaults to enabled.

### Patch Changes

- [`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Upgrade OpenAPI spec output from 3.1.0 to 3.2.0. Added new type contracts for 3.2 features: query method, additionalOperations, querystring parameters, MediaType/Encoding objects. Upgraded TypeScript to 6.0.1-rc, vite to v8, pnpm to 10.32.1. True dogfood with published @forge-ts/cli from npm.

- Updated dependencies [[`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805), [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361)]:
  - @forge-ts/core@0.3.0
  - @forge-ts/api@0.3.0
  - @forge-ts/enforcer@0.3.0
  - @forge-ts/doctest@0.3.0
  - @forge-ts/gen@0.3.0

## 0.2.1

### Patch Changes

- Fix package metadata: add per-package READMEs, correct repository URLs to kryptobaseddev/forge-ts, remove stale codluv references.

- Updated dependencies []:
  - @forge-ts/core@0.2.1
  - @forge-ts/enforcer@0.2.1
  - @forge-ts/doctest@0.2.1
  - @forge-ts/api@0.2.1
  - @forge-ts/gen@0.2.1

## 0.2.0

### Minor Changes

- [`0ce2f3e`](https://github.com/kryptobaseddev/forge-ts/commit/0ce2f3eca6e67e18d9baba867bcd4ac6236b1ae6) - Initial release of forge-ts - the universal TypeScript documentation compiler.
