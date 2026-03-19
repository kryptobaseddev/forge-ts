---
name: forge-ts
description: >
  Runs the API generation pipeline: walk → extract → generate → write. Use when: (1) calling its 39 API functions, (2) configuring forge-ts, (3) understanding its 61 type definitions, (4) user mentions "forge-ts" or asks about its API.
---

# forge-ts

Runs the API generation pipeline: walk → extract → generate → write.

## Quick Start

```bash
npm install forge-ts
```

```typescript
import { defaultConfig } from "@forge-ts/core";
const config = defaultConfig("/path/to/project");
console.log(config.enforce.enabled); // true
```

## API

| Function | Description |
|----------|-------------|
| `defaultConfig()` | Constructs a sensible default `ForgeConfig` rooted at `rootDir`. |
| `loadConfig()` | Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found) |
| `resolveVisibility()` | Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  → `Visibility.Internal` 2. `@beta`      → `Visibility.Beta` 3. `@public`    → `Visibility.Public` 4. (no tag)     → `Visibility.Public` (default for exports) |
| `meetsVisibility()` | Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not. |
| `filterByVisibility()` | Filters an array of `ForgeSymbol` objects to only include symbols whose visibility meets or exceeds `minVisibility`. |
| `createWalker()` | Creates an `ASTWalker` configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each `ForgeSymbol`. |
| `signatureToSchema()` | Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse. |
| `extractSDKTypes()` | Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of `ForgeSymbol` objects.  Only exported symbols whose visibility is not `Visibility.Internal` or `Visibility.Private` are included. |
| `generateOpenAPISpec()` | Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release. |
| `buildReference()` | Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with `Visibility.Internal` or `Visibility.Private` are excluded from the top-level results. Children with private/internal visibility are also filtered out. |
| `generateApi()` | Runs the API generation pipeline: walk → extract → generate → write. |
| `groupSymbolsByPackage()` | Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name. |
| `generateDocSite()` | Generates a full multi-page documentation site from symbols grouped by package.  Follows a 5-stage information architecture: 1. ORIENT — Landing page, Getting Started 2. LEARN — Concepts (stub) 3. BUILD — Guides (stub) 4. REFERENCE — API Reference, Types, Configuration, Changelog 5. COMMUNITY — FAQ, Contributing (stubs) |
| `registerAdapter()` | Register an SSG adapter. Called once per provider at module load time. |
| `getAdapter()` | Get a registered adapter by target name. Throws if the target is not registered. |
| ... | 24 more — see API reference |

## Configuration

```typescript
import type { ForgeConfig } from "forge-ts";

const config: Partial<ForgeConfig> = {
  // Root directory of the project.
  rootDir: "...",
  // Path to the tsconfig.json to compile against.
  tsconfig: "...",
  // Output directory for generated files.
  outDir: "...",
  // Enforce TSDoc on all public exports.
  enforce: { /* ... */ },
  // DocTest configuration.
  doctest: { /* ... */ },
  // API generation configuration.
  api: { /* ... */ },
  // Output generation configuration.
  gen: [],
  // Skill package generation settings. Custom sections here are merged into the generated SKILL.md, allowing projects to inject workflow knowledge, domain gotchas, and other context that cannot be derived from symbols alone.
  skill: [],
  // Project metadata — auto-detected from package.json if not provided.
  project: [],
};
```

See [references/CONFIGURATION.md](references/CONFIGURATION.md) for full details.

## The Flow

```
Your TypeScript code
  |  Write TSDoc comments (@param, @returns, @example, etc.)
  v
forge-ts check   -->  FAILS if docs incomplete (exact fix suggestions)
  v
forge-ts build   -->  Generates ALL artifacts from TSDoc
  v
forge-ts docs init --target mintlify  -->  Scaffolds SSG project
  v
forge-ts docs dev  -->  Preview locally
```

## CLI Commands

| Command | Purpose |
|---------|---------|
| `forge-ts check` | Enforce TSDoc on all public exports |
| `forge-ts check --json --mvi full` | Agent-friendly JSON with exact fix suggestions |
| `forge-ts test` | Extract and execute @example blocks |
| `forge-ts build` | Generate all docs, OpenAPI, llms.txt, SKILL.md |
| `forge-ts build --force-stubs` | Reset stub pages to scaffolding state |
| `forge-ts docs init --target mintlify` | Scaffold SSG doc site |
| `forge-ts docs dev` | Launch dev server (`npx @mintlify/cli dev`) |

