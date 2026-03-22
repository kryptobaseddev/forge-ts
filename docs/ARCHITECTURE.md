# forge-ts: System Architecture (v0.13.0)

This document describes how forge-ts works technically. It covers the package
structure, data flow, subsystems, and technology choices that make up the system
as of v0.13.0. For the project vision, see `VISION.md`. For the feature
inventory, see `FEATURES.md`.

> **Note:** The former `FORGE-ARCHITECTURE-SPEC.md` in this directory served as
> the working design spec during the v0.9.0 through v0.13.0 development cycle.
> Its content has been absorbed into this document and the spec file is now
> deprecated. It remains in the repository for historical reference only.

---

## 1. Package Architecture

forge-ts is a pnpm monorepo comprising 8 packages. Fixed versioning via
`@changesets/cli` means all packages share the same version number.

```
@forge-ts/tsdoc-config  JSON-only package; opinionated tsdoc.json preset
        |
@forge-ts/core          TS Compiler API walker, ForgeSymbol graph,
        |               TSDoc parsing via @microsoft/tsdoc-config,
        |               config loading, lock/audit/bypass systems
        |
        +-- @forge-ts/enforcer    22 rules across 4 enforcement layers
        |
        +-- @forge-ts/doctest     @example extraction + node:test runner
        |
        +-- @forge-ts/api         OpenAPI 3.2.0 generation from @route tags
        |
        +-- @forge-ts/gen         Markdown/MDX site generation, guide discovery,
        |                         FORGE:AUTO/STUB zones, SSG adapters,
        |                         llms.txt, SKILL packages
        |
        +-- @forge-ts/cli         citty CLI, 10 commands, LAFS protocol output;
                                  depends on all packages above
```

Every runtime package depends on `@forge-ts/core` for the walker and config
loader. `@forge-ts/cli` is the user-facing entry point and depends on every
other runtime package. `@forge-ts/tsdoc-config` is a data-only package consumed
at TSDoc parse time.

---

## 2. Pipeline Flow

A single AST traversal produces the `ForgeSymbol[]` graph that feeds every
downstream subsystem.

```
Source Code (.ts / .tsx)
    |
    v
@forge-ts/core: createWalker() -> walk() -> ForgeSymbol[]
    |
    |-- TSDocConfigFile.loadForFolder()  (cached per directory)
    |-- TSDocParser initialized with loaded config
    |-- Single-pass AST traversal via ts.createProgram
    |-- Extracts per symbol:
    |     name, kind, visibility, signature, documentation
    |     (params, returns, throws, examples, tags, links,
    |      parseMessages), children
    |
    +---> forge-ts check: enforce(config) -> ForgeResult
    |         |
    |         |-- Per-symbol rules
    |         |     E001-E008, E013-E016, W003-W006
    |         |
    |         |-- Per-file rules
    |         |     E005 (index.ts @packageDocumentation)
    |         |
    |         |-- Cross-symbol rules
    |         |     E008 (dead {@link}), W004 (deprecated imports)
    |         |
    |         |-- Guard rules (read-only validation of external configs)
    |         |     E009 (tsconfig), E010 (lock drift),
    |         |     E011 (biome), E012 (package.json)
    |         |     Bypass check: isRuleBypassed() runs before emission
    |         |
    |         |-- Guide rules
    |               W007 (stale FORGE:AUTO), W008 (guide coverage)
    |
    +---> forge-ts test: doctest(config) -> TestResult
    |         |
    |         |-- Extract @example blocks from ForgeSymbol[]
    |         |-- Generate virtual test files in cacheDir
    |         |-- Execute via node:test runner
    |
    +---> forge-ts build: generate(config) -> GenerateResult
              |
              |-- api: generateApi()
              |     OpenAPI 3.2 spec + API reference pages
              |
              |-- gen: generate()
              |     |-- generateDocSite() creates DocPage[] via 5-stage IA
              |     |-- discoverGuides() runs 5 heuristics on symbol graph
              |     |-- SSG adapter transforms pages for target framework
              |     |-- FORGE:AUTO sections regenerated
              |     |-- FORGE:STUB sections preserved if user-modified
              |     |-- Guide pages generated with code-derived content
              |     |-- llms.txt + SKILL packages emitted
              |     |-- README sync
              |
              |-- writtenFiles tracked in result
```

