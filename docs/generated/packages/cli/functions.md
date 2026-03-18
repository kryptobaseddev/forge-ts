---
title: cli — Functions
outline: deep
description: Functions and classes for the cli package
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
