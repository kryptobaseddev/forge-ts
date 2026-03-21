/**
 * Config locking system for forge-ts.
 *
 * Prevents LLM agents from silently weakening project settings by snapshotting
 * the current config state and validating it on every subsequent run.
 *
 * @packageDocumentation
 * @public
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ForgeConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Lock file name
// ---------------------------------------------------------------------------

/**
 * Default lock file name placed in the project root.
 * @internal
 */
const LOCK_FILE_NAME = ".forge-lock.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Manifest stored in `.forge-lock.json`.
 * Captures a point-in-time snapshot of the project's forge-ts configuration
 * so that future runs can detect when settings have been weakened.
 *
 * @public
 */
export interface ForgeLockManifest {
	/** Schema version of the lock manifest. */
	version: string;
	/** ISO-8601 timestamp when the lock was created. */
	lockedAt: string;
	/** Identifier of the user or agent that created the lock. */
	lockedBy: string;
	/** Snapshot of locked configuration values. */
	config: {
		/** Rule name to severity mapping from enforce.rules. */
		rules: Record<string, string>;
		/** tsconfig guard settings, if readable at lock time. */
		tsconfig?: Record<string, unknown>;
		/** Biome guard settings, if readable at lock time. */
		biome?: Record<string, unknown>;
	};
}

/**
 * A single violation found when comparing current config against the lock.
 *
 * @public
 */
