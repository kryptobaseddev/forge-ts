import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { extractSDKTypes, generateOpenAPISpec } from "@forge-ts/api";
import { enforce } from "@forge-ts/enforcer";
import { generateLlmsTxt, generateMarkdown } from "@forge-ts/gen";
import { afterEach, describe, expect, it } from "vitest";
import {
	clearTSDocConfigCache,
	createWalker,
	defaultConfig,
	type EnforceRules,
	type ForgeConfig,
	filterByVisibility,
	loadConfig,
	loadTSDocConfiguration,
	Visibility,
} from "../index.js";

// ---------------------------------------------------------------------------
// Fixture path
// ---------------------------------------------------------------------------

const FIXTURE_DIR = resolve(
	new URL(".", import.meta.url).pathname,
	"../../../../fixtures/sample-project",
);

const DEFAULT_E2E_RULES: EnforceRules = {
	"require-summary": "error",
	"require-param": "error",
	"require-returns": "error",
	"require-example": "error",
	"require-package-doc": "warn",
	"require-class-member-doc": "error",
	"require-interface-member-doc": "error",
	"require-tsdoc-syntax": "warn",
};

function makeFixtureConfig(overrides: Partial<ForgeConfig> = {}): ForgeConfig {
	return {
		rootDir: FIXTURE_DIR,
		tsconfig: resolve(FIXTURE_DIR, "tsconfig.json"),
		outDir: resolve(FIXTURE_DIR, "docs"),
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			rules: DEFAULT_E2E_RULES,
		},
		doctest: { enabled: false, cacheDir: resolve(FIXTURE_DIR, ".cache") },
		api: {
			enabled: true,
			openapi: true,
			openapiPath: resolve(FIXTURE_DIR, "docs", "openapi.json"),
		},
		gen: {
			enabled: true,
			formats: ["markdown"],
			llmsTxt: true,
			readmeSync: false,
		},
		skill: {},
		tsdoc: {
			writeConfig: true,
			customTags: [],
			enforce: { core: "error", extended: "warn", discretionary: "off" },
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
// Walker extraction
// ---------------------------------------------------------------------------

describe("E2E — walker extracts fixture symbols", () => {
	it("extracts all exported symbols from the fixture project", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		// Should have symbols from math.ts, types.ts, undocumented.ts
		expect(symbols.length).toBeGreaterThan(0);

		const names = symbols.map((s) => s.name);
		// Functions from math.ts
		expect(names).toContain("add");
		expect(names).toContain("subtract");
		expect(names).toContain("multiply");
		expect(names).toContain("_internalHelper");
		// Types from types.ts
		expect(names).toContain("CalculatorConfig");
		expect(names).toContain("Operation");
		expect(names).toContain("LegacyConfig");
		// Undocumented
		expect(names).toContain("noDocsFunction");
		expect(names).toContain("NoDocsInterface");
	});

	it("finds the `add` function with correct TSDoc", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const add = symbols.find((s) => s.name === "add" && s.kind === "function");
		expect(add).toBeDefined();
		expect(add?.documentation?.summary).toBeTruthy();
		expect(add?.documentation?.summary).toContain("Adds two numbers");

		// @param blocks
		const params = add?.documentation?.params ?? [];
		expect(params.length).toBeGreaterThanOrEqual(2);
		expect(params.some((p) => p.name === "a")).toBe(true);
		expect(params.some((p) => p.name === "b")).toBe(true);

		// @returns block
		expect(add?.documentation?.returns).toBeDefined();
		expect(add?.documentation?.returns?.description).toBeTruthy();

		// @example block
		const examples = add?.documentation?.examples ?? [];
		expect(examples.length).toBeGreaterThan(0);
		expect(examples[0].code).toContain("add(1, 2)");
	});

	it("identifies the @beta symbol (multiply)", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const multiply = symbols.find((s) => s.name === "multiply");
		expect(multiply).toBeDefined();
		expect(multiply?.visibility).toBe(Visibility.Beta);
	});

	it("identifies the @internal symbol (_internalHelper)", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const helper = symbols.find((s) => s.name === "_internalHelper");
		expect(helper).toBeDefined();
		expect(helper?.visibility).toBe(Visibility.Internal);
	});

	it("identifies the @deprecated symbol (LegacyConfig)", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const legacy = symbols.find((s) => s.name === "LegacyConfig");
		expect(legacy).toBeDefined();
		expect(legacy?.documentation?.deprecated).toBeTruthy();
	});

	it("extracts CalculatorConfig interface properties", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const calcConfig = symbols.find((s) => s.name === "CalculatorConfig" && s.kind === "interface");
		expect(calcConfig).toBeDefined();

		const children = calcConfig?.children ?? [];
		const childNames = children.map((c) => c.name);
		expect(childNames).toContain("precision");
		expect(childNames).toContain("mode");
		expect(childNames).toContain("label");
	});

	it("extracts Operation enum values", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const operation = symbols.find((s) => s.name === "Operation" && s.kind === "enum");
		expect(operation).toBeDefined();

		const children = operation?.children ?? [];
		const childNames = children.map((c) => c.name);
		expect(childNames).toContain("Add");
		expect(childNames).toContain("Subtract");
		expect(childNames).toContain("Multiply");
		expect(childNames).toContain("Divide");
	});
});

