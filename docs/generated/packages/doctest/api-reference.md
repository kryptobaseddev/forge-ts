---
title: doctest — API Reference
outline: deep
description: Full API reference for the doctest package
---

# doctest — API Reference

## Functions

### `extractExamples()`

```typescript
(symbols: ForgeSymbol[]) => ExtractedExample[]
```

Extracts all `@example` blocks from a list of  objects.

**Parameters**

- `symbols` — The symbols produced by the core AST walker.

**Returns**: A flat array of  objects, one per code block.

**Examples**

```typescript
import { createWalker, loadConfig } from "@forge-ts/core";
import { extractExamples } from "@forge-ts/doctest";
const config = await loadConfig();
const symbols = createWalker(config).walk();
const examples = extractExamples(symbols);
console.log(`Found ${examples.length} examples`);
```


### `generateTestFiles()`

```typescript
(examples: ExtractedExample[], options: GeneratorOptions) => VirtualTestFile[]
```

Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map.

**Parameters**

- `examples` — Examples to include in the generated file.
- `options` — Output configuration.

**Returns**: An array of  objects (one per source file).

**Examples**

```typescript
import { generateTestFiles } from "@forge-ts/doctest";
const files = generateTestFiles(examples, { cacheDir: "/tmp/doctest-cache" });
console.log(`Generated ${files.length} test file(s)`);
```


### `runTests()`

```typescript
(files: VirtualTestFile[]) => Promise<RunResult>
```

Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`).

**Parameters**

- `files` — The virtual test files to write and run.

**Returns**: A  summarising the test outcome.

**Examples**

```typescript
import { runTests } from "@forge-ts/doctest";
const result = await runTests(virtualFiles);
if (!result.success) {
  console.error(`${result.failed} doctest(s) failed`);
}
```


### `doctest()`

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

Runs the full doctest pipeline: extract → generate → run.

**Parameters**

- `config` — The resolved  for the project.

**Returns**: A  with success/failure and any diagnostics.

**Examples**

```typescript
import { loadConfig } from "@forge-ts/core";
import { doctest } from "@forge-ts/doctest";
const config = await loadConfig();
const result = await doctest(config);
if (!result.success) {
  console.error(`${result.errors.length} doctest failure(s)`);
}
```


## Interfaces

### `ExtractedExample`

```typescript
any
```

A single extracted `@example` block ready for test generation.

#### `symbolName`

```typescript
string
```

The symbol this example belongs to.

#### `filePath`

```typescript
string
```

Absolute path to the source file.

#### `line`

```typescript
number
```

1-based line number of the `@example` tag.

#### `code`

```typescript
string
```

The raw code inside the fenced block.

#### `language`

```typescript
string
```

The language identifier (e.g. `"typescript"`).

#### `index`

```typescript
number
```

Sequential index among examples for this symbol.


### `GeneratorOptions`

```typescript
any
```

Options for virtual test file generation.

#### `cacheDir`

```typescript
string
```

Directory where virtual test files will be written.


### `VirtualTestFile`

```typescript
any
```

A generated virtual test file.

#### `path`

```typescript
string
```

Absolute path where the file will be written.

#### `content`

```typescript
string
```

File contents (valid TypeScript).


### `RunResult`

```typescript
any
```

Result of running the generated test files.

#### `success`

```typescript
boolean
```

Whether all tests passed.

#### `passed`

```typescript
number
```

Number of tests that passed.

#### `failed`

```typescript
number
```

Number of tests that failed.

#### `output`

```typescript
string
```

Combined stdout + stderr output from the test runner.

#### `tests`

```typescript
TestCaseResult[]
```

Individual test results with name and status.


### `TestCaseResult`

```typescript
any
```

The result of a single test case.

#### `name`

```typescript
string
```

The full test name as reported by the runner.

#### `passed`

```typescript
boolean
```

Whether this test passed.

#### `sourceFile`

```typescript
string | undefined
```

The source file this test was generated from, if determinable.
