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
 *   forge-ts init [--cwd <dir>]               (full project setup)
 *   forge-ts init docs [--target <ssg>]        (scaffold doc site)
 *   forge-ts init hooks [--cwd <dir>] [--force] (scaffold pre-commit hooks)
 *   forge-ts prepublish [--cwd <dir>] [--strict]
 *   forge-ts doctor [--cwd <dir>] [--fix]
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
import { doctorCommand } from "./commands/doctor.js";
import { initDocsCommand } from "./commands/init-docs.js";
import { initHooksCommand } from "./commands/init-hooks.js";
import { initProjectCommand } from "./commands/init-project.js";
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
	type DoctorCheckResult,
	type DoctorCheckStatus,
	type DoctorResult,
	doctorCommand,
	runDoctor,
} from "./commands/doctor.js";
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
export {
	type InitProjectEnvironment,
	type InitProjectResult,
	initProjectCommand,
	runInitProject,
} from "./commands/init-project.js";
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
 * When called bare (`forge-ts init`), runs the full project setup.
 * When called with a subcommand (`forge-ts init docs` or `forge-ts init hooks`),
 * dispatches to that subcommand instead.
 *
 * @remarks
 * citty runs the parent's `run` handler after a subcommand completes, so we
 * check `rawArgs` to detect whether a subcommand was dispatched and skip the
 * default project-setup logic in that case.
 *
 * @example
 * ```typescript
 * // forge-ts init                    -> full project setup
 * // forge-ts init docs --target mintlify -> scaffold doc site
 * // forge-ts init hooks              -> scaffold pre-commit hooks
 * ```
 * @public
 */
const initCommand = defineCommand({
	meta: {
		name: "init",
		description: "Full project setup (bare) or scaffold artefacts (with subcommand)",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		json: {
			type: "boolean",
			description: "Output as LAFS JSON envelope",
			default: false,
		},
		human: {
			type: "boolean",
			description: "Output as formatted text",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Suppress non-essential output",
			default: false,
		},
		mvi: {
			type: "string",
			description: "MVI verbosity level: minimal, standard, full",
		},
	},
	subCommands: {
		docs: initDocsCommand,
		hooks: initHooksCommand,
		setup: initProjectCommand,
	},
	async run({ rawArgs, args }) {
		// If a subcommand was dispatched, citty already ran it.
		const subCommandNames = new Set(["docs", "hooks", "setup"]);
		const hasSubCommand = rawArgs.some((arg) => subCommandNames.has(arg));
		if (hasSubCommand) {
			return;
		}

		// Bare `forge-ts init` (no subcommand) — run full project setup
		const { runInitProject } = await import("./commands/init-project.js");
		const { emitResult, resolveExitCode } = await import("./output.js");
		const { createLogger } = await import("./logger.js");

		const output = await runInitProject({
			cwd: args.cwd,
			mvi: args.mvi,
		});

		const flags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data, cmd) => {
			if (!cmd.success) {
				const logger = createLogger();
				const msg = cmd.errors?.[0]?.message ?? "Init failed";
				logger.error(msg);
				return "";
			}

			// Use the same format as init-project command
			const lines: string[] = [];

			lines.push("\nforge-ts init: project setup complete\n");

			if (data.created.length > 0) {
				lines.push("  Created:");
				for (const file of data.created) {
					lines.push(`    ${file}`);
				}
			}

			if (data.skipped.length > 0) {
				lines.push("");
				lines.push("  Already exists (skipped):");
				for (const file of data.skipped) {
					lines.push(`    ${file}`);
				}
			} else if (data.created.length > 0) {
				lines.push("");
				lines.push("  Already exists (skipped):");
				lines.push("    (none)");
			}

			if (data.warnings.length > 0) {
				lines.push("");
				lines.push("  Warnings:");
				for (const warning of data.warnings) {
					lines.push(`    ${warning}`);
				}
			}

			const env = data.environment;
			lines.push("");
			lines.push("  Environment:");
			lines.push(`    TypeScript: ${env.typescriptVersion ?? "not detected"}`);
			lines.push(`    Biome: ${env.biomeDetected ? "detected" : "not detected"}`);

			const hookLabel = env.hookManager === "none" ? "not detected" : `${env.hookManager} detected`;
			lines.push(`    Git hooks: ${hookLabel}`);

			if (env.monorepo) {
				lines.push(
					`    Monorepo: ${env.monorepoType === "pnpm" ? "pnpm workspaces" : "npm/yarn workspaces"}`,
				);
			} else {
				lines.push("    Monorepo: no");
			}

			if (data.nextSteps.length > 0) {
				lines.push("");
				lines.push("  Next steps:");
				for (const [idx, step] of data.nextSteps.entries()) {
					lines.push(`    ${idx + 1}. ${step}`);
				}
			}

			return lines.join("\n");
		});

		process.exit(resolveExitCode(output));
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
		doctor: doctorCommand,
	},
});

runMain(main);
