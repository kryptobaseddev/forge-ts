# @forge-ts/api

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

### Minor Changes

- [`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - v0.4 release: configurable rules, dead link validation, OpenAPI path extraction, deprecation tracking.

  - Per-rule configuration: toggle E001-E008 individually as error/warn/off
  - E008: {@link} dead link validation against the project symbol graph
  - @route TSDoc tag → OpenAPI path entries with parameters and responses
  - W004: cross-monorepo deprecation tracking for @deprecated imports

### Patch Changes

- Updated dependencies [[`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f)]:
  - @forge-ts/core@0.4.0

## 0.3.1

### Patch Changes

- Complete TSDoc coverage across all packages. Every exported symbol, interface member, and function now has documentation with @example blocks. forge-ts check passes with 0 errors on all 6 packages (229 symbols). Fixed @packageDocumentation tag extraction in walker.

- Updated dependencies []:
  - @forge-ts/core@0.3.1

## 0.3.0

### Minor Changes

- [`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Upgrade OpenAPI spec output from 3.1.0 to 3.2.0. Added new type contracts for 3.2 features: query method, additionalOperations, querystring parameters, MediaType/Encoding objects. Upgraded TypeScript to 6.0.1-rc, vite to v8, pnpm to 10.32.1. True dogfood with published @forge-ts/cli from npm.

### Patch Changes

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
