import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { describe, expect, it } from "vitest";
import { generateDocSite, groupSymbolsByPackage } from "../site-generator.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ForgeConfig["gen"]> = {}): ForgeConfig {
	return {
		rootDir: "/project",
		tsconfig: "/project/tsconfig.json",
		outDir: "/project/docs",
		enforce: { enabled: false, minVisibility: Visibility.Public, strict: false },
		doctest: { enabled: false, cacheDir: "/project/.cache" },
		api: { enabled: false, openapi: false, openapiPath: "/project/docs/openapi.json" },
		gen: {
			enabled: true,
			formats: ["markdown"],
			llmsTxt: false,
			readmeSync: false,
			...overrides,
		},
	};
}

function sym(overrides: Partial<ForgeSymbol> & Pick<ForgeSymbol, "name" | "kind">): ForgeSymbol {
	return {
		visibility: Visibility.Public,
		filePath: "/project/src/index.ts",
		line: 1,
		column: 0,
		exported: true,
		...overrides,
	};
}

const fnAdd = sym({
	name: "add",
	kind: "function",
	signature: "function add(a: number, b: number): number",
	documentation: {
		summary: "Adds two numbers together.",
		params: [
			{ name: "a", description: "First number", type: "number" },
			{ name: "b", description: "Second number", type: "number" },
		],
		returns: { description: "The sum of a and b", type: "number" },
		examples: [
			{
				code: 'import { add } from "@project/core";\nconst result = add(1, 2); // => 3',
				language: "typescript",
				line: 10,
			},
		],
	},
});

const fnSubtract = sym({
	name: "subtract",
	kind: "function",
	signature: "function subtract(a: number, b: number): number",
	documentation: {
		summary: "Subtracts b from a.",
		deprecated: "Use `math.sub()` instead.",
	},
});

const ifaceConfig = sym({
	name: "CalculatorConfig",
	kind: "interface",
	documentation: {
		summary: "Configuration for the calculator.",
	},
	children: [
		sym({
			name: "precision",
			kind: "property",
			signature: "precision: number",
			documentation: { summary: "Number of decimal places." },
		}),
		sym({
			name: "mode",
			kind: "property",
			signature: 'mode: "standard" | "scientific"',
			documentation: { summary: "Calculator mode." },
		}),
		sym({
			name: "label",
			kind: "property",
			signature: "label?: string",
			documentation: { summary: "Optional label." },
		}),
	],
});

const typeAlias = sym({
	name: "ID",
	kind: "type",
	signature: "type ID = string | number",
	documentation: { summary: "Identifier type." },
});

const baseOptions = {
	format: "markdown" as const,
	projectName: "my-project",
	projectDescription: "A test project.",
};

function makeSymbolsByPackage(symbols: ForgeSymbol[]): Map<string, ForgeSymbol[]> {
	const map = new Map<string, ForgeSymbol[]>();
	map.set("core", symbols);
	return map;
}

// ---------------------------------------------------------------------------
// groupSymbolsByPackage
// ---------------------------------------------------------------------------

