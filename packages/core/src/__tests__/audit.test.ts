import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type AuditEvent,
	type AuditEventType,
	appendAuditEvent,
	formatAuditEvent,
	readAuditLog,
} from "../audit.js";

// ---------------------------------------------------------------------------
// Test isolation: each test gets a fresh temp directory
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
	testDir = join(tmpdir(), `forge-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		timestamp: new Date().toISOString(),
		event: "config.lock" as AuditEventType,
		user: "testuser",
		details: {},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// appendAuditEvent
// ---------------------------------------------------------------------------

describe("appendAuditEvent", () => {
	it("creates the audit file if it does not exist", () => {
		const filePath = join(testDir, ".forge-audit.jsonl");
		expect(existsSync(filePath)).toBe(false);

		appendAuditEvent(testDir, makeEvent());

		expect(existsSync(filePath)).toBe(true);
	});

	it("writes valid JSON on each line", () => {
		appendAuditEvent(testDir, makeEvent({ event: "config.lock" }));
		appendAuditEvent(testDir, makeEvent({ event: "config.unlock" }));

		const raw = readFileSync(join(testDir, ".forge-audit.jsonl"), "utf-8");
		const lines = raw.split("\n").filter((l) => l.trim().length > 0);

		expect(lines).toHaveLength(2);

		// Each line must be valid JSON
		for (const line of lines) {
			expect(() => JSON.parse(line)).not.toThrow();
		}
	});

	it("preserves all event fields in the JSON output", () => {
		const event = makeEvent({
			timestamp: "2026-03-21T12:00:00.000Z",
			event: "bypass.create",
			user: "alice",
			reason: "emergency hotfix",
			details: { ruleId: "E001", duration: 3600 },
		});

		appendAuditEvent(testDir, event);

		const raw = readFileSync(join(testDir, ".forge-audit.jsonl"), "utf-8");
		const parsed = JSON.parse(raw.trim()) as AuditEvent;

		expect(parsed.timestamp).toBe("2026-03-21T12:00:00.000Z");
		expect(parsed.event).toBe("bypass.create");
		expect(parsed.user).toBe("alice");
		expect(parsed.reason).toBe("emergency hotfix");
		expect(parsed.details).toEqual({ ruleId: "E001", duration: 3600 });
	});

	it("is truly append-only — does not overwrite existing events", () => {
		const first = makeEvent({ event: "config.lock", reason: "first" });
		const second = makeEvent({ event: "config.unlock", reason: "second" });
		const third = makeEvent({ event: "rule.change", reason: "third" });

		appendAuditEvent(testDir, first);
		appendAuditEvent(testDir, second);
		appendAuditEvent(testDir, third);

		const raw = readFileSync(join(testDir, ".forge-audit.jsonl"), "utf-8");
		const lines = raw.split("\n").filter((l) => l.trim().length > 0);

		expect(lines).toHaveLength(3);

		const parsed = lines.map((l) => JSON.parse(l) as AuditEvent);
		expect(parsed[0].reason).toBe("first");
		expect(parsed[1].reason).toBe("second");
		expect(parsed[2].reason).toBe("third");
	});

	it("each line ends with a newline (JSON Lines format)", () => {
		appendAuditEvent(testDir, makeEvent());

		const raw = readFileSync(join(testDir, ".forge-audit.jsonl"), "utf-8");
		expect(raw.endsWith("\n")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// readAuditLog
// ---------------------------------------------------------------------------

describe("readAuditLog", () => {
	it("returns an empty array when the file does not exist", () => {
		const events = readAuditLog(testDir);
		expect(events).toEqual([]);
	});

	it("reads events and returns newest first", () => {
		appendAuditEvent(
			testDir,
			makeEvent({ timestamp: "2026-01-01T00:00:00.000Z", reason: "first" }),
		);
		appendAuditEvent(
			testDir,
			makeEvent({ timestamp: "2026-01-02T00:00:00.000Z", reason: "second" }),
		);
		appendAuditEvent(
			testDir,
			makeEvent({ timestamp: "2026-01-03T00:00:00.000Z", reason: "third" }),
		);

		const events = readAuditLog(testDir);

		expect(events).toHaveLength(3);
		expect(events[0].reason).toBe("third");
		expect(events[1].reason).toBe("second");
		expect(events[2].reason).toBe("first");
	});

	it("respects the limit option", () => {
		for (let i = 0; i < 10; i++) {
			appendAuditEvent(testDir, makeEvent({ reason: `event-${i}` }));
		}

		const events = readAuditLog(testDir, { limit: 3 });

		expect(events).toHaveLength(3);
		// Newest first, so event-9 is first
		expect(events[0].reason).toBe("event-9");
		expect(events[1].reason).toBe("event-8");
		expect(events[2].reason).toBe("event-7");
	});

	it("filters by eventType", () => {
		appendAuditEvent(testDir, makeEvent({ event: "config.lock", reason: "lock-1" }));
		appendAuditEvent(testDir, makeEvent({ event: "config.unlock", reason: "unlock-1" }));
		appendAuditEvent(testDir, makeEvent({ event: "config.lock", reason: "lock-2" }));
		appendAuditEvent(testDir, makeEvent({ event: "rule.change", reason: "rule-1" }));

		const lockEvents = readAuditLog(testDir, { eventType: "config.lock" });

		expect(lockEvents).toHaveLength(2);
		expect(lockEvents.every((e) => e.event === "config.lock")).toBe(true);
	});

	it("combines limit and eventType filters", () => {
		for (let i = 0; i < 5; i++) {
			appendAuditEvent(testDir, makeEvent({ event: "config.drift", reason: `drift-${i}` }));
		}
		appendAuditEvent(testDir, makeEvent({ event: "config.lock", reason: "lock" }));

		const events = readAuditLog(testDir, { eventType: "config.drift", limit: 2 });

		expect(events).toHaveLength(2);
		expect(events[0].reason).toBe("drift-4");
		expect(events[1].reason).toBe("drift-3");
	});

	it("returns all events when limit exceeds total", () => {
		appendAuditEvent(testDir, makeEvent({ reason: "only-one" }));

		const events = readAuditLog(testDir, { limit: 100 });

		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("only-one");
	});
});

// ---------------------------------------------------------------------------
// formatAuditEvent
// ---------------------------------------------------------------------------

describe("formatAuditEvent", () => {
	it("formats an event with a reason", () => {
		const event = makeEvent({
			timestamp: "2026-03-21T12:00:00.000Z",
			event: "config.lock",
			user: "alice",
			reason: "Stabilize v2",
			details: {},
		});

		const formatted = formatAuditEvent(event);

		expect(formatted).toBe("[2026-03-21T12:00:00.000Z] config.lock by alice — Stabilize v2");
	});

	it("formats an event without a reason", () => {
		const event = makeEvent({
			timestamp: "2026-03-21T12:00:00.000Z",
			event: "config.drift",
			user: "bob",
			details: {},
		});
		// Remove reason explicitly
		delete event.reason;

		const formatted = formatAuditEvent(event);

		expect(formatted).toBe("[2026-03-21T12:00:00.000Z] config.drift by bob");
	});

	it("includes details as JSON when present", () => {
		const event = makeEvent({
			timestamp: "2026-03-21T12:00:00.000Z",
			event: "rule.change",
			user: "charlie",
			details: { rule: "E001", from: "error", to: "warn" },
		});
		delete event.reason;

		const formatted = formatAuditEvent(event);

		expect(formatted).toContain("[2026-03-21T12:00:00.000Z] rule.change by charlie");
		expect(formatted).toContain('"rule":"E001"');
		expect(formatted).toContain('"from":"error"');
		expect(formatted).toContain('"to":"warn"');
	});

	it("includes both reason and details", () => {
		const event = makeEvent({
			timestamp: "2026-03-21T12:00:00.000Z",
			event: "bypass.create",
			user: "dave",
			reason: "hotfix",
			details: { ttl: 3600 },
		});

		const formatted = formatAuditEvent(event);

		expect(formatted).toContain("bypass.create by dave — hotfix");
		expect(formatted).toContain('"ttl":3600');
	});
});
