/**
 * CLI command for reading the forge-ts audit trail.
 *
 * Reads `.forge-audit.jsonl` from the project root and displays events
 * in human-readable or LAFS JSON format.
 *
 * @packageDocumentation
 * @internal
 */

import {
	type AuditEvent,
	type AuditEventType,
	formatAuditEvent,
	readAuditLog,
} from "@forge-ts/core";
import { defineCommand } from "citty";
import { forgeLogger } from "../forge-logger.js";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Arguments for the `audit` command.
 *
 * @internal
 */
export interface AuditArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Maximum number of events to display (default: 20). */
	limit?: number;
	/** Filter events by type. */
	type?: AuditEventType;
}

/**
 * Typed result for the `audit` command.
 *
 * @public
 */
export interface AuditResult {
	/** Whether the audit log was read successfully. */
	success: boolean;
	/** Number of events returned. */
	count: number;
	/** The audit events, newest first. */
	events: AuditEvent[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads the audit log and returns a typed command output.
 *
 * @param args - CLI arguments for the audit command.
 * @returns A typed `CommandOutput<AuditResult>`.
 * @example
 * ```typescript
 * import { runAudit } from "@forge-ts/cli/commands/audit";
 * const output = await runAudit({ cwd: process.cwd(), limit: 10 });
 * console.log(output.data.count); // number of events returned
 * ```
 * @public
 */
export function runAudit(args: AuditArgs): CommandOutput<AuditResult> {
	const rootDir = args.cwd ?? process.cwd();
	const limit = args.limit ?? 20;

	const events = readAuditLog(rootDir, {
		limit,
		eventType: args.type,
	});

	const data: AuditResult = {
		success: true,
		count: events.length,
		events,
	};

	return {
		operation: "audit",
		success: true,
		data,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats an AuditResult as human-readable text.
 *
 * @param data - The audit result to format.
 * @returns Formatted multi-line string.
 * @internal
 */
function formatAuditHuman(data: AuditResult): string {
	if (data.count === 0) {
		return "forge-ts audit: no events found.";
	}

	const lines: string[] = [];
	lines.push(`forge-ts audit: ${data.count} event(s)\n`);

	for (const event of data.events) {
		lines.push(`  ${formatAuditEvent(event)}`);
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command
// ---------------------------------------------------------------------------

/** Valid event types for the --type filter. */
const VALID_EVENT_TYPES: string[] = [
	"config.lock",
	"config.unlock",
	"config.drift",
	"bypass.create",
	"bypass.expire",
	"rule.change",
];

/**
 * Citty command definition for `forge-ts audit`.
 *
 * @public
 */
export const auditCommand = defineCommand({
	meta: {
		name: "audit",
		description: "Display the forge-ts audit trail",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		limit: {
			type: "string",
			description: "Maximum events to display (default: 20)",
		},
		type: {
			type: "string",
			description:
				"Filter by event type (config.lock, config.unlock, config.drift, bypass.create, bypass.expire, rule.change)",
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
	run({ args }) {
		// Validate --type if provided
		const eventType = args.type as AuditEventType | undefined;
		if (eventType && !VALID_EVENT_TYPES.includes(eventType)) {
			forgeLogger.error(
				`Invalid event type "${eventType}". Valid types: ${VALID_EVENT_TYPES.join(", ")}`,
			);
			process.exit(1);
		}

		const output = runAudit({
			cwd: args.cwd,
			limit: args.limit ? Number.parseInt(args.limit, 10) : undefined,
			type: eventType,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
		};

		emitResult(output, flags, (data) => formatAuditHuman(data));

		process.exit(resolveExitCode(output));
	},
});
