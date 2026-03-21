/**
 * Bypass budget system for forge-ts config governance.
 *
 * Allows agents to temporarily bypass locked rules with a limited daily budget.
 * Each bypass requires a mandatory justification and expires after a configurable
 * duration. All bypass events are recorded in the audit trail.
 *
 * Bypass records are stored in `.forge-bypass.json` at the project root as a
 * JSON array of {@link BypassRecord} objects.
 *
 * @packageDocumentation
 * @public
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { appendAuditEvent } from "./audit.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the bypass budget system.
 *
 * @public
 */
export interface BypassConfig {
	/** Maximum number of bypasses allowed per calendar day. Default: 3 */
	dailyBudget: number;
	/** Duration in hours before a bypass automatically expires. Default: 24 */
	durationHours: number;
}

/**
 * A single bypass record stored in `.forge-bypass.json`.
 *
 * @public
 */
export interface BypassRecord {
	/** Unique identifier for this bypass. */
	id: string;
	/** ISO 8601 timestamp when the bypass was created. */
	createdAt: string;
	/** ISO 8601 timestamp when the bypass expires. */
	expiresAt: string;
	/** Mandatory justification for why the bypass was created. */
	reason: string;
	/** Specific rule code bypassed (e.g., "E009"), or "all" for a blanket bypass. */
	rule: string;
	/** OS username of the actor who created the bypass. */
	user: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default filename for the bypass records. */
const BYPASS_FILENAME = ".forge-bypass.json";

/** Default bypass configuration values. */
const DEFAULT_BYPASS_CONFIG: BypassConfig = {
	dailyBudget: 3,
	durationHours: 24,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current OS username, or "unknown" if unavailable.
 *
 * @returns The OS username string.
 * @internal
 */
function getCurrentUser(): string {
	try {
		return userInfo().username;
	} catch {
		return "unknown";
	}
}

/**
 * Reads the raw bypass records from `.forge-bypass.json`.
 * Returns an empty array if the file does not exist or contains invalid JSON.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns Array of all bypass records (including expired).
 * @internal
 */
function readBypassFile(rootDir: string): BypassRecord[] {
	const filePath = join(rootDir, BYPASS_FILENAME);
	if (!existsSync(filePath)) {
		return [];
	}
	try {
		const raw = readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as BypassRecord[];
	} catch {
		return [];
	}
}

/**
 * Writes bypass records to `.forge-bypass.json`.
 *
 * @param rootDir - Absolute path to the project root.
 * @param records - Array of bypass records to write.
 * @internal
 */
function writeBypassFile(rootDir: string, records: BypassRecord[]): void {
	const filePath = join(rootDir, BYPASS_FILENAME);
	writeFileSync(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf-8");
}

/**
 * Merges user-provided bypass config with defaults.
 *
 * @param config - Partial bypass configuration.
 * @returns Fully-resolved bypass configuration.
 * @internal
 */
function resolveConfig(config?: Partial<BypassConfig>): BypassConfig {
	return {
		...DEFAULT_BYPASS_CONFIG,
		...config,
	};
}

/**
 * Returns the start of the current UTC day as a Date object.
 *
 * @returns Date representing midnight UTC of the current day.
 * @internal
 */
function startOfToday(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new bypass record, writes it to `.forge-bypass.json`, and appends
 * an audit event.
 *
 * Throws an error if the daily budget is exhausted.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @param reason - Mandatory justification for the bypass.
 * @param rule - Specific rule code to bypass (e.g., "E009"), or "all". Defaults to "all".
 * @param config - Optional bypass budget configuration overrides.
 * @returns The created bypass record.
 * @throws Error when the daily bypass budget is exhausted.
 * @example
 * ```typescript
 * import { createBypass } from "@forge-ts/core";
 * const bypass = createBypass("/path/to/project", "hotfix for release", "E009");
 * console.log(bypass.id); // unique bypass ID
 * ```
 * @public
 */
export function createBypass(
	rootDir: string,
	reason: string,
	rule?: string,
	config?: Partial<BypassConfig>,
): BypassRecord {
	const resolved = resolveConfig(config);
	const remaining = getRemainingBudget(rootDir, config);

	if (remaining <= 0) {
		throw new Error(
			`Bypass budget exhausted: ${resolved.dailyBudget}/${resolved.dailyBudget} bypasses used today. ` +
				"Wait until tomorrow or increase bypass.dailyBudget in your forge-ts config.",
		);
	}

	const now = new Date();
	const expiresAt = new Date(now.getTime() + resolved.durationHours * 60 * 60 * 1000);

	const record: BypassRecord = {
		id: randomUUID(),
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
		reason,
		rule: rule ?? "all",
		user: getCurrentUser(),
	};

	// Read existing records and append the new one
	const records = readBypassFile(rootDir);
	records.push(record);
	writeBypassFile(rootDir, records);

	// Append audit event
	appendAuditEvent(rootDir, {
		timestamp: record.createdAt,
		event: "bypass.create",
		user: record.user,
		reason,
		details: {
			bypassId: record.id,
			rule: record.rule,
			expiresAt: record.expiresAt,
			durationHours: resolved.durationHours,
		},
	});

	return record;
}

/**
 * Returns all currently active (non-expired) bypass records.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @returns Array of active bypass records.
 * @example
 * ```typescript
 * import { getActiveBypasses } from "@forge-ts/core";
 * const active = getActiveBypasses("/path/to/project");
 * console.log(`${active.length} active bypass(es)`);
 * ```
 * @public
 */
export function getActiveBypasses(rootDir: string): BypassRecord[] {
	const records = readBypassFile(rootDir);
	const now = new Date();
	return records.filter((r) => new Date(r.expiresAt) > now);
}

/**
 * Checks whether a specific rule has an active bypass.
 *
 * A rule is considered bypassed if there is an active bypass with the exact
 * rule code or an "all" bypass.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @param ruleCode - The rule code to check (e.g., "E009", "E010").
 * @returns `true` if the rule is currently bypassed.
 * @example
 * ```typescript
 * import { isRuleBypassed } from "@forge-ts/core";
 * if (isRuleBypassed("/path/to/project", "E009")) {
 *   console.log("E009 is currently bypassed");
 * }
 * ```
 * @public
 */
export function isRuleBypassed(rootDir: string, ruleCode: string): boolean {
	const active = getActiveBypasses(rootDir);
	return active.some((r) => r.rule === ruleCode || r.rule === "all");
}

/**
 * Returns the number of bypass budget slots remaining for today.
 *
 * Counts bypasses created today (UTC) against the configured daily budget.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @param config - Optional bypass budget configuration overrides.
 * @returns Number of remaining bypass slots for today.
 * @example
 * ```typescript
 * import { getRemainingBudget } from "@forge-ts/core";
 * const remaining = getRemainingBudget("/path/to/project");
 * console.log(`${remaining} bypass(es) remaining today`);
 * ```
 * @public
 */
export function getRemainingBudget(rootDir: string, config?: Partial<BypassConfig>): number {
	const resolved = resolveConfig(config);
	const records = readBypassFile(rootDir);
	const todayStart = startOfToday();

	const todayCount = records.filter((r) => new Date(r.createdAt) >= todayStart).length;

	return Math.max(0, resolved.dailyBudget - todayCount);
}

/**
 * Removes expired bypass records from `.forge-bypass.json`.
 *
 * Also appends a `bypass.expire` audit event for each expired record removed.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @returns The number of expired records removed.
 * @example
 * ```typescript
 * import { expireOldBypasses } from "@forge-ts/core";
 * const removed = expireOldBypasses("/path/to/project");
 * console.log(`${removed} expired bypass(es) removed`);
 * ```
 * @public
 */
export function expireOldBypasses(rootDir: string): number {
	const records = readBypassFile(rootDir);
	const now = new Date();

	const active = records.filter((r) => new Date(r.expiresAt) > now);
	const expired = records.filter((r) => new Date(r.expiresAt) <= now);

	if (expired.length === 0) {
		return 0;
	}

	// Write back only active records
	writeBypassFile(rootDir, active);

	// Append audit events for each expired bypass
	for (const record of expired) {
		appendAuditEvent(rootDir, {
			timestamp: now.toISOString(),
			event: "bypass.expire",
			user: record.user,
			details: {
				bypassId: record.id,
				rule: record.rule,
				createdAt: record.createdAt,
				expiresAt: record.expiresAt,
			},
		});
	}

	return expired.length;
}
