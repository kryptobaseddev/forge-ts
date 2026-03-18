import { loadConfig } from "@codluv/forge-core";
import { doctest } from "@codluv/forge-doctest";
import { defineCommand } from "citty";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";

/**
 * Arguments for the `test` command.
 * @internal
 */
export interface TestArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
}

/**
 * Typed result for the `test` command.
 * @public
 */
export interface TestResult {
	passed: number;
	failed: number;
	total: number;
	duration: number;
	failures: ForgeCliError[];
}

/**
 * Runs the doctest pipeline and returns a typed command output.
 *
 * @param args - CLI arguments for the test command.
 * @returns A typed `CommandOutput<TestResult>`.
 * @public
 */
export async function runTest(args: TestArgs): Promise<CommandOutput<TestResult>> {
	const config = await loadConfig(args.cwd);
	const result = await doctest(config);

	const failures: ForgeCliError[] = result.errors.map((e) => ({
		code: e.code,
		message: e.message,
		filePath: e.filePath,
		line: e.line,
		column: e.column,
	}));

	const failCount = failures.length;
	const totalSymbols = result.symbols.length;
	const passCount = totalSymbols - failCount > 0 ? totalSymbols - failCount : 0;

	const data: TestResult = {
		passed: passCount,
		failed: failCount,
		total: totalSymbols,
		duration: result.duration,
		failures,
	};

	return {
		operation: "test",
		success: result.success,
		data,
		errors: failures,
		duration: result.duration,
	};
}

/**
 * Citty command definition for `forge-ts test`.
 * @public
 */
export const testCommand = defineCommand({
	meta: {
		name: "test",
		description: "Run @example blocks as doctests",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
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
		const output = await runTest({ cwd: args.cwd });

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data) => {
			if (output.success) {
				return `forge-ts test: all doctests passed. (${data.duration}ms)`;
			}
			const lines: string[] = [];
			for (const err of data.failures) {
				lines.push(err.message);
			}
			lines.push(`forge-ts test: ${data.failed} failure(s). (${data.duration}ms)`);
			return lines.join("\n");
		});

		process.exit(resolveExitCode(output));
	},
});
