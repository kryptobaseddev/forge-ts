import { execSync } from "node:child_process";
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
	/** Filter errors to a specific rule code (e.g., "E001"). */
	rule?: string;
	/** Filter errors to a specific file path (substring match). */
	file?: string;
	/** Only check symbols from git-staged .ts/.tsx files. */
	staged?: boolean;
	/** Maximum number of file groups to return in byFile (default: 20). */
	limit?: number;
	/** Offset into the byFile list for pagination (default: 0). */
	offset?: number;
}

/**
 * A single error entry within a file group.
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
	/** Exact TSDoc block to add (present at full MVI or with --rule/--file filters). */
	suggestedFix?: string;
	/** Recommended agent action. */
	agentAction?: string;
}

/**
 * A single warning entry within a file group.
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
 * Errors and warnings grouped by file.
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
 * Error breakdown by rule code, sorted by count descending.
 * @public
 */
export interface CheckRuleCount {
	/** Machine-readable rule code (e.g., "E001"). */
	code: string;
	/** Human-readable rule name (e.g., "require-summary"). */
	rule: string;
	/** Number of violations. */
	count: number;
	/** Number of unique files affected by this rule. */
	files: number;
}

/**
 * Triage data for prioritizing fixes.
 * Always present when the check has errors, bounded in size (~9 rules + top 20 files).
 * @public
 */
export interface CheckTriage {
	/** Error counts by rule, sorted descending. */
	byRule: CheckRuleCount[];
	/** Top files by error count (max 20). */
	topFiles: Array<{ file: string; errors: number; warnings: number }>;
	/** Suggested fix order: rules sorted by fewest files affected first (quick wins). */
	fixOrder: Array<{ code: string; rule: string; count: number; files: number }>;
}

/**
 * Pagination metadata for byFile results.
 * @public
 */
export interface CheckPage {
	/** Current offset. */
	offset: number;
	/** Page size. */
	limit: number;
	/** Whether more results exist beyond this page. */
	hasMore: boolean;
	/** Total number of file groups (after filters). */
	total: number;
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
	/** Triage data for prioritizing fixes — present when errors > 0 (except minimal). */
	triage?: CheckTriage;
	/** Per-file breakdown — present at standard and full MVI levels, paginated. */
	byFile?: CheckFileGroup[];
	/** Pagination metadata when byFile is paginated. */
	page?: CheckPage;
	/** Active filters applied to this result. */
	filters?: { rule?: string; file?: string };
	/** CLI command hint for the agent to run next. */
	nextCommand?: string;
}

// ---------------------------------------------------------------------------
// Git staged files helper
// ---------------------------------------------------------------------------

/**
 * Returns the list of staged .ts/.tsx files (relative paths) by querying git.
 * Returns `null` when git is unavailable or the working directory is not a
 * git repository. Deleted files are excluded.
 *
 * The command is a fixed string with no interpolated user input, so shell
 * injection is not a concern here.
 *
 * @param cwd - Working directory for the git command.
 * @returns Array of relative file paths, or `null` on failure.
 * @internal
 */
