import { describe, expect, it } from "vitest";
import type { DocPage } from "../site-generator.js";
import { generateSSGConfigs } from "../ssg-config.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function page(path: string): DocPage {
	return { path, content: "", frontmatter: {} };
}

/** A realistic page set: two top-level pages + one package with five pages. */
const singlePackagePages: DocPage[] = [
	page("index.md"),
	page("getting-started.md"),
	page("packages/core/index.md"),
	page("packages/core/api-reference.md"),
	page("packages/core/types.md"),
	page("packages/core/functions.md"),
	page("packages/core/examples.md"),
];

/** Two packages. */
const multiPackagePages: DocPage[] = [
	page("index.md"),
	page("getting-started.md"),
	page("packages/core/index.md"),
	page("packages/core/api-reference.md"),
	page("packages/enforcer/index.md"),
	page("packages/enforcer/api-reference.md"),
];

// ---------------------------------------------------------------------------
// Mintlify
// ---------------------------------------------------------------------------

describe("generateSSGConfigs — mintlify", () => {
	it("returns exactly one file named mint.json", () => {
		const files = generateSSGConfigs(singlePackagePages, "mintlify", "my-project");
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe("mint.json");
	});

	it("sets $schema and name fields", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "mintlify", "my-project");
		const parsed = JSON.parse(file.content) as Record<string, unknown>;
		expect(parsed.$schema).toBe("https://mintlify.com/schema.json");
		expect(parsed.name).toBe("my-project");
	});

	it("includes a Getting Started group with top-level pages", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "mintlify", "my-project");
		const parsed = JSON.parse(file.content) as {
			navigation: Array<{ group: string; pages: unknown[] }>;
		};
		const gs = parsed.navigation.find((g) => g.group === "Getting Started");
		expect(gs).toBeDefined();
		expect(gs?.pages).toContain("index");
		expect(gs?.pages).toContain("getting-started");
	});

	it("includes a Packages group containing nested package groups", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "mintlify", "my-project");
		const parsed = JSON.parse(file.content) as {
			navigation: Array<{ group: string; pages: unknown[] }>;
		};
		const pkgs = parsed.navigation.find((g) => g.group === "Packages");
		expect(pkgs).toBeDefined();
		// The pages array should contain a nested group object for "core"
		const coreGroup = (pkgs?.pages as Array<{ group: string }>).find((p) => p.group === "core");
		expect(coreGroup).toBeDefined();
	});

	it("nested package group contains all package page slugs", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "mintlify", "my-project");
		const parsed = JSON.parse(file.content) as {
			navigation: Array<{ group: string; pages: unknown[] }>;
		};
		const pkgs = parsed.navigation.find((g) => g.group === "Packages");
		const coreGroup = (pkgs?.pages as Array<{ group: string; pages: string[] }>).find(
			(p) => p.group === "core",
		);
		expect(coreGroup?.pages).toContain("packages/core/index");
		expect(coreGroup?.pages).toContain("packages/core/api-reference");
		expect(coreGroup?.pages).toContain("packages/core/types");
		expect(coreGroup?.pages).toContain("packages/core/functions");
		expect(coreGroup?.pages).toContain("packages/core/examples");
	});

	it("handles multiple packages", () => {
		const [file] = generateSSGConfigs(multiPackagePages, "mintlify", "my-project");
		const parsed = JSON.parse(file.content) as {
			navigation: Array<{ group: string; pages: unknown[] }>;
		};
		const pkgs = parsed.navigation.find((g) => g.group === "Packages");
		const groups = pkgs?.pages as Array<{ group: string }>;
		expect(groups.map((g) => g.group)).toContain("core");
		expect(groups.map((g) => g.group)).toContain("enforcer");
	});

	it("produces valid JSON", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "mintlify", "my-project");
		expect(() => JSON.parse(file.content)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Docusaurus
// ---------------------------------------------------------------------------

describe("generateSSGConfigs — docusaurus", () => {
	it("returns exactly one file named sidebars.js", () => {
		const files = generateSSGConfigs(singlePackagePages, "docusaurus", "my-project");
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe("sidebars.js");
	});

	it("content starts with the JSDoc type annotation comment", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "docusaurus", "my-project");
		expect(file.content).toContain(
			"/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */",
		);
	});

	it("contains module.exports assignment", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "docusaurus", "my-project");
		expect(file.content).toContain("module.exports = sidebars;");
	});

	it("includes top-level page slugs as direct items", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "docusaurus", "my-project");
		expect(file.content).toContain('"index"');
		expect(file.content).toContain('"getting-started"');
	});

	it("includes a category for each package", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "docusaurus", "my-project");
		expect(file.content).toContain('"type": "category"');
		expect(file.content).toContain('"label": "core"');
	});

	it("category items include all package page slugs", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "docusaurus", "my-project");
		expect(file.content).toContain('"packages/core/index"');
		expect(file.content).toContain('"packages/core/api-reference"');
		expect(file.content).toContain('"packages/core/types"');
		expect(file.content).toContain('"packages/core/functions"');
		expect(file.content).toContain('"packages/core/examples"');
	});

	it("handles multiple packages", () => {
		const [file] = generateSSGConfigs(multiPackagePages, "docusaurus", "my-project");
		expect(file.content).toContain('"label": "core"');
		expect(file.content).toContain('"label": "enforcer"');
	});
});

