# VISION: Forge (`forge-ts`)

## The Premise
As of 2026, the TypeScript ecosystem has matured incredibly in type safety, build tooling (esbuild, swc), and runtime engines (Node 24 LTS "Krypton", Deno). Yet, the documentation and API specification layer remains a fractured relic of the past. Teams currently stitch together ESLint plugins, TypeDoc, Zod schemas, and Swagger generators just to achieve what the Rust ecosystem gets out-of-the-box with a single command: `cargo doc`.

> **Status (v0.8.0):** forge-ts delivers on this premise. A single `npx forge-ts build` now compiles TSDoc into OpenAPI specs, consumer-ready MDX, llms.txt artifacts, and SKILL packages — all from one AST traversal pass. The v0.8.0 release completed the migration to a fully AST-based markdown pipeline (gray-matter + unified/remark), eliminating the last regex-based transforms.

Worse, in the era of AI-driven development, documentation isn't just for humans anymore. LLM agents need dense, high-signal context (`llms.txt`), and existing HTML-heavy documentation generators fail to deliver this natively.

## The Vision
**To build `forge-ts` (Forge): The universal documentation compiler for *any* TypeScript project.**

Whether you are building a React frontend, a Node.js REST API, a CLI tool, or a utility SDK, `forge-ts` acts as the uncompromising Single Source of Truth (SSoT). Built natively on the **TypeScript 6.0 Compiler API** — the last JavaScript-based release before the Go rewrite in TS 7.0 — it captures and dynamically generates documentation across three distinct layers:

### 1. API Docs (The Contract Layer) -- ✅ COMPLETE
For REST/GraphQL APIs and SDKs, `forge-ts` crawls your routing controllers and exported symbols. It emits perfect, strictly-typed `openapi.json` (Swagger) specs and API References without runtime reflection. It strictly respects tags like `@public`, `@beta`, and `@internal` so you never leak private APIs.

> **Implemented:** OpenAPI 3.2.0 generation with `@route`/`@get`/`@post`/`@put`/`@delete`/`@patch` tag extraction. Visibility filtering via `@public`, `@beta`, `@internal` controls which symbols appear in output.

### 2. Dev Docs & AI Context (The Contributor Layer) -- ✅ COMPLETE
Documentation must be trusted by developers and instantly understood by AI.
- **DocTests:** ✅ Code examples in comments (`@example`) are extracted and run natively via Node 24.14.0 LTS's `node:test` runner (now stable with automatic subtest awaiting, per-test timeouts, and `--test-rerun-failures`). If an example rots, the test suite fails. Documentation is executable code.
- **AI Context:** ✅ Natively generates token-optimized `llms.txt` and `llms-full.txt` artifacts. It aggregates OpenAPI specs, TSDoc comments, and repository guidelines into a dense format, ensuring that AI agents (Cursor, Copilot, Claude) instantly understand the codebase.
- **Build Gate:** ✅ Acts as a strict, zero-config linter during `npm run build`, powered by **Biome 2.4** (replacing the ESLint + Prettier combination), aggressively failing the build if developers try to push new public features without TSDoc comments.

> **Implemented:** 12 enforcement rules (E001-E008, W001-W004) with per-rule severity configuration (error/warn/off). `--strict` mode promotes all warnings to errors. Non-zero exit code on violations ensures CI integration as a build gate.

### 3. Consumer Docs (The User-Facing Layer) -- ✅ COMPLETE
Instead of dumping raw JSON, `forge-ts` outputs clean, beautifully formatted Markdown/MDX files ready to be dropped into static site generators like Docusaurus, Mintlify, Nextra, or VitePress. It dynamically injects your primary code examples and API summaries directly into the project's `README.md` (similar to `cargo-rdme`), ensuring your GitHub front page is always perfectly synchronized with your actual code.

> **Implemented:** 4 SSG adapters (Mintlify as default, plus Docusaurus, Nextra, VitePress). FORGE:AUTO progressive enrichment for stub pages with AST-aware protected ranges. SKILL package generation via LAFS protocol. README sync from TSDoc.

## Technology Foundation

The validated tooling stack (as of March 2026):

