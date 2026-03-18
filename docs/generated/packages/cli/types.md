---
title: cli — Types
outline: deep
description: Type contracts for the cli package
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
| `operation` | `string` | Yes |  |
| `success` | `boolean` | Yes |  |
| `data` | `T` | Yes |  |
| `errors` | `ForgeCliError[] \| undefined` | No |  |
| `warnings` | `ForgeCliWarning[] \| undefined` | No |  |
| `duration` | `number \| undefined` | No |  |

## ForgeCliError

Structured error for CLI commands.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes |  |
| `message` | `string` | Yes |  |
| `filePath` | `string \| undefined` | No |  |
| `line` | `number \| undefined` | No |  |
| `column` | `number \| undefined` | No |  |

## ForgeCliWarning

Structured warning for CLI commands.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes |  |
| `message` | `string` | Yes |  |
| `filePath` | `string \| undefined` | No |  |
| `line` | `number \| undefined` | No |  |
| `column` | `number \| undefined` | No |  |

## OutputFlags

Output format flags passed through from citty args.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `json` | `boolean \| undefined` | No |  |
| `human` | `boolean \| undefined` | No |  |
| `quiet` | `boolean \| undefined` | No |  |
| `mvi` | `string \| undefined` | No |  |

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
| `name` | `string` | Yes |  |
| `status` | `"success" \| "skipped" \| "failed"` | Yes |  |
| `outputPath` | `string \| undefined` | No |  |
| `duration` | `number \| undefined` | No |  |
| `errors` | `ForgeCliError[] \| undefined` | No |  |

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