---

## 3. Core Subsystem (`@forge-ts/core`)

### 3.1 Walker

`createWalker()` returns a walker instance that calls `walk()` to produce a
flat array of `ForgeSymbol` objects. The walker performs a single-pass traversal
of the TypeScript AST using `ts.createProgram`, visiting every exported
declaration.

Each `ForgeSymbol` contains the symbol's name, kind (function, class,
interface, type alias, enum, variable), visibility modifiers, full type
signature, parsed documentation, and child symbols (members of classes and
interfaces).

### 3.2 TSDoc Parsing

The walker loads TSDoc configuration via
`TSDocConfigFile.loadForFolder()` from `@microsoft/tsdoc-config`. Loaded
configurations are cached per directory in a `Map<string, TSDocConfiguration>`
inside `walker.ts`. The function `clearTSDocConfigCache()` resets this cache for
test isolation.

If no `tsdoc.json` file is found in the directory tree, the walker falls back to
a bare `new TSDocConfiguration()`.

The `TSDocParser` instance is initialized with the loaded (or fallback)
configuration. Every TSDoc comment is parsed into structured data: summary,
params, returns, throws, examples, tags, inline links, and the raw
`parseMessages` array (used by rule W006 to surface syntax errors).

### 3.3 Config Loading

`loadConfig()` reads `forge-ts.config.ts` from the project root. This file is
the single source of truth for all forge-ts behavior. It contains 10 sections:

| Section | Controls |
|---------|----------|
| `enforce` | Rule severities and per-rule configuration |
| `doctest` | Cache directory, test runner options |
| `api` | OpenAPI output path, visibility filtering |
| `gen` | Output directory, SSG target, page templates |
| `skill` | SKILL package generation options |
| `tsdoc` | tsdoc.json writing, custom tag definitions |
| `guards` | tsconfig/biome/package.json validation thresholds |
| `bypass` | Daily bypass budget, allowed rules |
| `guides` | Guide auto-discovery toggle, custom guide definitions |
| `project` | Root directory, entry points, exclude patterns |

### 3.4 Agent-Proof Subsystem

Three files form the lock/audit/bypass system:

**`.forge-lock.json`** stores a `ForgeLockManifest` containing snapshots of
rule severities and guard configuration values at lock time. The enforcer calls
`validateAgainstLock()` during `enforce()` to detect drift (rule E010).

**`.forge-audit.jsonl`** is an append-only JSON Lines file. Every lock, unlock,
bypass, and severity change appends a timestamped entry.

**`.forge-bypass.json`** holds an array of `BypassRecord` objects, each
specifying a rule ID, a reason, and an expiration. The enforcer calls
`isRuleBypassed()` before emitting guard rules E009, E010, E011, and E012. A
configurable daily budget limits how many bypasses can be active simultaneously.

---

## 4. Enforcer Subsystem (`@forge-ts/enforcer`)

The enforcer runs 22 rules organized into 4 layers. Each rule receives the
`ForgeSymbol[]` graph (or config files for guard rules) and emits diagnostics
at either `error` or `warn` severity.

### 4.1 API Documentation Rules

Per-symbol rules that validate TSDoc completeness on public exports:

| Rule | Severity | What It Checks |
|------|----------|----------------|
| E001 | error | Missing summary on exported symbol |
| E002 | error | Missing `@param` for declared parameters |
| E003 | error | Missing `@returns` on non-void function |
| E004 | error | Missing `@example` block |
| E005 | error | Missing `@packageDocumentation` in index.ts |
| E006 | error | Class member missing documentation |
| E007 | error | Interface member missing documentation |
| E008 | error | Dead `{@link}` reference (target does not exist) |
| W003 | warn | `@deprecated` tag without a reason string |
| W004 | warn | Import of a cross-package deprecated symbol |

### 4.2 Developer Documentation Rules

Rules that enforce documentation depth beyond presence:

