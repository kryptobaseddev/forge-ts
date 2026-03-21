import { afterEach, describe, expect, it, vi } from "vitest";
import {
	detectHookManager,
	generateHuskyHook,
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
	it("includes shebang and forge-ts check", () => {
		const content = generateHuskyHook();
		expect(content).toContain("#!/usr/bin/env sh");
		expect(content).toContain("npx forge-ts check");
	});

	it("sources husky.sh", () => {
		const content = generateHuskyHook();
		expect(content).toContain("husky.sh");
	});
});

describe("generateLefthookBlock", () => {
	it("includes pre-commit section with forge-ts check", () => {
		const content = generateLefthookBlock();
		expect(content).toContain("pre-commit:");
		expect(content).toContain("forge-ts-check:");
		expect(content).toContain("npx forge-ts check");
	});
});

// ---------------------------------------------------------------------------
// runInitHooks tests
// ---------------------------------------------------------------------------

describe("runInitHooks", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("writes husky pre-commit hook when husky is detected", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile, mkdir } = await import("node:fs/promises");

		// .husky dir exists (husky detected), but pre-commit file does not
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			return false;
		});

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.hookManager).toBe("husky");
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.summary.filesWritten).toBe(1);
		expect(mkdir).toHaveBeenCalled();
		expect(writeFile).toHaveBeenCalled();
		expect(resolveExitCode(output)).toBe(0);
	});

	it("writes husky hook when no manager is detected (default fallback)", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.hookManager).toBe("none");
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.instructions).toEqual(
			expect.arrayContaining([expect.stringContaining("No hook manager detected")]),
		);
		expect(writeFile).toHaveBeenCalled();
	});

	it("skips husky hook when pre-commit already contains forge-ts check", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile } = await import("node:fs/promises");

		// .husky dir and pre-commit both exist
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky") || s.endsWith("pre-commit")) return true;
			return false;
		});
		vi.mocked(readFile).mockResolvedValue("#!/usr/bin/env sh\nnpx forge-ts check\n");

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.summary.filesSkipped).toBe(1);
		expect(output.data.summary.filesWritten).toBe(0);
		expect(output.warnings).toBeDefined();
		expect(output.warnings?.[0]?.code).toBe("HOOKS_ALREADY_EXISTS");
	});

	it("appends to existing husky hook when forge-ts not present", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile, writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky") || s.endsWith("pre-commit")) return true;
			return false;
		});
		vi.mocked(readFile).mockResolvedValue("#!/usr/bin/env sh\nnpx lint-staged\n");

		const output = await runInitHooks({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.summary.filesWritten).toBe(1);

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const hookWriteCall = writeCalls.find((c) => String(c[0]).endsWith("pre-commit"));
		expect(hookWriteCall).toBeDefined();
		const written = hookWriteCall?.[1] as string;
		expect(written).toContain("npx lint-staged");
		expect(written).toContain("npx forge-ts check");
	});

	it("overwrites existing hook file when --force is set", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		// .husky dir and pre-commit both exist
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky") || s.endsWith("pre-commit")) return true;
			return false;
		});

		const output = await runInitHooks({ cwd: "/fake", force: true });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain(".husky/pre-commit");
		expect(output.data.summary.filesWritten).toBe(1);
		expect(writeFile).toHaveBeenCalled();
	});

	it("writes lefthook.yml when lefthook is detected", async () => {
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
	});

	it("skips lefthook.yml when already contains forge-ts check", async () => {
		const { existsSync } = await import("node:fs");
		const { readFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});
		vi.mocked(readFile).mockResolvedValue(
			"pre-commit:\n  commands:\n    forge-ts-check:\n      run: npx forge-ts check\n",
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
