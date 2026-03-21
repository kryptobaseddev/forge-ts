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
		skill: {},
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
	it("generates ORIENT pages: index and getting-started", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("index.md");
		expect(paths).toContain("getting-started.md");
	});

	it("generates LEARN page: concepts", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("concepts.md");
	});

	it("generates BUILD page: guides/index", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("guides/index.md");
	});

	it("generates REFERENCE project-level pages: configuration, changelog", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("configuration.md");
		expect(paths).toContain("changelog.md");
	});

	it("generates COMMUNITY pages: faq, contributing", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("faq.md");
		expect(paths).toContain("contributing.md");
	});

	it("generates per-package pages under api/ subdirectory", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).toContain("packages/core/index.md");
		expect(paths).toContain("packages/core/api/index.md");
		expect(paths).toContain("packages/core/api/types.md");
		expect(paths).toContain("packages/core/api/functions.md");
		expect(paths).toContain("packages/core/api/examples.md");
	});

	it("does NOT generate old flat api-reference path", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).not.toContain("packages/core/api-reference.md");
	});

	it("does NOT generate old flat types/functions/examples paths", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);
		expect(paths).not.toContain("packages/core/types.md");
		expect(paths).not.toContain("packages/core/functions.md");
		expect(paths).not.toContain("packages/core/examples.md");
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
		expect(paths).toContain("packages/core/api/index.mdx");
	});
});

// ---------------------------------------------------------------------------
// Index page (ORIENT)
// ---------------------------------------------------------------------------

describe("index page", () => {
	it("includes the project name in content", () => {
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

	it("includes a Features section", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("## Features");
	});

	it("includes an Installation section with npm install", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("## Installation");
		expect(index?.content).toContain("npm install");
	});

	it("includes a Quick Example when @example blocks exist", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("## Quick Example");
		expect(index?.content).toContain("add(1, 2)");
	});

	it("includes a Packages table listing all packages", () => {
		const map = new Map<string, ForgeSymbol[]>([
			["core", [fnAdd]],
			["cli", [typeAlias]],
		]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("## Packages");
		expect(index?.content).toContain("core");
		expect(index?.content).toContain("cli");
	});

	it("includes a Next Steps section with links", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const index = pages.find((p) => p.path === "index.md");
		expect(index?.content).toContain("## Next Steps");
		expect(index?.content).toContain("/getting-started");
	});
});

// ---------------------------------------------------------------------------
// Getting started page (ORIENT)
// ---------------------------------------------------------------------------

describe("getting-started page", () => {
	it("contains the project name", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("my-project");
	});

	it("has Step 1 Install, Step 2, Step 3, Step 4 headings", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("## Step 1: Install");
		expect(gs?.content).toContain("## Step 2:");
		expect(gs?.content).toContain("## Step 3:");
		expect(gs?.content).toContain("## Step 4:");
	});

	it("includes installation instructions", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("npm install");
	});

	it("extracts the first @example and shows it in the tutorial", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("add(1, 2)");
	});

	it("includes a What's Next section with links to other pages", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const gs = pages.find((p) => p.path === "getting-started.md");
		expect(gs?.content).toContain("What's Next");
		expect(gs?.content).toContain("/concepts");
	});
});

// ---------------------------------------------------------------------------
// Concepts page (LEARN)
// ---------------------------------------------------------------------------

describe("concepts page", () => {
	it("contains a stub notice for manual editing", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const concepts = pages.find((p) => p.path === "concepts.md");
		expect(concepts?.content).toContain("stub");
	});

	it("includes a How It Works section", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const concepts = pages.find((p) => p.path === "concepts.md");
		expect(concepts?.content).toContain("## How It Works");
	});

	it("includes Key Abstractions section when type symbols exist", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig, typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const concepts = pages.find((p) => p.path === "concepts.md");
		expect(concepts?.content).toContain("## Key Abstractions");
		expect(concepts?.content).toContain("CalculatorConfig");
		expect(concepts?.content).toContain("ID");
	});

	it("does not include function symbols in Key Abstractions", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const concepts = pages.find((p) => p.path === "concepts.md");
		// No type symbols, so Key Abstractions section should be absent
		expect(concepts?.content).not.toContain("## Key Abstractions");
	});

	it("wraps auto sections in FORGE:AUTO markers for progressive enrichment", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const concepts = pages.find((p) => p.path === "concepts.md");
		expect(concepts?.content).toContain("<!-- FORGE:AUTO-START how-it-works -->");
		expect(concepts?.content).toContain("<!-- FORGE:AUTO-END how-it-works -->");
		expect(concepts?.content).toContain("<!-- FORGE:AUTO-START key-abstractions -->");
		expect(concepts?.content).toContain("<!-- FORGE:AUTO-END key-abstractions -->");
	});

	it("is marked as a stub page", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const concepts = pages.find((p) => p.path === "concepts.md");
		expect(concepts?.stub).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Guides page (BUILD)
// ---------------------------------------------------------------------------

describe("guides/index page", () => {
	it("contains a stub notice blockquote", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const guides = pages.find((p) => p.path === "guides/index.md");
		expect(guides?.content).toContain("> Add your guides");
	});

	it("mentions the guides/ directory", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const guides = pages.find((p) => p.path === "guides/index.md");
		expect(guides?.content).toContain("guides/");
	});
});

