/**
 * Unified command-line interface for the forge-ts toolchain.
 *
 * Provides the `forge-ts` binary with subcommands that wrap every pipeline
 * stage — TSDoc enforcement, doctest execution, documentation generation,
 * OpenAPI spec output, and project health diagnostics — behind a consistent
 * flag surface and structured JSON/human output modes.
 *
 * @remarks
 * The CLI is built with `citty` and exports both the runnable command objects
 * and their underlying `run*` functions so that programmatic callers can
 * invoke the same logic without spawning a subprocess. All commands accept
 * `--json` (LAFS envelope), `--human` (formatted text), and `--quiet` output
 * flags alongside a `--cwd` working-directory override.
 *
 * Available subcommands:
 * - `check` — Run TSDoc enforcement; exits non-zero on rule violations.
 * - `test` — Execute `@example` doctest blocks via `@forge-ts/doctest`.
 * - `build` — Run enforce + doctest + gen + api in sequence.
 * - `docs init` — Scaffold a documentation site for a chosen SSG target.
 * - `docs dev` — Start the SSG dev server (delegates to the platform CLI).
 * - `init` — Full project setup: config, tsdoc.json, hooks, and guides.
 * - `init hooks` — Scaffold pre-commit hooks only.
 * - `lock` — Snapshot current config severities into `.forge-lock.json`.
 * - `unlock` — Remove the lock file with an audit-logged reason.
 * - `bypass` — Grant a temporary rule exemption within the daily budget.
 * - `audit` — Display the structured audit log of bypass and lock events.
 * - `prepublish` — Pre-publish gate: enforce + doctest with strict mode.
 * - `doctor` — Diagnose configuration and dependency health issues.
 * - `barometer` — Score documentation quality across 20 weighted questions.
 * - `version` — Print the installed forge-ts version.
 *
 * Key programmatic exports:
 * - `checkCommand` / `buildCommand` / `testCommand` — citty command objects.
 * - `runBarometer` / `runDoctor` / `runInitProject` / `runLock` — imperative runners.
 * - `emitResult` / `resolveExitCode` — Output formatting utilities.
 * - `forgeLogger` / `configureLogger` — Centralised logger (consola-backed).
 * - `CheckResult` / `BuildResult` / `BarometerResult` / `DoctorResult` — Result types.
 *
 * @example
 * ```typescript
 * // Programmatic usage — run enforcement without spawning a subprocess
 * import { loadConfig } from "@forge-ts/core";
 * import { runBarometer } from "@forge-ts/cli";
 *
 * const config = await loadConfig();
 * const result = await runBarometer({ cwd: config.rootDir });
 * console.log(`Documentation score: ${result.score}/100`);
 * ```
 *
 * @packageDocumentation
 * @public
 */

import { createRequire } from "node:module";
import { defineCommand, runMain } from "citty";
import { auditCommand } from "./commands/audit.js";
import { barometerCommand } from "./commands/barometer.js";
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
export {
	type BarometerInstructions,
	type BarometerQuestion,
	type BarometerRatingBand,
	type BarometerResult,
	type BarometerScoredAnswer,
	type BarometerScoreResult,
	type BarometerSource,
	barometerCommand,
	runBarometer,
	runBarometerScore,
} from "./commands/barometer.js";
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
export { configureLogger, type ForgeLoggerOptions, forgeLogger } from "./forge-logger.js";
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
		const { forgeLogger } = await import("./forge-logger.js");

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
				const msg = cmd.errors?.[0]?.message ?? "Init failed";
				forgeLogger.error(msg);
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

/**
 * The `version` subcommand — prints the CLI version and exits.
 *
 * Supplements citty's built-in `--version` flag so that `forge-ts version`,
 * `forge-ts -V`, and `forge-ts -v` all work as users expect.
 *
 * @public
 */
const versionCommand = defineCommand({
	meta: {
		name: "version",
		description: "Print the forge-ts version",
	},
	run() {
		console.log(pkg.version);
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
		barometer: barometerCommand,
		version: versionCommand,
	},
});

// Handle -V and -v as version flags (citty only supports --version natively)
const versionFlags = new Set(["-V", "-v"]);
if (process.argv.length === 3 && versionFlags.has(process.argv[2])) {
	console.log(pkg.version);
	process.exit(0);
}

runMain(main);
