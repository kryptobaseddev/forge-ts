import { afterEach, describe, expect, it, vi } from "vitest";
import { runDoctor } from "../commands/doctor.js";
import { resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		existsSync: vi.fn().mockReturnValue(false),
		readFileSync: vi.fn().mockReturnValue("{}"),
	};
});

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>();
	return {
		...actual,
		execSync: vi.fn().mockImplementation(() => {
			throw new Error("git config not set");
		}),
	};
});

// ---------------------------------------------------------------------------
// Helper: build a "complete project" existsSync mock
// ---------------------------------------------------------------------------

/**
 * Sets up mocks so all common project files appear to exist and contain
 * valid data. Must be called inside an async test after importing mocked fs.
 */
async function mockCompleteProject(): Promise<void> {
	const { existsSync, readFileSync } = await import("node:fs");

	vi.mocked(existsSync).mockImplementation((p) => {
		const s = String(p);
		if (s.endsWith("forge-ts.config.ts")) return true;
		if (s.endsWith("tsdoc.json")) return true;
		if (s.includes("@forge-ts/core/package.json")) return true;
		if (s.includes("typescript/package.json")) return true;
		if (s.endsWith("tsconfig.json")) return true;
		if (s.endsWith("biome.json")) return true;
		if (s.endsWith(".forge-lock.json")) return true;
		if (s.endsWith(".forge-audit.jsonl")) return true;
		if (s.endsWith(".forge-bypass.json")) return true;
		if (s.endsWith("pre-commit")) return true;
		if (s.endsWith("pre-push")) return true;
		if (s.endsWith(".husky")) return true;
		if (s.includes(".bin/husky")) return true;
		if (s.endsWith("package.json")) return true;
		return false;
	});

	vi.mocked(readFileSync).mockImplementation((p) => {
		const s = String(p);
		if (s.endsWith("tsdoc.json")) {
			return JSON.stringify({
				$schema: "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
				extends: ["@forge-ts/core/tsdoc-preset/tsdoc.json"],
			});
		}
		if (s.includes("@forge-ts/core/package.json")) {
			return JSON.stringify({ version: "0.14.0" });
		}
		if (s.includes("typescript/package.json")) {
			return JSON.stringify({ version: "5.8.2" });
		}
		if (s.endsWith("tsconfig.json")) {
			return JSON.stringify({ compilerOptions: { strict: true } });
		}
		if (s.endsWith(".forge-lock.json")) {
			return JSON.stringify({
				lockedAt: "2026-03-20T00:00:00.000Z",
				lockedBy: "forge-ts lock",
				config: { rules: {} },
			});
		}
		if (s.endsWith(".forge-audit.jsonl")) {
			return '{"event":"config.lock"}\n{"event":"bypass.create"}\n';
		}
		if (s.endsWith(".forge-bypass.json")) {
			return "[]";
		}
		if (s.endsWith("pre-commit")) {
			return "npx forge-ts check\n";
		}
		if (s.endsWith("pre-push")) {
			return "npx forge-ts prepublish\n";
		}
		if (s.endsWith("package.json")) {
			return JSON.stringify({
				scripts: { prepare: "husky" },
				devDependencies: { husky: "^9.0.0" },
			});
		}
		return "{}";
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runDoctor", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("all checks pass with complete setup", async () => {
		await mockCompleteProject();

		const output = await runDoctor({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.summary.errors).toBe(0);
		expect(output.data.summary.passed).toBeGreaterThan(0);

		// Verify specific checks
		const checkNames = output.data.checks.map((c) => c.name);
		expect(checkNames).toContain("forge-ts.config");
		expect(checkNames).toContain("tsdoc.json");
		expect(checkNames).toContain("@forge-ts/core");
		expect(checkNames).toContain("TypeScript");
		expect(checkNames).toContain("tsconfig.json");
		expect(checkNames).toContain("biome.json");
		expect(checkNames).toContain(".forge-lock.json");
		expect(checkNames).toContain(".forge-audit.jsonl");
		expect(checkNames).toContain(".forge-bypass.json");
		// Git hooks check now has a more specific name
		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("pass");
	});

	it("reports missing forge-ts.config.ts as error", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake" });

		const configCheck = output.data.checks.find((c) => c.name === "forge-ts.config");
		expect(configCheck).toBeDefined();
		expect(configCheck?.status).toBe("error");
		expect(configCheck?.message).toContain("MISSING");
		expect(configCheck?.fixable).toBe(true);
	});

	it("reports missing tsdoc.json as error", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake" });

		const tsdocCheck = output.data.checks.find((c) => c.name === "tsdoc.json");
		expect(tsdocCheck).toBeDefined();
		expect(tsdocCheck?.status).toBe("error");
		expect(tsdocCheck?.fixable).toBe(true);
	});

	it("reports tsdoc.json that does not extend @forge-ts/core/tsdoc-preset", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("tsdoc.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ extends: ["some-other-config"] }));

		const output = await runDoctor({ cwd: "/fake" });

		const tsdocCheck = output.data.checks.find((c) => c.name === "tsdoc.json");
		expect(tsdocCheck).toBeDefined();
		expect(tsdocCheck?.status).toBe("warn");
		expect(tsdocCheck?.message).toContain("does not extend");
	});

	it("reports missing lock file as warning", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake" });

		const lockCheck = output.data.checks.find((c) => c.name === ".forge-lock.json");
		expect(lockCheck).toBeDefined();
		expect(lockCheck?.status).toBe("warn");
		expect(lockCheck?.message).toContain("not locked");
	});

	it("--fix creates missing forge-ts.config.ts", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake", fix: true });

		expect(output.data.fixed).toContain("forge-ts.config.ts");

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const configCall = writeCalls.find((c) => String(c[0]).endsWith("forge-ts.config.ts"));
		expect(configCall).toBeDefined();
		const written = configCall?.[1] as string;
		expect(written).toContain("defineConfig");
	});

	it("--fix creates missing tsdoc.json", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake", fix: true });

		expect(output.data.fixed).toContain("tsdoc.json");

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const tsdocCall = writeCalls.find((c) => String(c[0]).endsWith("tsdoc.json"));
		expect(tsdocCall).toBeDefined();
		const written = tsdocCall?.[1] as string;
		const parsed = JSON.parse(written);
		expect(parsed.extends).toEqual(["@forge-ts/core/tsdoc-preset/tsdoc.json"]);
	});

	it("--fix is idempotent (running twice produces same result)", async () => {
		const { existsSync } = await import("node:fs");

		// First run: nothing exists, fix creates files
		vi.mocked(existsSync).mockReturnValue(false);
		const output1 = await runDoctor({ cwd: "/fake", fix: true });

		expect(output1.data.fixed).toContain("forge-ts.config.ts");
		expect(output1.data.fixed).toContain("tsdoc.json");

		vi.clearAllMocks();

		// Second run: files now exist (simulate by returning true for created files)
		await mockCompleteProject();
		const output2 = await runDoctor({ cwd: "/fake", fix: true });

		// No additional files should be fixed
		expect(output2.data.fixed).toHaveLength(0);
		expect(output2.data.summary.errors).toBe(0);
	});

	it("reports audit trail event count", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".forge-audit.jsonl")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			'{"event":"config.lock"}\n{"event":"bypass.create"}\n{"event":"config.unlock"}\n',
		);

		const output = await runDoctor({ cwd: "/fake" });

		const auditCheck = output.data.checks.find((c) => c.name === ".forge-audit.jsonl");
		expect(auditCheck).toBeDefined();
		expect(auditCheck?.status).toBe("info");
		expect(auditCheck?.message).toContain("3 events");
	});

	it("reports active bypasses", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".forge-bypass.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify([{ id: "1", expiresAt: futureDate, rule: "E009" }]),
		);

		const output = await runDoctor({ cwd: "/fake" });

		const bypassCheck = output.data.checks.find((c) => c.name === ".forge-bypass.json");
		expect(bypassCheck).toBeDefined();
		expect(bypassCheck?.status).toBe("info");
		expect(bypassCheck?.message).toContain("1 active bypass");
	});

	it("reports git hooks not configured", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("warn");
		expect(hookCheck?.message).toContain("no hook manager detected");
	});

	it("reports fully configured husky (installed + prepare + both hooks)", async () => {
		await mockCompleteProject();

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("pass");
		expect(hookCheck?.message).toContain("husky installed");
		expect(hookCheck?.message).toContain("prepare script wired");
		expect(hookCheck?.message).toContain("pre-commit and pre-push configured");
	});

	it("warns when husky hook files exist but husky is not installed", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return true;
			if (s.endsWith("pre-push")) return true;
			// No .bin/husky, no package.json with husky
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return "npx forge-ts check\n";
			if (s.endsWith("pre-push")) return "npx forge-ts prepublish\n";
			return "{}";
		});

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("warn");
		expect(hookCheck?.message).toContain("husky is not installed");
	});

	it("warns when husky installed but prepare script missing", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return true;
			if (s.endsWith("pre-push")) return true;
			if (s.includes(".bin/husky")) return true;
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return "npx forge-ts check\n";
			if (s.endsWith("pre-push")) return "npx forge-ts prepublish\n";
			if (s.endsWith("package.json")) {
				return JSON.stringify({ scripts: { test: "vitest" } });
			}
			return "{}";
		});

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("warn");
		expect(hookCheck?.message).toContain("prepare");
		expect(hookCheck?.message).toContain("missing");
	});

	it("warns when pre-push hook is missing", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return true;
			if (s.includes(".bin/husky")) return true;
			if (s.endsWith("package.json")) return true;
			// No pre-push file
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return "npx forge-ts check\n";
			if (s.endsWith("package.json")) {
				return JSON.stringify({
					scripts: { prepare: "husky" },
					devDependencies: { husky: "^9.0.0" },
				});
			}
			return "{}";
		});

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("warn");
		expect(hookCheck?.message).toContain("pre-push");
	});

	it("reports git hooks configured in lefthook (both pre-commit and pre-push)", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			"pre-commit:\n  commands:\n    forge-ts-check:\n      run: npx forge-ts check\npre-push:\n  commands:\n    forge-ts-prepublish:\n      run: npx forge-ts prepublish\n",
		);

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("pass");
		expect(hookCheck?.message).toContain("lefthook");
		expect(hookCheck?.message).toContain("pre-commit and pre-push configured");
	});

	it("warns when lefthook has pre-commit but no pre-push", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			"pre-commit:\n  commands:\n    forge-ts-check:\n      run: npx forge-ts check\n",
		);

		const output = await runDoctor({ cwd: "/fake" });

		const hookCheck = output.data.checks.find((c) => c.name.startsWith("Git hooks"));
		expect(hookCheck).toBeDefined();
		expect(hookCheck?.status).toBe("warn");
		expect(hookCheck?.message).toContain("pre-push");
	});

	it("LAFS envelope structure is correct", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake" });

		expect(output).toHaveProperty("operation", "doctor");
		expect(output).toHaveProperty("success");
		expect(output.data).toHaveProperty("checks");
		expect(output.data).toHaveProperty("summary");
		expect(output.data.summary).toHaveProperty("passed");
		expect(output.data.summary).toHaveProperty("warnings");
		expect(output.data.summary).toHaveProperty("errors");
		expect(output.data.summary).toHaveProperty("info");
		expect(output.data).toHaveProperty("fixed");
		expect(output).toHaveProperty("duration");
	});

	it("resolves exit code correctly on errors", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runDoctor({ cwd: "/fake" });

		// Missing config + tsdoc = errors
		expect(output.data.summary.errors).toBeGreaterThan(0);
		expect(resolveExitCode(output)).toBe(1);
	});

	it("resolves exit code 0 when only warnings", async () => {
		await mockCompleteProject();

		// Override tsconfig to not have strict
		const { readFileSync } = await import("node:fs");
		const originalMock = vi.mocked(readFileSync).getMockImplementation();
		vi.mocked(readFileSync).mockImplementation((p, ...rest) => {
			const s = String(p);
			if (s.endsWith("tsconfig.json")) {
				return JSON.stringify({ compilerOptions: { strict: false } });
			}
			if (originalMock) {
				return originalMock(p, ...rest);
			}
			return "{}";
		});

		const output = await runDoctor({ cwd: "/fake" });

		expect(output.data.summary.errors).toBe(0);
		expect(resolveExitCode(output)).toBe(0);
	});

	it("reports tsconfig strict mode not fully enabled", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("tsconfig.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				compilerOptions: { strict: false, strictNullChecks: true },
			}),
		);

		const output = await runDoctor({ cwd: "/fake" });

		const tsconfigCheck = output.data.checks.find((c) => c.name === "tsconfig.json");
		expect(tsconfigCheck).toBeDefined();
		expect(tsconfigCheck?.status).toBe("warn");
		expect(tsconfigCheck?.message).toContain("strict");
	});

	it("detects forge-ts.config.js as alternative", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("forge-ts.config.js")) return true;
			return false;
		});

		const output = await runDoctor({ cwd: "/fake" });

		const configCheck = output.data.checks.find((c) => c.name === "forge-ts.config");
		expect(configCheck).toBeDefined();
		expect(configCheck?.status).toBe("pass");
		expect(configCheck?.message).toContain("forge-ts.config.js");
	});
});
