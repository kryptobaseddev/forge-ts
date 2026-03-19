/**
 * @forge-ts/cli — Command-line interface for the forge-ts toolchain.
 *
 * Usage:
 *   forge-ts check [--cwd <dir>] [--strict] [--verbose]
 *   forge-ts test  [--cwd <dir>]
 *   forge-ts build [--cwd <dir>] [--skip-api] [--skip-gen]
 *   forge-ts init docs [--target <ssg>] [--out-dir <dir>] [--force]
 *
 * @packageDocumentation
 * @public
 */

import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { initCommand } from "./commands/init-docs.js";
import { testCommand } from "./commands/test.js";

export { type BuildResult, type BuildStep, buildCommand } from "./commands/build.js";
export {
	type CheckFileError,
	type CheckFileGroup,
	type CheckFileWarning,
	type CheckResult,
	checkCommand,
} from "./commands/check.js";
export {
	initCommand,
	initDocsCommand,
	type InitDocsResult,
} from "./commands/init-docs.js";
export { type TestFailure, type TestResult, testCommand } from "./commands/test.js";
export { createLogger, type Logger } from "./logger.js";
export {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type ForgeCliWarning,
	type OutputFlags,
	resolveExitCode,
} from "./output.js";

const main = defineCommand({
	meta: {
		name: "forge-ts",
		version: "0.1.0",
		description: "Universal TypeScript Documentation Compiler",
	},
	subCommands: {
		check: checkCommand,
		test: testCommand,
		build: buildCommand,
		init: initCommand,
	},
});

runMain(main);
