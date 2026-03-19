import { generateApi } from "@forge-ts/api";
import { loadConfig } from "@forge-ts/core";
import { generate } from "@forge-ts/gen";
import { defineCommand } from "citty";
import { createLogger } from "../logger.js";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";

/**
 * Arguments for the `build` command.
 * @internal
 */
export interface BuildArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Skip API generation even if enabled in config. */
	skipApi?: boolean;
	/** Skip doc generation even if enabled in config. */
	skipGen?: boolean;
	/**
	 * Overwrite stub pages even if they already exist on disk.
	 * Normally stub pages (concepts, guides, faq, contributing, changelog)
	 * are only created on the first build to preserve manual edits.
	 * Use this to reset stubs to their scaffolding state.
	 */
	forceStubs?: boolean;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

/**
 * A single step in the build pipeline.
 * @public
 */
export interface BuildStep {
	/** Internal step name, e.g. "api" or "gen". */
	name: string;
	/** Outcome of this step. */
	status: "success" | "skipped" | "failed";
	/** Path to the primary output file produced by this step, if applicable. */
	outputPath?: string;
	/** Wall-clock duration of this step in milliseconds. */
	duration?: number;
	/** Errors produced by this step when status is "failed". */
	errors?: ForgeCliError[];
}

/**
 * Typed result for the `build` command.
 * @public
 */
export interface BuildResult {
	/** Whether the build succeeded. */
	success: boolean;
	/** Aggregate pipeline counts — always present. */
	summary: {
		/** Total number of pipeline steps. */
		steps: number;
		/** Steps that completed successfully. */
		succeeded: number;
		/** Steps that failed. */
		failed: number;
		/** Wall-clock duration in milliseconds. */
		duration: number;
	};
	/** Per-step details. */
	steps: BuildStep[];
	/** Files written during the build — present at standard and full MVI levels. */
	generatedFiles?: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full build pipeline and returns a typed command output.
 *
 * @param args - CLI arguments for the build command.
 * @returns A typed `CommandOutput<BuildResult>`.
 * @example
 * ```typescript
 * import { runBuild } from "@forge-ts/cli/commands/build";
 * const output = await runBuild({ cwd: process.cwd() });
 * console.log(output.success); // true if all steps succeeded
 * ```
 * @public
 */
export async function runBuild(args: BuildArgs): Promise<CommandOutput<BuildResult>> {
	const config = await loadConfig(args.cwd);
	const buildStart = Date.now();
	const mviLevel = args.mvi ?? "standard";

	const steps: BuildStep[] = [];
	const allErrors: ForgeCliError[] = [];
	const generatedFiles: string[] = [];
	let success = true;

	if (config.api.enabled && !args.skipApi) {
		const result = await generateApi(config);
		if (!result.success) {
			const errors: ForgeCliError[] = result.errors.map((e) => ({
				code: e.code,
				message: e.message,
				filePath: e.filePath,
				line: e.line,
				column: e.column,
			}));
			allErrors.push(...errors);
			success = false;
			steps.push({
				name: "api",
				status: "failed",
				outputPath: config.api.openapiPath,
				duration: result.duration,
				errors,
			});
		} else {
			steps.push({
				name: "api",
				status: "success",
				outputPath: config.api.openapiPath,
				duration: result.duration,
			});
			generatedFiles.push(config.api.openapiPath);
		}
	} else if (!config.api.enabled || args.skipApi) {
		steps.push({ name: "api", status: "skipped" });
	}

	if (config.gen.enabled && !args.skipGen) {
		const result = await generate(config, { forceStubs: args.forceStubs });
		if (!result.success) {
			const errors: ForgeCliError[] = result.errors.map((e) => ({
				code: e.code,
				message: e.message,
				filePath: e.filePath,
				line: e.line,
				column: e.column,
			}));
			allErrors.push(...errors);
			success = false;
			steps.push({
				name: "gen",
				status: "failed",
				duration: result.duration,
				errors,
			});
		} else {
			steps.push({
				name: "gen",
				status: "success",
				duration: result.duration,
			});
			if (result.writtenFiles) {
				generatedFiles.push(...result.writtenFiles);
			}
		}
	} else if (!config.gen.enabled || args.skipGen) {
		steps.push({ name: "gen", status: "skipped" });
	}

	const totalMs = Date.now() - buildStart;

	const succeededCount = steps.filter((s) => s.status === "success").length;
	const failedCount = steps.filter((s) => s.status === "failed").length;

	const data: BuildResult = {
		success,
		summary: {
			steps: steps.length,
			succeeded: succeededCount,
			failed: failedCount,
			duration: totalMs,
		},
		steps,
	};

	if (mviLevel !== "minimal") {
		data.generatedFiles = generatedFiles;
	}

	const cliWarnings = config._configWarnings?.map((msg) => ({
		code: "CONFIG_WARNING",
		message: msg,
		filePath: "",
		line: 0,
		column: 0,
	}));

	return {
		operation: "build",
		success,
		data,
		errors: allErrors,
		warnings: cliWarnings,
		duration: totalMs,
	};
}

/**
 * Citty command definition for `forge-ts build`.
 * @public
 */
export const buildCommand = defineCommand({
	meta: {
		name: "build",
		description: "Generate API reference and documentation",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		"skip-api": {
			type: "boolean",
			description: "Skip OpenAPI generation",
			default: false,
		},
		"skip-gen": {
			type: "boolean",
			description: "Skip doc generation",
			default: false,
		},
		"force-stubs": {
			type: "boolean",
			description: "Overwrite stub pages even if they exist (reset to scaffolding)",
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
		const output = await runBuild({
			cwd: args.cwd,
			skipApi: args["skip-api"],
			skipGen: args["skip-gen"],
			forceStubs: args["force-stubs"],
			mvi: args.mvi,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data) => {
			const logger = createLogger();
			for (const step of data.steps) {
				if (step.status === "failed") {
					for (const err of step.errors ?? []) {
						logger.error(`[${step.name}] ${err.message}`);
					}
				} else if (step.status === "success") {
					const detail =
						step.name === "api" && step.outputPath != null
							? `Generated OpenAPI spec \u2192 ${step.outputPath}`
							: `Step complete`;
					logger.step(step.name.toUpperCase(), detail, step.duration);
				}
			}
			if (output.success) {
				return `  Done in ${data.summary.duration}ms`;
			}
			return "";
		});

		process.exit(resolveExitCode(output));
	},
});
