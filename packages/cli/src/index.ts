/**
 * @forge-ts/cli — Command-line interface for the forge-ts toolchain.
 *
 * Usage:
 *   forge-ts check [--cwd <dir>] [--strict] [--verbose]
 *   forge-ts test  [--cwd <dir>]
 *   forge-ts build [--cwd <dir>] [--skip-api] [--skip-gen]
 *   forge-ts docs init [--target <ssg>] [--out-dir <dir>] [--force]
 *   forge-ts docs dev [--target <ssg>] [--port <port>]
 *   forge-ts lock  [--cwd <dir>]
 *   forge-ts unlock --reason="..." [--cwd <dir>]
 *   forge-ts bypass --reason="..." [--rule E009]
 *   forge-ts bypass --status
 *   forge-ts audit [--limit N] [--type <eventType>]
 *   forge-ts init hooks [--cwd <dir>] [--force]
 *   forge-ts prepublish [--cwd <dir>] [--strict]
 *
 * @packageDocumentation
 * @public
 */

import { createRequire } from "node:module";
import { defineCommand, runMain } from "citty";
import { auditCommand } from "./commands/audit.js";
import { buildCommand } from "./commands/build.js";
import { bypassCommand } from "./commands/bypass.js";
import { checkCommand } from "./commands/check.js";
import { docsDevCommand } from "./commands/docs-dev.js";
import { initDocsCommand } from "./commands/init-docs.js";
import { initHooksCommand } from "./commands/init-hooks.js";
import { lockCommand } from "./commands/lock.js";
import { prepublishCommand } from "./commands/prepublish.js";
import { testCommand } from "./commands/test.js";
import { unlockCommand } from "./commands/unlock.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export { type AuditResult, auditCommand } from "./commands/audit.js";
export { type BuildResult, type BuildStep, buildCommand } from "./commands/build.js";
export {
	type BypassCreateResult,
	type BypassStatusResult,
	bypassCommand,
	runBypassCreate,
	runBypassStatus,
} from "./commands/bypass.js";
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
export {
	type HookManager,
	type InitHooksResult,
	initHooksCommand,
	runInitHooks,
} from "./commands/init-hooks.js";
export { type LockResult, lockCommand, runLock } from "./commands/lock.js";
export {
	type PrepublishResult,
	prepublishCommand,
	runPrepublish,
} from "./commands/prepublish.js";
export { type TestFailure, type TestResult, testCommand } from "./commands/test.js";
export { runUnlock, type UnlockResult, unlockCommand } from "./commands/unlock.js";
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

/**
 * The `init` parent command with `docs` and `hooks` subcommands.
 *
 * @example
 * ```typescript
 * // forge-ts init docs --target mintlify
 * // forge-ts init hooks
 * ```
 * @public
 */
const initCommand = defineCommand({
	meta: {
		name: "init",
		description: "Scaffold project artefacts",
	},
	subCommands: {
		docs: initDocsCommand,
		hooks: initHooksCommand,
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
		init: initCommand,
		lock: lockCommand,
		unlock: unlockCommand,
		bypass: bypassCommand,
		audit: auditCommand,
		prepublish: prepublishCommand,
	},
});

runMain(main);
