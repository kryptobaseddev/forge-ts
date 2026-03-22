# VISION: Forge (`forge-ts`)

## The Premise
As of 2026, the TypeScript ecosystem has matured incredibly in type safety, build tooling (esbuild, swc), and runtime engines (Node 24 LTS "Krypton", Deno). Yet, the documentation and API specification layer remains a fractured relic of the past. Teams currently stitch together ESLint plugins, TypeDoc, Zod schemas, and Swagger generators just to achieve what the Rust ecosystem gets out-of-the-box with a single command: `cargo doc`.

> **Status (v0.19.4):** forge-ts v0.19.4 delivers the complete vision: 33 enforcement rules across 4 layers, intelligent guide generation, agent-proof guardrails, and full ecosystem integration. A single `npx forge-ts build` compiles TSDoc into OpenAPI specs, consumer-ready MDX, llms.txt artifacts, and SKILL packages -- all from one AST traversal pass.

Worse, in the era of AI-driven development, documentation isn't just for humans anymore. LLM agents need dense, high-signal context (`llms.txt`), and existing HTML-heavy documentation generators fail to deliver this natively.

## The Vision
**To build `forge-ts` (Forge): The universal documentation compiler for *any* TypeScript project.**

Whether you are building a React frontend, a Node.js REST API, a CLI tool, or a utility SDK, `forge-ts` acts as the uncompromising Single Source of Truth (SSoT). Built natively on the **TypeScript 6.0 Compiler API** -- the last JavaScript-based release before the Go rewrite in TS 7.0 -- it captures and dynamically generates documentation across three distinct layers:

### 1. API Docs (The Contract Layer) -- COMPLETE
For REST/GraphQL APIs and SDKs, `forge-ts` crawls your routing controllers and exported symbols. It emits perfect, strictly-typed `openapi.json` (Swagger) specs and API References without runtime reflection. It strictly respects tags like `@public`, `@beta`, and `@internal` so you never leak private APIs.

> **Implemented:** OpenAPI 3.2.0 generation with `@route`/`@get`/`@post`/`@put`/`@delete`/`@patch` tag extraction. Visibility filtering via `@public`, `@beta`, `@internal` controls which symbols appear in output.

### 2. Dev Docs & AI Context (The Contributor Layer) -- COMPLETE
Documentation must be trusted by developers and instantly understood by AI.
- **DocTests:** Code examples in comments (`@example`) are extracted and run natively via Node 24.14.0 LTS's `node:test` runner (now stable with automatic subtest awaiting, per-test timeouts, and `--test-rerun-failures`). If an example rots, the test suite fails. Documentation is executable code.
- **AI Context:** Natively generates token-optimized `llms.txt` and `llms-full.txt` artifacts. It aggregates OpenAPI specs, TSDoc comments, and repository guidelines into a dense format, ensuring that AI agents (Cursor, Copilot, Claude) instantly understand the codebase.
- **Build Gate:** Acts as a strict, zero-config linter during `npm run build`, powered by **Biome 2.4** (replacing the ESLint + Prettier combination), aggressively failing the build if developers try to push new public features without TSDoc comments.

> **Implemented:** 33 enforcement rules (E001-E020, W001-W013) across 4 layers with per-rule severity configuration (error/warn/off). `--strict` mode promotes all warnings to errors. Non-zero exit code on violations ensures CI integration as a build gate.

### 3. Consumer Docs (The User-Facing Layer) -- COMPLETE
Instead of dumping raw JSON, `forge-ts` outputs clean, beautifully formatted Markdown/MDX files ready to be dropped into static site generators like Docusaurus, Mintlify, Nextra, or VitePress. It dynamically injects your primary code examples and API summaries directly into the project's `README.md` (similar to `cargo-rdme`), ensuring your GitHub front page is always perfectly synchronized with your actual code.

> **Implemented:** 4 SSG adapters (Mintlify as default, plus Docusaurus, Nextra, VitePress). FORGE:AUTO progressive enrichment for stub pages with AST-aware protected ranges. FORGE:STUB zones for intelligent guide generation. SKILL package generation via LAFS protocol. README sync from TSDoc.

