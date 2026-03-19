---
name: forge-ts
description: >
  Runs the API generation pipeline: walk → extract → generate → write. Use this skill when working with forge-ts. It exports functions, type contracts. Use when you need to understand the API, generate documentation, check TSDoc coverage, or run code examples as tests.
license: MIT
compatibility: Requires Node.js >=24 and TypeScript
metadata:
---

# forge-ts

Runs the API generation pipeline: walk → extract → generate → write.

## Quick Start

```bash
npm install -D forge-ts
```

## Core Workflow

### Step 1: Check TSDoc Coverage

```bash
npx forge-ts check
```

### Step 2: Run Doctests

```bash
npx forge-ts test
```

### Step 3: Generate Documentation

```bash
npx forge-ts build
```

## Common Patterns

### defaultConfig

Constructs a sensible default  rooted at `rootDir`.

```typescript
import { defaultConfig } from "@forge-ts/core";
const config = defaultConfig("/path/to/project");
console.log(config.enforce.enabled); // true
```

### loadConfig

Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found)

```typescript
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
// config is fully resolved with defaults
```

### resolveVisibility

Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  →  2. `@beta`      →  3. `@public`    →  4. (no tag)     →  (default for exports)

```typescript
import { resolveVisibility } from "@forge-ts/core";
const vis = resolveVisibility({ internal: [] });
// vis === Visibility.Internal
```

### meetsVisibility

Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not.

```typescript
import { meetsVisibility, Visibility } from "@forge-ts/core";
meetsVisibility(Visibility.Public, Visibility.Public); // true
meetsVisibility(Visibility.Internal, Visibility.Public); // false
```

### filterByVisibility

Filters an array of  objects to only include symbols whose visibility meets or exceeds `minVisibility`.

```typescript
import { filterByVisibility, Visibility } from "@forge-ts/core";
const publicOnly = filterByVisibility(symbols, Visibility.Public);
```

## Gotchas

- Every exported function MUST have a `@example` block (E004)
- Every interface member MUST have a TSDoc comment (E007)
- `{@link}` references must point to existing symbols (E008)
- Symbols tagged `@internal` are excluded from documentation output
- `@packageDocumentation` must appear in the entry-point file (E005)

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

## Configuration

Create a `forge-ts.config.ts`:

```typescript
import type { ForgeConfig } from "forge-ts";

export default {
  rootDir: ".",
  outDir: "docs/generated",
} satisfies Partial<ForgeConfig>;
```

See [references/CONFIGURATION.md](references/CONFIGURATION.md) for all options.

## Validation

Run `npx forge-ts check --json --mvi full` for detailed fix suggestions with exact TSDoc blocks to add.
