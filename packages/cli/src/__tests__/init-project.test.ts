import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTsdocContent, detectEnvironment, runInitProject } from "../commands/init-project.js";
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
		readFile: vi.fn().mockResolvedValue("{}"),
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
		expect(parsed.extends).toEqual(["@forge-ts/core/tsdoc-preset/tsdoc.json"]);
	});

	it("skips existing files (idempotent)", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile, readFile } = await import("node:fs/promises");

		// All files exist
		vi.mocked(existsSync).mockReturnValue(true);
		// Hook files already contain forge-ts marker so init-hooks skips them
		vi.mocked(readFile).mockImplementation(async (p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return "# forge-ts\nnpx forge-ts check --staged\n";
			if (s.endsWith("pre-push")) return "# forge-ts\nnpx forge-ts prepublish\n";
			return "{}";
		});
		// package.json already has prepare script
		vi.mocked(readFileSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) {
				return JSON.stringify({
					name: "test",
					scripts: { prepare: "husky" },
					devDependencies: { husky: "^9.0.0" },
				});
			}
			return "{}";
		});

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.skipped).toContain("forge-ts.config.ts");
		expect(output.data.skipped).toContain("tsdoc.json");

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
		expect(output.data).toHaveProperty("scriptsAdded");
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

	it("config template does not include incomplete enforce block", async () => {
		const { existsSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		await runInitProject({ cwd: "/fake" });

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const configCall = writeCalls.find((c) => String(c[0]).endsWith("forge-ts.config.ts"));
		expect(configCall).toBeDefined();
		const written = configCall?.[1] as string;
		expect(written).toContain("defineConfig");
		// Should NOT contain the enforce block (defaults handle it)
		expect(written).not.toContain("enforce:");
		expect(written).not.toContain("minVisibility");
		// Should contain the gen.ssgTarget override
		expect(written).toContain("ssgTarget");
	});

	it("wires forge-ts scripts into package.json", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({ name: "test-project", scripts: { test: "vitest" } }, null, 2),
		);

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.scriptsAdded).toContain("forge:check");
		expect(output.data.scriptsAdded).toContain("forge:test");
		expect(output.data.scriptsAdded).toContain("forge:build");
		expect(output.data.scriptsAdded).toContain("forge:doctor");
		expect(output.data.scriptsAdded).toContain("prepublishOnly");

		// Verify package.json was written back with scripts
		const writeCalls = vi.mocked(writeFile).mock.calls;
		const pkgCall = writeCalls.find((c) => String(c[0]).endsWith("package.json"));
		expect(pkgCall).toBeDefined();
		const writtenPkg = JSON.parse(pkgCall?.[1] as string);
		expect(writtenPkg.scripts["forge:check"]).toBe("forge-ts check");
		expect(writtenPkg.scripts["forge:test"]).toBe("forge-ts test");
		expect(writtenPkg.scripts["forge:build"]).toBe("forge-ts build");
		expect(writtenPkg.scripts["forge:doctor"]).toBe("forge-ts doctor");
		expect(writtenPkg.scripts.prepublishOnly).toBe("forge-ts prepublish");
		// Pre-existing scripts preserved
		expect(writtenPkg.scripts.test).toBe("vitest");
	});

	it("script wiring is idempotent — skips existing keys", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify(
				{
					name: "test-project",
					scripts: {
						"forge:check": "custom-check-command",
						prepublishOnly: "my-custom-prepublish",
					},
				},
				null,
				2,
			),
		);

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.success).toBe(true);
		// Should NOT include keys that already exist
		expect(output.data.scriptsAdded).not.toContain("forge:check");
		expect(output.data.scriptsAdded).not.toContain("prepublishOnly");
		// Should include keys that are new
		expect(output.data.scriptsAdded).toContain("forge:test");
		expect(output.data.scriptsAdded).toContain("forge:build");
		expect(output.data.scriptsAdded).toContain("forge:doctor");

		// Verify existing scripts are NOT overwritten
		const writeCalls = vi.mocked(writeFile).mock.calls;
		const pkgCall = writeCalls.find((c) => String(c[0]).endsWith("package.json"));
		expect(pkgCall).toBeDefined();
		const writtenPkg = JSON.parse(pkgCall?.[1] as string);
		expect(writtenPkg.scripts["forge:check"]).toBe("custom-check-command");
		expect(writtenPkg.scripts.prepublishOnly).toBe("my-custom-prepublish");
	});

	it("script wiring preserves indent style", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			return false;
		});

		// Tab-indented JSON
		vi.mocked(readFileSync).mockReturnValue('{\n\t"name": "test-project"\n}\n');

		await runInitProject({ cwd: "/fake" });

		const writeCalls = vi.mocked(writeFile).mock.calls;
		const pkgCall = writeCalls.find((c) => String(c[0]).endsWith("package.json"));
		expect(pkgCall).toBeDefined();
		const written = pkgCall?.[1] as string;
		// Should use tab indentation
		expect(written).toContain('\t"name"');
		// Should preserve trailing newline
		expect(written).toMatch(/\n$/);
	});

	it("script wiring does not write when all scripts already exist", async () => {
		const { existsSync, readFileSync } = await import("node:fs");
		const { writeFile, readFile } = await import("node:fs/promises");

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			if (s.endsWith("package.json")) return true;
			// .husky/pre-commit and pre-push exist with forge-ts marker
			if (s.endsWith("pre-commit") || s.endsWith("pre-push") || s.endsWith(".husky")) return true;
			return false;
		});
		// Hook files already contain forge-ts marker
		vi.mocked(readFile).mockImplementation(async (p) => {
			const s = String(p);
			if (s.endsWith("pre-commit")) return "# forge-ts\nnpx forge-ts check --staged\n";
			if (s.endsWith("pre-push")) return "# forge-ts\nnpx forge-ts prepublish\n";
			return "{}";
		});

		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify(
				{
					name: "test-project",
					scripts: {
						"forge:check": "forge-ts check",
						"forge:test": "forge-ts test",
						"forge:build": "forge-ts build",
						"forge:doctor": "forge-ts doctor",
						prepublishOnly: "forge-ts prepublish",
						prepare: "husky",
					},
					devDependencies: { husky: "^9.0.0" },
				},
				null,
				2,
			),
		);

		const output = await runInitProject({ cwd: "/fake" });

		expect(output.data.scriptsAdded).toHaveLength(0);

		// package.json should NOT be rewritten
		const writeCalls = vi.mocked(writeFile).mock.calls;
		const pkgCall = writeCalls.find((c) => String(c[0]).endsWith("package.json"));
		expect(pkgCall).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// defineConfig tests
