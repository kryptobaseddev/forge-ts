# forge-ts Feature Inventory (v0.19.5)

> Canonical reference for every implemented feature in forge-ts.
> No roadmap. No vision. Every item listed here exists in the codebase and passes tests.
>
> **859 tests | 20 test files | 6 packages | All v0.19.5**

---

## Table of Contents

- [Packages](#packages)
- [CLI Commands](#cli-commands)
- [Enforcement Rules](#enforcement-rules)
- [Documentation Generation](#documentation-generation)
- [Guide Discovery System](#guide-discovery-system)
- [Zone System](#zone-system)
- [Agent-Proof System](#agent-proof-system)
- [TSDoc Ecosystem](#tsdoc-ecosystem)
- [Configuration](#configuration)

---

## Packages

All packages are published under the `@forge-ts` scope at version **0.19.5**.

| Package | Responsibility |
|---------|---------------|
| `@forge-ts/core` | AST walker, config loading/validation (`defineConfig()`), lock file management, audit trail, bypass system, shared types, shared pkg-json.ts, bundled tsdoc-preset |
| `@forge-ts/enforcer` | 33 enforcement rules across 4 layers (API, Dev, Consumer, Config Guard) |
| `@forge-ts/doctest` | `@example` block extraction from TSDoc and execution via `node:test` runner |
| `@forge-ts/api` | OpenAPI 3.2.0 specification generation from `@route` tags, schema mapping |
| `@forge-ts/gen` | Markdown/MDX site generation, guide discovery, llms.txt, SKILL.md, README sync, SSG adapters |
| `@forge-ts/cli` | 12 commands via citty + consola, LAFS JSON output, human-readable formatting |

---

## CLI Commands

All commands are invoked as `forge-ts <command>`. Output supports both human-readable (default) and LAFS MVI JSON formats.

| Command | Description |
|---------|-------------|
| `forge-ts check` | Lint TSDoc coverage on exported symbols. Runs all enabled enforcement rules. Supports `--staged` flag for pre-commit use. |
| `forge-ts test` | Extract `@example` blocks from TSDoc and run them as doctests via `node:test`. |
| `forge-ts build` | Generate API reference, documentation site, llms.txt, SKILL.md, and README sync. |
| `forge-ts init setup` | Initial project setup: scaffold config, tsdoc.json, and recommended scripts. |
| `forge-ts init docs` | Scaffold a documentation site for the configured SSG target. |
| `forge-ts init hooks` | Scaffold pre-commit hook configuration (Husky v9) with `forge-ts check --staged` as the gate. Cooperative hook protocol with versionguard detection, `--no-install` for supply chain safety. Adds `prepare` script. |
| `forge-ts docs dev` | Start a local dev server for the configured SSG target. Reads `gen.ssgTarget` from config and spawns the correct platform dev server. |
| `forge-ts lock` | Snapshot current config to `.forge-lock.json` to prevent silent weakening. |
| `forge-ts unlock --reason` | Remove config lock. Requires a justification string. |
| `forge-ts bypass --reason` | Create a temporary rule bypass. Subject to daily budget and expiry. |
| `forge-ts audit` | Display the append-only audit trail from `.forge-audit.jsonl`. |
| `forge-ts prepublish` | Safety gate: runs `check` + `build` sequentially. Integrates with npm `prepublishOnly` lifecycle. Non-zero exit on failure. |
| `forge-ts doctor` | Validate project setup: checks Husky v9 hooks, prepare script, tsdoc.json, config file presence. |

---

## Enforcement Rules

33 rules organized into 4 enforcement layers. Rules with a **Key** column value are configurable in `enforce.rules`. Rules without a key are always active at their default severity.

### API Layer (10 rules)

Coverage enforcement for public API surface documentation.

| Code | Config Key | Default | Description |
|------|-----------|---------|-------------|
| E001 | `require-summary` | error | Exported symbol missing TSDoc summary |
| E002 | `require-param` | error | Function parameter missing `@param` tag |
| E003 | `require-returns` | error | Non-void function missing `@returns` tag |
| E004 | `require-example` | error | Exported function missing `@example` block |
| E005 | `require-package-doc` | error | Package entry point missing `@packageDocumentation` |
| E006 | `require-class-member-doc` | error | Class member missing documentation |
| E007 | `require-interface-member-doc` | error | Interface or type member missing documentation |
| E008 | -- | error | Dead `{@link}` reference to non-existent symbol |
| W003 | -- | warn | `@deprecated` tag without explanation text |
| W004 | -- | warn | Cross-package import of a deprecated symbol |

### Dev Layer (8 rules)

Enforcement for developer-facing documentation quality.

| Code | Config Key | Default | Description |
|------|-----------|---------|-------------|
| E013 | `require-remarks` | error | Exported function or class missing `@remarks` block |
| E014 | `require-default-value` | warn | Optional property missing `@defaultValue` tag |
| E015 | `require-type-param` | error | Generic symbol missing `@typeParam` for each type parameter |
| E017 | `require-internal-boundary` | error | `@internal` symbol re-exported through public barrel (index.ts) |
| E018 | `require-route-response` | warn | `@route`-tagged function missing `@response` tag |
| W005 | `require-see` | warn | Symbol contains `{@link}` references but no `@see` tags |
| W006 | `require-tsdoc-syntax` | warn | TSDoc parser syntax error (covers 70+ message types from `@microsoft/tsdoc`) |
| W009 | `require-inheritdoc-source` | warn | `{@inheritDoc}` references a symbol that does not exist |

### Consumer Layer (7 rules)

Enforcement for consumer-facing documentation and guide coverage.

| Code | Config Key | Default | Description |
|------|-----------|---------|-------------|
| E016 | `require-release-tag` | error | Exported symbol missing `@public`, `@beta`, or `@internal` release tag |
| W007 | `require-fresh-guides` | warn | Guide `FORGE:AUTO` zone references a symbol that no longer exists |
| W008 | `require-guide-coverage` | warn | Public symbol exported from `index.ts` not mentioned in any guide page |
| W010 | `require-migration-path` | warn | `@breaking` tag present without `@migration` path |
| W011 | `require-since` | warn | New public export missing `@since` version tag |

### LLM Anti-Pattern Layer (4 rules)

Enforcement to detect common LLM agent shortcuts.

| Code | Config Key | Default | Description |
|------|-----------|---------|-------------|
| E019 | `require-no-ts-ignore` | error | Non-test file contains `@ts-ignore` or `@ts-expect-error` directive |
| E020 | `require-no-any-in-api` | error | Exported symbol has `any` in its public API signature (uses `getDeclaredTypeOfSymbol` for interfaces/types) |
| W012 | `require-fresh-link-text` | warn | `{@link}` display text appears stale relative to target summary |
| W013 | `require-fresh-examples` | warn | `@example` block call arg count mismatches function signature |

### Config Guard Layer (4 rules)

Infrastructure guards that detect config weakening. Always error severity. Not configurable.

| Code | Guard Condition | Description |
|------|----------------|-------------|
| E009 | `guards.tsconfig.enabled` | `tsconfig.json` strict flag missing or disabled |
| E010 | `.forge-lock.json` exists | Rule severity weaker than the locked baseline value |
| E011 | `guards.biome.enabled` + lock | Biome rule weakened below the locked severity level |
| E012 | `guards.packageJson.enabled` | `engines.node` below minimum version, or required field missing |

---

## Documentation Generation

### Output Artifacts

The `forge-ts build` command produces the following artifacts.

| Artifact | Location | Description |
|----------|----------|-------------|
| Documentation site | `outDir/` | Multi-page Markdown/MDX site structured by the 5-stage IA |
| OpenAPI spec | `api.openapiPath` | OpenAPI 3.2.0 document generated from `@route` tags on exported symbols |
| `llms.txt` | `outDir/llms.txt` | Compact routing manifest following the llms.txt specification |
| `llms-full.txt` | `outDir/llms-full.txt` | Dense context file with complete documentation for every symbol |
| SKILL.md | `outDir/` | LAFS protocol skill package with API reference, gotchas, and scripts |
| README sync | project root | Synchronizes generated content back into `README.md` when `gen.readmeSync` is enabled |

### Site Architecture (5-Stage Information Architecture)

Generated documentation sites follow a 5-stage progressive disclosure structure.

| Stage | Section | Pages |
|-------|---------|-------|
| ORIENT | Landing, Getting Started | `index`, `getting-started` |
| LEARN | Concepts | `concepts` |
| BUILD | Guides | `guides/index`, discovered guide pages |
| REFERENCE | API Reference, Types, Functions, Examples, Configuration, Changelog | Per-package `index`, `types`, `functions`, `examples`; top-level `configuration`, `changelog` |
| COMMUNITY | FAQ, Contributing | `faq`, `contributing` |

### SSG Adapters

Four static site generator adapters are implemented. Each adapter produces platform-specific configuration files, navigation, and dependency manifests.

| Adapter | Target Key | Status |
|---------|-----------|--------|
| Mintlify | `mintlify` | Default target. Agent-first, zero build step. |
| Docusaurus | `docusaurus` | Full config generation with sidebars, presets, and tsconfig. |
| Nextra | `nextra` | MDX-native with `_meta.json` navigation files. |
| VitePress | `vitepress` | Vue-based with `.vitepress/config.ts` generation. |

---

## Guide Discovery System

The guide discovery system analyzes the symbol graph and automatically generates guide page structures. Five heuristics run in sequence.

| # | Heuristic | Trigger | Result |
|---|-----------|---------|--------|
| 1 | `config-interface` | Interfaces or types matching `/config\|options\|settings/i` | Configuration guide page |
| 2 | `error-types` | Symbols with `@throws` tags, or classes ending in `Error`/`Exception` | Error handling guide page |
| 3 | `guide-tag` | Symbols annotated with `@guide` tag | Guide page per unique `@guide` value |
| 4 | `category` | Symbols annotated with `@category` tag | Guide page per unique `@category` value |
| 5 | `entry-point` | Exported functions from `index.ts` files | Entry point overview guide page |

---

## Zone System

Generated documentation uses a three-zone ownership model for idempotent regeneration.

| Zone | Marker | Behavior |
|------|--------|----------|
| `FORGE:AUTO` | `<!-- FORGE:AUTO -->` | Regenerated on every build. Content is always code-derived. User edits are overwritten. |
| `FORGE:STUB` | `<!-- FORGE:STUB hash=... -->` | Generated once with a content hash. Preserved after user edits (hash mismatch stops regeneration). |
| Unmarked | (none) | User-owned content. Never read or modified by forge-ts. |

---

## Agent-Proof System

Three files form the agent-proof infrastructure. All are designed to prevent AI coding agents from silently weakening project standards.

### Lock File

- **File**: `.forge-lock.json`
- **Created by**: `forge-ts lock`
- **Removed by**: `forge-ts unlock --reason "<justification>"`
- **Purpose**: Snapshots current rule severities. E010 fires when any rule is weaker than the locked value.

### Audit Trail

- **File**: `.forge-audit.jsonl`
- **Format**: Append-only JSON Lines
- **Records**: Lock, unlock, bypass, and config change events with timestamps
- **Read by**: `forge-ts audit`

### Bypass System

- **File**: `.forge-bypass.json`
- **Created by**: `forge-ts bypass --reason "<justification>"`
- **Budget**: Configurable daily limit (default: 3 bypasses per day)
- **Expiry**: Configurable duration (default: 24 hours)
- **Scope**: Per-rule temporary exemptions that auto-expire

---

## Git Hooks Integration

forge-ts provides cooperative git hook integration for pre-commit enforcement.

| Feature | Description |
|---------|-------------|
| Cooperative hook protocol | Detects and cooperates with versionguard hooks -- both tools run in the same pre-commit hook without conflict |
| `--staged` flag | `forge-ts check --staged` runs enforcement only on staged files for fast pre-commit performance |
| `--no-install` flag | Hook templates use `--no-install` to prevent supply chain attacks via transitive dependency installation |
| Auto-scaffold | `forge-ts init hooks` scaffolds Husky v9 hooks with the correct flags pre-configured |
| Versionguard detection | Detects `.versionguard.yml` and appends `versionguard validate` to Husky hooks so both tools enforce cooperatively |

---

## TSDoc Ecosystem

### Preset (`@forge-ts/tsdoc-config`)

The `tsdoc.json` preset shipped in `@forge-ts/tsdoc-config` defines the full tag vocabulary.

**24 standard tags enabled:**

`@alpha`, `@beta`, `@decorator`, `@defaultValue`, `@deprecated`, `@eventProperty`, `@example`, `@inheritDoc`, `@internal`, `@label`, `@link`, `@override`, `@packageDocumentation`, `@param`, `@privateRemarks`, `@public`, `@readonly`, `@remarks`, `@returns`, `@sealed`, `@see`, `@throws`, `@typeParam`, `@virtual`

**15 custom tags:**

| Tag | Syntax Kind | Purpose |
|-----|-------------|---------|
| `@route` | block | HTTP route path for OpenAPI generation |
| `@category` | block | Symbol grouping for guide discovery and navigation |
| `@since` | block | Version when the symbol was introduced |
| `@guide` | block | Associates a symbol with a named guide page |
| `@concept` | block | Links a symbol to a conceptual documentation page |
| `@response` | block | HTTP response type and status code |
| `@query` | block | Query parameter documentation for REST endpoints |
| `@header` | block | HTTP header parameter documentation |
| `@body` | block | Request body schema documentation |
| `@quickstart` | modifier | "Start here" marker for new users |
| `@faq` | block | FAQ entry association |
| `@breaking` | block | Breaking change documentation |
| `@migration` | block | Migration path from old API |
| `@complexity` | block | Algorithmic complexity documentation |
| `@forgeIgnore` | modifier | Skip all enforcement rules on this symbol |

### Integration

- `@microsoft/tsdoc-config` integration via `TSDocConfigFile.loadForFolder` with caching
- Interoperable with `eslint-plugin-tsdoc`, TypeDoc, and API Extractor
- `tsdoc.writeConfig` option writes `tsdoc.json` to the project (forge-ts owns the TSDoc standard)
- `tsdoc.customTags` array for project-specific tags, written to `tsdoc.json` during init
- Per-group enforcement via `tsdoc.enforce` (core/extended/discretionary severity groups)

---

## Configuration

forge-ts is configured via `forge-ts.config.ts` (or `.js`, `.json`). The `ForgeConfig` object contains the following top-level sections.

| Section | Purpose |
|---------|---------|
| `enforce` | Rule configuration: per-rule severity overrides, strict mode, `minVisibility` threshold, `ignoreFile` for Knip integration |
| `doctest` | Doctest toggle (`enabled`) and cache directory (`cacheDir`) |
| `api` | OpenAPI generation toggle (`openapi`), output path (`openapiPath`) |
| `gen` | Output formats, `llmsTxt` toggle, `readmeSync` toggle, `ssgTarget` selection |
| `skill` | SKILL.md customization: `customSections`, `extraGotchas` |
| `tsdoc` | `writeConfig` toggle, `customTags` array (written to tsdoc.json during init), `enforce` groups for per-group severity (core/extended/discretionary) |
| `guards` | Drift detection for `tsconfig`, `biome`, and `packageJson` configurations |
| `bypass` | `dailyBudget` (default 3) and `durationHours` (default 24) for temporary rule bypasses |
| `guides` | `enabled` toggle, `autoDiscover` toggle, custom guide definitions |
| `project` | Metadata: `repository`, `homepage`, `packageName`, and other project-level fields |