export function getStagedFiles(cwd: string): string[] | null {
	try {
		const output = execSync("git diff --cached --name-only --diff-filter=d", {
			cwd,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return output
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f.length > 0 && (f.endsWith(".ts") || f.endsWith(".tsx")));
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Rule code → name mapping
// ---------------------------------------------------------------------------

const RULE_NAMES: Record<string, string> = {
	E001: "require-summary",
	E002: "require-param",
	E003: "require-returns",
	E004: "require-example",
	E005: "require-package-doc",
	E006: "require-class-member-doc",
	E007: "require-interface-member-doc",
	E008: "require-link-target",
	W004: "deprecated-cross-import",
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Computes triage data from the full (unfiltered) error/warning set.
 * Bounded output: max 9 rules + top 20 files.
 * @internal
 */
function computeTriage(errors: ForgeError[], warnings: ForgeWarning[]): CheckTriage {
	// byRule: count per code with file count
	const ruleMap = new Map<string, { count: number; files: Set<string> }>();
	for (const e of errors) {
		const entry = ruleMap.get(e.code) ?? { count: 0, files: new Set<string>() };
		entry.count++;
		entry.files.add(e.filePath);
		ruleMap.set(e.code, entry);
	}
	for (const w of warnings) {
		const entry = ruleMap.get(w.code) ?? { count: 0, files: new Set<string>() };
		entry.count++;
		entry.files.add(w.filePath);
		ruleMap.set(w.code, entry);
	}

	const byRule: CheckRuleCount[] = Array.from(ruleMap.entries())
		.map(([code, { count, files }]) => ({
			code,
			rule: RULE_NAMES[code] ?? code,
			count,
			files: files.size,
		}))
		.sort((a, b) => b.count - a.count);

	// topFiles: count errors/warnings per file, top 20
	const fileMap = new Map<string, { errors: number; warnings: number }>();
	for (const e of errors) {
		const entry = fileMap.get(e.filePath) ?? { errors: 0, warnings: 0 };
		entry.errors++;
		fileMap.set(e.filePath, entry);
	}
	for (const w of warnings) {
		const entry = fileMap.get(w.filePath) ?? { errors: 0, warnings: 0 };
		entry.warnings++;
		fileMap.set(w.filePath, entry);
	}
	const topFiles = Array.from(fileMap.entries())
		.map(([file, counts]) => ({ file, ...counts }))
		.sort((a, b) => b.errors - a.errors || a.file.localeCompare(b.file))
		.slice(0, 20);

	// fixOrder: rules sorted by fewest files (quick wins first)
	const fixOrder = [...byRule].sort((a, b) => a.files - b.files || b.count - a.count);

	return { byRule, topFiles, fixOrder };
}

/**
 * Filters errors/warnings by rule code and/or file path substring.
 * @internal
 */
function applyFilters(
	errors: ForgeError[],
	warnings: ForgeWarning[],
	filters: { rule?: string; file?: string },
): { errors: ForgeError[]; warnings: ForgeWarning[] } {
	let filteredErrors = errors;
	let filteredWarnings = warnings;

	if (filters.rule) {
		const r = filters.rule.toUpperCase();
		filteredErrors = filteredErrors.filter((e) => e.code === r);
		filteredWarnings = filteredWarnings.filter((w) => w.code === r);
	}
	if (filters.file) {
		const f = filters.file;
		filteredErrors = filteredErrors.filter((e) => e.filePath.includes(f));
		filteredWarnings = filteredWarnings.filter((w) => w.filePath.includes(f));
	}

	return { errors: filteredErrors, warnings: filteredWarnings };
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
		if (includeFix && e.suggestedFix !== undefined) {
			entry.suggestedFix = e.suggestedFix;
			entry.agentAction = "retry_modified";
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

	// Deterministic sort: most errors first, then lexicographic path
	return Array.from(fileMap.values()).sort(
		(a, b) => b.errors.length - a.errors.length || a.file.localeCompare(b.file),
	);
}

/**
 * Computes the next CLI command hint for the agent.
 * @internal
 */
function computeNextCommand(
	triage: CheckTriage,
	filters: { rule?: string; file?: string },
	page: CheckPage | undefined,
	hasFilters: boolean,
): string {
	// If paginated and has more, suggest next page
	if (page?.hasMore) {
		const parts = ["forge-ts check --mvi full"];
		if (filters.rule) parts.push(`--rule ${filters.rule}`);
		if (filters.file) parts.push(`--file "${filters.file}"`);
		parts.push(`--limit ${page.limit} --offset ${page.offset + page.limit}`);
		return parts.join(" ");
	}

	// If no filters yet, suggest drilling into the quickest-win rule
	if (!hasFilters && triage.fixOrder.length > 0) {
		const quickWin = triage.fixOrder[0];
		return `forge-ts check --rule ${quickWin.code} --mvi full`;
	}

	// If filtered by rule, suggest re-checking after fixes
	return "forge-ts check --mvi minimal";
}

/**
 * Builds a CheckResult with triage, filtering, pagination, and MVI differentiation.
 * @internal
 */
function buildCheckResult(
	rawErrors: ForgeError[],
	rawWarnings: ForgeWarning[],
	exportedSymbolCount: number,
	duration: number,
	success: boolean,
	mviLevel: string,
	filters: { rule?: string; file?: string },
	limit: number,
	offset: number,
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

	// Triage: always computed from FULL unfiltered data (bounded by rule count + top 20)
	const triage =
		rawErrors.length > 0 || rawWarnings.length > 0
			? computeTriage(rawErrors, rawWarnings)
			: undefined;

	// Apply filters
	const hasFilters = !!(filters.rule || filters.file);
	const { errors: filteredErrors, warnings: filteredWarnings } = hasFilters
		? applyFilters(rawErrors, rawWarnings, filters)
		: { errors: rawErrors, warnings: rawWarnings };

	// Include suggestedFix at full MVI or when filters are active (targeted drill-down)
	const includeFix = mviLevel === "full" || hasFilters;

	// Group and paginate
	const allGroups = groupByFile(filteredErrors, filteredWarnings, includeFix);
	const total = allGroups.length;
	const pagedGroups = allGroups.slice(offset, offset + limit);
	const hasMore = offset + limit < total;

	const page: CheckPage = { offset, limit, hasMore, total };

	const nextCommand = triage ? computeNextCommand(triage, filters, page, hasFilters) : undefined;

	const result: CheckResult = {
		success,
		summary,
		triage,
		byFile: pagedGroups,
		page,
		nextCommand,
	};

	if (hasFilters) {
		result.filters = {
			rule: filters.rule || undefined,
			file: filters.file || undefined,
		};
	}

	return result;
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

	// --staged: resolve staged .ts/.tsx files and merge into the file filter
	const fileFilter = args.file;
	let stagedPaths: string[] | undefined;
	if (args.staged) {
		const rootDir = config.rootDir;
		const staged = getStagedFiles(rootDir);
		if (staged !== null && staged.length > 0) {
			stagedPaths = staged;
		} else {
			// No staged .ts files — return an instant success result
			const data: CheckResult = {
				success: true,
				summary: { errors: 0, warnings: 0, files: 0, symbols: 0, duration: 0 },
			};
			return { operation: "check", success: true, data, duration: 0 };
		}
	}

	const result = await enforce(config);
	// Default to "standard" MVI — gives triage + paginated overview.
	// Agents drill into specific rules/files with --mvi full.
	const mviLevel = args.mvi ?? "standard";
	const limit = args.limit ?? 20;
	const offset = args.offset ?? 0;
	const filters = { rule: args.rule, file: fileFilter };

	// When --staged is active, filter per-symbol diagnostics to staged files.
	// Cross-file rules (E005, E008, E009-E012, W007, W008, W009) still run on
	// the full project to catch project-wide regressions.
	const CROSS_FILE_RULES = new Set([
		"E005",
		"E008",
		"E009",
		"E010",
		"E011",
		"E012",
		"W007",
		"W008",
		"W009",
	]);
	let filteredErrors = result.errors;
	let filteredWarnings = result.warnings;
	if (stagedPaths && stagedPaths.length > 0) {
		const stagedSet = new Set(stagedPaths);
		const matchesStaged = (filePath: string): boolean =>
			stagedPaths?.some((sp) => filePath.endsWith(sp)) ?? false;
		filteredErrors = result.errors.filter(
			(e) => CROSS_FILE_RULES.has(e.code) || stagedSet.has(e.filePath) || matchesStaged(e.filePath),
		);
		filteredWarnings = result.warnings.filter(
			(w) => CROSS_FILE_RULES.has(w.code) || stagedSet.has(w.filePath) || matchesStaged(w.filePath),
		);
	}

	const exportedSymbolCount = result.symbols.filter((s) => s.exported).length;

	const data = buildCheckResult(
		filteredErrors,
		filteredWarnings,
		exportedSymbolCount,
		result.duration,
		filteredErrors.length === 0,
		mviLevel,
		filters,
		limit,
		offset,
	);

	// Populate top-level errors so the LAFS envelope error code is actionable.
	const checkSuccess = filteredErrors.length === 0;
	const cliErrors = checkSuccess
		? undefined
		: [
				{
					code: "FORGE_CHECK_FAILED",
					message: `TSDoc coverage check failed: ${filteredErrors.length} error(s), ${filteredWarnings.length} warning(s) across ${data.summary.files} file(s)`,
				},
			];

	// Surface config warnings so agents see them in the JSON envelope
	const cliWarnings = config._configWarnings?.map((msg) => ({
		code: "CONFIG_WARNING",
		message: msg,
		filePath: "",
		line: 0,
		column: 0,
	}));

	return {
		operation: "check",
		success: checkSuccess,
		data,
		errors: cliErrors,
		warnings: cliWarnings,
		duration: result.duration,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats a CheckResult as human-readable, actionable text.
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

	// Triage: rule breakdown
	if (result.triage) {
		lines.push("  Rules:");
		for (const r of result.triage.byRule) {
			lines.push(`    ${r.code} ${r.rule}: ${r.count} violation(s) in ${r.files} file(s)`);
		}
		lines.push("");

		if (result.triage.fixOrder.length > 0) {
			const qw = result.triage.fixOrder[0];
			lines.push(
				`  Quick win: fix ${qw.code} (${qw.rule}) — ${qw.count} issue(s) in ${qw.files} file(s)`,
			);
			lines.push("");
		}
	}

	// Active filters
	if (result.filters) {
		const parts = [];
		if (result.filters.rule) parts.push(`rule=${result.filters.rule}`);
		if (result.filters.file) parts.push(`file=${result.filters.file}`);
		lines.push(`  Filtered: ${parts.join(", ")}`);
		lines.push("");
	}

	// Per-file errors
	if (result.byFile && result.byFile.length > 0) {
		for (const group of result.byFile) {
			if (group.errors.length > 0) {
				lines.push(`  ${group.file} (${group.errors.length} error(s)):`);
				for (const err of group.errors) {
					const symbolPart = err.symbol
						? `${err.symbol} (${err.kind}:${err.line})`
						: `line ${err.line}`;
					lines.push(`    ${err.code}  ${symbolPart} — ${err.message}`);
					if (err.suggestedFix) {
						for (const fixLine of err.suggestedFix.split("\n")) {
							lines.push(`           ${fixLine}`);
						}
					}
				}
			}
			if (group.warnings.length > 0) {
				lines.push(`  ${group.file} (${group.warnings.length} warning(s)):`);
				for (const w of group.warnings) {
					lines.push(`    ${w.code}  line ${w.line} — ${w.message}`);
				}
			}
		}
	}

	// Pagination footer
	if (result.page?.hasMore) {
		lines.push(
			`\n  Showing ${result.page.offset + 1}-${result.page.offset + (result.byFile?.length ?? 0)} of ${result.page.total} file(s). Use --offset ${result.page.offset + result.page.limit} to see more.`,
		);
	}

	// Next command hint
	if (result.nextCommand) {
		lines.push(`\n  Next: ${result.nextCommand}`);
	}

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
		rule: {
			type: "string",
			description: "Filter by rule code (e.g., E001, W004)",
		},
		file: {
			type: "string",
			description: "Filter by file path (substring match)",
		},
		staged: {
			type: "boolean",
			description: "Only check symbols from git-staged .ts/.tsx files",
			default: false,
		},
		limit: {
			type: "string",
			description: "Max file groups in output (default: 20)",
		},
		offset: {
			type: "string",
			description: "Skip N file groups for pagination (default: 0)",
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
			rule: args.rule,
			file: args.file,
			staged: args.staged,
			limit: args.limit ? parseInt(args.limit, 10) : undefined,
			offset: args.offset ? parseInt(args.offset, 10) : undefined,
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
