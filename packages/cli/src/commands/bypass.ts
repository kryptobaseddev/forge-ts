/**
 * `forge-ts bypass` command — create or inspect temporary rule bypasses.
 *
 * Bypasses allow agents to temporarily override locked rules with a limited
 * daily budget. Each bypass requires a mandatory `--reason` flag and expires
 * after a configurable duration.
 *
 * Usage:
 *   forge-ts bypass --reason="hotfix for release" [--rule E009]
 *   forge-ts bypass --status
 *
 * @packageDocumentation
 * @internal
 */

import {
	type BypassRecord,
	createBypass,
	expireOldBypasses,
	getActiveBypasses,
	getRemainingBudget,
	loadConfig,
} from "@forge-ts/core";
import { defineCommand } from "citty";
import { forgeLogger } from "../forge-logger.js";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Typed result for the `bypass` command when creating a bypass.
 * @public
 */
export interface BypassCreateResult {
	/** Whether the bypass was successfully created. */
	success: boolean;
	/** The bypass record that was created. */
	bypass: BypassRecord;
	/** Number of remaining bypass slots for today after creation. */
	remainingBudget: number;
	/** The configured daily budget. */
	dailyBudget: number;
}

/**
 * Typed result for the `bypass --status` command.
 * @public
 */
export interface BypassStatusResult {
	/** Always true for status queries. */
	success: boolean;
	/** Active (non-expired) bypass records. */
	activeBypasses: BypassRecord[];
	/** Number of remaining bypass slots for today. */
	remainingBudget: number;
	/** The configured daily budget. */
	dailyBudget: number;
	/** Number of expired bypasses that were cleaned up. */
	expiredRemoved: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the bypass creation: creates a new bypass record with budget enforcement.
 *
 * @remarks
 * Loads the project config, expires stale bypasses, then creates a new record with daily budget enforcement.
 *
 * @param args - CLI arguments for the bypass command.
 * @returns A typed `CommandOutput<BypassCreateResult>`.
 * @example
 * ```typescript
 * import { runBypassCreate } from "@forge-ts/cli/commands/bypass";
 * const output = await runBypassCreate({
 *   cwd: process.cwd(),
 *   reason: "hotfix for release",
 *   rule: "E009",
 * });
 * console.log(output.data.remainingBudget);
 * ```
 * @public
 */
export async function runBypassCreate(args: {
	cwd?: string;
	reason: string;
	rule?: string;
}): Promise<CommandOutput<BypassCreateResult>> {
	const config = await loadConfig(args.cwd);
	const rootDir = config.rootDir;

	// Clean up expired bypasses first
	expireOldBypasses(rootDir);

	try {
		const bypass = createBypass(rootDir, args.reason, args.rule, config.bypass);
		const remainingBudget = getRemainingBudget(rootDir, config.bypass);

		return {
			operation: "bypass",
			success: true,
			data: {
				success: true,
				bypass,
				remainingBudget,
				dailyBudget: config.bypass.dailyBudget,
			},
			duration: 0,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			operation: "bypass",
			success: false,
			data: {
				success: false,
				bypass: {} as BypassRecord,
				remainingBudget: 0,
				dailyBudget: config.bypass.dailyBudget,
			},
			errors: [
				{
					code: "FORGE_BYPASS_BUDGET_EXHAUSTED",
					message,
				},
			],
			duration: 0,
		};
	}
}

/**
 * Runs the bypass status query: shows active bypasses and remaining budget.
 *
 * @remarks
 * Loads config, cleans up expired bypasses, and returns active records with the remaining daily budget.
 *
 * @param args - CLI arguments for the bypass status command.
 * @returns A typed `CommandOutput<BypassStatusResult>`.
 * @example
 * ```typescript
 * import { runBypassStatus } from "@forge-ts/cli/commands/bypass";
 * const output = await runBypassStatus({ cwd: process.cwd() });
 * console.log(output.data.activeBypasses.length);
 * ```
 * @public
 */
export async function runBypassStatus(args: {
	cwd?: string;
}): Promise<CommandOutput<BypassStatusResult>> {
	const config = await loadConfig(args.cwd);
	const rootDir = config.rootDir;

	// Clean up expired bypasses first
	const expiredRemoved = expireOldBypasses(rootDir);
	const activeBypasses = getActiveBypasses(rootDir);
	const remainingBudget = getRemainingBudget(rootDir, config.bypass);

	return {
		operation: "bypass",
		success: true,
		data: {
			success: true,
			activeBypasses,
			remainingBudget,
			dailyBudget: config.bypass.dailyBudget,
			expiredRemoved,
		},
		duration: 0,
	};
}

// ---------------------------------------------------------------------------
// Human formatters
// ---------------------------------------------------------------------------

/**
 * Formats a BypassCreateResult as human-readable text.
 * @internal
 */
function formatBypassCreateHuman(result: BypassCreateResult): string {
	const lines: string[] = [];

	if (!result.success) {
		lines.push("forge-ts bypass: FAILED\n");
		lines.push("  Daily bypass budget exhausted.");
		lines.push(`  Budget: 0/${result.dailyBudget} remaining`);
		return lines.join("\n");
	}

	lines.push("forge-ts bypass: created\n");
	lines.push(`  ID:      ${result.bypass.id}`);
	lines.push(`  Rule:    ${result.bypass.rule}`);
	lines.push(`  Reason:  ${result.bypass.reason}`);
	lines.push(`  Expires: ${result.bypass.expiresAt}`);
	lines.push(`  User:    ${result.bypass.user}`);
	lines.push(`\n  Budget:  ${result.remainingBudget}/${result.dailyBudget} remaining today`);

	return lines.join("\n");
}

/**
 * Formats a BypassStatusResult as human-readable text.
 * @internal
 */
function formatBypassStatusHuman(result: BypassStatusResult): string {
	const lines: string[] = [];

	lines.push("forge-ts bypass: status\n");
	lines.push(`  Budget: ${result.remainingBudget}/${result.dailyBudget} remaining today`);

	if (result.expiredRemoved > 0) {
		lines.push(`  Cleaned up ${result.expiredRemoved} expired bypass(es)`);
	}

	if (result.activeBypasses.length === 0) {
		lines.push("\n  No active bypasses.");
	} else {
		lines.push(`\n  Active bypasses (${result.activeBypasses.length}):`);
		for (const b of result.activeBypasses) {
			lines.push(`    - [${b.rule}] ${b.reason} (expires ${b.expiresAt})`);
		}
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts bypass`.
 * @public
 */
export const bypassCommand = defineCommand({
	meta: {
		name: "bypass",
		description: "Create or inspect temporary rule bypasses",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		reason: {
			type: "string",
			description: "Mandatory justification for bypassing rules",
		},
		rule: {
			type: "string",
			description: 'Specific rule code to bypass (e.g., "E009"). Defaults to "all"',
		},
		status: {
			type: "boolean",
			description: "Show active bypasses and remaining budget",
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
	},
	async run({ args }) {
		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
		};

		// --status mode: show active bypasses
		if (args.status) {
			const output = await runBypassStatus({ cwd: args.cwd });
			emitResult(output, flags, (data) => formatBypassStatusHuman(data));
			process.exit(resolveExitCode(output));
			return;
		}

		// Create mode: --reason is required
		if (!args.reason) {
			forgeLogger.error("--reason is required. Provide a justification for the bypass.");
			process.exit(1);
		}

		const output = await runBypassCreate({
			cwd: args.cwd,
			reason: args.reason,
			rule: args.rule,
		});

		emitResult(output, flags, (data) => formatBypassCreateHuman(data));
		process.exit(resolveExitCode(output));
	},
});
