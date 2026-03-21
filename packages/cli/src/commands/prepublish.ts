/**
 * `forge-ts prepublish` command — safety gate for npm publish.
 *
 * Runs `forge-ts check` then `forge-ts build` in sequence. If check fails,
 * the build step is skipped and the command exits non-zero. This is designed
 * to be wired into package.json as `"prepublishOnly": "forge-ts prepublish"`.
 *
 * @packageDocumentation
 * @internal
 */

import { defineCommand } from "citty";
import { createLogger } from "../logger.js";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";
import { runBuild } from "./build.js";
import { runCheck } from "./check.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Typed result for the `prepublish` command.
 *
 * @example
 * ```typescript
 * import { runPrepublish } from "@forge-ts/cli/commands/prepublish";
 * const output = await runPrepublish({ cwd: process.cwd() });
 * console.log(output.data.check.success); // true if check passed
 * console.log(output.data.build?.success); // true if build passed
 * ```
 * @public
 */
export interface PrepublishResult {
	/** Whether both check and build passed. */
	success: boolean;
	/** Summary of the prepublish pipeline. */
	summary: {
		/** Number of pipeline steps run. */
		steps: number;
		/** Number of steps that passed. */
		passed: number;
		/** Number of steps that failed. */
		failed: number;
		/** Wall-clock duration of the entire pipeline in milliseconds. */
		duration: number;
	};
	/** Result of the check step. */
	check: {
		/** Whether the check passed. */
		success: boolean;
		/** Error count from the check. */
		errors: number;
		/** Warning count from the check. */
		warnings: number;
		/** Duration of the check step in milliseconds. */
		duration: number;
	};
	/** Result of the build step (absent if check failed and build was skipped). */
	build?: {
		/** Whether the build passed. */
		success: boolean;
		/** Number of build pipeline steps. */
		steps: number;
		/** Number of build steps that succeeded. */
		succeeded: number;
		/** Number of build steps that failed. */
		failed: number;
		/** Duration of the build step in milliseconds. */
		duration: number;
	};
	/** If check failed, the reason build was skipped. */
	skippedReason?: string;
}

/**
 * Arguments for the `prepublish` command.
 * @internal
 */
export interface PrepublishArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Treat warnings as errors during the check step. */
	strict?: boolean;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the prepublish safety gate: check then build.
 *
 * If the check step fails, the build step is skipped entirely.
 * Both steps use the same project root (cwd).
 *
 * @param args - CLI arguments for the prepublish command.
 * @returns A typed `CommandOutput<PrepublishResult>`.
 * @example
 * ```typescript
 * import { runPrepublish } from "@forge-ts/cli/commands/prepublish";
 * const output = await runPrepublish({ cwd: process.cwd() });
 * if (!output.success) process.exit(1);
 * ```
 * @public
 */
export async function runPrepublish(
	args: PrepublishArgs,
): Promise<CommandOutput<PrepublishResult>> {
	const start = Date.now();
	const allErrors: ForgeCliError[] = [];

	// Step 1: Run check
	const checkOutput = await runCheck({
		cwd: args.cwd,
		strict: args.strict,
		mvi: args.mvi,
	});
	const checkDuration = checkOutput.duration ?? 0;

	if (!checkOutput.success) {
		// Check failed — skip build
		const data: PrepublishResult = {
			success: false,
			summary: {
				steps: 1,
				passed: 0,
				failed: 1,
				duration: Date.now() - start,
			},
			check: {
				success: false,
				errors: checkOutput.data.summary.errors,
				warnings: checkOutput.data.summary.warnings,
				duration: checkDuration,
			},
			skippedReason: "Check failed — build step skipped.",
		};

		if (checkOutput.errors) {
			allErrors.push(...checkOutput.errors);
		}

		return {
			operation: "prepublish",
			success: false,
			data,
			errors: allErrors.length > 0 ? allErrors : undefined,
			duration: Date.now() - start,
		};
	}

	// Step 2: Run build
	const buildOutput = await runBuild({
		cwd: args.cwd,
		mvi: args.mvi,
	});
	const buildDuration = buildOutput.duration ?? 0;

	const buildSuccess = buildOutput.success;
	const overallSuccess = buildSuccess;

	if (buildOutput.errors) {
		allErrors.push(...buildOutput.errors);
	}

	const data: PrepublishResult = {
		success: overallSuccess,
		summary: {
			steps: 2,
			passed: (checkOutput.success ? 1 : 0) + (buildSuccess ? 1 : 0),
			failed: (checkOutput.success ? 0 : 1) + (buildSuccess ? 0 : 1),
			duration: Date.now() - start,
		},
		check: {
			success: checkOutput.success,
			errors: checkOutput.data.summary.errors,
			warnings: checkOutput.data.summary.warnings,
			duration: checkDuration,
		},
		build: {
			success: buildSuccess,
			steps: buildOutput.data.summary.steps,
			succeeded: buildOutput.data.summary.succeeded,
			failed: buildOutput.data.summary.failed,
			duration: buildDuration,
		},
	};

	return {
		operation: "prepublish",
		success: overallSuccess,
		data,
		errors: allErrors.length > 0 ? allErrors : undefined,
		duration: Date.now() - start,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats a PrepublishResult as human-readable text.
 * @internal
 */
function formatPrepublishHuman(result: PrepublishResult): string {
	const lines: string[] = [];

	lines.push(`\n  forge-ts prepublish: ${result.success ? "PASSED" : "FAILED"}\n`);

	// Check step
	const checkIcon = result.check.success ? "\u2713" : "\u2717";
	lines.push(
		`  ${checkIcon} check: ${result.check.errors} error(s), ${result.check.warnings} warning(s) (${result.check.duration}ms)`,
	);

	// Build step
	if (result.build) {
		const buildIcon = result.build.success ? "\u2713" : "\u2717";
		lines.push(
			`  ${buildIcon} build: ${result.build.succeeded}/${result.build.steps} steps succeeded (${result.build.duration}ms)`,
		);
	} else if (result.skippedReason) {
		lines.push(`  - build: skipped (${result.skippedReason})`);
	}

	lines.push(
		`\n  ${result.summary.passed}/${result.summary.steps} steps passed in ${result.summary.duration}ms`,
	);

	if (!result.success) {
		lines.push("\n  Publish blocked. Fix the above issues and re-run forge-ts prepublish.");
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command definition
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts prepublish`.
 *
 * Runs check then build as a publish safety gate. Add to package.json as:
 * `"prepublishOnly": "forge-ts prepublish"`
 *
 * @example
 * ```typescript
 * import { prepublishCommand } from "@forge-ts/cli/commands/prepublish";
 * // Registered as `forge-ts prepublish`
 * ```
 * @public
 */
export const prepublishCommand = defineCommand({
	meta: {
		name: "prepublish",
		description: "Safety gate: check + build before npm publish",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		strict: {
			type: "boolean",
			description: "Treat warnings as errors during check",
			default: false,
		},
		json: {
			type: "boolean",
			description: "Output as LAFS JSON envelope (agent-friendly)",
			default: false,
		},
		human: {
			type: "boolean",
			description: "Output as formatted text (default for TTY)",
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
	async run({ args }) {
		const output = await runPrepublish({
			cwd: args.cwd,
			strict: args.strict,
			mvi: args.mvi,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data, cmd) => {
			if (!cmd.success) {
				const logger = createLogger();
				logger.error("Prepublish gate failed");
			}
			return formatPrepublishHuman(data);
		});

		process.exit(resolveExitCode(output));
	},
});
