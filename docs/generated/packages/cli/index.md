---
title: cli
outline: deep
description: cli package overview
---

# cli

## Exported Symbols

| Symbol | Kind | Description |
|--------|------|-------------|
| [`Logger`](./api-reference.md#logger) | interface | A minimal structured logger used throughout the CLI commands. |
| [`createLogger()`](./api-reference.md#createlogger) | function | Creates a  instance. |
| [`CommandOutput`](./api-reference.md#commandoutput) | interface | Typed result from a forge-ts command. |
| [`ForgeCliError`](./api-reference.md#forgeclierror) | interface | Structured error for CLI commands. |
| [`ForgeCliWarning`](./api-reference.md#forgecliwarning) | interface | Structured warning for CLI commands. |
| [`OutputFlags`](./api-reference.md#outputflags) | interface | Output format flags passed through from citty args. |
| [`emitResult()`](./api-reference.md#emitresult) | function | Wraps a command result in a LAFS envelope and emits it.  - JSON mode: writes the projected envelope to stdout as JSON. - Human mode: calls the provided formatter function. - Quiet mode: suppresses all output regardless of format. |
| [`resolveExitCode()`](./api-reference.md#resolveexitcode) | function | Returns the LAFS-compliant exit code for a command output. |
| [`BuildArgs`](./api-reference.md#buildargs) | interface | Arguments for the `build` command. |
| [`BuildStep`](./api-reference.md#buildstep) | interface | A single step in the build pipeline. |
| [`BuildResult`](./api-reference.md#buildresult) | interface | Typed result for the `build` command. |
| [`runBuild()`](./api-reference.md#runbuild) | function | Runs the full build pipeline and returns a typed command output. |
| [`buildCommand`](./api-reference.md#buildcommand) | variable | Citty command definition for `forge-ts build`. |
| [`CheckArgs`](./api-reference.md#checkargs) | interface | Arguments for the `check` command. |
| [`CheckFileError`](./api-reference.md#checkfileerror) | interface | A single error entry within a file group, included at standard and full MVI levels. |
| [`CheckFileWarning`](./api-reference.md#checkfilewarning) | interface | A single warning entry within a file group, included at standard and full MVI levels. |
| [`CheckFileGroup`](./api-reference.md#checkfilegroup) | interface | Errors and warnings grouped by file, included at standard and full MVI levels. |
| [`CheckResult`](./api-reference.md#checkresult) | interface | Typed result for the `check` command. |
| [`runCheck()`](./api-reference.md#runcheck) | function | Runs the TSDoc enforcement pass and returns a typed command output. |
| [`checkCommand`](./api-reference.md#checkcommand) | variable | Citty command definition for `forge-ts check`. |
| [`TestArgs`](./api-reference.md#testargs) | interface | Arguments for the `test` command. |
| [`TestFailure`](./api-reference.md#testfailure) | interface | A single test failure entry, included at standard and full MVI levels. |
| [`TestResult`](./api-reference.md#testresult) | interface | Typed result for the `test` command. |
| [`runTest()`](./api-reference.md#runtest) | function | Runs the doctest pipeline and returns a typed command output. |
| [`testCommand`](./api-reference.md#testcommand) | variable | Citty command definition for `forge-ts test`. |
