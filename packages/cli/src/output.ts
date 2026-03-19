/**
 * Central output layer for forge-ts CLI.
 *
 * Wraps all command results in LAFS envelopes for agent-first output, while
 * preserving human-readable formatting for TTY consumers.
 *
 * @packageDocumentation
 * @internal
 */

import { randomUUID } from "node:crypto";
import {
	createEnvelope,
	type MVILevel,
	resolveFlags,
	type UnifiedFlagInput,
} from "@cleocode/lafs-protocol";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Typed result from a forge-ts command. */
export interface CommandOutput<T> {
	/** Name of the command that produced this output (e.g., "check", "build"). */
	operation: string;
	/** Whether the command completed successfully. */
	success: boolean;
	/** Strongly-typed command-specific result payload. */
	data: T;
	/** Structured errors produced by the command, if any. */
	errors?: ForgeCliError[];
	/** Structured warnings produced by the command, if any. */
	warnings?: ForgeCliWarning[];
	/** Wall-clock duration of the command in milliseconds. */
	duration?: number;
}

/** Structured error for CLI commands. */
export interface ForgeCliError {
	/** Machine-readable error code (e.g., "E004"). */
	code: string;
	/** Human-readable error description. */
	message: string;
	/** Absolute path to the source file containing the error, if applicable. */
	filePath?: string;
	/** 1-based line number of the error, if applicable. */
	line?: number;
	/** 0-based column number of the error, if applicable. */
	column?: number;
}

/** Structured warning for CLI commands. */
export interface ForgeCliWarning {
	/** Machine-readable warning code. */
	code: string;
	/** Human-readable warning description. */
	message: string;
	/** Absolute path to the source file containing the warning, if applicable. */
	filePath?: string;
	/** 1-based line number of the warning, if applicable. */
	line?: number;
	/** 0-based column number of the warning, if applicable. */
	column?: number;
}

/** Output format flags passed through from citty args. */
export interface OutputFlags {
	/** Emit output as a LAFS JSON envelope instead of human-readable text. */
	json?: boolean;
	/** Emit output as formatted human-readable text. */
	human?: boolean;
	/** Suppress all output regardless of format. */
	quiet?: boolean;
	/** MVI verbosity level: "minimal", "standard", or "full". */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// emitResult
// ---------------------------------------------------------------------------

/**
 * Wraps a command result in a LAFS envelope and emits it.
 *
 * Output format is determined by LAFS flag resolution:
 * - TTY terminals default to human-readable output.
 * - Non-TTY (piped, CI, agents) defaults to JSON.
 * - Explicit `--json` or `--human` flags always take precedence.
 *
 * On failure, the full result is included alongside the error so agents
 * get actionable data (e.g., suggestedFix) in a single response.
 *
 * @param output - Typed result from the command.
 * @param flags - Output format flags from citty args.
 * @param humanFormatter - Produces a human-readable string for TTY consumers.
 * @example
 * ```typescript
 * import { emitResult } from "@forge-ts/cli/output";
 * emitResult(output, { human: true }, (data) => `Done: ${data.summary.duration}ms`);
 * ```
 * @internal
 */
export function emitResult<T>(
	output: CommandOutput<T>,
	flags: OutputFlags,
	humanFormatter: (data: T, output: CommandOutput<T>) => string,
): void {
	const flagInput: UnifiedFlagInput = {
		json: flags.json,
		human: flags.human,
		quiet: flags.quiet,
		mvi: flags.mvi,
		// LAFS 1.8.0: TTY detection drives the default format.
		// Terminals get human output, pipes/agents get JSON.
		tty: process.stdout.isTTY ?? false,
	};

	const resolved = resolveFlags(flagInput);
	const format = resolved.format.format;
	const quiet = resolved.format.quiet;

	if (quiet) {
		return;
	}

	const meta = {
		operation: `forge-ts.${output.operation}`,
		requestId: randomUUID(),
		transport: "cli" as const,
		mvi: (flags.mvi as MVILevel) ?? "full",
	};

	// LAFS 1.8.0: result is included on error envelopes so agents get
	// actionable data (byFile, suggestedFix) alongside error metadata.
	const envelope = output.success
		? createEnvelope({
				success: true,
				result: output.data as Record<string, unknown>,
				meta,
			})
		: createEnvelope({
				success: false,
				result: output.data as Record<string, unknown>,
				error: {
					code: output.errors?.[0]?.code ?? "FORGE_CHECK_FAILED",
					message: output.errors?.[0]?.message ?? "Check failed — see result for actionable fixes",
					category: "VALIDATION",
					retryable: true,
					retryAfterMs: null,
				},
				meta,
			});

	if (format === "json") {
		process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
	} else {
		const formatted = humanFormatter(output.data, output);
		if (formatted) {
			console.log(formatted);
		}
	}
}

// ---------------------------------------------------------------------------
// resolveExitCode
// ---------------------------------------------------------------------------

/**
 * Returns the LAFS-compliant exit code for a command output.
 *
 * @param output - Typed result from the command.
 * @returns `0` on success, `1` on validation/check failure.
 * @internal
 */
export function resolveExitCode(output: CommandOutput<unknown>): number {
	if (output.success) return 0;
	return 1;
}
