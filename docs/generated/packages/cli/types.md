---
title: "cli — Types"
outline: deep
description: "Type contracts for the cli package"
---
# cli — Types

Type contracts exported by this package: interfaces, type aliases, and enums.

## Logger

A minimal structured logger used throughout the CLI commands.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `info` | `(msg: string) => void` | Yes | Print an informational message. |
| `success` | `(msg: string) => void` | Yes | Print a success message (green ✓ prefix when colours are on). |
| `warn` | `(msg: string) => void` | Yes | Print a warning message (yellow prefix when colours are on). |
| `error` | `(msg: string) => void` | Yes | Print an error message (red ✗ prefix when colours are on). |
| `step` | `(label: string, detail: string, duration?: number \| undefined) => void` | No | Print a build-step line. |

## CommandOutput

Typed result from a forge-ts command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `operation` | `string` | Yes | Name of the command that produced this output (e.g., "check", "build"). |
| `success` | `boolean` | Yes | Whether the command completed successfully. |
| `data` | `T` | Yes | Strongly-typed command-specific result payload. |
| `errors` | `ForgeCliError[] \| undefined` | No | Structured errors produced by the command, if any. |
| `warnings` | `ForgeCliWarning[] \| undefined` | No | Structured warnings produced by the command, if any. |
| `duration` | `number \| undefined` | No | Wall-clock duration of the command in milliseconds. |

## ForgeCliError

Structured error for CLI commands.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable error code (e.g., "E004"). |
| `message` | `string` | Yes | Human-readable error description. |
| `filePath` | `string \| undefined` | No | Absolute path to the source file containing the error, if applicable. |
| `line` | `number \| undefined` | No | 1-based line number of the error, if applicable. |
| `column` | `number \| undefined` | No | 0-based column number of the error, if applicable. |

## ForgeCliWarning

Structured warning for CLI commands.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable warning code. |
| `message` | `string` | Yes | Human-readable warning description. |
| `filePath` | `string \| undefined` | No | Absolute path to the source file containing the warning, if applicable. |
| `line` | `number \| undefined` | No | 1-based line number of the warning, if applicable. |
| `column` | `number \| undefined` | No | 0-based column number of the warning, if applicable. |

## OutputFlags

Output format flags passed through from citty args.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `json` | `boolean \| undefined` | No | Emit output as a LAFS JSON envelope instead of human-readable text. |
| `human` | `boolean \| undefined` | No | Emit output as formatted human-readable text. |
| `quiet` | `boolean \| undefined` | No | Suppress all output regardless of format. |
| `mvi` | `string \| undefined` | No | MVI verbosity level: "minimal", "standard", or "full". |

## BuildArgs

Arguments for the `build` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cwd` | `string \| undefined` | No | Project root directory (default: cwd). |
| `skipApi` | `boolean \| undefined` | No | Skip API generation even if enabled in config. |
| `skipGen` | `boolean \| undefined` | No | Skip doc generation even if enabled in config. |
| `mvi` | `string \| undefined` | No | MVI verbosity level for structured output. |

## BuildStep

A single step in the build pipeline.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Internal step name, e.g. "api" or "gen". |
| `status` | `"success" \| "skipped" \| "failed"` | Yes | Outcome of this step. |
| `outputPath` | `string \| undefined` | No | Path to the primary output file produced by this step, if applicable. |
| `duration` | `number \| undefined` | No | Wall-clock duration of this step in milliseconds. |
| `errors` | `ForgeCliError[] \| undefined` | No | Errors produced by this step when status is "failed". |

## BuildResult

Typed result for the `build` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether the build succeeded. |
| `summary` | `{ steps: number; succeeded: number; failed: number; duration: number; }` | Yes | Aggregate pipeline counts — always present. |
| `steps` | `BuildStep[]` | Yes | Per-step details. |
| `generatedFiles` | `string[] \| undefined` | No | Files written during the build — present at standard and full MVI levels. |

## CheckArgs

Arguments for the `check` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cwd` | `string \| undefined` | No | Project root directory (default: cwd). |
| `strict` | `boolean \| undefined` | No | Exit with non-zero code on warnings as well as errors. |
| `verbose` | `boolean \| undefined` | No | Include symbol signatures alongside diagnostics. |
| `mvi` | `string \| undefined` | No | MVI verbosity level for structured output. |

