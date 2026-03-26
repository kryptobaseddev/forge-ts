/**
 * `forge-ts lock` command — snapshots the current config and creates `.forge-lock.json`.
 *
 * This prevents LLM agents from silently weakening project settings.
 * Once locked, any attempt to weaken rule severities or disable guards
 * will cause `forge-ts check` to fail until `forge-ts unlock --reason=...`
 * is run.
 *
 * @packageDocumentation
 * @internal
 */

import {
	appendAuditEvent,
	createLockManifest,
	loadConfig,
	readLockFile,
	writeLockFile,
} from "@forge-ts/core";
import { defineCommand } from "citty";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Typed result for the `lock` command.
 * @public
 */
export interface LockResult {
	/** Whether the lock was successfully created. */
	success: boolean;
	/** Path to the lock file that was written. */
	lockFile: string;
	/** ISO-8601 timestamp when the lock was created. */
	lockedAt: string;
	/** Identifier of who created the lock. */
	lockedBy: string;
	/** Summary of what was locked. */
	locked: {
		/** Number of enforce rules captured. */
		rules: number;
		/** Whether tsconfig guard settings were captured. */
		tsconfig: boolean;
		/** Whether biome guard settings were captured. */
		biome: boolean;
	};
	/** Whether a previous lock file was overwritten. */
	overwrote: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the lock command: reads current config and creates `.forge-lock.json`.
 *
 * @remarks
 * Loads the project config, snapshots enforce rules and guard settings into a lock manifest, writes `.forge-lock.json`, and appends an audit event.
 *
 * @param args - CLI arguments for the lock command.
 * @returns A typed `CommandOutput<LockResult>`.
 * @example
 * ```typescript
 * import { runLock } from "@forge-ts/cli/commands/lock";
 * const output = await runLock({ cwd: process.cwd() });
 * console.log(output.data.locked.rules); // number of rules locked
 * ```
 * @public
 */
export async function runLock(args: { cwd?: string }): Promise<CommandOutput<LockResult>> {
	const config = await loadConfig(args.cwd);
	const rootDir = config.rootDir;

	const existingLock = readLockFile(rootDir);
	const manifest = createLockManifest(config);
	writeLockFile(rootDir, manifest);

	appendAuditEvent(rootDir, {
		timestamp: manifest.lockedAt,
		event: "config.lock",
		user: manifest.lockedBy,
		details: {
			rules: Object.keys(manifest.config.rules).length,
			tsconfig: manifest.config.tsconfig !== undefined,
			biome: manifest.config.biome !== undefined,
			overwrote: existingLock !== null,
		},
	});

	const lockFile = `${rootDir}/.forge-lock.json`;
	const data: LockResult = {
		success: true,
		lockFile,
		lockedAt: manifest.lockedAt,
		lockedBy: manifest.lockedBy,
		locked: {
			rules: Object.keys(manifest.config.rules).length,
			tsconfig: manifest.config.tsconfig !== undefined,
			biome: manifest.config.biome !== undefined,
		},
		overwrote: existingLock !== null,
	};

	return {
		operation: "lock",
		success: true,
		data,
		duration: 0,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats a LockResult as human-readable text.
 * @internal
 */
function formatLockHuman(result: LockResult): string {
	const lines: string[] = [];

	if (result.overwrote) {
		lines.push("forge-ts lock: updated existing lock\n");
	} else {
		lines.push("forge-ts lock: created .forge-lock.json\n");
	}

	lines.push(`  Locked ${result.locked.rules} enforce rule(s)`);
	if (result.locked.tsconfig) {
		lines.push("  Locked tsconfig guard settings");
	}
	if (result.locked.biome) {
		lines.push("  Locked biome guard settings");
	}
	lines.push(`\n  Locked by: ${result.lockedBy}`);
	lines.push(`  Locked at: ${result.lockedAt}`);
	lines.push(`\n  To modify locked settings, run: forge-ts unlock --reason="..."`);

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts lock`.
 * @public
 */
export const lockCommand = defineCommand({
	meta: {
		name: "lock",
		description: "Lock current config to prevent silent weakening",
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
	},
	async run({ args }) {
		const output = await runLock({ cwd: args.cwd });

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
		};

		emitResult(output, flags, (data) => formatLockHuman(data));

		process.exit(resolveExitCode(output));
	},
});
