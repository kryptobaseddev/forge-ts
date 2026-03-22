import { afterEach, describe, expect, it, vi } from "vitest";
import {
	detectHookManager,
	generateHuskyHook,
	generateHuskyPrePushHook,
	generateLefthookBlock,
	runInitHooks,
} from "../commands/init-hooks.js";
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
		readFile: vi.fn().mockResolvedValue(""),
		writeFile: vi.fn().mockResolvedValue(undefined),
	};
});

// ---------------------------------------------------------------------------
// detectHookManager tests
// ---------------------------------------------------------------------------

describe("detectHookManager", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns 'husky' when .husky directory exists", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			return String(p).endsWith(".husky");
		});

		expect(detectHookManager("/fake")).toBe("husky");
	});

	it("returns 'lefthook' when lefthook.yml exists", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			return String(p).endsWith("lefthook.yml");
		});

		expect(detectHookManager("/fake")).toBe("lefthook");
	});

	it("returns 'husky' when package.json has husky in devDependencies", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			return String(p).endsWith("package.json");
		});
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({ devDependencies: { husky: "^9.0.0" } }),
		);

		expect(detectHookManager("/fake")).toBe("husky");
	});

	it("returns 'lefthook' when package.json has lefthook in devDependencies", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			return String(p).endsWith("package.json");
		});
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({ devDependencies: { lefthook: "^1.0.0" } }),
		);

		expect(detectHookManager("/fake")).toBe("lefthook");
	});

	it("returns 'none' when no hook manager is detected", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		expect(detectHookManager("/fake")).toBe("none");
	});

	it("returns 'husky' when husky is in dependencies (not devDependencies)", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			return String(p).endsWith("package.json");
		});
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ dependencies: { husky: "^9.0.0" } }));

		expect(detectHookManager("/fake")).toBe("husky");
	});

	it("returns 'none' when package.json is malformed", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			return String(p).endsWith("package.json");
		});
		vi.mocked(readFileSync).mockReturnValue("not-json");

		expect(detectHookManager("/fake")).toBe("none");
	});
});

// ---------------------------------------------------------------------------
// Content generator tests
// ---------------------------------------------------------------------------

describe("generateHuskyHook", () => {
	it("includes forge-ts check command (modern husky v9 — no shebang)", () => {
		const content = generateHuskyHook();
		expect(content).toContain("npx forge-ts check");
		// Modern husky v9+ does not need a shebang or husky.sh source line
		expect(content).not.toContain("#!/usr/bin/env sh");
		expect(content).not.toContain("husky.sh");
	});
});

describe("generateHuskyPrePushHook", () => {
	it("includes forge-ts prepublish command (modern husky v9 — no shebang)", () => {
		const content = generateHuskyPrePushHook();
		expect(content).toContain("npx forge-ts prepublish");
		expect(content).not.toContain("#!/usr/bin/env sh");
	});
});

describe("generateLefthookBlock", () => {
	it("includes pre-commit and pre-push sections", () => {
		const content = generateLefthookBlock();
		expect(content).toContain("pre-commit:");
		expect(content).toContain("forge-ts-check:");
		expect(content).toContain("npx forge-ts check");
		expect(content).toContain("pre-push:");
		expect(content).toContain("forge-ts-prepublish:");
		expect(content).toContain("npx forge-ts prepublish");
	});
});

// ---------------------------------------------------------------------------
// runInitHooks tests
// ---------------------------------------------------------------------------

