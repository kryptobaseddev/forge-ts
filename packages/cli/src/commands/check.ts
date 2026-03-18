import { type ForgeError, type ForgeWarning, loadConfig } from "@forge-ts/core";
import { enforce } from "@forge-ts/enforcer";
import { defineCommand } from "citty";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

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
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

/**
 * A single error entry within a file group, included at standard and full MVI levels.
 * @public
 */
export interface CheckFileError {
	/** Machine-readable error code. */
	code: string;
	/** Symbol name that needs fixing. */
	symbol: string;
	/** Symbol kind (function, class, interface, etc.). */
	kind: string;
	/** 1-based line number of the error. */
	line: number;
	/** Human-readable description. */
	message: string;
	/** Exact TSDoc block to add (full MVI level only). */
	suggestedFix?: string;
	/** Recommended agent action (full MVI level only). */
	agentAction?: string;
}

/**
 * A single warning entry within a file group, included at standard and full MVI levels.
 * @public
 */
export interface CheckFileWarning {
	/** Machine-readable warning code. */
	code: string;
	/** Symbol name that generated the warning. */
	symbol: string;
	/** Symbol kind (function, class, interface, etc.). */
	kind: string;
	/** 1-based line number of the warning. */
	line: number;
	/** Human-readable description. */
	message: string;
}

/**
 * Errors and warnings grouped by file, included at standard and full MVI levels.
 * @public
 */
export interface CheckFileGroup {
	/** Absolute path to the source file. */
	file: string;
	/** Errors in this file. */
	errors: CheckFileError[];
	/** Warnings in this file. */
	warnings: CheckFileWarning[];
}

/**
 * Typed result for the `check` command.
 * @public
 */
export interface CheckResult {
	/** Whether the check passed without errors. */
	success: boolean;
	/** Aggregate counts — always present regardless of MVI level. */
	summary: {
		/** Total number of errors. */
		errors: number;
		/** Total number of warnings. */
		warnings: number;
		/** Number of unique files with diagnostics. */
		files: number;
		/** Number of exported symbols checked. */
		symbols: number;
		/** Wall-clock duration in milliseconds. */
		duration: number;
	};
	/** Per-file breakdown — present at standard and full MVI levels. */
	byFile?: CheckFileGroup[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determines the recommended agent action given a ForgeError.
 * @internal
 */
function resolveAgentAction(_error: ForgeError): string {
	return "retry_modified";
}

/**
 * Groups errors and warnings by file path.
 * @internal
 */
function groupByFile(
	errors: ForgeError[],
	warnings: ForgeWarning[],
	includeFix: boolean,
): CheckFileGroup[] {
	const fileMap = new Map<string, CheckFileGroup>();

	for (const e of errors) {
		const fp = e.filePath ?? "";
		if (!fileMap.has(fp)) {
			fileMap.set(fp, { file: fp, errors: [], warnings: [] });
		}
		const entry: CheckFileError = {
			code: e.code,
			symbol: e.symbolName ?? "",
			kind: e.symbolKind ?? "",
			line: e.line,
			message: e.message,
		};
		if (includeFix) {
			if (e.suggestedFix !== undefined) {
				entry.suggestedFix = e.suggestedFix;
			}
			entry.agentAction = resolveAgentAction(e);
		}
		fileMap.get(fp)?.errors.push(entry);
	}

	for (const w of warnings) {
		const fp = w.filePath ?? "";
		if (!fileMap.has(fp)) {
			fileMap.set(fp, { file: fp, errors: [], warnings: [] });
		}
		fileMap.get(fp)?.warnings.push({
			code: w.code,
			symbol: "",
			kind: "",
			line: w.line,
			message: w.message,
		});
	}

	return Array.from(fileMap.values());
}

/**
 * Builds an MVI-projected CheckResult from raw enforcer output.
 * @internal
 */
function buildCheckResult(
	rawErrors: ForgeError[],
	rawWarnings: ForgeWarning[],
	_symbolCount: number,
	exportedSymbolCount: number,
	duration: number,
	success: boolean,
	mviLevel: string,
): CheckResult {
	const uniqueFiles = new Set([
		...rawErrors.map((e) => e.filePath),
		...rawWarnings.map((w) => w.filePath),
	]);

	const summary = {
		errors: rawErrors.length,
		warnings: rawWarnings.length,
		files: uniqueFiles.size,
		symbols: exportedSymbolCount,
		duration,
	};

	if (mviLevel === "minimal") {
		return { success, summary };
	}

	const byFile = groupByFile(rawErrors, rawWarnings, mviLevel === "full");
	return { success, summary, byFile };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the TSDoc enforcement pass and returns a typed command output.
 *
 * @param args - CLI arguments for the check command.
 * @returns A typed `CommandOutput<CheckResult>`.
 * @example
 * ```typescript
 * import { runCheck } from "@forge-ts/cli/commands/check";
 * const output = await runCheck({ cwd: process.cwd() });
 * console.log(output.data.summary.errors); // number of TSDoc errors found
 * ```
 * @public
 */
export async function runCheck(args: CheckArgs): Promise<CommandOutput<CheckResult>> {
	const config = await loadConfig(args.cwd);
	if (args.strict !== undefined) {
		config.enforce.strict = args.strict;
	}

	const result = await enforce(config);
	const mviLevel = args.mvi ?? "standard";

	const exportedSymbolCount = result.symbols.filter((s) => s.exported).length;

	const data = buildCheckResult(
		result.errors,
		result.warnings,
		result.symbols.length,
		exportedSymbolCount,
		result.duration,
		result.success,
		mviLevel,
	);

	return {
		operation: "check",
		success: result.success,
		data,
		duration: result.duration,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats a CheckResult as human-readable text.
 * @internal
 */
function formatCheckHuman(result: CheckResult): string {
	const lines: string[] = [];

	if (result.success) {
		lines.push(
			`forge-ts check: OK  (${result.summary.symbols} symbol(s) checked, ${result.summary.duration}ms)`,
		);
		return lines.join("\n");
	}

	lines.push("forge-ts check: FAILED\n");
	lines.push(
		`  ${result.summary.errors} error(s), ${result.summary.warnings} warning(s) across ${result.summary.files} file(s) (${result.summary.symbols} symbols checked)\n`,
	);

	if (result.byFile && result.byFile.length > 0) {
		for (const group of result.byFile) {
			if (group.errors.length > 0) {
				lines.push(`  ${group.file} (${group.errors.length} error(s)):`);
				for (const err of group.errors) {
					const symbolPart = err.symbol
						? `${err.symbol} (${err.kind}:${err.line})`
						: `line ${err.line}`;
					lines.push(`    ${err.code}  ${symbolPart} — ${err.message}`);
				}
			}
			if (group.warnings.length > 0) {
				lines.push(`  ${group.file} (${group.warnings.length} warning(s)):`);
				for (const w of group.warnings) {
					lines.push(`    ${w.code}  line ${w.line} — ${w.message}`);
				}
			}
		}
		lines.push("");
	}

	lines.push("  Run with --json --mvi full for exact fix suggestions.");

	return lines.join("\n");
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
			mvi: args.mvi,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data) => formatCheckHuman(data));

		process.exit(resolveExitCode(output));
	},
});
