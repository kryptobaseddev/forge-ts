/**
 * `forge-ts unlock` command — removes `.forge-lock.json` with a mandatory reason.
 *
 * The `--reason` flag is required to provide an audit trail explaining why
 * the config lock is being removed. This discourages silent weakening
 * of project settings by LLM agents.
 *
 * @packageDocumentation
 * @internal
 */

import {
	appendAuditEvent,
	getCurrentUser,
	loadConfig,
	readLockFile,
	removeLockFile,
} from "@forge-ts/core";
import { defineCommand } from "citty";
import { forgeLogger } from "../forge-logger.js";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Typed result for the `unlock` command.
 * @public
 */
export interface UnlockResult {
	/** Whether the unlock was successful. */
	success: boolean;
	/** The reason provided for unlocking. */
	reason: string;
	/** Who originally locked the config, if known. */
	previousLockedBy: string | null;
	/** When the config was originally locked, if known. */
	previousLockedAt: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the unlock command: removes `.forge-lock.json` with a mandatory reason.
 *
 * @param args - CLI arguments for the unlock command.
 * @returns A typed `CommandOutput<UnlockResult>`.
 * @example
 * ```typescript
 * import { runUnlock } from "@forge-ts/cli/commands/unlock";
 * const output = await runUnlock({ cwd: process.cwd(), reason: "Relaxing rules for migration" });
 * console.log(output.data.success); // true
 * ```
 * @public
 */
export async function runUnlock(args: {
	cwd?: string;
	reason: string;
}): Promise<CommandOutput<UnlockResult>> {
	const config = await loadConfig(args.cwd);
	const rootDir = config.rootDir;

	const existingLock = readLockFile(rootDir);

	if (!existingLock) {
		return {
			operation: "unlock",
			success: false,
			data: {
				success: false,
				reason: args.reason,
				previousLockedBy: null,
				previousLockedAt: null,
			},
			errors: [
				{
					code: "FORGE_NO_LOCK",
					message: "No .forge-lock.json found. Nothing to unlock.",
				},
			],
			duration: 0,
		};
	}

	const removed = removeLockFile(rootDir);

	if (!removed) {
		return {
			operation: "unlock",
			success: false,
			data: {
				success: false,
				reason: args.reason,
				previousLockedBy: existingLock.lockedBy,
				previousLockedAt: existingLock.lockedAt,
			},
			errors: [
				{
					code: "FORGE_UNLOCK_FAILED",
					message: "Failed to remove .forge-lock.json. Check file permissions.",
				},
			],
			duration: 0,
		};
	}

	appendAuditEvent(rootDir, {
		timestamp: new Date().toISOString(),
		event: "config.unlock",
		user: getCurrentUser(),
		reason: args.reason,
		details: {
			previousLockedBy: existingLock.lockedBy,
			previousLockedAt: existingLock.lockedAt,
		},
	});

	return {
		operation: "unlock",
		success: true,
		data: {
			success: true,
			reason: args.reason,
			previousLockedBy: existingLock.lockedBy,
			previousLockedAt: existingLock.lockedAt,
		},
		duration: 0,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats an UnlockResult as human-readable text.
 * @internal
 */
function formatUnlockHuman(result: UnlockResult): string {
	const lines: string[] = [];

	if (!result.success) {
		lines.push("forge-ts unlock: FAILED\n");
		lines.push("  No .forge-lock.json found. Nothing to unlock.");
		return lines.join("\n");
	}

	lines.push("forge-ts unlock: removed .forge-lock.json\n");
	lines.push(`  Reason: ${result.reason}`);
	if (result.previousLockedBy) {
		lines.push(`  Previously locked by: ${result.previousLockedBy}`);
	}
	if (result.previousLockedAt) {
		lines.push(`  Previously locked at: ${result.previousLockedAt}`);
	}
	lines.push("\n  Config settings can now be modified freely.");
	lines.push("  Run `forge-ts lock` to re-lock after changes.");

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts unlock`.
 * @public
 */
export const unlockCommand = defineCommand({
	meta: {
		name: "unlock",
		description: "Remove config lock (requires --reason)",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		reason: {
			type: "string",
			description: "Mandatory reason for unlocking (audit trail)",
			required: true,
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
		if (!args.reason) {
			forgeLogger.error("--reason is required. Provide a reason for unlocking the config.");
			process.exit(1);
		}

		const output = await runUnlock({
			cwd: args.cwd,
			reason: args.reason,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
		};

		emitResult(output, flags, (data) => formatUnlockHuman(data));

		process.exit(resolveExitCode(output));
	},
});
