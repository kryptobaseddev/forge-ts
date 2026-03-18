---
title: cli — Examples
outline: deep
description: Usage examples for the cli package
---

# cli — Examples

All usage examples from the package, aggregated for quick reference.

## `emitResult()`

_Wraps a command result in a LAFS envelope and emits it.  - JSON mode: writes the projected envelope to stdout as JSON. - Human mode: calls the provided formatter function. - Quiet mode: suppresses all output regardless of format._

[View in API reference](./api-reference.md#emitresult)

```typescript
import { emitResult } from "@forge-ts/cli/output";
emitResult(output, { human: true }, (data) => `Done: ${data.summary.duration}ms`);
```

## `runBuild()`

_Runs the full build pipeline and returns a typed command output._

[View in API reference](./api-reference.md#runbuild)

```typescript
import { runBuild } from "@forge-ts/cli/commands/build";
const output = await runBuild({ cwd: process.cwd() });
console.log(output.success); // true if all steps succeeded
```

## `runCheck()`

_Runs the TSDoc enforcement pass and returns a typed command output._

[View in API reference](./api-reference.md#runcheck)

```typescript
import { runCheck } from "@forge-ts/cli/commands/check";
const output = await runCheck({ cwd: process.cwd() });
console.log(output.data.summary.errors); // number of TSDoc errors found
```

## `runTest()`

_Runs the doctest pipeline and returns a typed command output._

[View in API reference](./api-reference.md#runtest)

```typescript
import { runTest } from "@forge-ts/cli/commands/test";
const output = await runTest({ cwd: process.cwd() });
console.log(output.data.summary.passed); // number of passing doctests
```