| Rule | Severity | What It Checks |
|------|----------|----------------|
| E013 | error | Public function/class missing `@remarks` block |
| E014 | warn | Optional property with default missing `@defaultValue` |
| E015 | error | Generic function/class/interface missing `@typeParam` |
| E016 | error | Exported symbol missing release tag (`@public`/`@beta`/`@internal`) |
| W005 | warn | Function referencing symbols not mentioned in `@see` |
| W006 | warn | TSDoc parse error (surfaces parser-level syntax messages) |

### 4.3 Guard Rules

Read-only validation of external configuration files. These rules do not modify
the files they inspect. Each guard rule checks `isRuleBypassed()` before
emitting a diagnostic.

| Rule | Severity | What It Guards |
|------|----------|----------------|
| E009 | error | `tsconfig.json` strictness regression (required flags from `guards.tsconfig`) |
| E010 | error | `forge-ts.config.ts` rule severity weakened vs `.forge-lock.json` |
| E011 | error | `biome.json` rule weakened (locked rules switched from error to warn/off) |
| E012 | error | `package.json` engine field tampered (Node version downgraded, `type` changed) |

### 4.4 Guide Rules

Rules that validate the generated documentation site stays synchronized with
source code:

| Rule | Severity | What It Checks |
|------|----------|----------------|
| W007 | warn | FORGE:AUTO section is stale (code changed, guide not rebuilt) |
| W008 | warn | Symbol exported from index.ts not referenced in any guide page |

---

## 5. DocTest Subsystem (`@forge-ts/doctest`)

The doctest engine extracts `@example` code blocks from the `ForgeSymbol[]`
graph, generates virtual test files in a configurable cache directory, and
executes them via the built-in `node:test` runner.

The execution flow:

1. Iterate over all symbols with `@example` blocks.
2. For each example, generate a virtual `.test.ts` file that imports the parent
   symbol and wraps the example code in a test case.
3. Auto-inject imports based on the symbol's module path.
4. Execute all generated test files via `node:test`.
5. Map failures back to the original source file and line number.

---

## 6. API Generator Subsystem (`@forge-ts/api`)

The API generator operates entirely from the `ForgeSymbol[]` graph. No
decorators, no runtime reflection, no tsoa.

1. **Symbol extraction:** Collects exported interfaces, types, classes, enums,
   and functions from the symbol graph.
2. **Route detection:** Symbols annotated with `@route` tags (e.g.,
   `@route GET /api/users`) produce OpenAPI path items.
3. **Schema mapping:** TypeScript type signatures are mapped to OpenAPI 3.2.0
   schemas, handling generics, unions, intersections, and enums.
4. **Visibility filtering:** Respects `@public`, `@beta`, `@internal` tags to
   control which symbols appear in the generated spec.
5. **Output:** Produces an `openapi.json` file conforming to the OpenAPI 3.2.0
   specification and structured API reference pages.

---

## 7. Generation Subsystem (`@forge-ts/gen`)

The generation subsystem produces all consumer-facing output: documentation
site pages, guide pages, `llms.txt` AI context files, SKILL packages, and
README synchronization.

### 7.1 Five-Stage Information Architecture

`generateDocSite()` organizes `DocPage[]` output into five stages:

| Stage | Name | Content |
|-------|------|---------|
| 1 | ORIENT | Introduction, overview, quick start |
| 2 | LEARN | Concepts, tutorials, guides |
| 3 | BUILD | Configuration, integration, extending |
| 4 | REFERENCE | API reference, type reference, CLI reference |
| 5 | COMMUNITY | Contributing, changelog, support |

### 7.2 Guide Discovery

`discoverGuides()` runs 5 heuristics against the symbol graph to identify
guide topics automatically:

1. **Entry point analysis:** Functions exported from index.ts suggest "Getting
   Started" guide sections.
2. **Workflow detection:** Functions that call each other in sequence suggest
   step-by-step workflow guides.
3. **Config type analysis:** Configuration interfaces suggest a configuration
   guide with every option documented.
4. **Error/throws analysis:** Functions with `@throws` tags suggest an error
   handling guide.
5. **Pattern detection:** Adapter, strategy, and factory patterns suggest an
   "Extending" guide with extension points.

