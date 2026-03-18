---
title: doctest
outline: deep
description: doctest package overview
---

# doctest

## Exported Symbols

| Symbol | Kind | Description |
|--------|------|-------------|
| [`ExtractedExample`](./api-reference.md#extractedexample) | interface | A single extracted `@example` block ready for test generation. |
| [`extractExamples()`](./api-reference.md#extractexamples) | function | Extracts all `@example` blocks from a list of  objects. |
| [`GeneratorOptions`](./api-reference.md#generatoroptions) | interface | Options for virtual test file generation. |
| [`VirtualTestFile`](./api-reference.md#virtualtestfile) | interface | A generated virtual test file. |
| [`generateTestFiles()`](./api-reference.md#generatetestfiles) | function | Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map. |
| [`RunResult`](./api-reference.md#runresult) | interface | Result of running the generated test files. |
| [`TestCaseResult`](./api-reference.md#testcaseresult) | interface | The result of a single test case. |
| [`runTests()`](./api-reference.md#runtests) | function | Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`). |
| [`doctest()`](./api-reference.md#doctest) | function | Runs the full doctest pipeline: extract → generate → run. |