## Technology Foundation

The validated tooling stack (as of March 2026):

| Tool | Version | Role |
|------|---------|------|
| Node.js | 24.14.0 LTS ("Krypton") | Runtime -- native TS stripping, stable `node:test`, `node:sqlite` RC |
| TypeScript | 6.0 (beta/RC) | Compiler API -- last JS-based release; new defaults: `strict=true`, `target=es2025`, `module=esnext` |
| pnpm | 10.x | Monorepo workspaces with topological build ordering |
| Vitest | 4.1.0 | Unit test layer (28M weekly downloads, stable browser mode) |
| Biome | 2.4 | Linting + formatting -- replaces ESLint + Prettier, 10-100x faster, 423+ rules |
| @microsoft/tsdoc | 0.16.0 | TSDoc comment parsing |
| @microsoft/tsdoc-config | 0.17.x | TSDoc configuration file loading (`TSDocConfigFile.loadForFolder()`) |
| citty | 0.2.1 | Type-safe CLI framework (zero deps, 2.9kB) |
| @cleocode/lafs-protocol | 1.8.0 | LLM-Agent-First output layer |
| unified + remark | 11.x / 15.x | AST-based markdown pipeline: remark-parse, remark-stringify, remark-mdx, remark-gfm, remark-frontmatter, unist-util-visit |
| gray-matter | 4.x | Frontmatter parsing/serialization |
| @changesets/cli | 2.x | Monorepo versioning with fixed version strategy |
| tsup | 8.5.x | ESM bundling + `.d.ts` generation |

### Future-Proofing: TypeScript 7.0

TypeScript 7.0 (the Go rewrite, targeted mid-2026) will fundamentally change the Compiler API. `forge-ts` is architected on TS 6.0's stable API surface and will require a targeted migration once TS 7.0 reaches stability. The core AST traversal abstraction (`@forge-ts/enforcer`) is isolated precisely to contain this migration cost.

## The Future
By centralizing API specs, Dev Docs, and Consumer Docs into a single AST-traversing pass, `forge-ts` eliminates configuration fatigue, prevents documentation rot, and empowers both developers and autonomous agents to work with perfect clarity. Write your code and TSDoc once, run `npx forge-ts build`, and derive everything.

---

## Current State: v0.19.4

**6 packages**, all at v0.19.4 with fixed versioning:

| Package | Role |
|---------|------|
| `@forge-ts/core` | TypeScript Compiler API traversal, ForgeSymbol graph, TSDoc parsing, config, lock/audit/bypass, bundled tsdoc-preset |
| `@forge-ts/enforcer` | 33 rules (E001-E020, W001-W013) across 4 layers with per-rule severity config |
| `@forge-ts/doctest` | `@example` extraction + Node.js `node:test` runner integration |
| `@forge-ts/api` | OpenAPI 3.2.0 spec generation with `@route` tag extraction |
| `@forge-ts/gen` | Markdown/MDX generation, SSG adapters, intelligent guide generation, llms.txt, SKILL packages, README sync |
| `@forge-ts/cli` | CLI entry point (citty + consola), 12 commands: check [--staged], test, build, init [setup/docs/hooks], docs [init/dev], lock, unlock, bypass, audit, prepublish, doctor |

**859 tests** across 20 test files, all passing. CI pipeline: lint + typecheck + test + dogfood.

## The Five Pillars

