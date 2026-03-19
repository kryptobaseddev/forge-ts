---
name: forge-ts
description: >
  Runs the API generation pipeline: walk → extract → generate → write. Use when: (1) calling its 39 API functions, (2) configuring forge-ts, (3) understanding its 60 type definitions, (4) user mentions "forge-ts" or asks about its API.
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
| `defaultConfig()` | Constructs a sensible default  rooted at `rootDir`. |
| `loadConfig()` | Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found) |
| `resolveVisibility()` | Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  →  2. `@beta`      →  3. `@public`    →  4. (no tag)     →  (default for exports) |
| `meetsVisibility()` | Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not. |
| `filterByVisibility()` | Filters an array of  objects to only include symbols whose visibility meets or exceeds `minVisibility`. |
| `createWalker()` | Creates an  configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each . |
| `signatureToSchema()` | Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse. |
| `extractSDKTypes()` | Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of  objects.  Only exported symbols whose visibility is not  or  are included. |
| `generateOpenAPISpec()` | Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release. |
| `buildReference()` | Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with  or  are excluded from the top-level results. Children with private/internal visibility are also filtered out. |
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
  rootDir: ".",
  // Path to the tsconfig.json to compile against.
  tsconfig: undefined,
  // Output directory for generated files.
  outDir: ".",
  // Enforce TSDoc on all public exports.
  enforce: true,
  // DocTest configuration.
  doctest: true,
  // API generation configuration.
  api: true,
  // Output generation configuration.
  gen: true,
  // Project metadata — auto-detected from package.json if not provided.
  project: "...",
};
```

See [references/CONFIGURATION.md](references/CONFIGURATION.md) for full details.

## Gotchas

- `getAdapter()` throws: `Error` if the target is not registered.
- `Visibility` enum values: Public, Beta, Internal, Private

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