describe("groupSymbolsByPackage", () => {
	it("groups symbols from packages/<name>/ under that package name", () => {
		const s1 = sym({
			name: "foo",
			kind: "function",
			filePath: "/project/packages/core/src/index.ts",
		});
		const s2 = sym({
			name: "bar",
			kind: "function",
			filePath: "/project/packages/enforcer/src/index.ts",
		});
		const result = groupSymbolsByPackage([s1, s2], "/project");
		expect(result.get("core")).toHaveLength(1);
		expect(result.get("enforcer")).toHaveLength(1);
	});

	it("groups all symbols under root project name for non-monorepo projects", () => {
		const s1 = sym({
			name: "foo",
			kind: "function",
			filePath: "/project/src/index.ts",
		});
		const result = groupSymbolsByPackage([s1], "/project");
		// Should be under "project" (basename of rootDir)
		expect(result.get("project")).toHaveLength(1);
	});

	it("returns an empty map for empty input", () => {
		const result = groupSymbolsByPackage([], "/project");
		expect(result.size).toBe(0);
	});

	it("keeps all symbols from the same package together", () => {
		const s1 = sym({
			name: "alpha",
			kind: "function",
			filePath: "/project/packages/core/src/alpha.ts",
		});
		const s2 = sym({
			name: "beta",
			kind: "interface",
			filePath: "/project/packages/core/src/beta.ts",
		});
		const result = groupSymbolsByPackage([s1, s2], "/project");
		expect(result.get("core")).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// generateDocSite — top-level structure
// ---------------------------------------------------------------------------

describe("generateDocSite", () => {
	it("generates an index page and a getting-started page", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("index.md");
		expect(paths).toContain("getting-started.md");
	});

	it("generates per-package pages for each package", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("packages/core/index.md");
		expect(paths).toContain("packages/core/api-reference.md");
		expect(paths).toContain("packages/core/types.md");
		expect(paths).toContain("packages/core/functions.md");
		expect(paths).toContain("packages/core/examples.md");
	});

	it("generates pages for multiple packages", () => {
		const map = new Map<string, ForgeSymbol[]>([
			["core", [fnAdd]],
			["enforcer", [typeAlias]],
		]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("packages/core/index.md");
		expect(paths).toContain("packages/enforcer/index.md");
	});

	it("uses mdx extension when format is mdx", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig({ formats: ["mdx"] }), {
			...baseOptions,
			format: "mdx",
		});
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("index.mdx");
		expect(paths).toContain("packages/core/api-reference.mdx");
	});
});

// ---------------------------------------------------------------------------
// Index page
// ---------------------------------------------------------------------------

describe("index page", () => {
	it("includes the project name", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("my-project");
	});

	it("includes the project description", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("A test project.");
	});

	it("lists all packages as links", () => {
		const map = new Map<string, ForgeSymbol[]>([
			["core", [fnAdd]],
			["cli", [typeAlias]],
		]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("core");
		expect(index?.content).toContain("cli");
	});
});

// ---------------------------------------------------------------------------
// Getting started page
// ---------------------------------------------------------------------------

describe("getting-started page", () => {
	it("contains the project name", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("my-project");
	});

	it("extracts the first @example from the most prominent function", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("add(1, 2)");
	});

	it("includes installation instructions", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("npm install");
	});
});

// ---------------------------------------------------------------------------
// Package overview (index) page
// ---------------------------------------------------------------------------

describe("package overview page", () => {
	it("contains the package name as heading", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const overview = pages.find((p) => p.path === "packages/core/index.md");
		expect(overview?.content).toContain("# core");
	});

	it("lists exported symbols as a table", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const overview = pages.find((p) => p.path === "packages/core/index.md");
		expect(overview?.content).toContain("| Symbol | Kind | Description |");
		expect(overview?.content).toContain("add");
		expect(overview?.content).toContain("CalculatorConfig");
	});
});

// ---------------------------------------------------------------------------
// API reference page
// ---------------------------------------------------------------------------

describe("api-reference page", () => {
	it("includes all exported symbols", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig, typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api-reference.md");
		expect(api?.content).toContain("`add()`");
		expect(api?.content).toContain("`CalculatorConfig`");
		expect(api?.content).toContain("`ID`");
	});

	it("renders function signatures", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api-reference.md");
		expect(api?.content).toContain("function add(a: number, b: number): number");
	});

	it("includes deprecation notices", () => {
		const map = makeSymbolsByPackage([fnSubtract]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api-reference.md");
		expect(api?.content).toContain("**Deprecated**");
		expect(api?.content).toContain("math.sub()");
	});
});

// ---------------------------------------------------------------------------
// Types page
// ---------------------------------------------------------------------------

