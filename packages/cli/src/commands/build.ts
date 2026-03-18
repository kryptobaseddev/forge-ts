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
}

/**
 * A single step in the build pipeline.
 * @public
 */
export interface BuildStep {
	name: string;
	status: "success" | "skipped" | "failed";
	outputPath?: string;
	duration?: number;
	errors?: ForgeCliError[];
}

/**
 * Typed result for the `build` command.
 * @public
 */
export interface BuildResult {
	steps: BuildStep[];
	duration: number;
}

/**
 * Runs the full build pipeline and returns a typed command output.
 *
 * @param args - CLI arguments for the build command.
 * @returns A typed `CommandOutput<BuildResult>`.
 * @public
 */
export async function runBuild(args: BuildArgs): Promise<CommandOutput<BuildResult>> {
	const config = await loadConfig(args.cwd);
	const buildStart = Date.now();

	const steps: BuildStep[] = [];
	const allErrors: ForgeCliError[] = [];
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
		}
	} else if (!config.api.enabled || args.skipApi) {
		steps.push({ name: "api", status: "skipped" });
	}

	if (config.gen.enabled && !args.skipGen) {
		const result = await generate(config);
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
		}
	} else if (!config.gen.enabled || args.skipGen) {
		steps.push({ name: "gen", status: "skipped" });
	}

	const totalMs = Date.now() - buildStart;
	const data: BuildResult = { steps, duration: totalMs };

	return {
		operation: "build",
		success,
		data,
		errors: allErrors,
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
				return `  Done in ${data.duration}ms`;
			}
			return "";
		});

		process.exit(resolveExitCode(output));
	},
});
