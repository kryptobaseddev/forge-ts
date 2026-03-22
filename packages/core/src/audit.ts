/**
 * Append-only audit trail for forge-ts configuration and governance events.
 *
 * Events are stored as JSON Lines in `.forge-audit.jsonl` at the project root.
 * Each line is a single JSON object — the file is never truncated or overwritten.
 *
 * @packageDocumentation
 * @public
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Discriminated event types recorded in the audit trail.
 *
 * @since 0.10.0
 * @public
 */
export type AuditEventType =
	| "config.lock"
	| "config.unlock"
	| "config.drift"
	| "bypass.create"
	| "bypass.expire"
	| "rule.change";

/**
 * A single audit event recorded in the forge-ts audit trail.
 *
 * @since 0.10.0
 * @public
 */
export interface AuditEvent {
	/** ISO 8601 timestamp of when the event occurred. */
	timestamp: string;
	/** Discriminated event type. */
	event: AuditEventType;
	/** OS username of the actor (falls back to "unknown"). */
	user: string;
	/**
	 * Mandatory for lock/unlock/bypass events; optional otherwise.
	 * @defaultValue undefined
	 */
	reason?: string;
	/** Event-specific payload. */
	details: Record<string, unknown>;
}

/** Default filename for the audit trail. */
const AUDIT_FILENAME = ".forge-audit.jsonl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current OS username, or "unknown" if unavailable.
 *
 * @returns The OS username string.
 * @example
 * ```typescript
 * import { getCurrentUser } from "@forge-ts/core/audit";
 * const user = getCurrentUser(); // e.g. "alice"
 * ```
 * @internal
 */
export function getCurrentUser(): string {
	try {
		return userInfo().username;
	} catch {
		return "unknown";
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Appends a single audit event to the `.forge-audit.jsonl` file.
 *
 * @remarks
 * Creates the file if it does not exist. The file is strictly append-only —
 * existing content is never modified or truncated.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @param event - The audit event to record.
 * @example
 * ```typescript
 * import { appendAuditEvent } from "@forge-ts/core";
 * const event = { timestamp: new Date().toISOString(), event: "config.lock" as const, user: "alice", reason: "Stabilize", details: {} };
 * appendAuditEvent("/path/to/project", event);
 * ```
 * @since 0.10.0
 * @public
 */
export function appendAuditEvent(rootDir: string, event: AuditEvent): void {
	const filePath = join(rootDir, AUDIT_FILENAME);
	appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf-8");
}

/**
 * Options for reading the audit log.
 *
 * @since 0.10.0
 * @public
 */
export interface ReadAuditOptions {
	/**
	 * Maximum number of events to return.
	 * @defaultValue undefined
	 */
	limit?: number;
	/**
	 * Filter to a single event type.
	 * @defaultValue undefined
	 */
	eventType?: AuditEventType;
}

/**
 * Reads the `.forge-audit.jsonl` file and returns parsed audit events.
 *
 * @remarks
 * Returns newest events first. If the file does not exist, returns an empty
 * array. Invalid JSON lines are silently skipped.
 *
 * @param rootDir - Absolute path to the project root directory.
 * @param options - Optional limit and event type filter.
 * @returns Array of audit events, newest first.
 * @example
 * ```typescript
 * import { readAuditLog } from "@forge-ts/core";
 * const events = readAuditLog("/path/to/project", { limit: 10 });
 * console.log(events.length); // up to 10
 * ```
 * @since 0.10.0
 * @public
 */
export function readAuditLog(rootDir: string, options?: ReadAuditOptions): AuditEvent[] {
	const filePath = join(rootDir, AUDIT_FILENAME);
	if (!existsSync(filePath)) {
		return [];
	}

	const raw = readFileSync(filePath, "utf-8");
	const lines = raw.split("\n").filter((line) => line.trim().length > 0);

	let events: AuditEvent[] = lines.map((line) => JSON.parse(line) as AuditEvent);

	// Filter by event type if specified
	if (options?.eventType) {
		events = events.filter((e) => e.event === options.eventType);
	}

	// Newest first
	events.reverse();

	// Apply limit
	if (options?.limit !== undefined && options.limit >= 0) {
		events = events.slice(0, options.limit);
	}

	return events;
}

/**
 * Formats a single audit event as a human-readable string.
 *
 * @remarks
 * Produces a single-line representation suitable for terminal output or
 * log files. Includes the timestamp, event type, user, reason, and details.
 *
 * @param event - The audit event to format.
 * @returns A single-line human-readable representation.
 * @example
 * ```typescript
 * import { formatAuditEvent } from "@forge-ts/core";
 * const event = { timestamp: "2026-03-21T12:00:00.000Z", event: "config.lock" as const, user: "alice", reason: "Stabilize", details: {} };
 * const line = formatAuditEvent(event);
 * console.log(line);
 * ```
 * @since 0.10.0
 * @public
 */
export function formatAuditEvent(event: AuditEvent): string {
	const reasonPart = event.reason ? ` — ${event.reason}` : "";
	const detailKeys = Object.keys(event.details);
	const detailPart = detailKeys.length > 0 ? `  ${JSON.stringify(event.details)}` : "";

	return `[${event.timestamp}] ${event.event} by ${event.user}${reasonPart}${detailPart}`;
}
