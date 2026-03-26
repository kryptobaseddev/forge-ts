import { loadConfig } from "@forge-ts/core";
import { doctest } from "@forge-ts/doctest";
import { defineCommand } from "citty";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

/**
 * Arguments for the `test` command.
 * @internal
 */
export interface TestArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

/**
 * A single test failure entry, included at standard and full MVI levels.
 * @public
 */
export interface TestFailure {
	/** Symbol name where the doctest failed. */
	symbol: string;
	/** Absolute path to the source file. */
	file: string;
	/** 1-based line number of the failing example. */
	line: number;
	/** Human-readable failure message. */
	message: string;
}

/**
 * Typed result for the `test` command.
 * @public
 */
export interface TestResult {
	/** Whether all doctests passed. */
	success: boolean;
	/** Aggregate counts — always present regardless of MVI level. */
	summary: {
		/** Number of passing doctests. */
		passed: number;
		/** Number of failing doctests. */
		failed: number;
		/** Total doctests run. */
		total: number;
		/** Wall-clock duration in milliseconds. */
		duration: number;
	};
	/** Per-failure details — present at standard and full MVI levels. */
	failures?: TestFailure[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the doctest pipeline and returns a typed command output.
 *
 * @remarks
 * Loads config, delegates to the `@forge-ts/doctest` pipeline, and wraps pass/fail counts into a LAFS-compatible command output.
 *
 * @param args - CLI arguments for the test command.
 * @returns A typed `CommandOutput<TestResult>`.
 * @example
 * ```typescript
 * import { runTest } from "@forge-ts/cli/commands/test";
 * const output = await runTest({ cwd: process.cwd() });
 * console.log(output.data.summary.passed); // number of passing doctests
 * ```
 * @public
 */
export async function runTest(args: TestArgs): Promise<CommandOutput<TestResult>> {
	const config = await loadConfig(args.cwd);
	const result = await doctest(config);
	const mviLevel = args.mvi ?? "standard";

	const failCount = result.errors.length;
	const totalSymbols = result.symbols.length;
	const passCount = totalSymbols - failCount > 0 ? totalSymbols - failCount : 0;

	const summary = {
		passed: passCount,
		failed: failCount,
		total: totalSymbols,
		duration: result.duration,
	};

	const data: TestResult = { success: result.success, summary };

	if (mviLevel !== "minimal") {
		data.failures = result.errors.map((e) => ({
			symbol: e.symbolName ?? "",
			file: e.filePath ?? "",
			line: e.line,
			message: e.message,
		}));
	}

	// Populate top-level errors so the LAFS envelope error code is actionable.
	const cliErrors = result.success
		? undefined
		: result.errors.map((e) => ({
				code: e.code,
				message: e.message,
			}));

	const cliWarnings = config._configWarnings?.map((msg) => ({
		code: "CONFIG_WARNING",
		message: msg,
		filePath: "",
		line: 0,
		column: 0,
	}));

	return {
		operation: "test",
		success: result.success,
		data,
		errors: cliErrors,
		warnings: cliWarnings,
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
		const output = await runTest({ cwd: args.cwd, mvi: args.mvi });

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data) => {
			if (output.success) {
				return `forge-ts test: all doctests passed. (${data.summary.duration}ms)`;
			}
			const lines: string[] = [];
			for (const f of data.failures ?? []) {
				lines.push(f.message);
			}
			lines.push(`forge-ts test: ${data.summary.failed} failure(s). (${data.summary.duration}ms)`);
			return lines.join("\n");
		});

		process.exit(resolveExitCode(output));
	},
});
