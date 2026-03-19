/**
 * @forge-ts/cli — Command-line interface for the forge-ts toolchain.
 *
 * Usage:
 *   forge-ts check [--cwd <dir>] [--strict] [--verbose]
 *   forge-ts test  [--cwd <dir>]
 *   forge-ts build [--cwd <dir>] [--skip-api] [--skip-gen]
 *   forge-ts docs init [--target <ssg>] [--out-dir <dir>] [--force]
 *   forge-ts docs dev [--target <ssg>] [--port <port>]
 *
 * @packageDocumentation
 * @public
 */

import { createRequire } from "node:module";
import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { docsDevCommand } from "./commands/docs-dev.js";
import { initDocsCommand } from "./commands/init-docs.js";
import { testCommand } from "./commands/test.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export { type BuildResult, type BuildStep, buildCommand } from "./commands/build.js";
export {
	type CheckFileError,
	type CheckFileGroup,
	type CheckFileWarning,
	type CheckPage,
	type CheckResult,
	type CheckRuleCount,
	type CheckTriage,
	checkCommand,
} from "./commands/check.js";
export { docsDevCommand, runDocsDev } from "./commands/docs-dev.js";
export {
	type InitDocsResult,
	initDocsCommand,
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

/**
 * The `docs` parent command with `init` and `dev` subcommands.
 *
 * @example
 * ```typescript
 * // forge-ts docs init --target mintlify
 * // forge-ts docs dev
 * ```
 * @public
 */
const docsCommand = defineCommand({
	meta: {
		name: "docs",
		description: "Documentation site management",
	},
	subCommands: {
		init: initDocsCommand,
		dev: docsDevCommand,
	},
});

const main = defineCommand({
	meta: {
		name: "forge-ts",
		version: pkg.version,
		description: "Universal TypeScript Documentation Compiler",
	},
	subCommands: {
		check: checkCommand,
		test: testCommand,
		build: buildCommand,
		docs: docsCommand,
	},
});

runMain(main);
