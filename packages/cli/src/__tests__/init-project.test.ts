import { afterEach, describe, expect, it, vi } from "vitest";
import { detectEnvironment, runInitProject } from "../commands/init-project.js";
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

// ---------------------------------------------------------------------------
// detectEnvironment tests
// ---------------------------------------------------------------------------

describe("detectEnvironment", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("detects TypeScript from devDependencies", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({ devDependencies: { typescript: "^5.8.2" } }),
		);

		const env = detectEnvironment("/fake");
		expect(env.typescriptVersion).toBe("^5.8.2");
		expect(env.packageJsonExists).toBe(true);
	});

	it("detects Biome when biome.json exists", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("biome.json")) return true;
			return false;
		});

		const env = detectEnvironment("/fake");
		expect(env.biomeDetected).toBe(true);
	});

	it("detects Biome when biome.jsonc exists", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("biome.jsonc")) return true;
			return false;
		});

		const env = detectEnvironment("/fake");
		expect(env.biomeDetected).toBe(true);
	});

	it("detects husky from .husky directory", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith(".husky")) return true;
			return false;
		});

		const env = detectEnvironment("/fake");
		expect(env.hookManager).toBe("husky");
	});

	it("detects lefthook from lefthook.yml", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("lefthook.yml")) return true;
			return false;
		});

		const env = detectEnvironment("/fake");
		expect(env.hookManager).toBe("lefthook");
	});

	it("detects pnpm monorepo", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("pnpm-workspace.yaml")) return true;
			return false;
		});

		const env = detectEnvironment("/fake");
		expect(env.monorepo).toBe(true);
		expect(env.monorepoType).toBe("pnpm");
	});

	it("detects npm/yarn monorepo from workspaces field", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ workspaces: ["packages/*"] }));

		const env = detectEnvironment("/fake");
		expect(env.monorepo).toBe(true);
		expect(env.monorepoType).toBe("npm/yarn");
	});

	it("returns none for hook manager when nothing detected", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const env = detectEnvironment("/fake");
		expect(env.hookManager).toBe("none");
		expect(env.monorepo).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// runInitProject tests
// ---------------------------------------------------------------------------

describe("runInitProject", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("creates forge-ts.config.ts when missing", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		// package.json exists, nothing else
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.created).toContain("forge-ts.config.ts");

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const configCall = writeCalls.find((c) => String(c[0]).endsWith("forge-ts.config.ts"));
		expect(configCall).toBeDefined();
		const written = configCall?.[1] as string;
		expect(written).toContain("defineConfig");
	});

	it("creates tsdoc.json when missing", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.created).toContain("tsdoc.json");

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const tsdocCall = writeCalls.find((c) => String(c[0]).endsWith("tsdoc.json"));
		expect(tsdocCall).toBeDefined();
		const written = tsdocCall?.[1] as string;
		const parsed = JSON.parse(written);
		expect(parsed.extends).toEqual(["@forge-ts/tsdoc-config/tsdoc.json"]);
	});

	it("skips existing files (idempotent)", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		// All files exist
		vi.mocked(existsSync).mockReturnValue(true);

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.skipped).toContain("forge-ts.config.ts");
		expect(output.data.skipped).toContain("tsdoc.json");
		expect(output.data.created).toHaveLength(0);

		// writeFile should not be called for config or tsdoc
		const writeCalls = vi.mocked(writeFile).mock.calls;
		const configCall = writeCalls.find((c) => String(c[0]).endsWith("forge-ts.config.ts"));
		const tsdocCall = writeCalls.find((c) => String(c[0]).endsWith("tsdoc.json"));
		expect(configCall).toBeUndefined();
		expect(tsdocCall).toBeUndefined();
	});

	it("aborts when package.json is missing", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(false);
		expect(output.errors?.[0]?.code).toBe("INIT_NO_PACKAGE_JSON");
		expect(resolveExitCode(output)).toBe(1);
	});

	it("warns on missing strict mode in tsconfig.json", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			if (s.endsWith("tsconfig.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) {
				return JSON.stringify({ type: "module", devDependencies: { "@forge-ts/cli": "0.14.0" } });
			}
			if (s.endsWith("tsconfig.json")) {
				return JSON.stringify({ compilerOptions: { strict: false } });
			}
			return "{}";
		});

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.warnings).toEqual(
			expect.arrayContaining([expect.stringContaining("strict")]),
		);
		expect(output.warnings).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "INIT_TSCONFIG_NOT_STRICT" })]),
		);
	});

	it("warns on missing type: module in package.json", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ name: "test-project" }));

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.warnings).toEqual(
			expect.arrayContaining([expect.stringContaining('"type": "module"')]),
		);
	});

	it("reports summary correctly with environment", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			if (s.endsWith(".husky")) return true;
			if (s.endsWith("biome.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				type: "module",
				devDependencies: { typescript: "^5.8.2", "@forge-ts/cli": "0.14.0" },
				engines: { node: ">=22.0.0" },
			}),
		);

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.environment.typescriptVersion).toBe("^5.8.2");
		expect(output.data.environment.biomeDetected).toBe(true);
		expect(output.data.environment.hookManager).toBe("husky");
		expect(output.data.nextSteps.length).toBeGreaterThan(0);
	});

	it("LAFS envelope structure is correct", async () => {
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		const output = await runInitProject({ cwd: "/fake" });

		expect(output).toHaveProperty("operation", "init");
		expect(output).toHaveProperty("success", true);
		expect(output.data).toHaveProperty("created");
		expect(output.data).toHaveProperty("skipped");
		expect(output.data).toHaveProperty("warnings");
		expect(output.data).toHaveProperty("environment");
		expect(output.data).toHaveProperty("nextSteps");
		expect(output).toHaveProperty("duration");
	});

	it("reports missing engines.node", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ type: "module" }));

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.data.warnings).toEqual(
			expect.arrayContaining([expect.stringContaining("engines.node")]),
		);
	});

	it("reports missing @forge-ts/cli in devDependencies", async () => {
		const { existsSync, readFileSync } = await import("node:fs");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ type: "module" }));

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.data.warnings).toEqual(
			expect.arrayContaining([expect.stringContaining("@forge-ts/cli")]),
		);
	});
});
