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
	projectEnvelope,
	resolveFlags,
	type UnifiedFlagInput,
} from "@cleocode/lafs-protocol";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Typed result from a forge-ts command. */
export interface CommandOutput<T> {
	operation: string;
	success: boolean;
	data: T;
	errors?: ForgeCliError[];
	warnings?: ForgeCliWarning[];
	duration?: number;
}

/** Structured error for CLI commands. */
export interface ForgeCliError {
	code: string;
	message: string;
	filePath?: string;
	line?: number;
	column?: number;
}

/** Structured warning for CLI commands. */
export interface ForgeCliWarning {
	code: string;
	message: string;
	filePath?: string;
	line?: number;
	column?: number;
}

/** Output format flags passed through from citty args. */
export interface OutputFlags {
	json?: boolean;
	human?: boolean;
	quiet?: boolean;
	mvi?: string;
}

// ---------------------------------------------------------------------------
// emitResult
// ---------------------------------------------------------------------------

/**
 * Wraps a command result in a LAFS envelope and emits it.
 *
 * - JSON mode: writes the projected envelope to stdout as JSON.
 * - Human mode: calls the provided formatter function.
 * - Quiet mode: suppresses all output regardless of format.
 *
 * @param output - Typed result from the command.
 * @param flags - Output format flags from citty args.
 * @param humanFormatter - Produces a human-readable string for TTY consumers.
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
	};

	const resolved = resolveFlags(flagInput);
	const format = resolved.format.format;
	const quiet = resolved.format.quiet;

	// Quiet mode: suppress all output, just let exit code speak.
	if (quiet) {
		return;
	}

	// Build the LAFS envelope
	const envelope = createEnvelope(
		output.success
			? {
					success: true,
					result: output.data as Record<string, unknown>,
					meta: {
						operation: `forge-ts.${output.operation}`,
						requestId: randomUUID(),
						transport: "cli",
						mvi: (flags.mvi as MVILevel) ?? "standard",
					},
				}
			: {
					success: false,
					error: {
						code: output.errors?.[0]?.code ?? "FORGE_ERROR",
						message: output.errors?.[0]?.message ?? "Command failed",
						category: "VALIDATION",
						retryable: false,
						retryAfterMs: null,
						details: {
							errors: output.errors ?? [],
							warnings: output.warnings ?? [],
						},
					},
					meta: {
						operation: `forge-ts.${output.operation}`,
						requestId: randomUUID(),
						transport: "cli",
						mvi: (flags.mvi as MVILevel) ?? "standard",
					},
				},
	);

	if (format === "json") {
		// MVI projection reduces token cost for agents
		const mviLevel: MVILevel = (flags.mvi as MVILevel) ?? "standard";
		const projected = projectEnvelope(envelope, mviLevel);
		process.stdout.write(`${JSON.stringify(projected, null, 2)}\n`);
	} else {
		// Human-readable output
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
