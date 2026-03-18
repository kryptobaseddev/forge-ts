---
title: core — Functions
outline: deep
description: Functions and classes for the core package
---

# core — Functions & Classes

Functions and classes exported by this package.

## defaultConfig(rootDir)

Constructs a sensible default  rooted at `rootDir`.

**Signature**

```typescript
(rootDir: string) => ForgeConfig
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `rootDir` | — | Absolute path to the project root. |

**Returns** — A fully-populated default configuration.

**Example**

```typescript
import { defaultConfig } from "@forge-ts/core";
const config = defaultConfig("/path/to/project");
console.log(config.enforce.enabled); // true
```

## loadConfig(rootDir)

Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found)

**Signature**

```typescript
(rootDir?: string | undefined) => Promise<ForgeConfig>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `rootDir` | — | The project root to search for config.  Defaults to `process.cwd()`. |

**Returns** — A fully-resolved .

**Example**

```typescript
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
// config is fully resolved with defaults
```

## resolveVisibility(tags)

Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  →  2. `@beta`      →  3. `@public`    →  4. (no tag)     →  (default for exports)

**Signature**

```typescript
(tags: Record<string, string[]> | undefined) => Visibility
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tags` | — | The parsed `tags` map from `ForgeSymbol.documentation`. |

**Returns** — The resolved  value.

**Example**

```typescript
import { resolveVisibility } from "@forge-ts/core";
const vis = resolveVisibility({ internal: [] });
// vis === Visibility.Internal
```

## meetsVisibility(candidate, minVisibility)

Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not.

**Signature**

```typescript
(candidate: Visibility, minVisibility: Visibility) => boolean
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `candidate` | — | The visibility of the symbol being tested. |
| `minVisibility` | — | The minimum visibility threshold. |

**Returns** — `true` if `candidate` is at least as visible as `minVisibility`.

**Example**

```typescript
import { meetsVisibility, Visibility } from "@forge-ts/core";
meetsVisibility(Visibility.Public, Visibility.Public); // true
meetsVisibility(Visibility.Internal, Visibility.Public); // false
```

## filterByVisibility(symbols, minVisibility)

Filters an array of  objects to only include symbols whose visibility meets or exceeds `minVisibility`.

**Signature**

```typescript
(symbols: ForgeSymbol[], minVisibility: Visibility) => ForgeSymbol[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | The full list of symbols to filter. |
| `minVisibility` | — | The minimum visibility threshold to keep. |

**Returns** — A new array containing only symbols that pass the visibility check.

**Example**

```typescript
import { filterByVisibility, Visibility } from "@forge-ts/core";
const publicOnly = filterByVisibility(symbols, Visibility.Public);
```

## createWalker(config)

Creates an  configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each .

**Signature**

```typescript
(config: ForgeConfig) => ASTWalker
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `config` | — | The resolved  for the project. |

**Returns** — An  instance whose `walk()` method performs the extraction.

**Example**

```typescript
import { loadConfig, createWalker } from "@forge-ts/core";
const config = await loadConfig();
const walker = createWalker(config);
const symbols = walker.walk();
console.log(`Found ${symbols.length} symbols`);
```
