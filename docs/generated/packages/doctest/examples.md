---
title: doctest — Examples
outline: deep
description: Usage examples for the doctest package
---

# doctest — Examples

All usage examples from the package, aggregated for quick reference.

## `extractExamples()`

_Extracts all `@example` blocks from a list of  objects._

[View in API reference](./api-reference.md#extractexamples)

```typescript
import { createWalker, loadConfig } from "@forge-ts/core";
import { extractExamples } from "@forge-ts/doctest";
const config = await loadConfig();
const symbols = createWalker(config).walk();
const examples = extractExamples(symbols);
console.log(`Found ${examples.length} examples`);
```

## `generateTestFiles()`

_Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map._

[View in API reference](./api-reference.md#generatetestfiles)

```typescript
import { generateTestFiles } from "@forge-ts/doctest";
const files = generateTestFiles(examples, { cacheDir: "/tmp/doctest-cache" });
console.log(`Generated ${files.length} test file(s)`);
```

## `runTests()`

_Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`)._

[View in API reference](./api-reference.md#runtests)

```typescript
import { runTests } from "@forge-ts/doctest";
const result = await runTests(virtualFiles);
if (!result.success) {
  console.error(`${result.failed} doctest(s) failed`);
}
```

## `doctest()`

_Runs the full doctest pipeline: extract → generate → run._

[View in API reference](./api-reference.md#doctest)

```typescript
import { loadConfig } from "@forge-ts/core";
import { doctest } from "@forge-ts/doctest";
const config = await loadConfig();
const result = await doctest(config);
if (!result.success) {
  console.error(`${result.errors.length} doctest failure(s)`);
}
```
