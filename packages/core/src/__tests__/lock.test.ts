import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createLockManifest,
	type ForgeLockManifest,
	readLockFile,
	removeLockFile,
	validateAgainstLock,
	writeLockFile,
} from "../lock.js";
import type { ForgeConfig } from "../types.js";
import { Visibility } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDir: string;

function makeConfig(overrides?: Partial<ForgeConfig>): ForgeConfig {
	return {
		rootDir: testDir,
		tsconfig: join(testDir, "tsconfig.json"),
		outDir: join(testDir, "docs"),
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			rules: {
				"require-summary": "error",
				"require-param": "error",
				"require-returns": "error",
				"require-example": "error",
				"require-package-doc": "warn",
				"require-class-member-doc": "error",
				"require-interface-member-doc": "error",
				"require-tsdoc-syntax": "warn",
			},
		},
		doctest: { enabled: false, cacheDir: join(testDir, ".cache") },
		api: { enabled: false, openapi: false, openapiPath: join(testDir, "docs/openapi.json") },
		gen: { enabled: false, formats: [], llmsTxt: false, readmeSync: false },
		skill: {},
		tsdoc: {
			writeConfig: true,
			customTags: [],
			enforce: { core: "error", extended: "warn", discretionary: "off" },
		},
		guides: {
			enabled: true,
			autoDiscover: true,
			custom: [],
		},
		guards: {
			tsconfig: { enabled: true, requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"] },
			biome: { enabled: false, lockedRules: [] },
			packageJson: { enabled: false, minNodeVersion: "22.0.0", requiredFields: [] },
		},
		project: {},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
	testDir = join(tmpdir(), `forge-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// readLockFile
// ---------------------------------------------------------------------------

describe("readLockFile", () => {
	it("returns null when no lock file exists", () => {
		const result = readLockFile(testDir);
		expect(result).toBeNull();
	});

	it("returns null when lock file contains invalid JSON", () => {
		writeFileSync(join(testDir, ".forge-lock.json"), "not json", "utf8");
		const result = readLockFile(testDir);
		expect(result).toBeNull();
	});

	it("reads and parses a valid lock file", () => {
		const manifest: ForgeLockManifest = {
			version: "1.0.0",
			lockedAt: "2026-03-21T00:00:00.000Z",
			lockedBy: "test",
			config: {
				rules: { "require-summary": "error" },
			},
		};
		writeFileSync(join(testDir, ".forge-lock.json"), JSON.stringify(manifest), "utf8");
		const result = readLockFile(testDir);
		expect(result).toEqual(manifest);
	});
});

// ---------------------------------------------------------------------------
// writeLockFile
// ---------------------------------------------------------------------------

describe("writeLockFile", () => {
	it("creates a .forge-lock.json with 2-space indent", () => {
		const manifest: ForgeLockManifest = {
			version: "1.0.0",
			lockedAt: "2026-03-21T00:00:00.000Z",
			lockedBy: "test",
			config: {
				rules: { "require-summary": "error" },
			},
		};
		writeLockFile(testDir, manifest);

		const lockPath = join(testDir, ".forge-lock.json");
		expect(existsSync(lockPath)).toBe(true);

		const raw = readFileSync(lockPath, "utf8");
		// Verify 2-space indent
		expect(raw).toContain('  "version"');
		// Verify trailing newline
		expect(raw.endsWith("\n")).toBe(true);
		// Verify round-trip
		expect(JSON.parse(raw)).toEqual(manifest);
	});

	it("overwrites an existing lock file", () => {
		const manifest1: ForgeLockManifest = {
			version: "1.0.0",
			lockedAt: "2026-03-21T00:00:00.000Z",
			lockedBy: "first",
			config: { rules: {} },
		};
		const manifest2: ForgeLockManifest = {
			version: "1.0.0",
			lockedAt: "2026-03-21T01:00:00.000Z",
			lockedBy: "second",
			config: { rules: {} },
		};

		writeLockFile(testDir, manifest1);
		writeLockFile(testDir, manifest2);

		const result = readLockFile(testDir);
		expect(result?.lockedBy).toBe("second");
	});
});

// ---------------------------------------------------------------------------
// removeLockFile
// ---------------------------------------------------------------------------

describe("removeLockFile", () => {
	it("returns false when no lock file exists", () => {
		expect(removeLockFile(testDir)).toBe(false);
	});

	it("removes the lock file and returns true", () => {
		const lockPath = join(testDir, ".forge-lock.json");
		writeFileSync(lockPath, "{}", "utf8");
		expect(existsSync(lockPath)).toBe(true);

		const result = removeLockFile(testDir);
		expect(result).toBe(true);
		expect(existsSync(lockPath)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// createLockManifest
// ---------------------------------------------------------------------------

describe("createLockManifest", () => {
	it("snapshots all enforce rules", () => {
		const config = makeConfig();
		const manifest = createLockManifest(config);

		expect(manifest.version).toBe("1.0.0");
		expect(manifest.lockedBy).toBe("forge-ts lock");
		expect(manifest.lockedAt).toBeTruthy();
		expect(manifest.config.rules).toEqual({
			"require-summary": "error",
			"require-param": "error",
			"require-returns": "error",
			"require-example": "error",
			"require-package-doc": "warn",
			"require-class-member-doc": "error",
			"require-interface-member-doc": "error",
			"require-tsdoc-syntax": "warn",
		});
	});

	it("includes tsconfig guard settings when enabled", () => {
		const config = makeConfig();
		const manifest = createLockManifest(config);

		expect(manifest.config.tsconfig).toEqual({
			enabled: true,
			requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"],
		});
	});

	it("omits tsconfig guard settings when disabled", () => {
		const config = makeConfig({
			guards: {
				tsconfig: { enabled: false, requiredFlags: [] },
				biome: { enabled: false, lockedRules: [] },
				packageJson: { enabled: false, minNodeVersion: "22.0.0", requiredFields: [] },
			},
		});
		const manifest = createLockManifest(config);
		expect(manifest.config.tsconfig).toBeUndefined();
	});

	it("includes biome guard settings when enabled", () => {
		const config = makeConfig({
			guards: {
				tsconfig: { enabled: false, requiredFlags: [] },
				biome: { enabled: true, lockedRules: ["noDebugger", "noConsole"] },
				packageJson: { enabled: false, minNodeVersion: "22.0.0", requiredFields: [] },
			},
		});
		const manifest = createLockManifest(config);

		expect(manifest.config.biome).toEqual({
			enabled: true,
			lockedRules: ["noDebugger", "noConsole"],
		});
	});

	it("accepts custom lockedBy", () => {
		const config = makeConfig();
		const manifest = createLockManifest(config, "agent-x");
		expect(manifest.lockedBy).toBe("agent-x");
	});
});

// ---------------------------------------------------------------------------
// validateAgainstLock
// ---------------------------------------------------------------------------

describe("validateAgainstLock", () => {
	it("returns empty array when config matches lock", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);
		const violations = validateAgainstLock(config, lock);
		expect(violations).toEqual([]);
	});

	it("detects rule severity weakened from error to warn", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		// Weaken require-summary from error to warn
		config.enforce.rules["require-summary"] = "warn";

		const violations = validateAgainstLock(config, lock);
		expect(violations).toHaveLength(1);
		expect(violations[0].field).toBe("rules.require-summary");
		expect(violations[0].locked).toBe("error");
		expect(violations[0].current).toBe("warn");
	});

	it("detects rule severity weakened from error to off", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		config.enforce.rules["require-param"] = "off";

		const violations = validateAgainstLock(config, lock);
		expect(violations).toHaveLength(1);
		expect(violations[0].field).toBe("rules.require-param");
		expect(violations[0].locked).toBe("error");
		expect(violations[0].current).toBe("off");
	});

	it("detects rule severity weakened from warn to off", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		config.enforce.rules["require-package-doc"] = "off";

		const violations = validateAgainstLock(config, lock);
		expect(violations).toHaveLength(1);
		expect(violations[0].field).toBe("rules.require-package-doc");
		expect(violations[0].locked).toBe("warn");
		expect(violations[0].current).toBe("off");
	});

	it("allows strengthening rules (warn to error)", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		// Strengthen is fine
		config.enforce.rules["require-package-doc"] = "error";

		const violations = validateAgainstLock(config, lock);
		expect(violations).toEqual([]);
	});

	it("detects multiple violations at once", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		config.enforce.rules["require-summary"] = "off";
		config.enforce.rules["require-param"] = "warn";
		config.enforce.rules["require-returns"] = "off";

		const violations = validateAgainstLock(config, lock);
		expect(violations).toHaveLength(3);
		const fields = violations.map((v) => v.field);
		expect(fields).toContain("rules.require-summary");
		expect(fields).toContain("rules.require-param");
		expect(fields).toContain("rules.require-returns");
	});

	it("detects tsconfig guard disabled", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		// Disable the tsconfig guard after locking
		config.guards.tsconfig.enabled = false;

		const violations = validateAgainstLock(config, lock);
		expect(violations.some((v) => v.field === "guards.tsconfig.enabled")).toBe(true);
	});

	it("detects tsconfig required flag removed", () => {
		const config = makeConfig();
		const lock = createLockManifest(config);

		// Remove a required flag after locking
		config.guards.tsconfig.requiredFlags = ["strict"];

		const violations = validateAgainstLock(config, lock);
		expect(
			violations.some((v) => v.field === "guards.tsconfig.requiredFlags.strictNullChecks"),
		).toBe(true);
		expect(violations.some((v) => v.field === "guards.tsconfig.requiredFlags.noImplicitAny")).toBe(
			true,
		);
	});

	it("detects biome guard disabled", () => {
		const config = makeConfig({
			guards: {
				tsconfig: { enabled: false, requiredFlags: [] },
				biome: { enabled: true, lockedRules: ["noDebugger"] },
				packageJson: { enabled: false, minNodeVersion: "22.0.0", requiredFields: [] },
			},
		});
		const lock = createLockManifest(config);

		config.guards.biome.enabled = false;

		const violations = validateAgainstLock(config, lock);
		expect(violations.some((v) => v.field === "guards.biome.enabled")).toBe(true);
	});

	it("detects biome locked rule removed", () => {
		const config = makeConfig({
			guards: {
				tsconfig: { enabled: false, requiredFlags: [] },
				biome: { enabled: true, lockedRules: ["noDebugger", "noConsole"] },
				packageJson: { enabled: false, minNodeVersion: "22.0.0", requiredFields: [] },
			},
		});
		const lock = createLockManifest(config);

		// Remove a locked rule after locking
		config.guards.biome.lockedRules = ["noDebugger"];

		const violations = validateAgainstLock(config, lock);
		expect(violations.some((v) => v.field === "guards.biome.lockedRules.noConsole")).toBe(true);
	});

	it("ignores biome flag removal check when biome guard is disabled in lock", () => {
		const config = makeConfig(); // biome disabled by default
		const lock = createLockManifest(config);

		// No biome section in lock, so no violations related to biome
		const violations = validateAgainstLock(config, lock);
		const biomeViolations = violations.filter((v) => v.field.startsWith("guards.biome"));
		expect(biomeViolations).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Round-trip: write + read + validate
// ---------------------------------------------------------------------------

describe("round-trip", () => {
	it("write then read produces identical manifest", () => {
		const config = makeConfig();
		const manifest = createLockManifest(config);
		writeLockFile(testDir, manifest);
		const read = readLockFile(testDir);
		expect(read).toEqual(manifest);
	});

	it("write + weaken + validate detects drift", () => {
		const config = makeConfig();
		const manifest = createLockManifest(config);
		writeLockFile(testDir, manifest);

		const lock = readLockFile(testDir);
		expect(lock).not.toBeNull();

		config.enforce.rules["require-summary"] = "off";
		// biome-ignore lint/style/noNonNullAssertion: guarded by the assertion above
		const violations = validateAgainstLock(config, lock!);
		expect(violations).toHaveLength(1);
		expect(violations[0].field).toBe("rules.require-summary");
	});
});
