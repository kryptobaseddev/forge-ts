---
title: doctest — Functions
outline: deep
description: Functions and classes for the doctest package
---

# doctest — Functions & Classes

Functions and classes exported by this package.

## extractExamples(symbols)

Extracts all `@example` blocks from a list of  objects.

**Signature**

```typescript
(symbols: ForgeSymbol[]) => ExtractedExample[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | The symbols produced by the core AST walker. |

**Returns** — A flat array of  objects, one per code block.

## generateTestFiles(examples, options)

Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map.

**Signature**

```typescript
(examples: ExtractedExample[], options: GeneratorOptions) => VirtualTestFile[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `examples` | — | Examples to include in the generated file. |
| `options` | — | Output configuration. |

**Returns** — An array of  objects (one per source file).

## runTests(files)

Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`).

**Signature**

```typescript
(files: VirtualTestFile[]) => Promise<RunResult>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `files` | — | The virtual test files to write and run. |

**Returns** — A  summarising the test outcome.

## doctest(config)

Runs the full doctest pipeline: extract → generate → run.

**Signature**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `config` | — | The resolved  for the project. |

**Returns** — A  with success/failure and any diagnostics.