| Tool | Version | Role |
|------|---------|------|
| Node.js | 24.14.0 LTS ("Krypton") | Runtime — native TS stripping, stable `node:test`, `node:sqlite` RC |
| TypeScript | 6.0 (beta/RC) | Compiler API — last JS-based release; new defaults: `strict=true`, `target=es2025`, `module=esnext` |
| pnpm | 10.x | Monorepo workspaces with topological build ordering |
| Vitest | 4.1.0 | Unit test layer (28M weekly downloads, stable browser mode) |
| Biome | 2.4 | Linting + formatting — replaces ESLint + Prettier, 10-100x faster, 423+ rules |
| @microsoft/tsdoc | 0.16.0 | TSDoc comment parsing |
| citty | 0.2.1 | Type-safe CLI framework (zero deps, 2.9kB) |
| @cleocode/lafs-protocol | 1.8.0 | LLM-Agent-First output layer |
| unified + remark | 11.x / 15.x | AST-based markdown pipeline (v0.8.0): remark-parse, remark-stringify, remark-mdx, remark-gfm, remark-frontmatter, unist-util-visit |
| gray-matter | 4.x | Frontmatter parsing/serialization (replaces regex-based approach) |
| @changesets/cli | 2.x | Monorepo versioning with fixed version strategy |
| tsup | 8.5.x | ESM bundling + `.d.ts` generation |

### Future-Proofing: TypeScript 7.0

TypeScript 7.0 (the Go rewrite, targeted mid-2026) will fundamentally change the Compiler API. `forge-ts` is architected on TS 6.0's stable API surface and will require a targeted migration once TS 7.0 reaches stability. The core AST traversal abstraction (`@forge-ts/enforcer`) is isolated precisely to contain this migration cost.

## The Future
By centralizing API specs, Dev Docs, and Consumer Docs into a single AST-traversing pass, `forge-ts` eliminates configuration fatigue, prevents documentation rot, and empowers both developers and autonomous agents to work with perfect clarity. Write your code and TSDoc once, run `npx forge-ts build`, and derive everything.

---

## Current State: v0.8.0

**6 packages**, all at v0.8.0 with fixed versioning:

| Package | Role |
|---------|------|
| `@forge-ts/core` | TypeScript Compiler API traversal, ForgeSymbol graph, TSDoc parsing |
| `@forge-ts/enforcer` | 12 rules (E001-E008, W001-W004) with per-rule severity config |
| `@forge-ts/doctest` | `@example` extraction + Node.js `node:test` runner integration |
| `@forge-ts/api` | OpenAPI 3.2.0 spec generation with `@route` tag extraction |
| `@forge-ts/gen` | Markdown/MDX generation, SSG adapters, llms.txt, SKILL packages, README sync |
| `@forge-ts/cli` | CLI entry point (citty), check/test/build/init commands |

**441 tests** across 11 test files, all passing. CI pipeline: lint + typecheck + test + dogfood.

### v0.8.0 Highlight: mdast AST Pipeline

The v0.8.0 release completed a full migration from regex-based markdown transforms to an AST-based pipeline:
- **Frontmatter**: gray-matter for parsing and serialization (replaces regex strip/rebuild)
- **MDX sanitization**: remark AST + position-based transforms (replaces line-by-line regex)
- **FORGE:AUTO updates**: AST-aware protected ranges prevent matching markers inside code blocks
- **New public API**: `parseInline`, `parseBlocks`, `md`, `serializeMarkdown` for programmatic markdown manipulation

## Architecture: The Forge Pipeline

```
Source Code (.ts/.tsx)
        │
        ▼
┌─────────────────────────────────────────────┐
│  @forge-ts/core                             │
│  Single-pass AST traversal → ForgeSymbol[]  │
│  TSDoc parsing + tag extraction             │
└─────────────────────────────────────────────┘
        │
        ├──────────────────┬──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   check       │  │   test        │  │   build       │
│  (enforcer)   │  │  (doctest)    │  │  (api + gen)  │
│               │  │               │  │               │
│ E001-E008     │  │ @example      │  │ OpenAPI 3.2   │
│ W001-W004     │  │ extraction    │  │ Markdown/MDX  │
│ Per-rule      │  │ node:test     │  │ llms.txt      │
│ severity      │  │ runner        │  │ SKILL pkg     │
│ --strict mode │  │               │  │ README sync   │
└───────────────┘  └───────────────┘  └───────────────┘
                                              │
                                              ▼
                                    ┌───────────────────┐
                                    │  SSG Adapter Layer │
                                    │  Mintlify (default)│
                                    │  Docusaurus        │
                                    │  Nextra            │
                                    │  VitePress         │
                                    └───────────────────┘
```

**Output matrix:** markdown, MDX, OpenAPI 3.2, llms.txt, llms-full.txt, SKILL packages, README sync. All outputs tracked via `ForgeResult.writtenFiles`.

## The Five Pillars

