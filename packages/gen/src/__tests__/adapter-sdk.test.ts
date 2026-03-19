import { describe, expect, it } from "vitest";
import {
	DEFAULT_TARGET,
	getAdapter,
	getAvailableTargets,
	registerAdapter,
} from "../adapters/registry.js";
import type { AdapterContext, SSGAdapter, SSGTarget } from "../adapters/types.js";
import type { DocPage } from "../site-generator.js";

// Import to trigger self-registration of all adapters
import "../adapters/mintlify.js";
import "../adapters/docusaurus.js";
import "../adapters/nextra.js";
import "../adapters/vitepress.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function page(path: string, title = "Test Page"): DocPage {
	return { path, content: `# ${title}\n\nContent.\n`, frontmatter: { title } };
}

const samplePages: DocPage[] = [
	page("index.md", "My Project"),
	page("getting-started.md", "Getting Started"),
	page("packages/core/index.md", "core"),
	page("packages/core/api-reference.md", "API Reference"),
	page("packages/core/types.md", "Types"),
];

/** Minimal AdapterContext for testing. */
function makeContext(overrides: Partial<AdapterContext> = {}): AdapterContext {
	return {
		config: {} as AdapterContext["config"],
		projectName: "test-project",
		projectDescription: "A test project",
		pages: samplePages,
		symbols: [],
		outDir: "/tmp/test-docs",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe("registry — registerAdapter / getAdapter", () => {
	it("getAdapter returns the registered adapter", () => {
		const adapter = getAdapter("mintlify");
		expect(adapter.target).toBe("mintlify");
	});

	it("getAdapter throws for an unknown target", () => {
		expect(() => getAdapter("unknown" as SSGTarget)).toThrowError(/Unknown SSG target/);
	});

	it("error message from unknown target lists available targets", () => {
		expect(() => getAdapter("unknown" as SSGTarget)).toThrowError(/Available targets/);
	});

	it("registerAdapter overwrites an existing entry", () => {
		const stub: SSGAdapter = {
			...getAdapter("mintlify"),
			displayName: "Mintlify (override)",
		};
		registerAdapter(stub);
		expect(getAdapter("mintlify").displayName).toBe("Mintlify (override)");

		// Restore — re-import to re-register the real one. We can't truly re-import
		// in ESM so we re-register directly.
		registerAdapter({ ...stub, displayName: "Mintlify" });
	});
});

describe("registry — getAvailableTargets", () => {
	it("returns all four targets", () => {
		const targets = getAvailableTargets();
		expect(targets).toContain("mintlify");
		expect(targets).toContain("docusaurus");
		expect(targets).toContain("nextra");
		expect(targets).toContain("vitepress");
	});

	it("returns exactly four targets", () => {
		const targets = getAvailableTargets();
		expect(targets).toHaveLength(4);
	});
});

describe("registry — DEFAULT_TARGET", () => {
	it('is "mintlify"', () => {
		expect(DEFAULT_TARGET).toBe("mintlify");
	});
});

// ---------------------------------------------------------------------------
// Interface contract — each adapter
// ---------------------------------------------------------------------------

const ALL_TARGETS: SSGTarget[] = ["mintlify", "docusaurus", "nextra", "vitepress"];

describe("SSGAdapter interface contract", () => {
	for (const target of ALL_TARGETS) {
		describe(target, () => {
			it("has a target property matching the registered key", () => {
				const adapter = getAdapter(target);
				expect(adapter.target).toBe(target);
			});

			it("has a non-empty displayName", () => {
				const adapter = getAdapter(target);
				expect(typeof adapter.displayName).toBe("string");
				expect(adapter.displayName.length).toBeGreaterThan(0);
			});

			it("has a valid styleGuide", () => {
				const { styleGuide } = getAdapter(target);
				expect(["md", "mdx"]).toContain(styleGuide.pageExtension);
				expect(typeof styleGuide.supportsMdx).toBe("boolean");
				expect(typeof styleGuide.requiresFrontmatter).toBe("boolean");
				expect(styleGuide.maxHeadingDepth).toBeGreaterThanOrEqual(1);
				expect(Array.isArray(styleGuide.defaultImports)).toBe(true);
				expect(["typescript", "ts", "tsx"]).toContain(styleGuide.codeBlockLanguage);
			});

			it("scaffold returns a ScaffoldManifest with correct target", () => {
				const adapter = getAdapter(target);
				const manifest = adapter.scaffold(makeContext());
				expect(manifest.target).toBe(target);
				expect(Array.isArray(manifest.files)).toBe(true);
				expect(typeof manifest.dependencies).toBe("object");
				expect(typeof manifest.devDependencies).toBe("object");
				expect(typeof manifest.scripts).toBe("object");
				expect(Array.isArray(manifest.instructions)).toBe(true);
			});

			it("transformPages returns an array of GeneratedFile objects", () => {
				const adapter = getAdapter(target);
				const ctx = makeContext();
				const files = adapter.transformPages(samplePages, ctx);
				expect(Array.isArray(files)).toBe(true);
				expect(files).toHaveLength(samplePages.length);
				for (const file of files) {
					expect(typeof file.path).toBe("string");
					expect(typeof file.content).toBe("string");
				}
			});

			it("generateConfig returns an array of GeneratedFile objects", () => {
				const adapter = getAdapter(target);
				const ctx = makeContext();
				const configs = adapter.generateConfig(ctx);
				expect(Array.isArray(configs)).toBe(true);
				expect(configs.length).toBeGreaterThan(0);
				for (const file of configs) {
					expect(typeof file.path).toBe("string");
					expect(typeof file.content).toBe("string");
				}
			});

			it("detectExisting returns a boolean", async () => {
				const adapter = getAdapter(target);
				const result = await adapter.detectExisting("/tmp/nonexistent-forge-test-dir");
				expect(typeof result).toBe("boolean");
			});

			it("detectExisting returns false for a non-existent directory", async () => {
				const adapter = getAdapter(target);
				const result = await adapter.detectExisting("/tmp/nonexistent-forge-test-dir-xyz");
				expect(result).toBe(false);
			});
		});
	}
});

// ---------------------------------------------------------------------------
// Style guide values
// ---------------------------------------------------------------------------

describe("styleGuide values", () => {
	it("mintlify: pageExtension is mdx and supportsMdx is true", () => {
		const { styleGuide } = getAdapter("mintlify");
		expect(styleGuide.pageExtension).toBe("mdx");
		expect(styleGuide.supportsMdx).toBe(true);
		expect(styleGuide.requiresFrontmatter).toBe(true);
	});

	it("docusaurus: pageExtension is mdx and supportsMdx is true", () => {
		const { styleGuide } = getAdapter("docusaurus");
		expect(styleGuide.pageExtension).toBe("mdx");
		expect(styleGuide.supportsMdx).toBe(true);
	});

	it("nextra: pageExtension is mdx and requiresFrontmatter is false", () => {
		const { styleGuide } = getAdapter("nextra");
		expect(styleGuide.pageExtension).toBe("mdx");
		expect(styleGuide.requiresFrontmatter).toBe(false);
	});

	it("vitepress: pageExtension is md and supportsMdx is false", () => {
		const { styleGuide } = getAdapter("vitepress");
		expect(styleGuide.pageExtension).toBe("md");
		expect(styleGuide.supportsMdx).toBe(false);
		expect(styleGuide.requiresFrontmatter).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// transformPages — output shapes
// ---------------------------------------------------------------------------

describe("transformPages — file extensions", () => {
	it("mintlify: .md pages become .mdx", () => {
		const adapter = getAdapter("mintlify");
		const files = adapter.transformPages([page("test.md")], makeContext());
		expect(files[0].path).toBe("test.mdx");
	});

	it("docusaurus: .md pages become .mdx", () => {
		const adapter = getAdapter("docusaurus");
		const files = adapter.transformPages([page("test.md")], makeContext());
		expect(files[0].path).toBe("test.mdx");
	});

	it("nextra: .md pages become .mdx", () => {
		const adapter = getAdapter("nextra");
		const files = adapter.transformPages([page("test.md")], makeContext());
		expect(files[0].path).toBe("test.mdx");
	});

	it("vitepress: .mdx pages become .md", () => {
		const adapter = getAdapter("vitepress");
		const files = adapter.transformPages([page("test.mdx")], makeContext());
		expect(files[0].path).toBe("test.md");
	});

	it("vitepress: .md pages remain .md", () => {
		const adapter = getAdapter("vitepress");
		const files = adapter.transformPages([page("test.md")], makeContext());
		expect(files[0].path).toBe("test.md");
	});
});

// ---------------------------------------------------------------------------
// generateConfig — config file paths
// ---------------------------------------------------------------------------

describe("generateConfig — primary config file paths", () => {
	it("mintlify produces mint.json", () => {
		const configs = getAdapter("mintlify").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "mint.json")).toBe(true);
	});

	it("docusaurus produces sidebars.js", () => {
		const configs = getAdapter("docusaurus").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "sidebars.js")).toBe(true);
	});

	it("nextra produces _meta.json", () => {
		const configs = getAdapter("nextra").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "_meta.json")).toBe(true);
	});

	it("vitepress produces .vitepress/sidebar.json", () => {
		const configs = getAdapter("vitepress").generateConfig(makeContext());
		expect(configs.some((f) => f.path === ".vitepress/sidebar.json")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// generateConfig — JSON validity
// ---------------------------------------------------------------------------

describe("generateConfig — JSON validity", () => {
	it("mintlify mint.json is valid JSON", () => {
		const [file] = getAdapter("mintlify").generateConfig(makeContext());
		expect(() => JSON.parse(file.content)).not.toThrow();
	});

	it("nextra _meta.json files are all valid JSON", () => {
		const files = getAdapter("nextra").generateConfig(makeContext());
		for (const file of files) {
			expect(() => JSON.parse(file.content), `${file.path} invalid JSON`).not.toThrow();
		}
	});

	it("vitepress sidebar.json is valid JSON", () => {
		const [file] = getAdapter("vitepress").generateConfig(makeContext());
		expect(() => JSON.parse(file.content)).not.toThrow();
	});
});