// ---------------------------------------------------------------------------
// filterByVisibility
// ---------------------------------------------------------------------------

describe("E2E — filterByVisibility", () => {
	it("filterByVisibility with Public excludes @internal symbols", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const publicOnly = filterByVisibility(symbols, Visibility.Public);
		const names = publicOnly.map((s) => s.name);

		expect(names).not.toContain("_internalHelper");
		// Public symbols should be present
		expect(names).toContain("add");
		expect(names).toContain("subtract");
	});

	it("filterByVisibility with Beta includes @beta but excludes @internal", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const betaAndBelow = filterByVisibility(symbols, Visibility.Beta);
		const names = betaAndBelow.map((s) => s.name);

		// Beta symbols included
		expect(names).toContain("multiply");
		// Public symbols included
		expect(names).toContain("add");
		// Internal excluded
		expect(names).not.toContain("_internalHelper");
	});
});

// ---------------------------------------------------------------------------
// Enforcer integration
// ---------------------------------------------------------------------------

describe("E2E — enforcer integration", () => {
	it("enforce() reports errors for undocumented exports in undocumented.ts", async () => {
		const config = makeFixtureConfig();
		const result = await enforce(config);

		// undocumented.ts exports lack TSDoc — must produce E001 errors
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001.length).toBeGreaterThan(0);

		// At least noDocsFunction and NoDocsInterface should fail
		const errorMessages = result.errors.map((e) => e.message);
		expect(errorMessages.some((m) => m.includes("noDocsFunction"))).toBe(true);
		expect(errorMessages.some((m) => m.includes("NoDocsInterface"))).toBe(true);
	});

	it("enforce() passes for fully documented symbols (add, subtract)", async () => {
		const config = makeFixtureConfig();
		const result = await enforce(config);

		// add and subtract are fully documented — no E001 for them
		const e001 = result.errors.filter((e) => e.code === "E001");
		const failedNames = e001.map((e) => e.message);
		expect(failedNames.every((m) => !m.includes('"add"'))).toBe(true);
		expect(failedNames.every((m) => !m.includes('"subtract"'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Gen integration
// ---------------------------------------------------------------------------

describe("E2E — gen integration", () => {
	it("generateMarkdown produces valid output with sections for the fixture", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const md = generateMarkdown(symbols, config);

		expect(typeof md).toBe("string");
		expect(md.length).toBeGreaterThan(0);
		// Should have a top-level heading
		expect(md).toContain("# API Reference");
		// Should have sections for functions and interfaces
		expect(md).toContain("## Functions");
		expect(md).toContain("## Interfaces");
		// add function should appear
		expect(md).toContain("add");
	});

	it("generateLlmsTxt produces routing manifest", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const llms = generateLlmsTxt(symbols, config);

		expect(typeof llms).toBe("string");
		expect(llms.length).toBeGreaterThan(0);
		// Must start with a title heading
		expect(llms).toMatch(/^# /m);
		// Should have a Sections block
		expect(llms).toContain("## Sections");
		// Should have a Quick Reference block
		expect(llms).toContain("## Quick Reference");
		// Should reference the markdown API reference
		expect(llms).toContain("api-reference.md");
	});

	it("generateOpenAPISpec produces valid OpenAPI with CalculatorConfig schema", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		const sdkTypes = extractSDKTypes(symbols);
		const spec = generateOpenAPISpec(config, sdkTypes);

		expect(spec.openapi).toBe("3.2.0");
		expect(spec.info).toBeDefined();
		expect(spec.components).toBeDefined();
		expect(spec.components.schemas).toBeDefined();

		// CalculatorConfig is a public interface — must appear in schemas
		expect(spec.components.schemas.CalculatorConfig).toBeDefined();

		// _internalHelper is @internal — must NOT appear
		expect(spec.components.schemas._internalHelper).toBeUndefined();

		// Operation enum should appear
		expect(spec.components.schemas.Operation).toBeDefined();
		const opSchema = spec.components.schemas.Operation;
		expect(opSchema.type).toBe("string");
		expect(Array.isArray(opSchema.enum)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// v0.9.0 — TSDoc configuration integration
// ---------------------------------------------------------------------------

describe("E2E — v0.9.0 tsdoc.json loading", () => {
	const tempDir = join(tmpdir(), `forge-ts-tsdoc-test-${Date.now()}`);

	afterEach(() => {
		clearTSDocConfigCache();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup failures
		}
	});

	it("loadTSDocConfiguration returns a valid configuration for a folder without tsdoc.json", () => {
		const config = loadTSDocConfiguration(FIXTURE_DIR);
		// Should return a default TSDocConfiguration (no crash, no undefined)
		expect(config).toBeDefined();
		// Default configuration has standard tags enabled
		expect(config.tagDefinitions.length).toBeGreaterThan(0);
	});

	it("loadTSDocConfiguration loads custom tags from tsdoc.json when present", () => {
		mkdirSync(tempDir, { recursive: true });

		// loadForFolder needs a package.json to identify the project root
		writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "test-pkg" }));

		const tsdocJson = {
			$schema: "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
			noStandardTags: false,
			tagDefinitions: [{ tagName: "@myCustomTag", syntaxKind: "block" }],
			supportForTags: {
				"@myCustomTag": true,
			},
		};
		writeFileSync(join(tempDir, "tsdoc.json"), JSON.stringify(tsdocJson));

		const config = loadTSDocConfiguration(tempDir);
		expect(config).toBeDefined();

		// The custom tag @myCustomTag should be present in the configuration
		const customTag = config.tagDefinitions.find((t) => t.tagName === "@myCustomTag");
		expect(customTag).toBeDefined();
	});

	it("loadTSDocConfiguration caches results per folder", () => {
		const config1 = loadTSDocConfiguration(FIXTURE_DIR);
		const config2 = loadTSDocConfiguration(FIXTURE_DIR);
		// Same object reference due to caching
		expect(config1).toBe(config2);
	});

	it("clearTSDocConfigCache invalidates the cache", () => {
		const config1 = loadTSDocConfiguration(FIXTURE_DIR);
		clearTSDocConfigCache();
		const config2 = loadTSDocConfiguration(FIXTURE_DIR);
		// Different object reference after cache clear
		expect(config1).not.toBe(config2);
	});

	it("walker uses tsdoc.json custom tags to suppress parse warnings for known tags", () => {
		// Create a fixture-like project with a custom tag and a tsdoc.json
		mkdirSync(join(tempDir, "src"), { recursive: true });

		// package.json is needed for TSDocConfigFile.loadForFolder to find tsdoc.json
		writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "test-pkg" }));

		// Write a tsconfig.json
		writeFileSync(
			join(tempDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "NodeNext",
					moduleResolution: "NodeNext",
					strict: true,
					outDir: "dist",
					rootDir: "src",
				},
				include: ["src/**/*"],
			}),
		);

		// Write a source file using @myCustomTag
		writeFileSync(
			join(tempDir, "src", "example.ts"),
			`/**
 * Does something.
 *
 * @myCustomTag This is custom info.
 * @public
 */
export function doSomething(): void {}
`,
		);

		// Write a tsdoc.json defining @myCustomTag
		writeFileSync(
			join(tempDir, "tsdoc.json"),
			JSON.stringify({
				$schema: "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
				noStandardTags: false,
				tagDefinitions: [{ tagName: "@myCustomTag", syntaxKind: "block" }],
				supportForTags: { "@myCustomTag": true },
			}),
		);

		const config = makeFixtureConfig({
			rootDir: tempDir,
			tsconfig: join(tempDir, "tsconfig.json"),
			outDir: join(tempDir, "docs"),
		});

		const walker = createWalker(config);
		const symbols = walker.walk();

		const doSomething = symbols.find((s) => s.name === "doSomething");
		expect(doSomething).toBeDefined();
		expect(doSomething?.documentation?.summary).toContain("Does something");

		// With tsdoc.json present, @myCustomTag should NOT produce parse warnings
		const parseMessages = doSomething?.documentation?.parseMessages ?? [];
		const customTagWarnings = parseMessages.filter((m) => m.text.includes("@myCustomTag"));
		expect(customTagWarnings).toHaveLength(0);
	});

	it("walker produces parseMessages for unknown tags when no tsdoc.json is present", () => {
		// Create a fixture-like project WITHOUT a tsdoc.json
		mkdirSync(join(tempDir, "src"), { recursive: true });

		writeFileSync(
			join(tempDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "NodeNext",
					moduleResolution: "NodeNext",
					strict: true,
					outDir: "dist",
					rootDir: "src",
				},
				include: ["src/**/*"],
			}),
		);

		// Write a source file using @myCustomTag WITHOUT a tsdoc.json
		writeFileSync(
			join(tempDir, "src", "example.ts"),
			`/**
 * Does something else.
 *
 * @myCustomTag This is custom info.
 * @public
 */
export function doSomethingElse(): void {}
`,
		);

		const config = makeFixtureConfig({
			rootDir: tempDir,
			tsconfig: join(tempDir, "tsconfig.json"),
			outDir: join(tempDir, "docs"),
		});

		const walker = createWalker(config);
		const symbols = walker.walk();

		const doSomethingElse = symbols.find((s) => s.name === "doSomethingElse");
		expect(doSomethingElse).toBeDefined();

		// Without tsdoc.json, @myCustomTag should produce a parse warning
		const parseMessages = doSomethingElse?.documentation?.parseMessages ?? [];
		const customTagWarnings = parseMessages.filter((m) => m.text.includes("@myCustomTag"));
		expect(customTagWarnings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// v0.9.0 — W006 integration (through real walker + enforcer)
// ---------------------------------------------------------------------------

describe("E2E — v0.9.0 W006 fires for malformed TSDoc", () => {
	const tempDir = join(tmpdir(), `forge-ts-w006-test-${Date.now()}`);

	afterEach(() => {
		clearTSDocConfigCache();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup failures
		}
	});

	it("W006 fires when walker encounters an undefined TSDoc tag", async () => {
		mkdirSync(join(tempDir, "src"), { recursive: true });

		writeFileSync(
			join(tempDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "NodeNext",
					moduleResolution: "NodeNext",
					strict: true,
					outDir: "dist",
					rootDir: "src",
				},
				include: ["src/**/*"],
			}),
		);

		// Use an intentionally malformed TSDoc: @badTag is undefined
		writeFileSync(
			join(tempDir, "src", "bad.ts"),
			`/**
 * Has bad doc.
 *
 * @badTag this tag is not defined
 * @public
 */
export function badDocFunction(): void {}
`,
		);

		const config = makeFixtureConfig({
			rootDir: tempDir,
			tsconfig: join(tempDir, "tsconfig.json"),
			outDir: join(tempDir, "docs"),
		});

		const result = await enforce(config);

		// W006 should fire for the undefined @badTag
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006.length).toBeGreaterThan(0);
		expect(w006.some((w) => w.message.includes("@badTag"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// v0.9.0 — ForgeConfig tsdoc/guards sections
// ---------------------------------------------------------------------------

describe("E2E — v0.9.0 ForgeConfig tsdoc and guards sections", () => {
	it("defaultConfig includes tsdoc section with correct defaults", () => {
		const config = defaultConfig("/fake");
		expect(config.tsdoc).toBeDefined();
		expect(config.tsdoc.writeConfig).toBe(true);
		expect(config.tsdoc.customTags).toEqual([]);
		expect(config.tsdoc.enforce).toEqual({
			core: "error",
			extended: "warn",
			discretionary: "off",
		});
	});

	it("defaultConfig includes guards section with correct defaults", () => {
		const config = defaultConfig("/fake");
		expect(config.guards).toBeDefined();
		expect(config.guards.tsconfig).toEqual({
			enabled: true,
			requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"],
		});
		expect(config.guards.biome).toEqual({
			enabled: false,
			lockedRules: [],
		});
		expect(config.guards.packageJson).toEqual({
			enabled: true,
			minNodeVersion: "22.0.0",
			requiredFields: ["type", "engines"],
		});
	});

	it("defaultConfig includes require-tsdoc-syntax rule defaulting to warn", () => {
		const config = defaultConfig("/fake");
		expect(config.enforce.rules["require-tsdoc-syntax"]).toBe("warn");
	});

	it("loadConfig merges tsdoc overrides with defaults", async () => {
		const config = await loadConfig(FIXTURE_DIR);
		// Fixture has no forge-ts config, so defaults should apply
		expect(config.tsdoc).toBeDefined();
		expect(config.tsdoc.writeConfig).toBe(true);
		expect(config.tsdoc.enforce.core).toBe("error");
	});

	it("loadConfig merges guards overrides with defaults", async () => {
		const config = await loadConfig(FIXTURE_DIR);
		// Fixture has no forge-ts config, so defaults should apply
		expect(config.guards).toBeDefined();
		expect(config.guards.tsconfig.enabled).toBe(true);
		expect(config.guards.biome.enabled).toBe(false);
	});

	it("ForgeConfig type includes parseMessages in documentation", () => {
		const config = makeFixtureConfig();
		const walker = createWalker(config);
		const symbols = walker.walk();

		// Verify the parseMessages field exists on the type (even if empty)
		for (const sym of symbols) {
			if (sym.documentation) {
				// parseMessages can be undefined or an array — verify the shape
				if (sym.documentation.parseMessages !== undefined) {
					expect(Array.isArray(sym.documentation.parseMessages)).toBe(true);
					for (const msg of sym.documentation.parseMessages) {
						expect(typeof msg.messageId).toBe("string");
						expect(typeof msg.text).toBe("string");
						expect(typeof msg.line).toBe("number");
					}
				}
			}
		}
	});
});