Inspired by the battle-tested patterns in [ferrous-forge](https://github.com/kryptobaseddev/ferrous-forge) (Rust sister project, v1.9.0), adapted for the TypeScript ecosystem. forge-ts sits **on top of** best-practice tools like Biome, LSP, and linting tools -- it does not replace them, it adds strict opinionated guardrails.

### Pillar 1: Enforcement -- COMPLETE

Strict TSDoc quality enforcement across all three documentation layers, plus config guards.

**API Layer:**

| Rule | Description | Severity |
|------|-------------|----------|
| E001 | Missing TSDoc on exported symbol | error |
| E002 | Missing `@param` tag | error |
| E003 | Missing `@returns` tag | error |
| E004 | Missing `@example` block | error |
| E005 | Missing `@packageDocumentation` | error |
| E006 | Class member missing documentation | error |
| E007 | Interface member missing documentation | error |
| E008 | Dead `{@link}` reference | error |
| W003 | `@deprecated` without explanation | warn |
| W004 | Cross-package deprecated import | warn |

**Dev Layer:**

| Rule | Description | Severity |
|------|-------------|----------|
| E013 | Missing `@remarks` on public function/class | error |
| E014 | Missing `@defaultValue` on optional property with default | warn |
| E015 | Missing `@typeParam` on generic symbol | error |
| W005 | Missing `@see` for referenced symbols | warn |
| W006 | TSDoc parse errors (surfaces 70+ parser-level messages) | warn |
| W009 | `{@inheritDoc}` references non-existent symbol | warn |

**Consumer Layer:**

| Rule | Description | Severity |
|------|-------------|----------|
| E016 | Exported symbol missing release tag (`@public`/`@beta`/`@internal`) | error |
| E017 | `@internal` symbol re-exported through public barrel (index.ts) | error |
| E018 | `@route`-tagged function missing `@response` tag | warn |
| W007 | Guide FORGE:AUTO section is stale (code changed, guide not rebuilt) | warn |
| W008 | Symbol exported from index.ts but not documented in any guide | warn |
| W010 | `@breaking` tag present without `@migration` path | warn |
| W011 | New public export missing `@since` version tag | warn |

**LLM Anti-Pattern Layer:**

| Rule | Description | Severity |
|------|-------------|----------|
| E019 | `@ts-ignore` / `@ts-expect-error` in non-test file | error |
| E020 | `any` type in public API signature | error |
| W012 | `{@link}` display text stale relative to target summary | warn |
| W013 | `@example` call arg count mismatches function signature | warn |

**Config Guard Layer:**

| Rule | Description | Severity |
|------|-------------|----------|
| E009 | tsconfig.json strictness regression | error |
| E010 | forge-ts config drift (rule severity weakened without audit) | error |
| E011 | Biome config rule weakened | error |
| E012 | package.json engine field tampered | error |

- Per-rule severity configuration (error/warn/off) in `forge-ts.config.ts`
- `--strict` mode promotes all warnings to errors
- Visibility filtering: `@public`, `@beta`, `@internal` control which symbols are enforced
- Non-zero exit code on errors ensures CI build gate integration

### Pillar 2: Generation -- COMPLETE

All three documentation layers from the original vision, plus intelligent guide generation.

- **API Docs**: OpenAPI 3.2.0 with `@route` tag path extraction, visibility-filtered
- **Dev Docs**: DocTests via `@example` + `node:test`, llms.txt/llms-full.txt for AI context
- **Consumer Docs**: 4 SSG adapters (Mintlify default), FORGE:AUTO progressive enrichment
- **SKILL packages**: LAFS protocol output for agent-consumable documentation
- **mdast AST pipeline**: gray-matter + unified/remark for all markdown transforms

**Intelligent Guide Generation:**
- Code analysis discovers guide topics via 5 heuristics: entry points, workflows, config types, error catalogs, extension patterns
- `@guide` and `@concept` custom TSDoc tags for explicit annotation
- Three zone types for idempotent regeneration: FORGE:AUTO (always fresh), FORGE:STUB (generated once, preserved after edit), unmarked (user-owned)
- Consumer guides derive structure and content from code -- code is the SSoT

### Pillar 2.5: TSDoc Ecosystem Orchestration -- COMPLETE

forge-ts is the central authority for TSDoc standards in a project.

**Opinionated TSDoc Preset** (`@forge-ts/tsdoc-config`):
- Ships a `tsdoc.json` with all Core + Extended standardization groups enabled
- Defines 15 custom tags including `@route`, `@category`, `@since`, `@guide`, `@concept`, `@forgeIgnore`, and more
- Consumed by eslint-plugin-tsdoc, TypeDoc, API Extractor automatically

**Central Config Orchestration** (`forge-ts.config.ts` flows DOWN):
- **WRITES** tsdoc.json (forge-ts owns the TSDoc standard for the project)
- **GUARDS** tsconfig.json, biome.json, package.json (detects drift, doesn't write)
- **SCAFFOLDS** eslint-plugin-tsdoc config during `forge-ts init` (if ESLint detected)

**@microsoft/tsdoc-config Integration**:
- Replaces bare `new TSDocConfiguration()` with `TSDocConfigFile.loadForFolder()`
- Surfaces 70+ TSDoc parser-level syntax errors that were previously silent
- Custom tag definitions flow from forge-ts.config.ts -> tsdoc.json -> all tools

### Pillar 3: Agent-Proof Guardrails -- COMPLETE

> *"LLM agents like to take the easy way out and downgrade or switch versions."*

Every bypass is explicit, justified, and audited.

**Config Locking**: Prevents loosening of forge-ts rules, tsconfig strictness, and Biome config.
- `forge-ts lock` creates a `.forge-lock.json` manifest of locked settings
- `forge-ts unlock --reason="..."` requires explicit justification to change locked values
- Locked settings: forge-ts rule severities, tsconfig `strict`/`strictNullChecks`/etc., Biome rule overrides

**Audit Trail**: Every rule change, bypass, and override is logged.
- Append-only JSON log (`.forge-audit.jsonl`) with user, timestamp, reason, and diff
- `forge-ts audit` command to view and filter audit history
- Machine-readable for CI dashboards and compliance reporting

**Bypass Budget**: Limited bypasses per session with mandatory justification.
- Configurable daily budget (default: 3 bypasses per day)
- Each bypass requires `--reason="..."` and is recorded in the audit trail
- Budget exhaustion blocks further bypasses until the next day (or human override)

**Tiered Violations**: Not all violations are equal.
- Locked settings (tsconfig strict, forge-ts rules): ALWAYS block, no auto-fix
- Documentation coverage (E001-E008): configurable severity, auto-stub allowed
- Style warnings (W001-W004): configurable, auto-fix permitted

**LLM Anti-Pattern Detection**: Flags common agent shortcuts in monitored files.
- E019: `@ts-ignore` / `@ts-expect-error` additions in non-test files
- E020: `any` type casts in public API signatures (uses `getDeclaredTypeOfSymbol` for interfaces/types)
- `strict: false` or strictness loosening in tsconfig (E009)
- `"off"` overrides in forge-ts or Biome config (E010, E011)

### Pillar 4: Safety Pipeline -- COMPLETE

Pre-commit and pre-publish integration -- catches issues at commit time, not CI time.

**Pre-Commit Integration**:
- `forge-ts check` as a husky/lefthook gate
- `forge-ts init --hooks` scaffolds hook configuration for the project
- forge-ts provides the check command; hook management is deferred to husky/lefthook

**Pre-Publish Validation**:
- `forge-ts prepublish` runs check + build in a single gate command
- Blocks `npm publish` if documentation coverage fails thresholds
- Integrates with npm `prepublishOnly` lifecycle script

**Safety Defaults**:
- Strict by default -- escape hatches require explicit command + reason + audit
- All safety overrides logged to the audit trail (Pillar 3)
- Zero silent environment variables that disable everything

### Pillar 5: Ecosystem Integration -- COMPLETE

forge-ts complements, never replaces, existing best-practice tools.

**Complement, Don't Replace**:
| Tool | Owns | forge-ts Adds |
|------|------|---------------|
| Biome | Code quality, formatting | Config drift prevention -- detect weakened rules (E011) |
| ESLint/TSDoc plugin | JSDoc syntax validation | TSDoc completeness and cross-reference validation |
| Knip | Dead code / unused exports | Skip enforcement on Knip-flagged dead exports via `ignoreFile` + `@forgeIgnore` tag |
| publint / attw | Package quality | Documentation coverage as a publish gate |
| TypeScript | Type checking | tsconfig strictness locking (E009) |

**forge-ts Owns** (no other tool does this):
- TSDoc completeness enforcement (E001-E020, W001-W013)
- Documentation pipeline integration (lint -> generate -> validate -> publish)
- Config drift prevention (tsconfig, Biome, forge-ts rules)
- Agent-proof guardrails on documentation quality

**Config Guard Rules** (E009-E012):
- E009: tsconfig strictness regression (detect loosening of strict mode flags)
- E010: forge-ts config drift (detect rule severity weakening without audit trail)
- E011: Biome config weakening (detect rules switched from error to warn/off)
- E012: package.json engine field tampering (detect Node.js version downgrades)

## Competitive Positioning

What **no other tool** in the TypeScript ecosystem does:

| Capability | forge-ts | TypeDoc | ESLint | Biome | publint |
|------------|----------|---------|--------|-------|---------|
| `@packageDocumentation` enforcement (E005) | yes | -- | -- | -- | -- |
| Dead `{@link}` validation (E008) | yes | -- | -- | -- | -- |
| Cross-package deprecated import tracking (W004) | yes | -- | -- | -- | -- |
| Config drift prevention (E009-E012) | yes | -- | -- | -- | -- |
| Doc pipeline: lint -> generate -> validate -> publish | yes | partial | -- | -- | -- |
| Agent-proof guardrails on doc quality | yes | -- | -- | -- | -- |
| OpenAPI generation from TSDoc `@route` tags | yes | -- | -- | -- | -- |
| llms.txt / llms-full.txt generation | yes | -- | -- | -- | -- |
| SKILL package generation (LAFS protocol) | yes | -- | -- | -- | -- |
| Intelligent guide generation from code analysis | yes | -- | -- | -- | -- |

## Roadmap

### Phase 1-3: Foundation, Enforcement, Generation -- COMPLETE (v0.1.0 - v0.8.0)

All three documentation layers implemented. 12 enforcement rules. 4 SSG adapters. mdast AST pipeline. SKILL package generation.

### Phase 4: TSDoc Ecosystem Foundation -- COMPLETE (v0.9.0)

@microsoft/tsdoc-config integration, @forge-ts/tsdoc-config preset, W006 rule, tsdoc.json generation via `forge-ts init`.

### Phase 5: Agent-Proof Guardrails -- COMPLETE (v0.10.0)

Config locking (lock/unlock), audit logging (.forge-audit.jsonl), bypass budget system, E009 (tsconfig strictness), E010 (config drift detection).

### Phase 6: Dev Layer Enforcement -- COMPLETE (v0.11.0)

E013 (@remarks), E014 (@defaultValue), E015 (@typeParam), W005 (@see), @concept and @guide custom tags.

### Phase 7: Intelligent Guide Generation -- COMPLETE (v0.12.0)

Guide discovery via 5 heuristics, FORGE:STUB zone support, code-derived guide structures, W007 (stale guide detection), W008 (undocumented in guides).

### Phase 8: Safety Pipeline + Ecosystem -- COMPLETE (v0.13.0)

`forge-ts init --hooks` (husky/lefthook scaffolding), `forge-ts prepublish` gate, E011 (Biome config guard), E012 (engine guard), E016 (release tag requirement).

### Phase 9-12: DX Polish, Init, Husky, Advanced Enforcement -- COMPLETE (v0.14.0 - v0.19.4)

Complete tag system (15 custom tags), init setup + doctor commands, defineConfig(), Husky v9 integration, check --staged, shared pkg-json.ts, Knip integration via ignoreFile + @forgeIgnore, E017-E020, W009-W013, per-group TSDoc enforcement, customTags written to tsdoc.json, getDeclaredTypeOfSymbol fix for E020 false positives.

### What's Next

The core vision is fully realized. Future work focuses on deeper ecosystem integration and developer experience:

- **LSP extension** -- real-time diagnostics in editor (VS Code, Neovim)
- **Guide intelligence** -- workflow detection heuristic, extension pattern heuristic
- **eslint-plugin-tsdoc scaffolding** -- automated setup during `forge-ts init`

See ROADMAP.md for full future plans.