// ---------------------------------------------------------------------------
// Package overview (packages/<name>/index)
// ---------------------------------------------------------------------------

describe("package overview page", () => {
	it("contains the package name in content", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const overview = pages.find((p) => p.path === "packages/core/index.md");
		expect(overview?.content).toContain("core");
	});

	it("lists exported symbols as a table", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const overview = pages.find((p) => p.path === "packages/core/index.md");
		expect(overview?.content).toMatch(/\| Symbol\s+\| Kind\s+\| Description\s+\|/);
		expect(overview?.content).toContain("add");
		expect(overview?.content).toContain("CalculatorConfig");
	});

	it("links symbols to api/index", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const overview = pages.find((p) => p.path === "packages/core/index.md");
		expect(overview?.content).toContain("api/index");
	});
});

// ---------------------------------------------------------------------------
// API index page (packages/<name>/api/index)
// ---------------------------------------------------------------------------

describe("api/index page", () => {
	it("includes all exported symbols in a table", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig, typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api/index.md");
		expect(api?.content).toContain("add");
		expect(api?.content).toContain("CalculatorConfig");
		expect(api?.content).toContain("ID");
	});

	it("links functions to api/functions page", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api/index.md");
		expect(api?.content).toContain("api/functions");
	});

	it("links types to api/types page", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api/index.md");
		expect(api?.content).toContain("api/types");
	});

	it("has a Symbol Kind Description header row", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const api = pages.find((p) => p.path === "packages/core/api/index.md");
		expect(api?.content).toMatch(/\| Symbol\s+\| Kind\s+\| Description\s+\|/);
	});
});

// ---------------------------------------------------------------------------
// Types page (packages/<name>/api/types)
// ---------------------------------------------------------------------------

describe("api/types page", () => {
	it("is at the new api/types path", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/api/types.md");
		expect(typesPage).toBeDefined();
	});

	it("includes interfaces with property tables", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/api/types.md");
		expect(typesPage?.content).toContain("CalculatorConfig");
		expect(typesPage?.content).toMatch(/\| Property\s+\| Type\s+\| Required\s+\| Description\s+\|/);
		expect(typesPage?.content).toContain("`precision`");
		expect(typesPage?.content).toContain("`mode`");
		expect(typesPage?.content).toContain("`label`");
	});

	it("includes type aliases with their signature", () => {
		const map = makeSymbolsByPackage([typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/api/types.md");
		expect(typesPage?.content).toContain("ID");
		expect(typesPage?.content).toContain("type ID = string | number");
	});

	it("does not include function symbols", () => {
		const map = makeSymbolsByPackage([fnAdd, ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/api/types.md");
		expect(typesPage?.content).not.toContain("## add");
	});

	it("marks optional properties with No in Required column", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const typesPage = pages.find((p) => p.path === "packages/core/api/types.md");
		// label? is optional, so Required = No
		expect(typesPage?.content).toMatch(/`label`[^|]*\|[^|]*\| No\s+\|/);
	});
});

// ---------------------------------------------------------------------------
// Functions page (packages/<name>/api/functions)
// ---------------------------------------------------------------------------

describe("api/functions page", () => {
	it("is at the new api/functions path", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage).toBeDefined();
	});

	it("includes function headings with parameter names", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).toContain("## add(a, b)");
	});

	it("includes a parameter table", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).toMatch(/\| Name\s+\| Type\s+\| Description\s+\|/);
		expect(fnPage?.content).toContain("`a`");
		expect(fnPage?.content).toContain("`b`");
	});

	it("includes the Returns line", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).toContain("**Returns**");
		expect(fnPage?.content).toContain("The sum of a and b");
	});

	it("includes the first example", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).toContain("**Example**");
		expect(fnPage?.content).toContain("add(1, 2)");
	});

	it("includes the code signature block", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).toContain("**Signature**");
		expect(fnPage?.content).toContain("function add(a: number, b: number): number");
	});

	it("does not include type-only symbols", () => {
		const map = makeSymbolsByPackage([ifaceConfig, typeAlias]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).not.toContain("## CalculatorConfig");
		expect(fnPage?.content).not.toContain("## ID");
	});

	it("includes deprecation notices", () => {
		const map = makeSymbolsByPackage([fnSubtract]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const fnPage = pages.find((p) => p.path === "packages/core/api/functions.md");
		expect(fnPage?.content).toContain("**Deprecated**");
		expect(fnPage?.content).toContain("math.sub()");
	});
});

