/**
 * @forge-ts/cli — Command-line interface for the forge-ts toolchain.
 *
 * Usage:
 *   forge-ts check [--cwd <dir>] [--strict] [--verbose]
 *   forge-ts test  [--cwd <dir>]
 *   forge-ts build [--cwd <dir>] [--skip-api] [--skip-gen]
 *
 * @packageDocumentation
 * @public
 */

import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { testCommand } from "./commands/test.js";

export { buildCommand } from "./commands/build.js";
export { checkCommand } from "./commands/check.js";
export { testCommand } from "./commands/test.js";
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
	},
});

runMain(main);