// ---------------------------------------------------------------------------

describe("defineConfig", () => {
	it("returns the same object (identity function)", async () => {
		const { defineConfig } = await import("@forge-ts/core");
		const input = { outDir: "docs", enforce: { strict: true } };
		const result = defineConfig(input);
		expect(result).toBe(input);
	});

	it("accepts string literals for minVisibility", async () => {
		const { defineConfig } = await import("@forge-ts/core");
		const config = defineConfig({
			enforce: {
				enabled: true,
				minVisibility: "public",
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
					"require-remarks": "error",
					"require-default-value": "warn",
					"require-type-param": "error",
					"require-see": "warn",
					"require-release-tag": "error",
					"require-fresh-guides": "warn",
					"require-guide-coverage": "warn",
					"require-internal-boundary": "error",
					"require-route-response": "warn",
					"require-inheritdoc-source": "warn",
					"require-migration-path": "warn",
					"require-since": "warn",
				},
			},
		});
		expect(config.enforce?.minVisibility).toBe("public");
	});
});

// ---------------------------------------------------------------------------
// buildTsdocContent tests
// ---------------------------------------------------------------------------

describe("buildTsdocContent", () => {
	it("with no customTags writes basic extends-only tsdoc.json", () => {
		const content = buildTsdocContent();
		const parsed = JSON.parse(content);
		expect(parsed.$schema).toBe(
			"https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
		);
		expect(parsed.extends).toEqual(["@forge-ts/core/tsdoc-preset/tsdoc.json"]);
		expect(parsed.tagDefinitions).toBeUndefined();
		expect(parsed.supportForTags).toBeUndefined();
	});

	it("with empty customTags array writes basic extends-only tsdoc.json", () => {
		const content = buildTsdocContent([]);
		const parsed = JSON.parse(content);
		expect(parsed.tagDefinitions).toBeUndefined();
		expect(parsed.supportForTags).toBeUndefined();
	});

	it("with customTags includes tagDefinitions and supportForTags", () => {
		const customTags = [
			{ tagName: "@myTag", syntaxKind: "block" as const },
			{ tagName: "@myInline", syntaxKind: "inline" as const },
		];
		const content = buildTsdocContent(customTags);
		const parsed = JSON.parse(content);
		expect(parsed.extends).toEqual(["@forge-ts/core/tsdoc-preset/tsdoc.json"]);
		expect(parsed.tagDefinitions).toEqual(customTags);
		expect(parsed.supportForTags).toEqual({
			"@myTag": true,
			"@myInline": true,
		});
	});

	it("preserves tag syntaxKind in tagDefinitions", () => {
		const customTags = [{ tagName: "@modifier", syntaxKind: "modifier" as const }];
		const content = buildTsdocContent(customTags);
		const parsed = JSON.parse(content);
		expect(parsed.tagDefinitions[0].syntaxKind).toBe("modifier");
	});
});
