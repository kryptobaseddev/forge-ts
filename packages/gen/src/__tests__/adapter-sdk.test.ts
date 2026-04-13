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
import "../adapters/fumadocs.js";

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
		config: { project: {} } as AdapterContext["config"],
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
	it("returns all five targets", () => {
		const targets = getAvailableTargets();
		expect(targets).toContain("mintlify");
		expect(targets).toContain("docusaurus");
		expect(targets).toContain("nextra");
		expect(targets).toContain("vitepress");
		expect(targets).toContain("fumadocs");
	});

	it("returns exactly five targets", () => {
		const targets = getAvailableTargets();
		expect(targets).toHaveLength(5);
	});
});

describe("registry — DEFAULT_TARGET", () => {
	it('is "fumadocs"', () => {
		expect(DEFAULT_TARGET).toBe("fumadocs");
	});
});

// ---------------------------------------------------------------------------
// Interface contract — each adapter
// ---------------------------------------------------------------------------

const ALL_TARGETS: SSGTarget[] = ["mintlify", "docusaurus", "nextra", "vitepress", "fumadocs"];

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

	it("fumadocs: pageExtension is mdx, supportsMdx is true, requiresFrontmatter is true", () => {
		const { styleGuide } = getAdapter("fumadocs");
		expect(styleGuide.pageExtension).toBe("mdx");
		expect(styleGuide.supportsMdx).toBe(true);
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

	it("fumadocs: .md pages become .mdx", () => {
		const adapter = getAdapter("fumadocs");
		const files = adapter.transformPages([page("test.md")], makeContext());
		expect(files[0].path).toBe("test.mdx");
	});
});

// ---------------------------------------------------------------------------
// generateConfig — config file paths
// ---------------------------------------------------------------------------