describe("runInitHooks", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("writes husky pre-commit AND pre-push hooks when husky is detected", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile, mkdir } = await import("node:fs/promises");

		// .husky dir exists (husky detected), but hook files do not
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			return false;
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.hookManager).toBe("husky");
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.files).toContain(".husky/pre-push");
		expect(mkdir).toHaveBeenCalled();
		expect(writeFile).toHaveBeenCalled();
		expect(resolveExitCode(output)).toBe(0);
	});

	it("writes husky hooks when no manager is detected (default fallback)", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.hookManager).toBe("none");
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.files).toContain(".husky/pre-push");
		expect(output.data.instructions).toEqual(
			expect.arrayContaining([expect.stringContaining("No hook manager detected")]),
		);
		expect(writeFile).toHaveBeenCalled();
	});

	it("skips husky hook when pre-commit already contains forge-ts check", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile } = await import("node:fs/promises");

		// .husky dir, pre-commit, and pre-push all exist
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky") || s.endsWith("pre-commit") || s.endsWith("pre-push")) return true;
			return false;
		});
		vi.mocked(readFile).mockImplementation(async (p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return "npx forge-ts check\n";
			if (s.endsWith("pre-push")) return "npx forge-ts prepublish\n";
			return "";
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.summary.filesSkipped).toBeGreaterThanOrEqual(2);
		expect(output.warnings).toBeDefined();
		const hookWarnings = output.warnings?.filter((w) => w.code === "HOOKS_ALREADY_EXISTS");
		expect(hookWarnings?.length).toBeGreaterThanOrEqual(1);
	});

	it("appends to existing husky hook when forge-ts not present", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile, writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky") || s.endsWith("pre-commit")) return true;
			return false;
		});
		vi.mocked(readFile).mockResolvedValue("npx lint-staged\n");

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain(".husky/pre-commit");

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const hookWriteCall = writeCalls.find((c) => String(c[0]).endsWith("pre-commit"));
		expect(hookWriteCall).toBeDefined();
		const written = hookWriteCall?.[1] as string;
		expect(written).toContain("npx lint-staged");
		expect(written).toContain("npx forge-ts check");
	});

	it("overwrites existing hook files when --force is set", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		// .husky dir, pre-commit, and pre-push all exist
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky") || s.endsWith("pre-commit") || s.endsWith("pre-push")) return true;
			return false;
		});

		const output = await runInitHooks({ cwd: "/fake", force: true });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.files).toContain(".husky/pre-push");
		expect(writeFile).toHaveBeenCalled();
	});

	it("writes lefthook.yml with pre-commit and pre-push when lefthook is detected", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.hookManager).toBe("lefthook");
		expect(output.data.files).toContain("lefthook.yml");
		expect(output.data.instructions).toEqual(
			expect.arrayContaining([expect.stringContaining("Lefthook")]),
		);

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const lefthookCall = writeCalls.find((c) => String(c[0]).endsWith("lefthook.yml"));
		expect(lefthookCall).toBeDefined();
		const written = lefthookCall?.[1] as string;
		expect(written).toContain("pre-commit:");
		expect(written).toContain("pre-push:");
		expect(written).toContain("forge-ts-prepublish:");
	});

	it("skips lefthook.yml when already contains both forge-ts check and prepublish", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});
		vi.mocked(readFile).mockResolvedValue(
			"pre-commit:\n  commands:\n    forge-ts-check:\n      run: npx forge-ts check\npre-push:\n  commands:\n    forge-ts-prepublish:\n      run: npx forge-ts prepublish\n",
		);

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.summary.filesSkipped).toBe(1);
		expect(output.warnings?.[0]?.code).toBe("HOOKS_ALREADY_EXISTS");
	});

	it("appends to lefthook.yml pre-commit section when it exists", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile, writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});
		vi.mocked(readFile).mockResolvedValue(
			"pre-commit:\n  commands:\n    lint:\n      run: npx eslint .\n",
		);

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain("lefthook.yml");

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const lefthookCall = writeCalls.find((c) => String(c[0]).endsWith("lefthook.yml"));
		const written = lefthookCall?.[1] as string;
		expect(written).toContain("forge-ts-check:");
		expect(written).toContain("npx forge-ts check");
		expect(written).toContain("pre-push:");
		expect(written).toContain("forge-ts-prepublish:");
	});

	it("adds prepare script to package.json (idempotent)", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		// .husky dir exists, package.json exists with scripts but no prepare
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) {
				return JSON.stringify(
					{
						name: "my-project",
						scripts: { test: "vitest" },
						devDependencies: { husky: "^9.0.0" },
					},
					null,
					"  ",
				);
			}
			return "{}";
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain("package.json (prepare script)");

		// Find the package.json write call
		const writeCalls = vi.mocked(writeFile).mock.calls;
		const pkgWriteCall = writeCalls.find((c) => String(c[0]).endsWith("package.json"));
		expect(pkgWriteCall).toBeDefined();
		const written = JSON.parse(pkgWriteCall?.[1] as string);
		expect(written.scripts.prepare).toBe("husky");
		// Ensure existing scripts are preserved
		expect(written.scripts.test).toBe("vitest");
		// Ensure all existing content is preserved
		expect(written.name).toBe("my-project");
		expect(written.devDependencies.husky).toBe("^9.0.0");
	});

	it("does not overwrite existing prepare script in package.json", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) {
				return JSON.stringify(
					{
						name: "my-project",
						scripts: { prepare: "my-custom-prepare", test: "vitest" },
					},
					null,
					"  ",
				);
			}
			return "{}";
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		// prepare script should NOT be in the written files
		expect(output.data.files).not.toContain("package.json (prepare script)");
	});

	it("preserves exact JSON formatting when writing package.json", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		const originalPkg =
			'{\n\t"name": "my-project",\n\t"scripts": {\n\t\t"test": "vitest"\n\t}\n}\n';

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return originalPkg;
			return "{}";
		});

		await runInitHooks({ cwd: "/fake" });

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const pkgWriteCall = writeCalls.find((c) => String(c[0]).endsWith("package.json"));
		expect(pkgWriteCall).toBeDefined();
		const written = pkgWriteCall?.[1] as string;
		// Should detect tab indent and preserve trailing newline
		expect(written).toContain("\t");
		expect(written).toMatch(/\n$/);
	});

	it("warns when husky is not installed", async () => {
		const { existsSync } = await import("node:fs");

		// .husky dir exists but node_modules/.bin/husky does not, no husky in package.json
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			return false;
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		const huskyWarn = output.warnings?.find((w) => w.code === "HOOKS_HUSKY_NOT_INSTALLED");
		expect(huskyWarn).toBeDefined();
		expect(huskyWarn?.message).toContain("husky not installed");
	});

	it("LAFS envelope structure is correct", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output).toHaveProperty("operation", "init.hooks");
		expect(output).toHaveProperty("success", true);
		expect(output.data).toHaveProperty("hookManager");
		expect(output.data).toHaveProperty("summary");
		expect(output.data.summary).toHaveProperty("filesWritten");
		expect(output.data.summary).toHaveProperty("filesSkipped");
		expect(output.data).toHaveProperty("files");
		expect(output.data).toHaveProperty("instructions");
		expect(output).toHaveProperty("duration");
	});
});
