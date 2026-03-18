---
title: cli — API Reference
outline: deep
description: Full API reference for the cli package
---

# cli — API Reference

## Functions

### `createLogger()`

```typescript
(options?: { colors?: boolean | undefined; } | undefined) => Logger
```

Creates a  instance.

**Parameters**

- `options` — Optional configuration.
- `` — options.colors - Emit ANSI colour codes.  Defaults to `process.stdout.isTTY`.

**Returns**: A configured logger.


### `emitResult()`

```typescript
<T>(output: CommandOutput<T>, flags: OutputFlags, humanFormatter: (data: T, output: CommandOutput<T>) => string) => void
```

Wraps a command result in a LAFS envelope and emits it.  - JSON mode: writes the projected envelope to stdout as JSON. - Human mode: calls the provided formatter function. - Quiet mode: suppresses all output regardless of format.

**Parameters**

- `output` — Typed result from the command.
- `flags` — Output format flags from citty args.
- `humanFormatter` — Produces a human-readable string for TTY consumers.

**Examples**

```typescript
import { emitResult } from "@forge-ts/cli/output";
emitResult(output, { human: true }, (data) => `Done: ${data.summary.duration}ms`);
```


### `resolveExitCode()`

```typescript
(output: CommandOutput<unknown>) => number
```

Returns the LAFS-compliant exit code for a command output.

**Parameters**

- `output` — Typed result from the command.

**Returns**: `0` on success, `1` on validation/check failure.


### `runBuild()`

```typescript
(args: BuildArgs) => Promise<CommandOutput<BuildResult>>
```

Runs the full build pipeline and returns a typed command output.

**Parameters**

- `args` — CLI arguments for the build command.

**Returns**: A typed `CommandOutput<BuildResult>`.

**Examples**

```typescript
import { runBuild } from "@forge-ts/cli/commands/build";
const output = await runBuild({ cwd: process.cwd() });
console.log(output.success); // true if all steps succeeded
```


### `runCheck()`

```typescript
(args: CheckArgs) => Promise<CommandOutput<CheckResult>>
```

Runs the TSDoc enforcement pass and returns a typed command output.

**Parameters**

- `args` — CLI arguments for the check command.

**Returns**: A typed `CommandOutput<CheckResult>`.

**Examples**

```typescript
import { runCheck } from "@forge-ts/cli/commands/check";
const output = await runCheck({ cwd: process.cwd() });
console.log(output.data.summary.errors); // number of TSDoc errors found
```


### `runTest()`

```typescript
(args: TestArgs) => Promise<CommandOutput<TestResult>>
```

Runs the doctest pipeline and returns a typed command output.

**Parameters**

- `args` — CLI arguments for the test command.

**Returns**: A typed `CommandOutput<TestResult>`.

**Examples**

```typescript
import { runTest } from "@forge-ts/cli/commands/test";
const output = await runTest({ cwd: process.cwd() });
console.log(output.data.summary.passed); // number of passing doctests
```


## Interfaces

### `Logger`

```typescript
any
```

A minimal structured logger used throughout the CLI commands.

#### `info()`

```typescript
(msg: string) => void
```

Print an informational message.

#### `success()`

```typescript
(msg: string) => void
```

Print a success message (green ✓ prefix when colours are on).

#### `warn()`

```typescript
(msg: string) => void
```

Print a warning message (yellow prefix when colours are on).

#### `error()`

```typescript
(msg: string) => void
```

Print an error message (red ✗ prefix when colours are on).

#### `step()`

```typescript
(label: string, detail: string, duration?: number | undefined) => void
```

Print a build-step line.

**Parameters**

- `label` — Short category label (e.g. "API", "Gen").
- `detail` — Description of what was produced.
- `duration` — Optional wall-clock time in milliseconds.


### `CommandOutput`

```typescript
any
```

Typed result from a forge-ts command.

#### `operation`

```typescript
string
```

Name of the command that produced this output (e.g., "check", "build").

#### `success`

```typescript
boolean
```

Whether the command completed successfully.

#### `data`

```typescript
T
```

Strongly-typed command-specific result payload.

#### `errors`

```typescript
ForgeCliError[] | undefined
```

Structured errors produced by the command, if any.

#### `warnings`

```typescript
ForgeCliWarning[] | undefined
```

Structured warnings produced by the command, if any.

#### `duration`

```typescript
number | undefined
```

Wall-clock duration of the command in milliseconds.


### `ForgeCliError`

```typescript
any
```

Structured error for CLI commands.

#### `code`

```typescript
string
```

Machine-readable error code (e.g., "E004").

#### `message`

```typescript
string
```

Human-readable error description.

#### `filePath`

```typescript
string | undefined
```

Absolute path to the source file containing the error, if applicable.

#### `line`

```typescript
number | undefined
```

1-based line number of the error, if applicable.

#### `column`

```typescript
number | undefined
```

0-based column number of the error, if applicable.


### `ForgeCliWarning`

```typescript
any
```

Structured warning for CLI commands.

#### `code`

```typescript
string
```

Machine-readable warning code.

#### `message`

```typescript
string
```

Human-readable warning description.

#### `filePath`

```typescript
string | undefined
```

Absolute path to the source file containing the warning, if applicable.

#### `line`

```typescript
number | undefined
```

1-based line number of the warning, if applicable.

#### `column`

```typescript
number | undefined
```

0-based column number of the warning, if applicable.


### `OutputFlags`

```typescript
any
```

Output format flags passed through from citty args.

#### `json`

```typescript
boolean | undefined
```

Emit output as a LAFS JSON envelope instead of human-readable text.

#### `human`

```typescript
boolean | undefined
```

Emit output as formatted human-readable text.

#### `quiet`

