---
title: "cli — Functions"
outline: deep
description: "Functions and classes for the cli package"
---
# cli — Functions & Classes

Functions and classes exported by this package.

## createLogger(options, )

Creates a  instance.

**Signature**

```typescript
(options?: { colors?: boolean | undefined; } | undefined) => Logger
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `options` | — | Optional configuration. |
| `` | — | options.colors - Emit ANSI colour codes.  Defaults to `process.stdout.isTTY`. |

**Returns** — A configured logger.

## emitResult(output, flags, humanFormatter)

Wraps a command result in a LAFS envelope and emits it.  - JSON mode: writes the projected envelope to stdout as JSON. - Human mode: calls the provided formatter function. - Quiet mode: suppresses all output regardless of format.

**Signature**

```typescript
<T>(output: CommandOutput<T>, flags: OutputFlags, humanFormatter: (data: T, output: CommandOutput<T>) => string) => void
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `output` | — | Typed result from the command. |
| `flags` | — | Output format flags from citty args. |
| `humanFormatter` | — | Produces a human-readable string for TTY consumers. |

**Example**

```typescript
import { emitResult } from "@forge-ts/cli/output";
emitResult(output, { human: true }, (data) => `Done: ${data.summary.duration}ms`);
```

## resolveExitCode(output)

Returns the LAFS-compliant exit code for a command output.

**Signature**

```typescript
(output: CommandOutput<unknown>) => number
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `output` | — | Typed result from the command. |

**Returns** — `0` on success, `1` on validation/check failure.

## runBuild(args)

Runs the full build pipeline and returns a typed command output.

**Signature**

```typescript
(args: BuildArgs) => Promise<CommandOutput<BuildResult>>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `args` | — | CLI arguments for the build command. |

**Returns** — A typed `CommandOutput<BuildResult>`.

**Example**

```typescript
import { runBuild } from "@forge-ts/cli/commands/build";
const output = await runBuild({ cwd: process.cwd() });
console.log(output.success); // true if all steps succeeded
```

## runCheck(args)

Runs the TSDoc enforcement pass and returns a typed command output.

**Signature**

```typescript
(args: CheckArgs) => Promise<CommandOutput<CheckResult>>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `args` | — | CLI arguments for the check command. |

**Returns** — A typed `CommandOutput<CheckResult>`.

**Example**

```typescript
import { runCheck } from "@forge-ts/cli/commands/check";
const output = await runCheck({ cwd: process.cwd() });
console.log(output.data.summary.errors); // number of TSDoc errors found
```

## runInitDocs(args)

Scaffolds a documentation site for the target SSG platform.  Resolves the target from args, validates it, checks for an existing scaffold, calls the adapter's `scaffold()` method, and writes all files produced by the manifest to `outDir`.

**Signature**

```typescript
(args: InitDocsArgs) => Promise<CommandOutput<InitDocsResult>>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `args` | — | CLI arguments for the init docs command. |

**Returns** — A typed `CommandOutput<InitDocsResult>`.

**Example**

```typescript
import { runInitDocs } from "@forge-ts/cli/commands/init-docs";
const output = await runInitDocs({ target: "mintlify", cwd: process.cwd() });
console.log(output.data.files); // list of created file paths
```

## runTest(args)

Runs the doctest pipeline and returns a typed command output.

**Signature**

```typescript
(args: TestArgs) => Promise<CommandOutput<TestResult>>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `args` | — | CLI arguments for the test command. |

**Returns** — A typed `CommandOutput<TestResult>`.

**Example**

```typescript
import { runTest } from "@forge-ts/cli/commands/test";
const output = await runTest({ cwd: process.cwd() });
console.log(output.data.summary.passed); // number of passing doctests
```