Additionally, explicit `@guide` and `@category` tags on symbols produce
dedicated guide pages and category-organized sections.

### 7.3 Zone System for Idempotent Regeneration

The zone system ensures user-written content survives `forge-ts build`.

**FORGE:AUTO zones** are delimited by `<!-- FORGE:AUTO-START id -->` and
`<!-- FORGE:AUTO-END id -->` markers. Content inside these zones is regenerated
from code on every build. Stale detection (rule W007) compares current code
state against the last generated content.

**FORGE:STUB zones** are delimited by `<!-- FORGE:STUB-START id -->` and
`<!-- FORGE:STUB-END id -->` markers. A `<!-- FORGE:STUB-HASH: xxx -->` comment
inside the zone stores a DJB2 hash (8-character fingerprint) of the originally
generated content. On subsequent builds, `stubHash()` compares the current
content against this fingerprint. If the content has been modified by a user,
the zone is preserved. If it still matches the original stub, it is eligible
for regeneration.

**Unmarked zones** are any content outside FORGE:AUTO and FORGE:STUB markers.
forge-ts never reads or modifies unmarked content.

AST-aware marker detection prevents false matches inside fenced code blocks.

### 7.4 SSG Adapter System

A central `SSGAdapter` interface defines five methods:

| Method | Purpose |
|--------|---------|
| `transformPages()` | Convert `DocPage[]` into SSG-specific file format |
| `generateConfig()` | Produce the SSG's configuration file |
| `scaffold()` | Create initial project structure for the SSG |
| `getDevCommand()` | Return the SSG's local development server command |
| `detectExisting()` | Check if the SSG is already configured in the project |

Four adapters are implemented:

| Adapter | SSG Target | Notes |
|---------|-----------|-------|
| `mintlify` | Mintlify | Default adapter; agent-first, zero build step |
| `docusaurus` | Docusaurus | React-based, MDX support |
| `nextra` | Nextra | Next.js-based documentation |
| `vitepress` | VitePress | Vite-powered, Vue-based |

Adapters are managed through a registry pattern: `getAdapter(target)` retrieves
an adapter by name, and `registerAdapter()` adds custom adapters at runtime.

### 7.5 AI Context Output

The generation subsystem produces two AI context files:

- **`llms.txt`:** A routing manifest listing all available context files with
  descriptions, enabling LLM agents to discover relevant documentation.
- **`llms-full.txt`:** A dense context file containing full type signatures,
  parameter documentation, return types, and code examples.

SKILL packages bundle related documentation into self-contained context units
for agent consumption.

---

## 8. CLI Subsystem (`@forge-ts/cli`)

The CLI is built on `citty 0.2.1` and provides 10 commands. It integrates
`@cleocode/lafs-protocol 1.8.0` for machine-readable output.

**Output mode flags** (available on all commands):

| Flag | Behavior |
|------|----------|
| `--json` | Emits a `LAFSEnvelope` JSON object to stdout; human text goes to stderr |
| `--human` | Forces plain human-readable output (default in TTY contexts) |
| `--quiet` | Suppresses all non-error output |
| `--mvi` | Includes a structured `intent` block in the envelope for agent verification |

The `LAFSEnvelope` wraps every `--json` response with `status`, `data`,
`warnings`, and optional `intent` fields. Config-level warnings (such as
unrecognized options) are emitted to stderr and included in the envelope's
`result._warnings` array.

The CLI version is read from `package.json` via `createRequire` (single source
of truth; never hardcoded).

---

## 9. TSDoc Integration

### 9.1 Configuration Loading

forge-ts uses `@microsoft/tsdoc-config` (v0.18.1) to load `tsdoc.json` files.
The walker calls `TSDocConfigFile.loadForFolder()` which searches up the
directory tree for the nearest `tsdoc.json`. Loaded configurations are cached
per directory to avoid repeated filesystem access.

### 9.2 Custom Tags

forge-ts defines 5 custom tags in its opinionated `tsdoc.json` preset (shipped
by `@forge-ts/tsdoc-config`):

