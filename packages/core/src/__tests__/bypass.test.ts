import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAuditLog } from "../audit.js";
import {
	type BypassRecord,
	createBypass,
	expireOldBypasses,
	getActiveBypasses,
	getRemainingBudget,
	isRuleBypassed,
} from "../bypass.js";

// ---------------------------------------------------------------------------
// Test isolation: each test gets a fresh temp directory
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
	testDir = join(
		tmpdir(),
		`forge-bypass-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBypassFile(rootDir: string): BypassRecord[] {
	const filePath = join(rootDir, ".forge-bypass.json");
	if (!existsSync(filePath)) return [];
	return JSON.parse(readFileSync(filePath, "utf-8")) as BypassRecord[];
}

function writeBypassFile(rootDir: string, records: BypassRecord[]): void {
	writeFileSync(
		join(rootDir, ".forge-bypass.json"),
		`${JSON.stringify(records, null, 2)}\n`,
		"utf-8",
	);
}

// ---------------------------------------------------------------------------
// createBypass
// ---------------------------------------------------------------------------

describe("createBypass", () => {
	it("creates a bypass record and writes to .forge-bypass.json", () => {
		const bypass = createBypass(testDir, "hotfix for release", "E009");

		expect(bypass.id).toBeTruthy();
		expect(bypass.reason).toBe("hotfix for release");
		expect(bypass.rule).toBe("E009");
		expect(bypass.user).toBeTruthy();
		expect(bypass.createdAt).toBeTruthy();
		expect(bypass.expiresAt).toBeTruthy();

		// Verify file was written
		const records = readBypassFile(testDir);
		expect(records).toHaveLength(1);
		expect(records[0].id).toBe(bypass.id);
	});

	it("defaults rule to 'all' when not specified", () => {
		const bypass = createBypass(testDir, "blanket bypass");
		expect(bypass.rule).toBe("all");
	});

	it("appends to existing records rather than overwriting", () => {
		createBypass(testDir, "first bypass", "E009");
		createBypass(testDir, "second bypass", "E010");

		const records = readBypassFile(testDir);
		expect(records).toHaveLength(2);
		expect(records[0].reason).toBe("first bypass");
		expect(records[1].reason).toBe("second bypass");
	});

	it("appends a bypass.create audit event", () => {
		const bypass = createBypass(testDir, "audit trail test", "E009");

		const events = readAuditLog(testDir, { eventType: "bypass.create" });
		expect(events).toHaveLength(1);
		expect(events[0].event).toBe("bypass.create");
		expect(events[0].reason).toBe("audit trail test");
		expect(events[0].details.bypassId).toBe(bypass.id);
		expect(events[0].details.rule).toBe("E009");
	});

	it("sets expiration based on durationHours config", () => {
		const bypass = createBypass(testDir, "custom duration", "E009", {
			durationHours: 48,
		});

		const created = new Date(bypass.createdAt).getTime();
		const expires = new Date(bypass.expiresAt).getTime();
		const diffHours = (expires - created) / (60 * 60 * 1000);

		expect(diffHours).toBeCloseTo(48, 1);
	});

	it("uses default durationHours of 24 when not configured", () => {
		const bypass = createBypass(testDir, "default duration");

		const created = new Date(bypass.createdAt).getTime();
		const expires = new Date(bypass.expiresAt).getTime();
		const diffHours = (expires - created) / (60 * 60 * 1000);

		expect(diffHours).toBeCloseTo(24, 1);
	});
});

// ---------------------------------------------------------------------------
// Budget enforcement
// ---------------------------------------------------------------------------

describe("budget enforcement", () => {
	it("throws when daily budget is exhausted", () => {
		const config = { dailyBudget: 2, durationHours: 24 };

		createBypass(testDir, "first", "E009", config);
		createBypass(testDir, "second", "E010", config);

		expect(() => createBypass(testDir, "third", "E009", config)).toThrow(/Bypass budget exhausted/);
	});

	it("allows bypass when budget has remaining slots", () => {
		const config = { dailyBudget: 3, durationHours: 24 };

		createBypass(testDir, "first", "E009", config);
		createBypass(testDir, "second", "E010", config);

		// Third should succeed (budget is 3)
		expect(() => createBypass(testDir, "third", "E009", config)).not.toThrow();
	});

	it("uses default dailyBudget of 3 when not configured", () => {
		createBypass(testDir, "first");
		createBypass(testDir, "second");
		createBypass(testDir, "third");

		expect(() => createBypass(testDir, "fourth")).toThrow(/Bypass budget exhausted/);
	});

	it("counts all bypasses today regardless of expiration status", () => {
		// Create a bypass that is already expired (but created today)
		const now = new Date();
		const expiredRecord: BypassRecord = {
			id: "expired-today",
			createdAt: now.toISOString(),
			expiresAt: new Date(now.getTime() - 1000).toISOString(), // expired 1s ago
			reason: "expired but created today",
			rule: "E009",
			user: "test",
		};
		writeBypassFile(testDir, [expiredRecord]);

		// Budget of 2: 1 used today (even though expired), 1 remaining
		const config = { dailyBudget: 2, durationHours: 24 };
		createBypass(testDir, "second", "E010", config);

		expect(() => createBypass(testDir, "third", "E009", config)).toThrow(/Bypass budget exhausted/);
	});
});

// ---------------------------------------------------------------------------
// getActiveBypasses
// ---------------------------------------------------------------------------

describe("getActiveBypasses", () => {
	it("returns empty array when no bypass file exists", () => {
		const active = getActiveBypasses(testDir);
		expect(active).toEqual([]);
	});

	it("returns only non-expired bypasses", () => {
		const now = new Date();
		const records: BypassRecord[] = [
			{
				id: "active-1",
				createdAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
				reason: "active",
				rule: "E009",
				user: "test",
			},
			{
				id: "expired-1",
				createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
				reason: "expired",
				rule: "E010",
				user: "test",
			},
		];
		writeBypassFile(testDir, records);

		const active = getActiveBypasses(testDir);
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe("active-1");
	});
});

// ---------------------------------------------------------------------------
// isRuleBypassed
// ---------------------------------------------------------------------------

describe("isRuleBypassed", () => {
	it("returns false when no bypasses exist", () => {
		expect(isRuleBypassed(testDir, "E009")).toBe(false);
	});

	it("returns true for a specific rule bypass", () => {
		createBypass(testDir, "test bypass", "E009");
		expect(isRuleBypassed(testDir, "E009")).toBe(true);
	});

	it("returns false for a different rule", () => {
		createBypass(testDir, "test bypass", "E009");
		expect(isRuleBypassed(testDir, "E010")).toBe(false);
	});

	it('returns true for any rule when bypass rule is "all"', () => {
		createBypass(testDir, "blanket bypass");
		expect(isRuleBypassed(testDir, "E009")).toBe(true);
		expect(isRuleBypassed(testDir, "E010")).toBe(true);
		expect(isRuleBypassed(testDir, "E001")).toBe(true);
	});

	it("returns false when the only bypass is expired", () => {
		const now = new Date();
		const records: BypassRecord[] = [
			{
				id: "expired-1",
				createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(now.getTime() - 1000).toISOString(),
				reason: "expired",
				rule: "E009",
				user: "test",
			},
		];
		writeBypassFile(testDir, records);

		expect(isRuleBypassed(testDir, "E009")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getRemainingBudget
// ---------------------------------------------------------------------------

describe("getRemainingBudget", () => {
	it("returns full budget when no bypasses exist", () => {
		const remaining = getRemainingBudget(testDir, { dailyBudget: 5 });
		expect(remaining).toBe(5);
	});

	it("returns default budget of 3 when no config provided", () => {
		const remaining = getRemainingBudget(testDir);
		expect(remaining).toBe(3);
	});

	it("decrements budget for each bypass created today", () => {
		createBypass(testDir, "first");
		expect(getRemainingBudget(testDir)).toBe(2);

		createBypass(testDir, "second");
		expect(getRemainingBudget(testDir)).toBe(1);
	});

	it("returns 0 when budget is fully consumed, never negative", () => {
		const config = { dailyBudget: 1, durationHours: 24 };
		createBypass(testDir, "only one", "E009", config);
		expect(getRemainingBudget(testDir, config)).toBe(0);
	});

	it("does not count bypasses created on previous days", () => {
		// Manually create a record from yesterday
		const yesterday = new Date();
		yesterday.setUTCDate(yesterday.getUTCDate() - 1);
		yesterday.setUTCHours(12, 0, 0, 0);

		const records: BypassRecord[] = [
			{
				id: "yesterday-1",
				createdAt: yesterday.toISOString(),
				expiresAt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString(),
				reason: "old bypass",
				rule: "E009",
				user: "test",
			},
		];
		writeBypassFile(testDir, records);

		// Full budget available since yesterday's bypass doesn't count
		expect(getRemainingBudget(testDir, { dailyBudget: 3 })).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// expireOldBypasses
// ---------------------------------------------------------------------------

describe("expireOldBypasses", () => {
	it("returns 0 when no bypass file exists", () => {
		const removed = expireOldBypasses(testDir);
		expect(removed).toBe(0);
	});

	it("returns 0 when all bypasses are still active", () => {
		createBypass(testDir, "still active");
		const removed = expireOldBypasses(testDir);
		expect(removed).toBe(0);
	});

	it("removes expired bypasses and keeps active ones", () => {
		const now = new Date();
		const records: BypassRecord[] = [
			{
				id: "active-1",
				createdAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
				reason: "active",
				rule: "E009",
				user: "test",
			},
			{
				id: "expired-1",
				createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(now.getTime() - 1000).toISOString(),
				reason: "expired",
				rule: "E010",
				user: "test",
			},
			{
				id: "expired-2",
				createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
				reason: "very expired",
				rule: "all",
				user: "test",
			},
		];
		writeBypassFile(testDir, records);

		const removed = expireOldBypasses(testDir);
		expect(removed).toBe(2);

		// Verify only active bypass remains
		const remaining = readBypassFile(testDir);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].id).toBe("active-1");
	});

	it("appends bypass.expire audit events for each expired record", () => {
		const now = new Date();
		const records: BypassRecord[] = [
			{
				id: "expired-a",
				createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(now.getTime() - 1000).toISOString(),
				reason: "expired a",
				rule: "E009",
				user: "test",
			},
			{
				id: "expired-b",
				createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(now.getTime() - 2000).toISOString(),
				reason: "expired b",
				rule: "E010",
				user: "test",
			},
		];
		writeBypassFile(testDir, records);

		expireOldBypasses(testDir);

		const events = readAuditLog(testDir, { eventType: "bypass.expire" });
		expect(events).toHaveLength(2);

		const bypassIds = events.map((e) => e.details.bypassId);
		expect(bypassIds).toContain("expired-a");
		expect(bypassIds).toContain("expired-b");
	});
});

// ---------------------------------------------------------------------------
// File format: .forge-bypass.json is a JSON array
// ---------------------------------------------------------------------------

describe("file format", () => {
	it(".forge-bypass.json is a JSON array with 2-space indent", () => {
		createBypass(testDir, "format test", "E009");

		const raw = readFileSync(join(testDir, ".forge-bypass.json"), "utf-8");

		// Should be valid JSON
		expect(() => JSON.parse(raw)).not.toThrow();

		// Should be an array
		const parsed = JSON.parse(raw);
		expect(Array.isArray(parsed)).toBe(true);

		// Should have 2-space indent
		expect(raw).toContain('  "id"');

		// Should end with a newline
		expect(raw.endsWith("\n")).toBe(true);
	});
});