```typescript
boolean | undefined
```

Suppress all output regardless of format.

#### `mvi`

```typescript
string | undefined
```

MVI verbosity level: "minimal", "standard", or "full".


### `BuildArgs`

```typescript
any
```

Arguments for the `build` command.

#### `cwd`

```typescript
string | undefined
```

Project root directory (default: cwd).

#### `skipApi`

```typescript
boolean | undefined
```

Skip API generation even if enabled in config.

#### `skipGen`

```typescript
boolean | undefined
```

Skip doc generation even if enabled in config.

#### `mvi`

```typescript
string | undefined
```

MVI verbosity level for structured output.


### `BuildStep`

```typescript
any
```

A single step in the build pipeline.

#### `name`

```typescript
string
```

Internal step name, e.g. "api" or "gen".

#### `status`

```typescript
"success" | "skipped" | "failed"
```

Outcome of this step.

#### `outputPath`

```typescript
string | undefined
```

Path to the primary output file produced by this step, if applicable.

#### `duration`

```typescript
number | undefined
```

Wall-clock duration of this step in milliseconds.

#### `errors`

```typescript
ForgeCliError[] | undefined
```

Errors produced by this step when status is "failed".


### `BuildResult`

```typescript
any
```

Typed result for the `build` command.

#### `success`

```typescript
boolean
```

Whether the build succeeded.

#### `summary`

```typescript
{ steps: number; succeeded: number; failed: number; duration: number; }
```

Aggregate pipeline counts — always present.

#### `steps`

```typescript
BuildStep[]
```

Per-step details.

#### `generatedFiles`

```typescript
string[] | undefined
```

Files written during the build — present at standard and full MVI levels.


### `CheckArgs`

```typescript
any
```

Arguments for the `check` command.

#### `cwd`

```typescript
string | undefined
```

Project root directory (default: cwd).

#### `strict`

```typescript
boolean | undefined
```

Exit with non-zero code on warnings as well as errors.

#### `verbose`

```typescript
boolean | undefined
```

Include symbol signatures alongside diagnostics.

#### `mvi`

```typescript
string | undefined
```

MVI verbosity level for structured output.


### `CheckFileError`

```typescript
any
```

A single error entry within a file group, included at standard and full MVI levels.

#### `code`

```typescript
string
```

Machine-readable error code.

#### `symbol`

```typescript
string
```

Symbol name that needs fixing.

#### `kind`

```typescript
string
```

Symbol kind (function, class, interface, etc.).

#### `line`

```typescript
number
```

1-based line number of the error.

#### `message`

```typescript
string
```

Human-readable description.

#### `suggestedFix`

```typescript
string | undefined
```

Exact TSDoc block to add (full MVI level only).

#### `agentAction`

```typescript
string | undefined
```

Recommended agent action (full MVI level only).


### `CheckFileWarning`

```typescript
any
```

A single warning entry within a file group, included at standard and full MVI levels.

#### `code`

```typescript
string
```

Machine-readable warning code.

#### `symbol`

```typescript
string
```

Symbol name that generated the warning.

#### `kind`

```typescript
string
```

Symbol kind (function, class, interface, etc.).

#### `line`

```typescript
number
```

1-based line number of the warning.

#### `message`

```typescript
string
```

Human-readable description.


### `CheckFileGroup`

```typescript
any
```

Errors and warnings grouped by file, included at standard and full MVI levels.

#### `file`

```typescript
string
```

Absolute path to the source file.

#### `errors`

```typescript
CheckFileError[]
```

Errors in this file.

#### `warnings`

```typescript
CheckFileWarning[]
```

Warnings in this file.


### `CheckResult`

```typescript
any
```

Typed result for the `check` command.

#### `success`

```typescript
boolean
```

Whether the check passed without errors.

#### `summary`

```typescript
{ errors: number; warnings: number; files: number; symbols: number; duration: number; }
```

Aggregate counts — always present regardless of MVI level.

#### `byFile`

```typescript
CheckFileGroup[] | undefined
```

Per-file breakdown — present at standard and full MVI levels.


### `TestArgs`

```typescript
any
```

Arguments for the `test` command.

#### `cwd`

```typescript
string | undefined
```

Project root directory (default: cwd).

#### `mvi`

```typescript
string | undefined
```

MVI verbosity level for structured output.


### `TestFailure`

```typescript
any
```

A single test failure entry, included at standard and full MVI levels.

#### `symbol`

```typescript
string
```

Symbol name where the doctest failed.

#### `file`

```typescript
string
```

Absolute path to the source file.

#### `line`

```typescript
number
```

1-based line number of the failing example.

#### `message`

```typescript
string
```

Human-readable failure message.


### `TestResult`

```typescript
any
```

Typed result for the `test` command.

#### `success`

```typescript
boolean
```

Whether all doctests passed.

#### `summary`

```typescript
{ passed: number; failed: number; total: number; duration: number; }
```

Aggregate counts — always present regardless of MVI level.

#### `failures`

```typescript
TestFailure[] | undefined
```

Per-failure details — present at standard and full MVI levels.


## Variables

### `buildCommand`

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly "skip-api": { readonly type: "boolean"; readonly description: "Skip OpenAPI generation"; readonly default: false; }; ... 4 more ...; readonly mvi: { ...; }; }>
```

Citty command definition for `forge-ts build`.


### `checkCommand`

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly strict: { readonly type: "boolean"; readonly description: "Treat warnings as errors"; readonly default: false; }; ... 4 more ...; readonly mvi: { ...; }; }>
```

Citty command definition for `forge-ts check`.


### `testCommand`

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { ...; }; readonly quiet: { ...; }; readonly mvi: { .....
```

Citty command definition for `forge-ts test`.
