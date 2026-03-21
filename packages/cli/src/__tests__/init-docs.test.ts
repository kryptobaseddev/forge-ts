import type { ForgeConfig } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import type { ScaffoldManifest, SSGAdapter, SSGTarget } from "@forge-ts/gen";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runInitDocs } from "../commands/init-docs.js";
import { resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@forge-ts/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/core")>();
	return {
		...actual,
		loadConfig: vi.fn(),
	};
});

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		existsSync: vi.fn().mockReturnValue(false),
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

// Mock @forge-ts/gen at the module level so we can control getAdapter / getAvailableTargets
vi.mock("@forge-ts/gen", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/gen")>();
	return {
		...actual,
		getAdapter: vi.fn(),
		getAvailableTargets: vi.fn().mockReturnValue(["mintlify", "docusaurus", "nextra", "vitepress"]),
		DEFAULT_TARGET: "mintlify",
	};
});

// ---------------------------------------------------------------------------
// Adapter mock helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock adapter for a given target. */
function makeMockAdapter(
	target: SSGTarget,
	options: {
		scaffoldManifest?: Partial<ScaffoldManifest>;
		detectExistingResult?: boolean;
	} = {},
): SSGAdapter {
	const manifest: ScaffoldManifest = {
		target,
		files: options.scaffoldManifest?.files ?? [
			{ path: "index.mdx", content: "# Hello" },
			{ path: "getting-started.mdx", content: "# Getting Started" },
		],
		dependencies: options.scaffoldManifest?.dependencies ?? { [target]: "latest" },
		devDependencies: options.scaffoldManifest?.devDependencies ?? {},
		scripts: options.scaffoldManifest?.scripts ?? { "docs:dev": `${target} dev` },
		instructions: options.scaffoldManifest?.instructions ?? [
			`Run \`npx ${target} dev\` to preview`,
		],
	};

	return {
		target,
		displayName: target.charAt(0).toUpperCase() + target.slice(1),
		styleGuide: {
			pageExtension: "mdx",
			supportsMdx: true,
			requiresFrontmatter: true,
			maxHeadingDepth: 3,
			defaultImports: [],
			codeBlockLanguage: "typescript",
		},
		scaffold: vi.fn().mockReturnValue(manifest),
		transformPages: vi.fn().mockReturnValue([]),
		generateConfig: vi.fn().mockReturnValue([]),
		detectExisting: vi.fn().mockResolvedValue(options.detectExistingResult ?? false),
	};
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ForgeConfig> = {}): ForgeConfig {
	return {
		rootDir: "/fake",
		tsconfig: "/fake/tsconfig.json",
		outDir: "/fake/docs",
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			rules: {
				"require-summary": "error",
				"require-param": "error",
				"require-returns": "error",
				"require-example": "warn",
				"require-package-doc": "warn",
				"require-class-member-doc": "warn",
				"require-interface-member-doc": "warn",
				"require-tsdoc-syntax": "warn",
			},
		},
		doctest: { enabled: false, cacheDir: "/fake/.cache" },
		api: { enabled: false, openapi: false, openapiPath: "/fake/docs/openapi.json" },
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
			tsconfig: { enabled: false, requiredFlags: [] },
			biome: { enabled: false, lockedRules: [] },
			packageJson: { enabled: false, minNodeVersion: "22.0.0", requiredFields: [] },
		},
		project: {},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runInitDocs", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("resolves default target when none specified", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(makeMockAdapter("mintlify"));

		const output = await runInitDocs({});
		expect(output.data.target).toBe("mintlify");
	});

	it("uses --target flag when provided", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(makeMockAdapter("docusaurus"));

		const output = await runInitDocs({ target: "docusaurus" });
		expect(output.data.target).toBe("docusaurus");
	});

	it("returns file list in result", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("mintlify", {
				scaffoldManifest: {
					files: [
						{ path: "mint.json", content: "{}" },
						{ path: "index.mdx", content: "# Hello" },
						{ path: "getting-started.mdx", content: "# GS" },
					],
				},
			}),
		);

		const output = await runInitDocs({ target: "mintlify" });
		expect(output.data.files).toContain("mint.json");
		expect(output.data.files).toContain("index.mdx");
		expect(output.data.files).toContain("tsdoc.json");
		expect(output.data.summary.filesCreated).toBe(4);
	});

	it("returns instructions in result", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("mintlify", {
				scaffoldManifest: {
					instructions: ["Run `npx mintlify dev` to preview"],
				},
			}),
		);

		const output = await runInitDocs({ target: "mintlify" });
		expect(output.data.instructions).toHaveLength(1);
		expect(output.data.instructions[0]).toContain("mintlify");
	});

	it("detects existing scaffold (mock detectExisting returning true)", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("mintlify", { detectExistingResult: true }),
		);

		const output = await runInitDocs({ target: "mintlify" });
		expect(output.success).toBe(false);
		expect(output.errors?.[0]?.code).toBe("INIT_ALREADY_EXISTS");
	});

	it("errors without --force when existing scaffold detected", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("mintlify", { detectExistingResult: true }),
		);

		const output = await runInitDocs({ target: "mintlify", force: false });
		expect(output.success).toBe(false);
		expect(resolveExitCode(output)).toBe(1);
		const errMsg = output.errors?.[0]?.message ?? "";
		expect(errMsg).toMatch(/already scaffolded/i);
		expect(errMsg).toMatch(/--force/i);
	});

	it("succeeds with --force when existing scaffold is present", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("mintlify", { detectExistingResult: true }),
		);

		const output = await runInitDocs({ target: "mintlify", force: true });
		expect(output.success).toBe(true);
		expect(resolveExitCode(output)).toBe(0);
	});

	it("LAFS envelope structure is correct on success", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(makeMockAdapter("mintlify"));

		const output = await runInitDocs({ target: "mintlify" });

		expect(output).toHaveProperty("operation", "init.docs");
		expect(output).toHaveProperty("success", true);
		expect(output.data).toHaveProperty("target", "mintlify");
		expect(output.data).toHaveProperty("summary");
		expect(output.data.summary).toHaveProperty("filesCreated");
		expect(output.data.summary).toHaveProperty("dependencies");
		expect(output.data.summary).toHaveProperty("scripts");
		expect(output.data).toHaveProperty("files");
		expect(output.data).toHaveProperty("instructions");
	});

	it("errors when an unknown target is provided", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);

		const output = await runInitDocs({ target: "unknown-ssg" });
		expect(output.success).toBe(false);
		expect(output.errors?.[0]?.code).toBe("INIT_UNKNOWN_TARGET");
	});

	it("summary counts reflect adapter manifest deps and scripts", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("vitepress", {
				scaffoldManifest: {
					files: [{ path: "index.md", content: "# hi" }],
					dependencies: { vitepress: "^1.0.0" },
					devDependencies: { "@types/node": "^20.0.0" },
					scripts: {
						"docs:dev": "vitepress dev docs",
						"docs:build": "vitepress build docs",
					},
					instructions: ["Run npm run docs:dev"],
				},
			}),
		);

		const output = await runInitDocs({ target: "vitepress" });
		expect(output.success).toBe(true);
		// 1 dep + 1 devDep = 2
		expect(output.data.summary.dependencies).toBe(2);
		expect(output.data.summary.scripts).toBe(2);
	});

	it("passes outDir override to adapter context", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		const adapter = makeMockAdapter("mintlify");
		vi.mocked(getAdapter).mockReturnValue(adapter);

		await runInitDocs({ target: "mintlify", outDir: "/custom/out" });

		// The adapter's scaffold() should have been called with a context whose outDir matches
		expect(adapter.scaffold).toHaveBeenCalledOnce();
		const ctx = vi.mocked(adapter.scaffold).mock.calls[0]?.[0];
		expect(ctx?.outDir).toBe("/custom/out");
	});

	// -----------------------------------------------------------------------
	// tsdoc.json writing
	// -----------------------------------------------------------------------

	it("writes tsdoc.json to project root with correct content", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");
		const { writeFile } = await import("node:fs/promises");
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(makeMockAdapter("mintlify"));

		const output = await runInitDocs({ target: "mintlify" });

		expect(output.success).toBe(true);
		expect(output.data.files).toContain("tsdoc.json");

		// Verify writeFile was called with the correct tsdoc.json content
		const writeFileCalls = vi.mocked(writeFile).mock.calls;
		const tsdocCall = writeFileCalls.find(
			(call) => typeof call[0] === "string" && call[0].endsWith("tsdoc.json"),
		);
		expect(tsdocCall).toBeDefined();

		const writtenContent = JSON.parse(tsdocCall?.[1] as string);
		expect(writtenContent.$schema).toBe(
			"https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
		);
		expect(writtenContent.extends).toEqual(["@forge-ts/tsdoc-config/tsdoc.json"]);
	});

	it("skips tsdoc.json when file already exists", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(makeMockAdapter("mintlify"));

		const output = await runInitDocs({ target: "mintlify" });

		expect(output.success).toBe(true);
		expect(output.data.files).not.toContain("tsdoc.json");
		const tsdocWarning = output.warnings?.find((w) => w.code === "INIT_TSDOC_EXISTS");
		expect(tsdocWarning).toBeDefined();
		expect(tsdocWarning?.message).toMatch(/already exists/i);
	});

	it("skips tsdoc.json when tsdoc.writeConfig is false", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");
		const { writeFile } = await import("node:fs/promises");
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				tsdoc: {
					writeConfig: false,
					customTags: [],
					enforce: { core: "error", extended: "warn", discretionary: "off" },
				},
			}),
		);
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(makeMockAdapter("mintlify"));

		const output = await runInitDocs({ target: "mintlify" });

		expect(output.success).toBe(true);
		expect(output.data.files).not.toContain("tsdoc.json");
		const writeFileCalls = vi.mocked(writeFile).mock.calls;
		const tsdocCall = writeFileCalls.find(
			(call) => typeof call[0] === "string" && call[0].endsWith("tsdoc.json"),
		);
		expect(tsdocCall).toBeUndefined();
	});

	it("includes tsdoc.json in filesCreated count", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { getAdapter, getAvailableTargets } = await import("@forge-ts/gen");
		const { existsSync } = await import("node:fs");

		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(getAvailableTargets).mockReturnValue([
			"mintlify",
			"docusaurus",
			"nextra",
			"vitepress",
		]);
		vi.mocked(getAdapter).mockReturnValue(
			makeMockAdapter("mintlify", {
				scaffoldManifest: {
					files: [{ path: "index.mdx", content: "# Hello" }],
				},
			}),
		);

		const output = await runInitDocs({ target: "mintlify" });

		expect(output.data.summary.filesCreated).toBe(2);
		expect(output.data.files).toContain("index.mdx");
		expect(output.data.files).toContain("tsdoc.json");
	});
});