| Tag | Syntax Kind | Purpose |
|-----|-------------|---------|
| `@route` | block | HTTP route extraction for OpenAPI (e.g., `@route GET /api/users`) |
| `@category` | modifier | Symbol categorization for documentation organization |
| `@since` | modifier | Version tracking |
| `@guide` | block | Links a symbol to a consumer guide topic |
| `@concept` | block | Links a symbol to a concepts page section |

### 9.3 Config Ownership Model

forge-ts **writes** `tsdoc.json` (it owns the TSDoc standard for the project).
The `forge-ts init` command generates this file from the preset in
`@forge-ts/tsdoc-config`.

forge-ts **guards** (reads but does not write) `tsconfig.json`, `biome.json`,
and `package.json`. Those tools own their respective configuration files;
forge-ts validates them against expected thresholds and reports violations
through the guard rules (E009, E011, E012).

---

## 10. Config System

`forge-ts.config.ts` is the single source of truth. It flows downward:

```
forge-ts.config.ts (SSoT)
        |
        v
  +-----------+     +-------------+     +-----------+     +-------------+
  | tsdoc.json|     | biome.json  |     | tsconfig  |     | package.json|
  | (written) |     | (guarded)   |     | (guarded) |     | (guarded)   |
  +-----------+     +-------------+     +-----------+     +-------------+
```

The config contains 10 sections (documented in section 3.3 above). At runtime,
`loadConfig()` in `@forge-ts/core` reads and validates the config, providing
typed defaults for any omitted sections.

---

## 11. Technology Stack

| Tool | Version | Role |
|------|---------|------|
| Node.js | 24.14.0 LTS | Runtime |
| TypeScript | 6.0 | Compiler API (last JS-based release) |
| pnpm | 10.x | Monorepo workspaces with topological builds |
| @microsoft/tsdoc | 0.16.0 | TSDoc comment parsing |
| @microsoft/tsdoc-config | 0.18.1 | tsdoc.json loading and resolution |
| citty | 0.2.1 | Type-safe CLI framework (zero deps, 2.9kB) |
| @cleocode/lafs-protocol | 1.8.0 | LLM-Agent-First output layer |
| unified + remark | 11.x / 15.x | mdast AST pipeline for Markdown/MDX |
| gray-matter | 4.x | Frontmatter parsing |
| Vitest | 4.1.0 | Unit test framework |
| node:test | Built-in (Node 24) | DocTest execution runner |
| Biome | 2.4 | Linting + formatting |
| tsup | 8.5.x | ESM bundling + .d.ts generation |
| @changesets/cli | 2.x | Fixed versioning across all packages |

---

## 12. Tooling Rationale

### pnpm over Bun

Bun 1.3.11 was evaluated and rejected as the monorepo manager and runtime due
to fundamental incompatibilities:

- **TypeScript Compiler API crashes in Bun** (segfaults, stack overflows --
  GitHub issue #18960). This is a hard blocker since `@forge-ts/enforcer` and
  `@forge-ts/doctest` are built entirely on `ts.createProgram`.
- **No `.d.ts` generation.** Bun cannot generate TypeScript declaration files;
  tsup handles this for all published packages.
- **No topological build ordering.** `pnpm -r --filter` provides
  dependency-ordered builds across the monorepo; Bun has no equivalent.
- **Partial `node:test` implementation.** forge-ts relies on advanced
  `node:test` features (per-test timeouts, automatic subtest awaiting) that are
  not fully implemented in Bun.

pnpm 10.x with `pnpm -r` is battle-tested, provides true topological workspace
builds, and has zero compatibility issues with the TS Compiler API.

### Biome over ESLint + Prettier

Biome 2.4 replaces the ESLint + Prettier combination across the monorepo:

- **Performance.** 10-100x faster than ESLint + Prettier in benchmarks --
  critical for a tool that acts as a build gate.
- **Unified config.** A single `biome.json` replaces `.eslintrc`,
  `.prettierrc`, and multiple plugin configs.
- **Rule coverage.** 423+ lint rules including type-aware linting, covering the
  equivalent of `eslint:recommended` + `@typescript-eslint/recommended` +
  Prettier formatting.
- **Zero peer-dependency fragility.** ESLint's plugin ecosystem has frequent
  breaking changes across major versions; Biome ships as a single binary.