The `--mvi` flag controls verbosity: `minimal` (~50 tokens), `standard` (~200), `full` (~500+).
All JSON output uses the LAFS envelope format (`_meta`, `success`, `result`, `error`).

## SSoT Principle

Source code IS documentation. Change a function signature, docs update on next build. Remove a parameter, docs remove it. Add an `@example`, it becomes a doctest AND a doc page entry AND part of the SKILL.md.

## Auto-Generated vs Stub Pages

`forge-ts build` produces two categories of output:

**Auto-generated (regenerated every build):** index.mdx, getting-started.mdx, configuration.mdx, packages/*/api/*.mdx, api/openapi.json, llms.txt, llms-full.txt, SKILL.md, docs.json

**Stubs (created once, progressively enriched):** concepts.mdx, guides/index.mdx, faq.mdx, contributing.mdx, changelog.mdx

Stubs contain `<!-- FORGE:AUTO-START id -->` / `<!-- FORGE:AUTO-END id -->` markers. On rebuild, content inside markers is updated from source while manual content outside markers is preserved.

Use `--force-stubs` to reset stubs to their scaffolding state.

## Enforcer Rules

| Code | What it checks |
|------|----------------|
| E001 | Exported symbol missing TSDoc summary |
| E002 | Function parameter missing `@param` tag |
| E003 | Non-void function missing `@returns` tag |
| E004 | Exported function missing `@example` block |
| E005 | Entry point missing `@packageDocumentation` |
| E006 | Class member missing documentation |
| E007 | Interface/type member missing documentation |
| E008 | `{@link}` references non-existent symbol |
| W004 | Importing `@deprecated` symbol cross-package |

Rules accept `"error"` | `"warn"` | `"off"` in config `enforce.rules`.
When `strict: true`, all warnings become errors.
When `--json --mvi full`, each error includes `suggestedFix` with the exact TSDoc block to paste.

## Packages

| Package | Purpose |
|---------|---------|
| `@forge-ts/cli` | Unified CLI (install this one) |
| `@forge-ts/core` | AST walker, config loader, shared types |
| `@forge-ts/enforcer` | TSDoc enforcement (E001-E008, W004) |
| `@forge-ts/doctest` | @example extraction + node:test runner |
| `@forge-ts/api` | OpenAPI 3.2 generation from types |
| `@forge-ts/gen` | Markdown/MDX, llms.txt, SKILL.md, SSG adapters |

## Gotchas

- `getAdapter()` throws: `Error` if the target is not registered.
- `Visibility` enum values: Public, Beta, Internal, Private
- Enforcer checks ALL files in tsconfig. Exclude test fixtures via `exclude`.
- `@example` blocks require fenced code blocks. Bare code is silently ignored.
- `// => value` in examples auto-converts to `assert.strictEqual()` during doctest.
- `@internal` symbols excluded from ALL output. `@beta` filtered at `minVisibility: "public"`.
- OpenAPI paths require `@route GET /path` tags. No `@route` = empty `paths`.
- Mintlify adapter generates `docs.json` (v4 format), not `mint.json`.
- Stub pages use FORGE:AUTO markers — manual content outside markers is safe.
- `--force-stubs` resets stubs to scaffolding; use with care on edited stubs.

## Key Types

- **`Visibility`** — Visibility levels for exported symbols. Derived from TSDoc release tags (public, beta, internal).
- **`ForgeSymbol`** — A single extracted and annotated symbol from the TypeScript AST.
- **`RuleSeverity`** — Severity level for an individual enforcement rule. - `"error"` — violation fails the build. - `"warn"`  — violation is reported but does not fail the build. - `"off"`   — rule is disabled entirely.
- **`EnforceRules`** — Per-rule severity configuration for the TSDoc enforcer. Each key corresponds to one of the E001–E007 rule codes.
- **`ForgeConfig`** — Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.
- **`ForgeResult`** — The result of a forge-ts compilation pass.
- **`ForgeError`** — A diagnostic error produced during a forge-ts run.
- **`ForgeWarning`** — A diagnostic warning produced during a forge-ts run.
- **`OpenAPISchemaObject`** — OpenAPI 3.2 schema object.
- **`OpenAPIInfoObject`** — OpenAPI 3.2 info object.

## References

- [references/CONFIGURATION.md](references/CONFIGURATION.md) — Full config options
- [references/API-REFERENCE.md](references/API-REFERENCE.md) — Signatures, parameters, examples