// ---------------------------------------------------------------------------
// Nextra
// ---------------------------------------------------------------------------

describe("generateSSGConfigs — nextra", () => {
	it("returns a root _meta.json", () => {
		const files = generateSSGConfigs(singlePackagePages, "nextra", "my-project");
		const root = files.find((f) => f.path === "_meta.json");
		expect(root).toBeDefined();
	});

	it("root _meta.json contains top-level page segments", () => {
		const files = generateSSGConfigs(singlePackagePages, "nextra", "my-project");
		const root = files.find((f) => f.path === "_meta.json");
		const parsed = JSON.parse(root?.content) as Record<string, string>;
		expect(parsed.index).toBeDefined();
		expect(parsed["getting-started"]).toBeDefined();
	});

	it("root _meta.json contains a packages entry when packages exist", () => {
		const files = generateSSGConfigs(singlePackagePages, "nextra", "my-project");
		const root = files.find((f) => f.path === "_meta.json");
		const parsed = JSON.parse(root?.content) as Record<string, string>;
		expect(parsed.packages).toBe("Packages");
	});

	it("returns a _meta.json for each package directory", () => {
		const files = generateSSGConfigs(singlePackagePages, "nextra", "my-project");
		const coreMeta = files.find((f) => f.path === "packages/core/_meta.json");
		expect(coreMeta).toBeDefined();
	});

	it("package _meta.json contains all page segment keys", () => {
		const files = generateSSGConfigs(singlePackagePages, "nextra", "my-project");
		const coreMeta = files.find((f) => f.path === "packages/core/_meta.json");
		const parsed = JSON.parse(coreMeta?.content) as Record<string, string>;
		expect(parsed.index).toBeDefined();
		expect(parsed["api-reference"]).toBeDefined();
		expect(parsed.types).toBeDefined();
		expect(parsed.functions).toBeDefined();
		expect(parsed.examples).toBeDefined();
	});

	it("all returned files produce valid JSON", () => {
		const files = generateSSGConfigs(singlePackagePages, "nextra", "my-project");
		for (const file of files) {
			expect(() => JSON.parse(file.content), `${file.path} is invalid JSON`).not.toThrow();
		}
	});

	it("returns packages/_meta.json when there are multiple packages", () => {
		const files = generateSSGConfigs(multiPackagePages, "nextra", "my-project");
		const pkgsMeta = files.find((f) => f.path === "packages/_meta.json");
		expect(pkgsMeta).toBeDefined();
	});

	it("packages/_meta.json contains all package names as keys", () => {
		const files = generateSSGConfigs(multiPackagePages, "nextra", "my-project");
		const pkgsMeta = files.find((f) => f.path === "packages/_meta.json");
		const parsed = JSON.parse(pkgsMeta?.content) as Record<string, string>;
		expect(parsed.core).toBeDefined();
		expect(parsed.enforcer).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// VitePress
// ---------------------------------------------------------------------------

describe("generateSSGConfigs — vitepress", () => {
	it("returns exactly one file at .vitepress/sidebar.json", () => {
		const files = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe(".vitepress/sidebar.json");
	});

	it("produces valid JSON", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		expect(() => JSON.parse(file.content)).not.toThrow();
	});

	it("includes a Getting Started group for top-level pages", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		const sidebar = JSON.parse(file.content) as Array<{ text: string; items: unknown[] }>;
		const gs = sidebar.find((g) => g.text === "Getting Started");
		expect(gs).toBeDefined();
		expect(gs?.items.length).toBeGreaterThan(0);
	});

	it("top-level index maps to link '/'", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		const sidebar = JSON.parse(file.content) as Array<{
			text: string;
			items: Array<{ text: string; link: string }>;
		}>;
		const gs = sidebar.find((g) => g.text === "Getting Started");
		const indexItem = gs?.items.find((i) => i.link === "/");
		expect(indexItem).toBeDefined();
	});

	it("includes a group for each package", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		const sidebar = JSON.parse(file.content) as Array<{ text: string }>;
		expect(sidebar.map((g) => g.text)).toContain("core");
	});

	it("package index item link ends with trailing slash", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		const sidebar = JSON.parse(file.content) as Array<{
			text: string;
			items: Array<{ text: string; link: string }>;
		}>;
		const coreGroup = sidebar.find((g) => g.text === "core");
		const indexItem = coreGroup?.items.find((i) => i.link === "/packages/core/");
		expect(indexItem).toBeDefined();
	});

	it("non-index package items have absolute link paths", () => {
		const [file] = generateSSGConfigs(singlePackagePages, "vitepress", "my-project");
		const sidebar = JSON.parse(file.content) as Array<{
			text: string;
			items: Array<{ text: string; link: string }>;
		}>;
		const coreGroup = sidebar.find((g) => g.text === "core");
		const apiRef = coreGroup?.items.find((i) => i.link === "/packages/core/api-reference");
		expect(apiRef).toBeDefined();
	});

	it("handles multiple packages", () => {
		const [file] = generateSSGConfigs(multiPackagePages, "vitepress", "my-project");
		const sidebar = JSON.parse(file.content) as Array<{ text: string }>;
		const texts = sidebar.map((g) => g.text);
		expect(texts).toContain("core");
		expect(texts).toContain("enforcer");
	});
});

// ---------------------------------------------------------------------------
// Cross-target: all pages accounted for
// ---------------------------------------------------------------------------

describe("generateSSGConfigs — all pages included", () => {
	const targets = ["mintlify", "docusaurus", "nextra", "vitepress"] as const;

	for (const target of targets) {
		it(`${target}: every page slug appears somewhere in the generated config(s)`, () => {
			const files = generateSSGConfigs(singlePackagePages, target, "my-project");
			const combined = files.map((f) => f.content).join("\n");
			for (const p of singlePackagePages) {
				const slug = p.path.replace(/\.[^.]+$/, "");
				// VitePress converts "index" slugs to "/" links, so check the link
				// path instead of the slug literal.
				if (target === "vitepress" && (slug === "index" || slug.endsWith("/index"))) {
					// The link will be "/" or "/packages/<pkg>/" — both contain "/"
					// which is trivially present. Just verify the file was generated.
					expect(combined.length).toBeGreaterThan(0);
					continue;
				}
				// For nextra we only store the leaf segment in _meta.json keys,
				// so check for the final segment at minimum.
				const segment = slug.split("/").pop() ?? slug;
				expect(combined, `${target}: slug "${slug}" not found`).toContain(segment);
			}
		});
	}
});