describe("generateConfig — primary config file paths", () => {
	it("mintlify produces docs.json", () => {
		const configs = getAdapter("mintlify").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "docs.json")).toBe(true);
	});

	it("docusaurus produces sidebars.ts", () => {
		const configs = getAdapter("docusaurus").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "sidebars.ts")).toBe(true);
	});

	it("nextra produces content/_meta.js", () => {
		const configs = getAdapter("nextra").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "content/_meta.js")).toBe(true);
	});

	it("vitepress produces .vitepress/config.mts", () => {
		const configs = getAdapter("vitepress").generateConfig(makeContext());
		expect(configs.some((f) => f.path === ".vitepress/config.mts")).toBe(true);
	});

	it("fumadocs produces meta.json", () => {
		const configs = getAdapter("fumadocs").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "meta.json")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// generateConfig — content validity
// ---------------------------------------------------------------------------

describe("generateConfig — content validity", () => {
	it("mintlify docs.json is valid JSON", () => {
		const [file] = getAdapter("mintlify").generateConfig(makeContext());
		expect(() => JSON.parse(file.content)).not.toThrow();
	});

	it("mintlify docs.json has correct name field", () => {
		const [file] = getAdapter("mintlify").generateConfig(makeContext());
		const parsed = JSON.parse(file.content) as { name: string };
		expect(parsed.name).toBe("test-project");
	});

	it("nextra _meta.js files use ES module export syntax", () => {
		const files = getAdapter("nextra").generateConfig(makeContext());
		for (const file of files) {
			expect(file.content, `${file.path} missing export default`).toContain("export default");
		}
	});

	it("vitepress config.mts uses defineConfig", () => {
		const [file] = getAdapter("vitepress").generateConfig(makeContext());
		expect(file.content).toContain("defineConfig");
	});

	it("docusaurus sidebars.ts uses SidebarsConfig type", () => {
		const [file] = getAdapter("docusaurus").generateConfig(makeContext());
		expect(file.content).toContain("SidebarsConfig");
	});

	it("fumadocs meta.json files are valid JSON", () => {
		const files = getAdapter("fumadocs").generateConfig(makeContext());
		for (const file of files) {
			expect(() => JSON.parse(file.content), `${file.path} should be valid JSON`).not.toThrow();
		}
	});

	it("fumadocs meta.json has pages array", () => {
		const files = getAdapter("fumadocs").generateConfig(makeContext());
		const root = files.find((f) => f.path === "meta.json");
		expect(root).toBeDefined();
		const parsed = JSON.parse(root?.content ?? "{}");
		expect(parsed.title).toBe("Documentation");
		expect(Array.isArray(parsed.pages)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// scaffold — key file presence
// ---------------------------------------------------------------------------

describe("scaffold — key files present", () => {
	it("mintlify scaffold includes docs.json", () => {
		const manifest = getAdapter("mintlify").scaffold(makeContext());
		expect(manifest.files.some((f) => f.path === "docs.json")).toBe(true);
	});

	it("mintlify scaffold has empty dependencies (not a Node project)", () => {
		const manifest = getAdapter("mintlify").scaffold(makeContext());
		expect(Object.keys(manifest.dependencies)).toHaveLength(0);
		expect(Object.keys(manifest.devDependencies)).toHaveLength(0);
		expect(Object.keys(manifest.scripts)).toHaveLength(0);
	});

	it("mintlify scaffold instructions mention mint CLI", () => {
		const manifest = getAdapter("mintlify").scaffold(makeContext());
		const combined = manifest.instructions.join(" ");
		expect(combined).toContain("mint");
	});

	it("docusaurus scaffold includes docusaurus.config.ts and sidebars.ts", () => {
		const manifest = getAdapter("docusaurus").scaffold(makeContext());
		expect(manifest.files.some((f) => f.path === "docusaurus.config.ts")).toBe(true);
		expect(manifest.files.some((f) => f.path === "sidebars.ts")).toBe(true);
	});

	it("docusaurus scaffold has correct v3 dependencies", () => {
		const manifest = getAdapter("docusaurus").scaffold(makeContext());
		expect(manifest.dependencies["@docusaurus/core"]).toBe("^3.9.2");
		expect(manifest.dependencies["@docusaurus/preset-classic"]).toBe("^3.9.2");
		expect(manifest.dependencies.react).toBe("^19.0.0");
	});

	it("docusaurus scaffold includes docs:serve script", () => {
		const manifest = getAdapter("docusaurus").scaffold(makeContext());
		expect(manifest.scripts["docs:serve"]).toBe("docusaurus serve");
	});

	it("nextra scaffold includes next.config.ts and app/layout.tsx", () => {
		const manifest = getAdapter("nextra").scaffold(makeContext());
		expect(manifest.files.some((f) => f.path === "next.config.ts")).toBe(true);
		expect(manifest.files.some((f) => f.path === "app/layout.tsx")).toBe(true);
	});

	it("nextra scaffold has v4 dependencies", () => {
		const manifest = getAdapter("nextra").scaffold(makeContext());
		expect(manifest.dependencies.nextra).toBe("^4");
		expect(manifest.dependencies["nextra-theme-docs"]).toBe("^4");
		expect(manifest.dependencies.next).toBe("^15");
	});

	it("vitepress scaffold includes .vitepress/config.mts", () => {
		const manifest = getAdapter("vitepress").scaffold(makeContext());
		expect(manifest.files.some((f) => f.path === ".vitepress/config.mts")).toBe(true);
	});

	it("vitepress scaffold uses vitepress ^2", () => {
		const manifest = getAdapter("vitepress").scaffold(makeContext());
		expect(manifest.devDependencies.vitepress).toBe("^2.0.0");
	});

	it("vitepress scaffold includes docs:preview script", () => {
		const manifest = getAdapter("vitepress").scaffold(makeContext());
		expect(manifest.scripts["docs:preview"]).toBe("vitepress preview");
	});

	it("fumadocs scaffold includes ../site/source.config.ts and ../site/src/app/layout.tsx", () => {
		const manifest = getAdapter("fumadocs").scaffold(makeContext());
		expect(manifest.files.some((f) => f.path === "../site/source.config.ts")).toBe(true);
		expect(manifest.files.some((f) => f.path === "../site/src/app/layout.tsx")).toBe(true);
	});

	it("fumadocs scaffold includes docs layout and catch-all page in ../site/", () => {
		const manifest = getAdapter("fumadocs").scaffold(makeContext());
		expect(manifest.files.some((f) => f.path === "../site/src/app/docs/layout.tsx")).toBe(true);
		expect(manifest.files.some((f) => f.path === "../site/src/app/docs/[[...slug]]/page.tsx")).toBe(
			true,
		);
	});

	it("fumadocs scaffold has correct dependencies", () => {
		const manifest = getAdapter("fumadocs").scaffold(makeContext());
		expect(manifest.dependencies["fumadocs-core"]).toBe("^16");
		expect(manifest.dependencies["fumadocs-mdx"]).toBe("^14");
		expect(manifest.dependencies["fumadocs-ui"]).toBe("^16");
		expect(manifest.dependencies.next).toBe("^16");
	});

	it("fumadocs scaffold has Tailwind v4 devDependencies", () => {
		const manifest = getAdapter("fumadocs").scaffold(makeContext());
		expect(manifest.devDependencies.tailwindcss).toBe("^4");
		expect(manifest.devDependencies["@tailwindcss/postcss"]).toBe("^4");
	});

	it("fumadocs scaffold includes docs:dev script", () => {
		const manifest = getAdapter("fumadocs").scaffold(makeContext());
		expect(manifest.scripts["docs:dev"]).toBe("next dev");
	});

	it("fumadocs scaffold instructions mention dev", () => {
		const manifest = getAdapter("fumadocs").scaffold(makeContext());
		const combined = manifest.instructions.join(" ");
		expect(combined).toContain("docs:dev");
	});
});

// ---------------------------------------------------------------------------
// transformPages — frontmatter
// ---------------------------------------------------------------------------

describe("transformPages — frontmatter", () => {
	it("fumadocs transformPages adds title and description frontmatter", () => {
		const adapter = getAdapter("fumadocs");
		const pages: DocPage[] = [
			{
				path: "test.md",
				content: "# Hello\n\nBody.\n",
				frontmatter: { title: "Hello", description: "A test" },
			},
		];
		const files = adapter.transformPages(pages, makeContext());
		expect(files[0].content).toContain("title: Hello");
		expect(files[0].content).toContain("description: A test");
	});

	it("fumadocs transformPages preserves stub flag", () => {
		const adapter = getAdapter("fumadocs");
		const pages: DocPage[] = [
			{ path: "test.md", content: "# Stub\n", frontmatter: { title: "Stub" }, stub: true },
		];
		const files = adapter.transformPages(pages, makeContext());
		expect(files[0].stub).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// generateConfig — Fumadocs meta.json structure
// ---------------------------------------------------------------------------

describe("generateConfig — fumadocs meta.json structure", () => {
	it("fumadocs generateConfig creates per-package meta.json", () => {
		const configs = getAdapter("fumadocs").generateConfig(makeContext());
		expect(configs.some((f) => f.path === "packages/core/meta.json")).toBe(true);
	});

	it("fumadocs generateConfig root includes packages separator", () => {
		const configs = getAdapter("fumadocs").generateConfig(makeContext());
		const root = configs.find((f) => f.path === "meta.json");
		const parsed = JSON.parse(root?.content ?? "{}");
		expect(parsed.pages).toContain("---Packages---");
		expect(parsed.pages).toContain("packages");
	});

	it("fumadocs generateConfig puts index first in page ordering", () => {
		const configs = getAdapter("fumadocs").generateConfig(makeContext());
		const root = configs.find((f) => f.path === "meta.json");
		const parsed = JSON.parse(root?.content ?? "{}");
		expect(parsed.pages[0]).toBe("index");
	});
});