describe("types page", () => {
	it("includes interfaces with property tables", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/types.md");
		expect(typesPage?.content).toContain("CalculatorConfig");
		expect(typesPage?.content).toContain("| Property | Type | Required | Description |");
		expect(typesPage?.content).toContain("`precision`");
		expect(typesPage?.content).toContain("`mode`");
		expect(typesPage?.content).toContain("`label`");
	});

	it("includes type aliases with their signature", () => {
		const map = makeSymbolsByPackage([typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/types.md");
		expect(typesPage?.content).toContain("ID");
		expect(typesPage?.content).toContain("type ID = string | number");
	});

	it("does not include function symbols", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/types.md");
		// Should not have a section for the `add` function
		expect(typesPage?.content).not.toContain("## add");
	});

	it("marks optional properties with No in Required column", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/types.md");
		// label? is optional, so Required = No
		expect(typesPage?.content).toMatch(/`label`[^|]*\|[^|]*\| No \|/);
	});
});

// ---------------------------------------------------------------------------
// Functions page
// ---------------------------------------------------------------------------

describe("functions page", () => {
	it("includes function headings with parameter names", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/functions.md");
		expect(fnPage?.content).toContain("## add(a, b)");
	});

	it("includes a parameter table", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/functions.md");
		expect(fnPage?.content).toContain("| Name | Type | Description |");
		expect(fnPage?.content).toContain("`a`");
		expect(fnPage?.content).toContain("`b`");
	});

	it("includes the Returns line", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/functions.md");
		expect(fnPage?.content).toContain("**Returns**");
		expect(fnPage?.content).toContain("The sum of a and b");
	});

	it("includes the first example", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/functions.md");
		expect(fnPage?.content).toContain("**Example**");
		expect(fnPage?.content).toContain("add(1, 2)");
	});

	it("includes the code signature block", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/functions.md");
		expect(fnPage?.content).toContain("**Signature**");
		expect(fnPage?.content).toContain("function add(a: number, b: number): number");
	});

	it("does not include type-only symbols", () => {
		const map = makeSymbolsByPackage([ifaceConfig, typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/functions.md");
		expect(fnPage?.content).not.toContain("## CalculatorConfig");
		expect(fnPage?.content).not.toContain("## ID");
	});
});

// ---------------------------------------------------------------------------
// Examples page
// ---------------------------------------------------------------------------

describe("examples page", () => {
	it("aggregates all @example blocks from the package", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/examples.md");
		expect(exPage?.content).toContain("add(1, 2)");
	});

	it("shows which symbol each example belongs to", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/examples.md");
		expect(exPage?.content).toContain("`add()`");
	});

	it("links back to the api-reference page", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/examples.md");
		expect(exPage?.content).toContain("api-reference.md");
	});

	it("shows a placeholder when no examples exist", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/examples.md");
		expect(exPage?.content).toContain("No examples documented yet");
	});
});

// ---------------------------------------------------------------------------
// Frontmatter — SSG targets
// ---------------------------------------------------------------------------

describe("frontmatter — SSG targets", () => {
	it("docusaurus: adds title, sidebar_label, sidebar_position", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig({ ssgTarget: "docusaurus" }), {
			...baseOptions,
			ssgTarget: "docusaurus",
		});
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toMatch(/^---/);
		expect(index?.content).toContain("title:");
		expect(index?.content).toContain("sidebar_label:");
		expect(index?.content).toContain("sidebar_position:");
		expect(index?.frontmatter.sidebar_position).toBeDefined();
	});

	it("mintlify: adds title and description", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig({ ssgTarget: "mintlify" }), {
			...baseOptions,
			ssgTarget: "mintlify",
		});
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("title:");
		expect(index?.frontmatter.title).toBe("my-project");
	});

	it("nextra: adds title only", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig({ ssgTarget: "nextra" }), {
			...baseOptions,
			ssgTarget: "nextra",
		});
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("title:");
		expect(index?.frontmatter.title).toBe("my-project");
	});

	it("vitepress: adds title and outline: deep", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig({ ssgTarget: "vitepress" }), {
			...baseOptions,
			ssgTarget: "vitepress",
		});
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("outline: deep");
		expect(index?.frontmatter.outline).toBe("deep");
	});

	it("no ssgTarget: produces no frontmatter", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).not.toMatch(/^---/);
		expect(Object.keys(index?.frontmatter ?? {})).toHaveLength(0);
	});
});