// ---------------------------------------------------------------------------
// Examples page (packages/<name>/api/examples)
// ---------------------------------------------------------------------------

describe("api/examples page", () => {
	it("is at the new api/examples path", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/api/examples.md");
		expect(exPage).toBeDefined();
	});

	it("aggregates all @example blocks from the package", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/api/examples.md");
		expect(exPage?.content).toContain("add(1, 2)");
	});

	it("shows which symbol each example belongs to", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/api/examples.md");
		expect(exPage?.content).toContain("`add()`");
	});

	it("links back to the api/functions page", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/api/examples.md");
		expect(exPage?.content).toContain("api/functions");
	});

	it("shows a placeholder when no examples exist", () => {
		const map = makeSymbolsByPackage([ifaceConfig]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const exPage = pages.find((p) => p.path === "packages/core/api/examples.md");
		expect(exPage?.content).toContain("No examples documented yet");
	});
});

// ---------------------------------------------------------------------------
// Configuration page (REFERENCE)
// ---------------------------------------------------------------------------

describe("configuration page", () => {
	it("is not marked as a stub (auto-generated from config types)", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const configPage = pages.find((p) => p.path === "configuration.md");
		expect(configPage?.stub).not.toBe(true);
	});

	it("includes forge-ts.config.ts example", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const configPage = pages.find((p) => p.path === "configuration.md");
		expect(configPage?.content).toContain("forge-ts.config.ts");
	});

	it("renders config type properties when a config-named interface is present", () => {
		const configType = sym({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "Main config interface." },
			children: [
				sym({
					name: "outDir",
					kind: "property",
					signature: "outDir: string",
					documentation: { summary: "Output directory." },
				}),
			],
		});
		const map = makeSymbolsByPackage([configType]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const configPage = pages.find((p) => p.path === "configuration.md");
		expect(configPage?.content).toContain("MyConfig");
		expect(configPage?.content).toContain("outDir");
	});
});

// ---------------------------------------------------------------------------
// Changelog page (REFERENCE)
// ---------------------------------------------------------------------------

describe("changelog page", () => {
	it("includes a stub notice", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const changelogPage = pages.find((p) => p.path === "changelog.md");
		expect(changelogPage?.content).toContain("stub");
	});

	it("mentions CHANGELOG.md", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const changelogPage = pages.find((p) => p.path === "changelog.md");
		expect(changelogPage?.content).toContain("CHANGELOG.md");
	});
});

// ---------------------------------------------------------------------------
// FAQ page (COMMUNITY)
// ---------------------------------------------------------------------------

describe("faq page", () => {
	it("includes a stub notice", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const faqPage = pages.find((p) => p.path === "faq.md");
		expect(faqPage?.content).toContain("stub");
	});

	it("has at least one question heading", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const faqPage = pages.find((p) => p.path === "faq.md");
		expect(faqPage?.content).toContain("## How do I");
	});
});

// ---------------------------------------------------------------------------
// Contributing page (COMMUNITY)
// ---------------------------------------------------------------------------

describe("contributing page", () => {
	it("includes a stub notice", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const contributingPage = pages.find((p) => p.path === "contributing.md");
		expect(contributingPage?.content).toContain("stub");
	});

	it("mentions CONTRIBUTING.md", () => {
		const map = makeSymbolsByPackage([fnAdd]);
		const pages = generateDocSite(map, makeConfig(), baseOptions);
		const contributingPage = pages.find((p) => p.path === "contributing.md");
		expect(contributingPage?.content).toContain("CONTRIBUTING.md");
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