Inspired by the battle-tested patterns in [ferrous-forge](https://github.com/kryptobaseddev/ferrous-forge) (Rust sister project, v1.9.0), adapted for the TypeScript ecosystem. forge-ts sits **on top of** best-practice tools like Biome, LSP, and linting tools — it does not replace them, it adds strict opinionated guardrails.

### Pillar 1: Enforcement (Existing — API Layer ✅, Dev/Consumer Layer EXPANDING)

Strict TSDoc quality enforcement across all three documentation layers.

**API Layer (v0.8.0 — complete):**

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

**Dev Layer (planned):**

| Rule | Description | Severity |
|------|-------------|----------|
| E013 | Missing `@remarks` on public function/class | error |
| E014 | Missing `@defaultValue` on optional property with default | warn |
| E015 | Missing `@typeParam` on generic symbol | error |
| W005 | Missing `@see` for referenced symbols | warn |
| W006 | TSDoc parse errors (surfaces 70+ parser-level messages) | warn |

**Consumer Layer (planned):**

| Rule | Description | Severity |
|------|-------------|----------|
| E016 | Exported symbol missing release tag (`@public`/`@beta`/`@internal`) | error |
| W007 | Guide FORGE:AUTO section is stale (code changed, guide not rebuilt) | warn |
| W008 | Symbol exported from index.ts but not documented in any guide | warn |

**Config Guard Layer (planned):**

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

### Pillar 2: Generation (Existing ✅ + Intelligent Guides PLANNED)

All three documentation layers from the original vision, plus intelligent guide generation.

- **API Docs**: OpenAPI 3.2.0 with `@route` tag path extraction, visibility-filtered
- **Dev Docs**: DocTests via `@example` + `node:test`, llms.txt/llms-full.txt for AI context
- **Consumer Docs**: 4 SSG adapters (Mintlify default), FORGE:AUTO progressive enrichment
- **SKILL packages**: LAFS protocol output for agent-consumable documentation
- **mdast AST pipeline** (v0.8.0): gray-matter + unified/remark for all markdown transforms

**Intelligent Guide Generation (planned):**
- Code analysis discovers guide topics: entry points, workflows, config types, error catalogs, extension patterns
- `@guide` and `@concept` custom TSDoc tags for explicit annotation
- Three zone types for idempotent regeneration: FORGE:AUTO (always fresh), FORGE:STUB (generated once, preserved after edit), unmarked (user-owned)
- Consumer guides derive structure and content from code — code is the SSoT

### Pillar 2.5: TSDoc Ecosystem Orchestration (NEW) -- PLANNED

forge-ts becomes the central authority for TSDoc standards in a project.

**Opinionated TSDoc Preset** (`@forge-ts/tsdoc-config`):
- Ships a `tsdoc.json` with all Core + Extended standardization groups enabled
- Defines custom tags: `@route`, `@category`, `@since`, `@guide`, `@concept`
- Consumed by eslint-plugin-tsdoc, TypeDoc, API Extractor automatically

**Central Config Orchestration** (`forge-ts.config.ts` flows DOWN):
- **WRITES** tsdoc.json (forge-ts owns the TSDoc standard for the project)
- **GUARDS** tsconfig.json, biome.json, package.json (detects drift, doesn't write)
- **SCAFFOLDS** eslint-plugin-tsdoc config during `forge-ts init` (if ESLint detected)

**@microsoft/tsdoc-config Integration**:
- Replaces bare `new TSDocConfiguration()` with `TSDocConfigFile.loadForFolder()`
- Surfaces 70+ TSDoc parser-level syntax errors that were previously silent
- Custom tag definitions flow from forge-ts.config.ts -> tsdoc.json -> all tools

### Pillar 3: Agent-Proof Guardrails (NEW) -- PLANNED

> *"LLM agents like to take the easy way out and downgrade or switch versions."*

The highest-priority new capability. Every bypass must be explicit, justified, and audited.

**Config Locking**: Prevent loosening of forge-ts rules, tsconfig strictness, and Biome config.
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

**LLM Anti-Pattern Detection**: Flag common agent shortcuts in monitored files.
- `@ts-ignore` / `@ts-expect-error` additions in non-test files
- `any` type casts in public API signatures
- `strict: false` or strictness loosening in tsconfig
- `"off"` overrides in forge-ts or Biome config

### Pillar 4: Safety Pipeline (NEW) -- PLANNED

Pre-commit and pre-publish integration — catch issues at commit time, not CI time.

**Pre-Commit Integration**:
- `forge-ts check` as a husky/lefthook gate
- `forge-ts init --hooks` scaffolds hook configuration for the project
- forge-ts provides the check command; hook management is deferred to husky/lefthook

**Pre-Publish Validation**:
- `forge-ts prepublish` runs check + build in a single gate command
- Block `npm publish` if documentation coverage fails thresholds
- Integrates with npm `prepublishOnly` lifecycle script

**Safety Defaults**:
- Strict by default — escape hatches require explicit command + reason + audit
- All safety overrides logged to the audit trail (Pillar 3)
- Zero silent environment variables that disable everything

### Pillar 5: Ecosystem Integration (NEW) -- PLANNED

forge-ts complements, never replaces, existing best-practice tools.

**Complement, Don't Replace**:
| Tool | Owns | forge-ts Adds |
|------|------|---------------|
| Biome | Code quality, formatting | Config drift prevention — detect weakened rules |
| ESLint/TSDoc plugin | JSDoc syntax validation | TSDoc completeness and cross-reference validation |
| Knip | Dead code / unused exports | Skip enforcement on Knip-flagged dead exports |
| publint / attw | Package quality | Documentation coverage as a publish gate |
| TypeScript | Type checking | tsconfig strictness locking |

**forge-ts Owns** (no other tool does this):
- TSDoc completeness enforcement (E001-E008)
- Documentation pipeline integration (lint -> generate -> validate -> publish)
- Config drift prevention (tsconfig, Biome, forge-ts rules)
- Agent-proof guardrails on documentation quality

**Config Guard Rules** (planned E009-E012):
- E009: tsconfig strictness regression (detect loosening of strict mode flags)
- E010: forge-ts config drift (detect rule severity weakening without audit trail)
- E011: Biome config weakening (detect rules switched from error to warn/off)
- E012: package.json engine field tampering (detect Node.js version downgrades)

## Competitive Positioning

What **no other tool** in the TypeScript ecosystem does:

| Capability | forge-ts | TypeDoc | ESLint | Biome | publint |
|------------|----------|---------|--------|-------|---------|
| `@packageDocumentation` enforcement (E005) | ✅ | -- | -- | -- | -- |
| Dead `{@link}` validation (E008) | ✅ | -- | -- | -- | -- |
| Cross-package deprecated import tracking (W004) | ✅ | -- | -- | -- | -- |
| Config drift prevention | ✅ (planned) | -- | -- | -- | -- |
| Doc pipeline: lint -> generate -> validate -> publish | ✅ | partial | -- | -- | -- |
| Agent-proof guardrails on doc quality | ✅ (planned) | -- | -- | -- | -- |
| OpenAPI generation from TSDoc `@route` tags | ✅ | -- | -- | -- | -- |
| llms.txt / llms-full.txt generation | ✅ | -- | -- | -- | -- |
| SKILL package generation (LAFS protocol) | ✅ | -- | -- | -- | -- |

## Roadmap

### Phase 1-3: Foundation, Enforcement, Generation -- ✅ COMPLETE (v0.1.0 - v0.8.0)

All three documentation layers implemented. 12 enforcement rules. 4 SSG adapters. mdast AST pipeline. SKILL package generation. 441 tests passing.

### Phase 4: TSDoc Ecosystem Foundation (v0.9.0 — Next)

- Replace `new TSDocConfiguration()` with `TSDocConfigFile.loadForFolder()` in walker.ts
- Add `@microsoft/tsdoc-config` dependency to `@forge-ts/core`
- Create `@forge-ts/tsdoc-config` package with opinionated tsdoc.json preset
- Update `forge-ts init` to write tsdoc.json + scaffold eslint-plugin-tsdoc config
- Add W006 rule (surface TSDoc parser-level syntax errors)
- Add `tsdoc` and `guards` sections to ForgeConfig

### Phase 5: Agent-Proof Guardrails (v0.10.0)

- Config locking system (`forge-ts lock` / `forge-ts unlock`)
- Audit logging (append-only `.forge-audit.jsonl`)
- Bypass system with time expiration + daily budget
- New enforcer rules: E009 (tsconfig strictness), E010 (config drift detection)
- LLM anti-pattern detection in monitored files

### Phase 6: Dev Layer Enforcement (v0.11.0)

- New rules: E013 (@remarks), E014 (@defaultValue), E015 (@typeParam), W005 (@see)
- Enhanced DocTest: detect stale @example blocks where signatures changed
- Add `@concept` and `@guide` custom tags to tsdoc.json preset
- Validate `{@inheritDoc}` sources exist and have content

### Phase 7: Intelligent Guide Generation (v0.12.0)

- Guide discovery heuristics (entry points, workflows, config types, error catalogs)
- FORGE:STUB zone support alongside FORGE:AUTO
- Code-derived guide structures with TODO markers for human/agent completion
- Add W007 (stale guide detection), W008 (undocumented in guides)
- Add `guides` section to ForgeConfig

### Phase 8: Safety Pipeline + Ecosystem (v0.13.0)

- `forge-ts init --hooks` (husky/lefthook scaffolding)
- `forge-ts prepublish` (check + build in one gate command)
- E011 (Biome config guard), E012 (package.json engine guard)
- E016 (release tag requirement)
- Knip integration (skip enforcement on dead exports)
- LSP extension for real-time diagnostics in editor (long-term)