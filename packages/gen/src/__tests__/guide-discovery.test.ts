import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { describe, expect, it } from "vitest";
import { discoverGuides } from "../guide-discovery.js";
import { generateDocSite } from "../site-generator.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(): ForgeConfig {
	return {
		rootDir: "/project",
		tsconfig: "/project/tsconfig.json",
		outDir: "/project/docs",
		enforce: {
			enabled: false,
			minVisibility: Visibility.Public,
			strict: false,
			rules: {
				"require-summary": "off",
				"require-param": "off",
				"require-returns": "off",
				"require-example": "off",
				"require-package-doc": "off",
				"require-class-member-doc": "off",
				"require-interface-member-doc": "off",
				"require-tsdoc-syntax": "off",
				"require-remarks": "off",
				"require-default-value": "off",
				"require-type-param": "off",
				"require-see": "off",
			},
		},
		doctest: { enabled: false, cacheDir: "/project/.cache" },
		api: { enabled: false, openapi: false, openapiPath: "/project/docs/openapi.json" },
		gen: {
			enabled: true,
			formats: ["markdown"],
			llmsTxt: false,
			readmeSync: false,
		},
		skill: {},
		tsdoc: {
			writeConfig: false,
			customTags: [],
			enforce: { core: "off", extended: "off", discretionary: "off" },
		},
		bypass: { dailyBudget: 3, durationHours: 24 },
		guards: {
			tsconfig: { enabled: false, requiredFlags: [] },
			biome: { enabled: false, lockedRules: [] },
			packageJson: { enabled: false, minNodeVersion: "18", requiredFields: [] },
		},
		project: {},
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

function makeSymbolsByPackage(symbols: ForgeSymbol[]): Map<string, ForgeSymbol[]> {
	const map = new Map<string, ForgeSymbol[]>();
	map.set("core", symbols);
	return map;
}

const baseOptions = {
	format: "markdown" as const,
	projectName: "my-project",
	projectDescription: "A test project.",
};

// ---------------------------------------------------------------------------
// Config interface detection
// ---------------------------------------------------------------------------

describe("config interface detection", () => {
	it("discovers a Configuration Guide when an exported interface name contains 'Config'", () => {
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "Application configuration." },
			children: [
				sym({
					name: "port",
					kind: "property",
					signature: "port: number",
					documentation: { summary: "Server port." },
				}),
			],
		});

		const guides = discoverGuides(makeSymbolsByPackage([configIface]), makeConfig());
		const configGuide = guides.find((g) => g.source === "config-interface");
		expect(configGuide).toBeDefined();
		expect(configGuide?.slug).toBe("configuration");
		expect(configGuide?.title).toBe("Configuration Guide");
		expect(configGuide?.symbols).toContain(configIface);
	});

	it("discovers a Configuration Guide when an exported type name contains 'Options'", () => {
		const optionsType = sym({
			name: "BuildOptions",
			kind: "type",
			signature: "type BuildOptions = { outDir: string }",
			documentation: { summary: "Build options." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([optionsType]), makeConfig());
		const configGuide = guides.find((g) => g.source === "config-interface");
		expect(configGuide).toBeDefined();
		expect(configGuide?.symbols).toContain(optionsType);
	});

	it("discovers a Configuration Guide when name contains 'Settings'", () => {
		const settingsIface = sym({
			name: "UserSettings",
			kind: "interface",
			documentation: { summary: "User settings." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([settingsIface]), makeConfig());
		const configGuide = guides.find((g) => g.source === "config-interface");
		expect(configGuide).toBeDefined();
	});

	it("does not discover config guide for non-config interfaces", () => {
		const regularIface = sym({
			name: "User",
			kind: "interface",
			documentation: { summary: "A user." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([regularIface]), makeConfig());
		const configGuide = guides.find((g) => g.source === "config-interface");
		expect(configGuide).toBeUndefined();
	});

	it("ignores non-exported config interfaces", () => {
		const privateConfig = sym({
			name: "InternalConfig",
			kind: "interface",
			exported: false,
			documentation: { summary: "Internal config." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([privateConfig]), makeConfig());
		const configGuide = guides.find((g) => g.source === "config-interface");
		expect(configGuide).toBeUndefined();
	});

	it("groups multiple config interfaces into a single guide", () => {
		const config1 = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "App config." },
		});
		const config2 = sym({
			name: "BuildOptions",
			kind: "type",
			documentation: { summary: "Build options." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([config1, config2]), makeConfig());
		const configGuides = guides.filter((g) => g.source === "config-interface");
		expect(configGuides).toHaveLength(1);
		expect(configGuides[0].symbols).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// Error type detection
// ---------------------------------------------------------------------------

describe("error type detection", () => {
	it("discovers an Error Handling Guide for functions with @throws", () => {
		const throwingFn = sym({
			name: "parseInput",
			kind: "function",
			documentation: {
				summary: "Parses user input.",
				throws: [{ type: "ValidationError", description: "When input is invalid." }],
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([throwingFn]), makeConfig());
		const errorGuide = guides.find((g) => g.source === "error-types");
		expect(errorGuide).toBeDefined();
		expect(errorGuide?.slug).toBe("error-handling");
		expect(errorGuide?.title).toBe("Error Handling Guide");
		expect(errorGuide?.symbols).toContain(throwingFn);
	});

	it("discovers an Error Handling Guide for classes ending with 'Error'", () => {
		const errorClass = sym({
			name: "ValidationError",
			kind: "class",
			signature: "class ValidationError extends Error",
			documentation: { summary: "Validation error." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([errorClass]), makeConfig());
		const errorGuide = guides.find((g) => g.source === "error-types");
		expect(errorGuide).toBeDefined();
		expect(errorGuide?.symbols).toContain(errorClass);
	});

	it("discovers an Error Handling Guide for classes ending with 'Exception'", () => {
		const exceptionClass = sym({
			name: "TimeoutException",
			kind: "class",
			signature: "class TimeoutException extends Error",
			documentation: { summary: "Timeout exception." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([exceptionClass]), makeConfig());
		const errorGuide = guides.find((g) => g.source === "error-types");
		expect(errorGuide).toBeDefined();
	});

	it("does not discover error guide for regular classes", () => {
		const regularClass = sym({
			name: "Calculator",
			kind: "class",
			documentation: { summary: "A calculator." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([regularClass]), makeConfig());
		const errorGuide = guides.find((g) => g.source === "error-types");
		expect(errorGuide).toBeUndefined();
	});

	it("does not discover error guide for functions without @throws", () => {
		const safeFn = sym({
			name: "add",
			kind: "function",
			documentation: { summary: "Adds two numbers." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([safeFn]), makeConfig());
		const errorGuide = guides.find((g) => g.source === "error-types");
		expect(errorGuide).toBeUndefined();
	});

	it("groups throwing functions and error classes in one guide", () => {
		const throwingFn = sym({
			name: "parseInput",
			kind: "function",
			documentation: {
				summary: "Parses input.",
				throws: [{ description: "On failure." }],
			},
		});
		const errorClass = sym({
			name: "ParseError",
			kind: "class",
			documentation: { summary: "Parse error." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([throwingFn, errorClass]), makeConfig());
		const errorGuides = guides.filter((g) => g.source === "error-types");
		expect(errorGuides).toHaveLength(1);
		expect(errorGuides[0].symbols).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// @guide tag grouping
// ---------------------------------------------------------------------------

describe("@guide tag grouping", () => {
	it("creates a guide page for each unique @guide tag value", () => {
		const fn1 = sym({
			name: "connectDB",
			kind: "function",
			documentation: {
				summary: "Connects to database.",
				tags: { guide: ["database"] },
			},
		});
		const fn2 = sym({
			name: "queryDB",
			kind: "function",
			documentation: {
				summary: "Queries database.",
				tags: { guide: ["database"] },
			},
		});
		const fn3 = sym({
			name: "authenticate",
			kind: "function",
			documentation: {
				summary: "Authenticates user.",
				tags: { guide: ["authentication"] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn1, fn2, fn3]), makeConfig());
		const guideTagGuides = guides.filter((g) => g.source === "guide-tag");

		expect(guideTagGuides).toHaveLength(2);

		const dbGuide = guideTagGuides.find((g) => g.slug === "database");
		expect(dbGuide).toBeDefined();
		expect(dbGuide?.title).toBe("Database");
		expect(dbGuide?.symbols).toHaveLength(2);

		const authGuide = guideTagGuides.find((g) => g.slug === "authentication");
		expect(authGuide).toBeDefined();
		expect(authGuide?.title).toBe("Authentication");
		expect(authGuide?.symbols).toHaveLength(1);
	});

	it("ignores empty @guide tag values", () => {
		const fn = sym({
			name: "doSomething",
			kind: "function",
			documentation: {
				summary: "Does something.",
				tags: { guide: [""] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const guideTagGuides = guides.filter((g) => g.source === "guide-tag");
		expect(guideTagGuides).toHaveLength(0);
	});

	it("ignores non-exported symbols", () => {
		const fn = sym({
			name: "internal",
			kind: "function",
			exported: false,
			documentation: {
				summary: "Internal function.",
				tags: { guide: ["internal-guide"] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const guideTagGuides = guides.filter((g) => g.source === "guide-tag");
		expect(guideTagGuides).toHaveLength(0);
	});

	it("handles symbols with multiple @guide tags", () => {
		const fn = sym({
			name: "multiGuide",
			kind: "function",
			documentation: {
				summary: "Multi-guide function.",
				tags: { guide: ["database", "caching"] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const guideTagGuides = guides.filter((g) => g.source === "guide-tag");
		expect(guideTagGuides).toHaveLength(2);
		expect(guideTagGuides.map((g) => g.slug).sort()).toEqual(["caching", "database"]);
	});
});

// ---------------------------------------------------------------------------
// @category grouping
// ---------------------------------------------------------------------------

describe("@category grouping", () => {
	it("creates a guide page for each unique @category tag value", () => {
		const fn1 = sym({
			name: "readFile",
			kind: "function",
			documentation: {
				summary: "Reads a file.",
				tags: { category: ["IO"] },
			},
		});
		const fn2 = sym({
			name: "writeFile",
			kind: "function",
			documentation: {
				summary: "Writes a file.",
				tags: { category: ["IO"] },
			},
		});
		const fn3 = sym({
			name: "transform",
			kind: "function",
			documentation: {
				summary: "Transforms data.",
				tags: { category: ["Data Processing"] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn1, fn2, fn3]), makeConfig());
		const categoryGuides = guides.filter((g) => g.source === "category");

		expect(categoryGuides).toHaveLength(2);

		const ioGuide = categoryGuides.find((g) => g.slug === "io");
		expect(ioGuide).toBeDefined();
		expect(ioGuide?.title).toBe("IO Guide");
		expect(ioGuide?.symbols).toHaveLength(2);

		const dpGuide = categoryGuides.find((g) => g.slug === "data-processing");
		expect(dpGuide).toBeDefined();
		expect(dpGuide?.title).toBe("Data Processing Guide");
		expect(dpGuide?.symbols).toHaveLength(1);
	});

	it("ignores empty @category values", () => {
		const fn = sym({
			name: "orphan",
			kind: "function",
			documentation: {
				summary: "Orphan function.",
				tags: { category: ["  "] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const categoryGuides = guides.filter((g) => g.source === "category");
		expect(categoryGuides).toHaveLength(0);
	});

	it("ignores non-exported symbols", () => {
		const fn = sym({
			name: "internal",
			kind: "function",
			exported: false,
			documentation: {
				summary: "Internal function.",
				tags: { category: ["Utils"] },
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const categoryGuides = guides.filter((g) => g.source === "category");
		expect(categoryGuides).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Entry point analysis
// ---------------------------------------------------------------------------

describe("entry point analysis", () => {
	it("discovers Getting Started guide from index.ts exports", () => {
		const fn = sym({
			name: "init",
			kind: "function",
			filePath: "/project/packages/core/src/index.ts",
			documentation: {
				summary: "Initializes the library.",
				examples: [{ code: "init()", language: "typescript", line: 5 }],
			},
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const entryGuide = guides.find((g) => g.source === "entry-point");
		expect(entryGuide).toBeDefined();
		expect(entryGuide?.slug).toBe("getting-started");
		expect(entryGuide?.title).toBe("Getting Started");
		expect(entryGuide?.symbols).toContain(fn);
	});

	it("only includes functions, not types, from index.ts", () => {
		const fn = sym({
			name: "run",
			kind: "function",
			filePath: "/project/src/index.ts",
			documentation: { summary: "Runs the app." },
		});
		const iface = sym({
			name: "AppConfig",
			kind: "interface",
			filePath: "/project/src/index.ts",
			documentation: { summary: "Config." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn, iface]), makeConfig());
		const entryGuide = guides.find((g) => g.source === "entry-point");
		expect(entryGuide).toBeDefined();
		// Only the function should be included
		expect(entryGuide?.symbols).toHaveLength(1);
		expect(entryGuide?.symbols[0].name).toBe("run");
	});

	it("does not discover entry point guide when no functions in index.ts", () => {
		const iface = sym({
			name: "Config",
			kind: "interface",
			filePath: "/project/src/index.ts",
			documentation: { summary: "Config." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([iface]), makeConfig());
		const entryGuide = guides.find((g) => g.source === "entry-point");
		// Config interface triggers config-interface, not entry-point
		expect(entryGuide).toBeUndefined();
	});

	it("does not include functions from non-index files", () => {
		const fn = sym({
			name: "helper",
			kind: "function",
			filePath: "/project/src/utils.ts",
			documentation: { summary: "A helper." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		const entryGuide = guides.find((g) => g.source === "entry-point");
		expect(entryGuide).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// No discoverable guides (empty result)
// ---------------------------------------------------------------------------

describe("no discoverable guides", () => {
	it("returns empty array when no symbols match any heuristic", () => {
		const fn = sym({
			name: "helper",
			kind: "function",
			filePath: "/project/src/utils.ts",
			documentation: { summary: "A helper function." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		expect(guides).toHaveLength(0);
	});

	it("returns empty array for empty symbol map", () => {
		const guides = discoverGuides(new Map(), makeConfig());
		expect(guides).toHaveLength(0);
	});

	it("returns empty array when all symbols are non-exported", () => {
		const fn = sym({
			name: "InternalConfig",
			kind: "interface",
			exported: false,
			filePath: "/project/src/index.ts",
			documentation: { summary: "Internal." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn]), makeConfig());
		expect(guides).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("slug deduplication", () => {
	it("deduplicates guides with the same slug (first wins)", () => {
		// A @guide tag named "configuration" would collide with the config-interface heuristic
		const fn = sym({
			name: "setup",
			kind: "function",
			documentation: {
				summary: "Setup function.",
				tags: { guide: ["configuration"] },
			},
		});
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "Config." },
		});

		const guides = discoverGuides(makeSymbolsByPackage([fn, configIface]), makeConfig());
		const configGuides = guides.filter((g) => g.slug === "configuration");
		// Only one guide with slug "configuration" should exist
		expect(configGuides).toHaveLength(1);
		// guide-tag has higher priority than config-interface
		expect(configGuides[0].source).toBe("guide-tag");
	});
});

// ---------------------------------------------------------------------------
// Integration: site-generator uses discovered guides
// ---------------------------------------------------------------------------

describe("site-generator integration", () => {
	it("generates guide pages for discovered config interfaces", () => {
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "Application configuration." },
			children: [
				sym({
					name: "port",
					kind: "property",
					signature: "port: number",
					documentation: { summary: "Server port." },
				}),
			],
		});

		const pages = generateDocSite(makeSymbolsByPackage([configIface]), makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);

		// Should have a guides/configuration.md page
		expect(paths).toContain("guides/configuration.md");

		const configGuidePage = pages.find((p) => p.path === "guides/configuration.md");
		expect(configGuidePage?.content).toContain("Configuration Interfaces");
		expect(configGuidePage?.content).toContain("AppConfig");
		expect(configGuidePage?.content).toContain("port");
	});

	it("generates guide pages for @guide tagged symbols", () => {
		const fn = sym({
			name: "connectDB",
			kind: "function",
			signature: "function connectDB(): void",
			documentation: {
				summary: "Connects to database.",
				tags: { guide: ["database"] },
			},
		});

		const pages = generateDocSite(makeSymbolsByPackage([fn]), makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);

		expect(paths).toContain("guides/database.md");

		const dbGuidePage = pages.find((p) => p.path === "guides/database.md");
		expect(dbGuidePage?.content).toContain("connectDB");
		expect(dbGuidePage?.content).toContain("Related Symbols");
	});

	it("generates guide pages for error types", () => {
		const errorClass = sym({
			name: "ValidationError",
			kind: "class",
			signature: "class ValidationError extends Error",
			documentation: { summary: "Validation error." },
		});

		const pages = generateDocSite(makeSymbolsByPackage([errorClass]), makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);

		expect(paths).toContain("guides/error-handling.md");

		const errorGuidePage = pages.find((p) => p.path === "guides/error-handling.md");
		expect(errorGuidePage?.content).toContain("Error Types");
		expect(errorGuidePage?.content).toContain("ValidationError");
	});

	it("generates guide pages for @category grouped symbols", () => {
		const fn = sym({
			name: "readFile",
			kind: "function",
			signature: "function readFile(path: string): string",
			documentation: {
				summary: "Reads a file.",
				tags: { category: ["IO Operations"] },
			},
		});

		const pages = generateDocSite(makeSymbolsByPackage([fn]), makeConfig(), baseOptions);
		const paths = pages.map((p) => p.path);

		expect(paths).toContain("guides/io-operations.md");

		const ioGuidePage = pages.find((p) => p.path === "guides/io-operations.md");
		expect(ioGuidePage?.content).toContain("readFile");
	});

	it("updates the guides index with discovered guide listing", () => {
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "App config." },
		});

		const pages = generateDocSite(makeSymbolsByPackage([configIface]), makeConfig(), baseOptions);
		const guidesIndex = pages.find((p) => p.path === "guides/index.md");

		expect(guidesIndex?.content).toContain("Available Guides");
		expect(guidesIndex?.content).toContain("Configuration Guide");
		expect(guidesIndex?.content).toContain("FORGE:AUTO-START guide-listing");
		expect(guidesIndex?.content).toContain("FORGE:AUTO-END guide-listing");
	});

	it("keeps the stub notice when no guides are discovered", () => {
		// A plain function not in index.ts, no tags, no config name, no throws
		const fn = sym({
			name: "helper",
			kind: "function",
			filePath: "/project/src/utils.ts",
			documentation: { summary: "A helper." },
		});

		const pages = generateDocSite(makeSymbolsByPackage([fn]), makeConfig(), baseOptions);
		const guidesIndex = pages.find((p) => p.path === "guides/index.md");

		// Should still have the stub fallback text
		expect(guidesIndex?.content).toContain("guides/");
		expect(guidesIndex?.content).not.toContain("Available Guides");
	});

	it("guide pages include FORGE:AUTO markers for progressive enrichment", () => {
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "App config." },
		});

		const pages = generateDocSite(makeSymbolsByPackage([configIface]), makeConfig(), baseOptions);
		const configGuidePage = pages.find((p) => p.path === "guides/configuration.md");

		expect(configGuidePage?.content).toContain("<!-- FORGE:AUTO-START guide-configuration -->");
		expect(configGuidePage?.content).toContain("<!-- FORGE:AUTO-END guide-configuration -->");
	});

	it("guide pages are marked as stubs", () => {
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "App config." },
		});

		const pages = generateDocSite(makeSymbolsByPackage([configIface]), makeConfig(), baseOptions);
		const configGuidePage = pages.find((p) => p.path === "guides/configuration.md");
		expect(configGuidePage?.stub).toBe(true);
	});

	it("guide pages include TODO placeholder for user content", () => {
		const configIface = sym({
			name: "AppConfig",
			kind: "interface",
			documentation: { summary: "App config." },
		});

		const pages = generateDocSite(makeSymbolsByPackage([configIface]), makeConfig(), baseOptions);
		const configGuidePage = pages.find((p) => p.path === "guides/configuration.md");
		expect(configGuidePage?.content).toContain("TODO");
	});

	it("entry point guide includes function signatures and examples", () => {
		const fn = sym({
			name: "init",
			kind: "function",
			filePath: "/project/src/index.ts",
			signature: "function init(config: Config): void",
			documentation: {
				summary: "Initializes the library.",
				params: [{ name: "config", description: "Configuration object" }],
				examples: [{ code: "init({ port: 3000 })", language: "typescript", line: 5 }],
			},
		});

		const pages = generateDocSite(makeSymbolsByPackage([fn]), makeConfig(), baseOptions);

		const entryGuidePage = pages.find((p) => p.path === "guides/getting-started.md");
		expect(entryGuidePage).toBeDefined();
		expect(entryGuidePage?.content).toContain("Key Functions");
		expect(entryGuidePage?.content).toContain("init(config)");
		expect(entryGuidePage?.content).toContain("function init(config: Config): void");
		expect(entryGuidePage?.content).toContain("init({ port: 3000 })");
	});
});
