import type { ForgeResult } from "@forge-ts/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options that control how {@link formatResults} renders its output.
 * @see formatResults
 * @since 0.9.0
 * @public
 */
export interface FormatOptions {
	/** Emit ANSI colour escape sequences when `true`. */
	colors: boolean;
	/**
	 * When `true`, include the symbol's type signature alongside each
	 * diagnostic so the reader has immediate context.
	 */
	verbose: boolean;
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

/** @internal */
const RESET = "\x1b[0m";
/** @internal */
const RED = "\x1b[31m";
/** @internal */
const YELLOW = "\x1b[33m";
/** @internal */
const BOLD = "\x1b[1m";
/** @internal */
const DIM = "\x1b[2m";

/** @internal */
function colorize(text: string, color: string, useColors: boolean): string {
	return useColors ? `${color}${text}${RESET}` : text;
}

/** @internal */
function bold(text: string, useColors: boolean): string {
	return useColors ? `${BOLD}${text}${RESET}` : text;
}

/** @internal */
function dim(text: string, useColors: boolean): string {
	return useColors ? `${DIM}${text}${RESET}` : text;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** @internal */
interface Diagnostic {
	code: string;
	message: string;
	filePath: string;
	line: number;
	column: number;
}

/** @internal */
function isError(code: string): boolean {
	return code.startsWith("E");
}

/** @internal */
function renderDiagnostic(diag: Diagnostic, opts: FormatOptions): string {
	const label = isError(diag.code)
		? colorize(`error[${diag.code}]`, RED, opts.colors)
		: colorize(`warning[${diag.code}]`, YELLOW, opts.colors);

	const location = dim(`${diag.line}:${diag.column}`, opts.colors);
	return `  ${label} ${diag.message} ${location}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Formats a {@link ForgeResult} into a human-readable string suitable for
 * printing to a terminal.
 *
 * Diagnostics are grouped by source file.  Each file heading shows the
 * relative-ish path, followed by indented error and warning lines.  A summary
 * line is appended at the end.
 *
 * @remarks
 * Groups diagnostics by file path and sorts errors before warnings within each
 * group. When `verbose` is enabled, type signatures are appended to each diagnostic.
 *
 * @param result  - The result produced by {@link enforce}.
 * @param options - Rendering options (colours, verbosity).
 * @returns A formatted string ready to write to stdout or stderr.
 * @example
 * ```typescript
 * import { enforce } from "@forge-ts/enforcer";
 * import { formatResults } from "@forge-ts/enforcer";
 * import { loadConfig } from "@forge-ts/core";
 * const config = await loadConfig();
 * const result = await enforce(config);
 * console.log(formatResults(result, opts));
 * ```
 * @see FormatOptions
 * @see enforce
 * @since 0.9.0
 * @public
 */
export function formatResults(result: ForgeResult, options: FormatOptions): string {
	const allDiags: Diagnostic[] = [
		...result.errors.map((e) => ({ ...e })),
		...result.warnings.map((w) => ({ ...w })),
	];

	if (allDiags.length === 0) {
		const msg = `No issues found across ${result.symbols.length} symbol(s).`;
		return bold(msg, options.colors);
	}

	// Group by filePath
	const byFile = new Map<string, Diagnostic[]>();
	for (const diag of allDiags) {
		const list = byFile.get(diag.filePath);
		if (list) {
			list.push(diag);
		} else {
			byFile.set(diag.filePath, [diag]);
		}
	}

	const lines: string[] = [];

	for (const [filePath, diags] of byFile) {
		lines.push(bold(filePath, options.colors));

		// Sort: errors before warnings, then by line
		const sorted = [...diags].sort((a, b) => {
			const aIsErr = isError(a.code) ? 0 : 1;
			const bIsErr = isError(b.code) ? 0 : 1;
			if (aIsErr !== bIsErr) return aIsErr - bIsErr;
			return a.line - b.line;
		});

		for (const diag of sorted) {
			lines.push(renderDiagnostic(diag, options));

			if (options.verbose) {
				// Find the matching symbol to show its signature
				const sym = result.symbols.find(
					(s) => s.filePath === diag.filePath && s.line === diag.line,
				);
				if (sym?.signature) {
					lines.push(dim(`    signature: ${sym.signature}`, options.colors));
				}
			}
		}

		lines.push("");
	}

	// Summary line
	const errorCount = result.errors.length;
	const warnCount = result.warnings.length;
	const fileCount = byFile.size;

	const errorPart =
		errorCount > 0
			? colorize(`${errorCount} error${errorCount !== 1 ? "s" : ""}`, RED, options.colors)
			: `0 errors`;
	const warnPart =
		warnCount > 0
			? colorize(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`, YELLOW, options.colors)
			: `0 warnings`;
	const filePart = `${fileCount} file${fileCount !== 1 ? "s" : ""}`;

	lines.push(`${errorPart}, ${warnPart} in ${filePart}`);

	return lines.join("\n");
}