export interface LockViolation {
	/** Dot-path of the config field that changed (e.g., "rules.require-summary"). */
	field: string;
	/** The value stored in the lock file. */
	locked: string;
	/** The current value in the live config. */
	current: string;
	/** Human-readable explanation of the violation. */
	message: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads the `.forge-lock.json` file from the given project root.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns The parsed lock manifest, or `null` if no lock file exists or is invalid.
 * @example
 * ```typescript
 * import { readLockFile } from "@forge-ts/core";
 * const lock = readLockFile("/path/to/project");
 * if (lock) {
 *   console.log(`Locked at ${lock.lockedAt} by ${lock.lockedBy}`);
 * }
 * ```
 * @public
 */
export function readLockFile(rootDir: string): ForgeLockManifest | null {
	const lockPath = join(rootDir, LOCK_FILE_NAME);
	if (!existsSync(lockPath)) {
		return null;
	}
	try {
		const raw = readFileSync(lockPath, "utf8");
		return JSON.parse(raw) as ForgeLockManifest;
	} catch {
		return null;
	}
}

/**
 * Writes a {@link ForgeLockManifest} to `.forge-lock.json` in the project root.
 *
 * @param rootDir - Absolute path to the project root.
 * @param manifest - The lock manifest to write.
 * @example
 * ```typescript
 * import { writeLockFile, createLockManifest, loadConfig } from "@forge-ts/core";
 * const config = await loadConfig("/path/to/project");
 * const manifest = createLockManifest(config);
 * writeLockFile("/path/to/project", manifest);
 * ```
 * @public
 */
export function writeLockFile(rootDir: string, manifest: ForgeLockManifest): void {
	const lockPath = join(rootDir, LOCK_FILE_NAME);
	writeFileSync(lockPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/**
 * Removes the `.forge-lock.json` file from the project root.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns `true` if the file existed and was removed, `false` otherwise.
 * @example
 * ```typescript
 * import { removeLockFile } from "@forge-ts/core";
 * const removed = removeLockFile("/path/to/project");
 * console.log(removed ? "Lock removed" : "No lock file found");
 * ```
 * @public
 */
export function removeLockFile(rootDir: string): boolean {
	const lockPath = join(rootDir, LOCK_FILE_NAME);
	if (!existsSync(lockPath)) {
		return false;
	}
	try {
		unlinkSync(lockPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Creates a {@link ForgeLockManifest} from the current project config.
 *
 * Snapshots the enforce rule severities and guard settings so they can
 * be compared on future runs to detect weakening.
 *
 * @param config - The fully-resolved {@link ForgeConfig} to snapshot.
 * @param lockedBy - Identifier of the user or agent creating the lock. Defaults to `"forge-ts lock"`.
 * @returns A new lock manifest ready to be written with {@link writeLockFile}.
 * @example
 * ```typescript
 * import { createLockManifest, loadConfig } from "@forge-ts/core";
 * const config = await loadConfig();
 * const manifest = createLockManifest(config);
 * console.log(manifest.config.rules); // { "require-summary": "error", ... }
 * ```
 * @public
 */
export function createLockManifest(
	config: ForgeConfig,
	lockedBy: string = "forge-ts lock",
): ForgeLockManifest {
	const rules: Record<string, string> = {};
	for (const [key, value] of Object.entries(config.enforce.rules)) {
		rules[key] = value;
	}

	const lockConfig: ForgeLockManifest["config"] = { rules };

	// Snapshot tsconfig guard settings if enabled
	if (config.guards.tsconfig.enabled) {
		lockConfig.tsconfig = {
			enabled: config.guards.tsconfig.enabled,
			requiredFlags: config.guards.tsconfig.requiredFlags,
		};
	}

	// Snapshot biome guard settings if enabled
	if (config.guards.biome.enabled) {
		lockConfig.biome = {
			enabled: config.guards.biome.enabled,
			lockedRules: config.guards.biome.lockedRules,
		};
	}

	return {
		version: "1.0.0",
		lockedAt: new Date().toISOString(),
		lockedBy,
		config: lockConfig,
	};
}

/**
 * Validates the current config against a locked manifest.
 *
 * Returns an array of violations where the current config has weakened
 * settings relative to the locked state. Weakening means:
 * - A rule severity changed from `"error"` to `"warn"` or `"off"`
 * - A rule severity changed from `"warn"` to `"off"`
 * - A tsconfig guard was disabled
 * - A required tsconfig flag was removed
 * - A biome guard was disabled
 * - A locked biome rule was removed
 *
 * @param config - The current fully-resolved {@link ForgeConfig}.
 * @param lock - The lock manifest to validate against.
 * @returns An array of {@link LockViolation} entries. Empty means no weakening detected.
 * @example
 * ```typescript
 * import { validateAgainstLock, readLockFile, loadConfig } from "@forge-ts/core";
 * const config = await loadConfig();
 * const lock = readLockFile(config.rootDir);
 * if (lock) {
 *   const violations = validateAgainstLock(config, lock);
 *   for (const v of violations) {
 *     console.error(`LOCK VIOLATION: ${v.message}`);
 *   }
 * }
 * ```
 * @public
 */
export function validateAgainstLock(config: ForgeConfig, lock: ForgeLockManifest): LockViolation[] {
	const violations: LockViolation[] = [];

	// Severity ranking: higher number = stricter
	const severityRank: Record<string, number> = {
		off: 0,
		warn: 1,
		error: 2,
	};

	// Check rule severities
	for (const [ruleName, lockedSeverity] of Object.entries(lock.config.rules)) {
		const currentSeverity =
			(config.enforce.rules as unknown as Record<string, string>)[ruleName] ?? "off";
		const lockedRank = severityRank[lockedSeverity] ?? 0;
		const currentRank = severityRank[currentSeverity] ?? 0;

		if (currentRank < lockedRank) {
			violations.push({
				field: `rules.${ruleName}`,
				locked: lockedSeverity,
				current: currentSeverity,
				message: `Rule "${ruleName}" was weakened from "${lockedSeverity}" to "${currentSeverity}". Locked settings cannot be weakened without running "forge-ts unlock --reason=...".`,
			});
		}
	}

	// Check tsconfig guard settings
	if (lock.config.tsconfig) {
		const lockedTsconfig = lock.config.tsconfig as {
			enabled?: boolean;
			requiredFlags?: string[];
		};

		// Guard was disabled
		if (lockedTsconfig.enabled && !config.guards.tsconfig.enabled) {
			violations.push({
				field: "guards.tsconfig.enabled",
				locked: "true",
				current: "false",
				message:
					'tsconfig guard was disabled. Locked settings cannot be weakened without running "forge-ts unlock --reason=...".',
			});
		}

		// Required flags removed
		if (lockedTsconfig.requiredFlags && config.guards.tsconfig.enabled) {
			const currentFlags = new Set(config.guards.tsconfig.requiredFlags);
			for (const flag of lockedTsconfig.requiredFlags) {
				if (!currentFlags.has(flag)) {
					violations.push({
						field: `guards.tsconfig.requiredFlags.${flag}`,
						locked: flag,
						current: "(removed)",
						message: `tsconfig required flag "${flag}" was removed. Locked settings cannot be weakened without running "forge-ts unlock --reason=...".`,
					});
				}
			}
		}
	}

	// Check biome guard settings
	if (lock.config.biome) {
		const lockedBiome = lock.config.biome as {
			enabled?: boolean;
			lockedRules?: string[];
		};

		// Guard was disabled
		if (lockedBiome.enabled && !config.guards.biome.enabled) {
			violations.push({
				field: "guards.biome.enabled",
				locked: "true",
				current: "false",
				message:
					'Biome guard was disabled. Locked settings cannot be weakened without running "forge-ts unlock --reason=...".',
			});
		}

		// Locked rules removed
		if (lockedBiome.lockedRules && config.guards.biome.enabled) {
			const currentRules = new Set(config.guards.biome.lockedRules);
			for (const rule of lockedBiome.lockedRules) {
				if (!currentRules.has(rule)) {
					violations.push({
						field: `guards.biome.lockedRules.${rule}`,
						locked: rule,
						current: "(removed)",
						message: `Biome locked rule "${rule}" was removed. Locked settings cannot be weakened without running "forge-ts unlock --reason=...".`,
					});
				}
			}
		}
	}

	return violations;
}