## CheckFileError

A single error entry within a file group, included at standard and full MVI levels.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable error code. |
| `symbol` | `string` | Yes | Symbol name that needs fixing. |
| `kind` | `string` | Yes | Symbol kind (function, class, interface, etc.). |
| `line` | `number` | Yes | 1-based line number of the error. |
| `message` | `string` | Yes | Human-readable description. |
| `suggestedFix` | `string \| undefined` | No | Exact TSDoc block to add (full MVI level only). |
| `agentAction` | `string \| undefined` | No | Recommended agent action (full MVI level only). |

## CheckFileWarning

A single warning entry within a file group, included at standard and full MVI levels.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable warning code. |
| `symbol` | `string` | Yes | Symbol name that generated the warning. |
| `kind` | `string` | Yes | Symbol kind (function, class, interface, etc.). |
| `line` | `number` | Yes | 1-based line number of the warning. |
| `message` | `string` | Yes | Human-readable description. |

## CheckFileGroup

Errors and warnings grouped by file, included at standard and full MVI levels.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `file` | `string` | Yes | Absolute path to the source file. |
| `errors` | `CheckFileError[]` | Yes | Errors in this file. |
| `warnings` | `CheckFileWarning[]` | Yes | Warnings in this file. |

## CheckResult

Typed result for the `check` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether the check passed without errors. |
| `summary` | `{ errors: number; warnings: number; files: number; symbols: number; duration: number; }` | Yes | Aggregate counts — always present regardless of MVI level. |
| `byFile` | `CheckFileGroup[] \| undefined` | No | Per-file breakdown — present at standard and full MVI levels. |

## InitDocsResult

Result of the `init docs` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether the scaffold succeeded. |
| `target` | `SSGTarget` | Yes | The SSG target that was scaffolded. |
| `summary` | `{ filesCreated: number; dependencies: number; scripts: number; }` | Yes | Summary of what was created. |
| `files` | `string[]` | Yes | Relative paths of all files created. |
| `instructions` | `string[]` | Yes | Post-scaffold instructions for the user. |

## InitDocsArgs

Arguments for the `init docs` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `target` | `string \| undefined` | No | SSG target to scaffold. Defaults to . |
| `cwd` | `string \| undefined` | No | Project root directory (default: cwd). |
| `outDir` | `string \| undefined` | No | Output directory for the doc site (default: outDir from config or ./docs). |
| `force` | `boolean \| undefined` | No | Overwrite an existing scaffold without prompting. |
| `mvi` | `string \| undefined` | No | MVI verbosity level for structured output. |

## TestArgs

Arguments for the `test` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cwd` | `string \| undefined` | No | Project root directory (default: cwd). |
| `mvi` | `string \| undefined` | No | MVI verbosity level for structured output. |

## TestFailure

A single test failure entry, included at standard and full MVI levels.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `symbol` | `string` | Yes | Symbol name where the doctest failed. |
| `file` | `string` | Yes | Absolute path to the source file. |
| `line` | `number` | Yes | 1-based line number of the failing example. |
| `message` | `string` | Yes | Human-readable failure message. |

## TestResult

Typed result for the `test` command.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether all doctests passed. |
| `summary` | `{ passed: number; failed: number; total: number; duration: number; }` | Yes | Aggregate counts — always present regardless of MVI level. |
| `failures` | `TestFailure[] \| undefined` | No | Per-failure details — present at standard and full MVI levels. |
