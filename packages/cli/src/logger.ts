/**
 * Simple TTY-aware logger for forge-ts CLI output.
 *
 * Uses ANSI escape codes directly — no external colour library.
 *
 * @packageDocumentation
 * @internal
 */

// ---------------------------------------------------------------------------
// ANSI constants
// ---------------------------------------------------------------------------

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A minimal structured logger used throughout the CLI commands.
 * @internal
 */
export interface Logger {
	/** Print an informational message. */
	info(msg: string): void;
	/** Print a success message (green ✓ prefix when colours are on). */
	success(msg: string): void;
	/** Print a warning message (yellow prefix when colours are on). */
	warn(msg: string): void;
	/** Print an error message (red ✗ prefix when colours are on). */
	error(msg: string): void;
	/**
	 * Print a build-step line.
	 *
	 * @param label    - Short category label (e.g. "API", "Gen").
	 * @param detail   - Description of what was produced.
	 * @param duration - Optional wall-clock time in milliseconds.
	 */
	step(label: string, detail: string, duration?: number): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Creates a {@link Logger} instance.
 *
 * @param options - Optional configuration.
 * @param options.colors - Emit ANSI colour codes.  Defaults to `process.stdout.isTTY`.
 * @returns A configured logger.
 * @internal
 */
export function createLogger(options?: { colors?: boolean }): Logger {
	const useColors = options?.colors ?? process.stdout.isTTY ?? false;

	function colorize(text: string, code: string): string {
		return useColors ? `${code}${text}${RESET}` : text;
	}

	function bold(text: string): string {
		return useColors ? `${BOLD}${text}${RESET}` : text;
	}

	return {
		info(msg: string): void {
			console.log(msg);
		},

		success(msg: string): void {
			const prefix = colorize("✓", GREEN);
			console.log(`${prefix} ${msg}`);
		},

		warn(msg: string): void {
			const prefix = colorize("warn", YELLOW);
			console.warn(`${bold(prefix)} ${msg}`);
		},

		error(msg: string): void {
			const prefix = colorize("error", RED);
			console.error(`${bold(prefix)} ${msg}`);
		},

		step(label: string, detail: string, duration?: number): void {
			const check = colorize("✓", GREEN);
			const durationStr = duration !== undefined ? ` (${duration}ms)` : "";
			console.log(`  ${check} ${bold(label)}: ${detail}${durationStr}`);
		},
	};
}
