import { loadConfig } from "@codluv/forge-core";
import { enforce } from "@codluv/forge-enforcer";
import { defineCommand } from "citty";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type ForgeCliWarning,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";

/**
 * Arguments for the `check` command.
 * @internal
 */
export interface CheckArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Exit with non-zero code on warnings as well as errors. */
	strict?: boolean;
	/** Include symbol signatures alongside diagnostics. */
	verbose?: boolean;
}

/**
 * Typed result for the `check` command.
 * @public
 */
export interface CheckResult {
	symbolCount: number;
	errorCount: number;
	warningCount: number;
	errors: ForgeCliError[];
	warnings: ForgeCliWarning[];
	duration: number;
}

/**
 * Runs the TSDoc enforcement pass and returns a typed command output.
 *
 * @param args - CLI arguments for the check command.
 * @returns A typed `CommandOutput<CheckResult>`.
 * @public
 */
export async function runCheck(args: CheckArgs): Promise<CommandOutput<CheckResult>> {
	const config = await loadConfig(args.cwd);
	if (args.strict !== undefined) {
		config.enforce.strict = args.strict;
	}

	const result = await enforce(config);

	const errors: ForgeCliError[] = result.errors.map((e) => ({
		code: e.code,
		message: e.message,
		filePath: e.filePath,
		line: e.line,
		column: e.column,
	}));

	const warnings: ForgeCliWarning[] = result.warnings.map((w) => ({
		code: w.code,
		message: w.message,
		filePath: w.filePath,
		line: w.line,
		column: w.column,
	}));

	const data: CheckResult = {
		symbolCount: result.symbols.length,
		errorCount: errors.length,
		warningCount: warnings.length,
		errors,
		warnings,
		duration: result.duration,
	};

	return {
		operation: "check",
		success: result.success,
		data,
		errors,
		warnings,
		duration: result.duration,
	};
}

/**
 * Citty command definition for `forge-ts check`.
 * @public
 */
export const checkCommand = defineCommand({
	meta: {
		name: "check",
		description: "Lint TSDoc coverage on exported symbols",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		strict: {
			type: "boolean",
			description: "Treat warnings as errors",
			default: false,
		},
		verbose: {
			type: "boolean",
			description: "Show detailed output",
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
		const output = await runCheck({
			cwd: args.cwd,
			strict: args.strict,
			verbose: args.verbose,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (_data, cmd) => {
			// Delegate to enforcer's own formatter for human output.
			// Re-run enforce is not needed — we have the raw result embedded.
			// However formatResults needs the ForgeResult shape; we reconstruct
			// just enough to call it by printing the errors inline.
			const lines: string[] = [];
			for (const err of cmd.errors ?? []) {
				const loc =
					err.filePath != null ? `${err.filePath}:${err.line ?? 0}:${err.column ?? 0}` : "";
				lines.push(loc ? `${loc} — ${err.message}` : err.message);
			}
			if (lines.length > 0) {
				lines.push(
					`\n${cmd.data.errorCount} error(s), ${cmd.data.warningCount} warning(s) in ${cmd.data.duration}ms`,
				);
			} else {
				lines.push(
					`forge-ts check: ${cmd.data.symbolCount} symbol(s) checked. (${cmd.data.duration}ms)`,
				);
			}
			return lines.join("\n");
		});

		process.exit(resolveExitCode(output));
	},
});
