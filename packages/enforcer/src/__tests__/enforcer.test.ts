import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
	type EnforceRules,
	type ForgeConfig,
	type ForgeResult,
	type ForgeSymbol,
	Visibility,
} from "@forge-ts/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findDeprecatedUsages } from "../deprecation-tracker.js";
import { enforce } from "../enforcer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default per-rule severities that match the production defaults. */
const DEFAULT_RULES: EnforceRules = {
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
};

/**
 * Returns a minimal valid {@link ForgeConfig} for tests.
 * Rules default to the production defaults; pass `rules` inside `overrides`
 * to override individual entries.
 */
function makeConfig(overrides?: Partial<ForgeConfig["enforce"]>): ForgeConfig {
	const { rules: ruleOverrides, ...restOverrides } = overrides ?? {};
	// Default require-release-tag to "off" in tests so E016 does not interfere
	// with unrelated test suites.  E016-specific tests explicitly enable it.
	const testRules: EnforceRules = {
		...DEFAULT_RULES,
		"require-release-tag": "off",
		...ruleOverrides,
	};
	return {
		rootDir: "/fake",
		tsconfig: "/fake/tsconfig.json",
		outDir: "/fake/docs",
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			rules: testRules,
			...restOverrides,
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
	};
}

/**
 * Builds a minimal {@link ForgeSymbol} for testing.
 * Provide only the fields relevant to the test case.
 */
function makeSymbol(overrides: Partial<ForgeSymbol> & { name: string }): ForgeSymbol {
	return {
		kind: "function",
		visibility: Visibility.Public,
		filePath: "/fake/src/module.ts",
		line: 10,
		column: 0,
		exported: true,
		...overrides,
	};
}

/**
 * Mocks `createWalker` from `@forge-ts/core` so the enforcer uses the
 * provided symbol list instead of touching the real TypeScript compiler.
 */
async function runEnforce(
	symbols: ForgeSymbol[],
	configOverrides?: Partial<ForgeConfig["enforce"]>,
): Promise<ForgeResult> {
	const { createWalker } = await import("@forge-ts/core");
	vi.mocked(createWalker).mockReturnValue({ walk: () => symbols });
	return enforce(makeConfig(configOverrides));
}

/**
 * Runs enforce with full {@link ForgeConfig} overrides (not just enforce section).
 * Used for E009/E010 tests that need to control `guards` and `rootDir`.
 */
async function runEnforceWithConfig(
	symbols: ForgeSymbol[],
	configOverrides: Partial<ForgeConfig>,
): Promise<ForgeResult> {
	const { createWalker } = await import("@forge-ts/core");
	vi.mocked(createWalker).mockReturnValue({ walk: () => symbols });
	const base = makeConfig();
	const merged: ForgeConfig = {
		...base,
		...configOverrides,
		enforce: { ...base.enforce, ...configOverrides.enforce },
		guards: {
			...base.guards,
			...configOverrides.guards,
			tsconfig: { ...base.guards.tsconfig, ...configOverrides.guards?.tsconfig },
			biome: { ...base.guards.biome, ...configOverrides.guards?.biome },
			packageJson: { ...base.guards.packageJson, ...configOverrides.guards?.packageJson },
		},
	};
	return enforce(merged);
}

// ---------------------------------------------------------------------------
// Module mock — replaces the real walker with a controllable stub
// ---------------------------------------------------------------------------

vi.mock("@forge-ts/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/core")>();
	return {
		...actual,
		createWalker: vi.fn(),
	};
});

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		readFileSync: vi.fn(actual.readFileSync),
		existsSync: vi.fn(actual.existsSync),
		readdirSync: vi.fn(actual.readdirSync),
	};
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("enforce — E001 missing summary", () => {
	it("passes a symbol that has a full TSDoc summary", async () => {
		const sym = makeSymbol({
			name: "doThing",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Detailed description."] },
			},
		});
		const result = await runEnforce([sym]);
		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("emits E001 for a symbol missing a summary", async () => {
		const sym = makeSymbol({ name: "doThing", documentation: undefined });
		const result = await runEnforce([sym]);
		expect(result.success).toBe(false);
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001).toHaveLength(1);
		expect(e001[0].message).toContain("doThing");
	});

	it("emits E001 when summary is an empty string", async () => {
		const sym = makeSymbol({
			name: "doThing",
			documentation: { summary: "   " },
		});
		const result = await runEnforce([sym]);
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001).toHaveLength(1);
	});
});

describe("enforce — E002 missing @param", () => {
	it("emits E002 for a function whose parameter is not documented", async () => {
		const sym = makeSymbol({
			name: "greet",
			kind: "function",
			signature: "(name: string) => void",
			documentation: { summary: "Greets someone." },
		});
		const result = await runEnforce([sym]);
		const e002 = result.errors.filter((e) => e.code === "E002");
		expect(e002).toHaveLength(1);
		expect(e002[0].message).toContain("name");
	});

	it("passes when all parameters are documented", async () => {
		const sym = makeSymbol({
			name: "greet",
			kind: "function",
			signature: "(name: string) => void",
			documentation: {
				summary: "Greets someone.",
				params: [{ name: "name", description: "The person to greet." }],
			},
		});
		const result = await runEnforce([sym]);
		const e002 = result.errors.filter((e) => e.code === "E002");
		expect(e002).toHaveLength(0);
	});

	it("does not emit E002 for non-function symbols", async () => {
		const sym = makeSymbol({
			name: "MY_CONST",
			kind: "variable",
			signature: "string",
			documentation: { summary: "A constant." },
		});
		const result = await runEnforce([sym]);
		const e002 = result.errors.filter((e) => e.code === "E002");
		expect(e002).toHaveLength(0);
	});

	it("skips the implicit `this` parameter", async () => {
		const sym = makeSymbol({
			name: "bound",
			kind: "method",
			signature: "(this: MyClass, value: number) => void",
			documentation: {
				summary: "A bound method.",
				params: [{ name: "value", description: "The number." }],
			},
		});
		const result = await runEnforce([sym]);
		const e002 = result.errors.filter((e) => e.code === "E002");
		expect(e002).toHaveLength(0);
	});
});

describe("enforce — E003 missing @returns", () => {
	it("emits E003 when return type is non-void and @returns is absent", async () => {
		const sym = makeSymbol({
			name: "getCount",
			kind: "function",
			signature: "() => number",
			documentation: { summary: "Returns the count." },
		});
		const result = await runEnforce([sym]);
		const e003 = result.errors.filter((e) => e.code === "E003");
		expect(e003).toHaveLength(1);
		expect(e003[0].message).toContain("getCount");
	});

	it("passes when @returns is present", async () => {
		const sym = makeSymbol({
			name: "getCount",
			kind: "function",
			signature: "() => number",
			documentation: {
				summary: "Returns the count.",
				returns: { description: "The current count." },
			},
		});
		const result = await runEnforce([sym]);
		const e003 = result.errors.filter((e) => e.code === "E003");
		expect(e003).toHaveLength(0);
	});

	it("does not emit E003 for void return type", async () => {
		const sym = makeSymbol({
			name: "doSideEffect",
			kind: "function",
			signature: "() => void",
			documentation: { summary: "Performs a side effect." },
		});
		const result = await runEnforce([sym]);
		const e003 = result.errors.filter((e) => e.code === "E003");
		expect(e003).toHaveLength(0);
	});

	it("does not emit E003 for Promise<void> return type", async () => {
		const sym = makeSymbol({
			name: "writeFile",
			kind: "function",
			signature: "(path: string) => Promise<void>",
			documentation: {
				summary: "Writes a file.",
				params: [{ name: "path", description: "Destination path." }],
			},
		});
		const result = await runEnforce([sym]);
		const e003 = result.errors.filter((e) => e.code === "E003");
		expect(e003).toHaveLength(0);
	});
});

describe("enforce — visibility filtering", () => {
	it("skips @internal symbols when minVisibility is Public", async () => {
		const sym = makeSymbol({
			name: "internalHelper",
			visibility: Visibility.Internal,
			documentation: undefined,
		});
		const result = await runEnforce([sym], { minVisibility: Visibility.Public });
		expect(result.errors).toHaveLength(0);
	});

	it("checks @beta symbols when minVisibility is Beta", async () => {
		const sym = makeSymbol({
			name: "betaFeature",
			visibility: Visibility.Beta,
			documentation: undefined,
		});
		const result = await runEnforce([sym], { minVisibility: Visibility.Beta });
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001).toHaveLength(1);
	});

	it("skips unexported symbols regardless of visibility", async () => {
		const sym = makeSymbol({
			name: "privateHelper",
			exported: false,
			visibility: Visibility.Public,
			documentation: undefined,
		});
		const result = await runEnforce([sym]);
		expect(result.errors).toHaveLength(0);
	});
});

describe("enforce — strict mode", () => {
	it("promotes W003 to an error in strict mode", async () => {
		const sym = makeSymbol({
			name: "oldApi",
			documentation: {
				summary: "An old API.",
				deprecated: "true",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym], { strict: true });
		// In strict mode W003 becomes an error
		const w003AsError = result.errors.filter((e) => e.code === "W003");
		expect(w003AsError).toHaveLength(1);
		expect(result.warnings).toHaveLength(0);
	});

	it("keeps W003 as a warning when strict is false", async () => {
		const sym = makeSymbol({
			name: "oldApi",
			documentation: {
				summary: "An old API.",
				deprecated: "true",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], { strict: false });
		expect(result.warnings.filter((w) => w.code === "W003")).toHaveLength(1);
		expect(result.errors).toHaveLength(0);
		expect(result.success).toBe(true);
	});
});

describe("enforce — empty project", () => {
	it("returns success with no diagnostics for an empty symbol list", async () => {
		const result = await runEnforce([]);
		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
		expect(result.symbols).toHaveLength(0);
	});
});

describe("enforce — multi-file grouping", () => {
	it("records correct filePath for diagnostics across multiple files", async () => {
		const symA = makeSymbol({
			name: "funcA",
			filePath: "/fake/src/a.ts",
			line: 5,
			documentation: undefined,
		});
		const symB = makeSymbol({
			name: "funcB",
			filePath: "/fake/src/b.ts",
			line: 12,
			documentation: undefined,
		});
		const result = await runEnforce([symA, symB]);
		// E001 + E013 fire per symbol (both missing summary and @remarks)
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
		const paths = result.errors.map((e) => e.filePath);
		expect(paths).toContain("/fake/src/a.ts");
		expect(paths).toContain("/fake/src/b.ts");
	});
});

describe("enforce — E004 missing @example", () => {
	it("emits E004 for an exported function with a summary but no @example block", async () => {
		const sym = makeSymbol({
			name: "parseConfig",
			kind: "function",
			signature: "(raw: string) => void",
			documentation: {
				summary: "Parses a config string.",
				params: [{ name: "raw", description: "The raw config." }],
			},
		});
		const result = await runEnforce([sym]);
		const e004 = result.errors.filter((e) => e.code === "E004");
		expect(e004).toHaveLength(1);
		expect(e004[0].message).toContain("parseConfig");
	});

	it("passes when an exported function has at least one @example block", async () => {
		const sym = makeSymbol({
			name: "parseConfig",
			kind: "function",
			signature: "(raw: string) => void",
			documentation: {
				summary: "Parses a config string.",
				params: [{ name: "raw", description: "The raw config." }],
				examples: [{ code: "parseConfig('{}');", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const e004 = result.errors.filter((e) => e.code === "E004");
		expect(e004).toHaveLength(0);
	});

	it("does not emit E004 for a function with no documentation at all (E001 covers it)", async () => {
		const sym = makeSymbol({
			name: "parseConfig",
			kind: "function",
			documentation: undefined,
		});
		const result = await runEnforce([sym]);
		const e004 = result.errors.filter((e) => e.code === "E004");
		// E001 fires instead; E004 only fires when documentation exists but examples are absent
		expect(e004).toHaveLength(0);
	});

	it("does not emit E004 for non-function symbols", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config type." },
		});
		const result = await runEnforce([sym]);
		const e004 = result.errors.filter((e) => e.code === "E004");
		expect(e004).toHaveLength(0);
	});
});

describe("enforce — E005 missing @packageDocumentation", () => {
	it("emits E005 as a warning for an index.ts file with no @packageDocumentation tag (default severity is warn)", async () => {
		const sym = makeSymbol({
			name: "doThing",
			filePath: "/fake/src/index.ts",
			documentation: { summary: "Does a thing." },
		});
		const result = await runEnforce([sym]);
		// require-package-doc defaults to "warn", so E005 lands in warnings
		const e005 = result.warnings.filter((w) => w.code === "E005");
		expect(e005).toHaveLength(1);
		expect(e005[0].filePath).toBe("/fake/src/index.ts");
		// Must not appear in errors
		expect(result.errors.filter((e) => e.code === "E005")).toHaveLength(0);
	});

	it("emits E005 as an error when require-package-doc is set to error", async () => {
		const sym = makeSymbol({
			name: "doThing",
			filePath: "/fake/src/index.ts",
			documentation: { summary: "Does a thing." },
		});
		const result = await runEnforce([sym], {
			rules: { "require-package-doc": "error" },
		});
		const e005 = result.errors.filter((e) => e.code === "E005");
		expect(e005).toHaveLength(1);
		expect(e005[0].filePath).toBe("/fake/src/index.ts");
	});

	it("passes when an index.ts symbol carries the @packageDocumentation tag", async () => {
		const sym = makeSymbol({
			name: "doThing",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "Does a thing.",
				tags: { packageDocumentation: [""] },
			},
		});
		const result = await runEnforce([sym]);
		const e005Errors = result.errors.filter((e) => e.code === "E005");
		const e005Warns = result.warnings.filter((w) => w.code === "E005");
		expect(e005Errors).toHaveLength(0);
		expect(e005Warns).toHaveLength(0);
	});

	it("does not emit E005 for non-index.ts files", async () => {
		const sym = makeSymbol({
			name: "helperFn",
			filePath: "/fake/src/helpers.ts",
			documentation: { summary: "A helper." },
		});
		const result = await runEnforce([sym]);
		expect(result.errors.filter((e) => e.code === "E005")).toHaveLength(0);
		expect(result.warnings.filter((w) => w.code === "E005")).toHaveLength(0);
	});
});

describe("enforce — E006 class member missing documentation", () => {
	it("emits E006 for a class with an undocumented public member", async () => {
		const sym = makeSymbol({
			name: "MyService",
			kind: "class",
			documentation: { summary: "A service." },
			children: [
				makeSymbol({
					name: "connect",
					kind: "method",
					filePath: "/fake/src/index.ts",
					line: 20,
					documentation: undefined,
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e006 = result.errors.filter((e) => e.code === "E006");
		expect(e006).toHaveLength(1);
		expect(e006[0].message).toContain("connect");
		expect(e006[0].message).toContain("MyService");
	});

	it("passes when all class members have documentation", async () => {
		const sym = makeSymbol({
			name: "MyService",
			kind: "class",
			documentation: { summary: "A service." },
			children: [
				makeSymbol({
					name: "connect",
					kind: "method",
					filePath: "/fake/src/index.ts",
					line: 20,
					documentation: { summary: "Establishes the connection." },
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e006 = result.errors.filter((e) => e.code === "E006");
		expect(e006).toHaveLength(0);
	});

	it("does not emit E006 for interface symbols (E007 covers those)", async () => {
		const sym = makeSymbol({
			name: "MyInterface",
			kind: "interface",
			documentation: { summary: "An interface." },
			children: [
				makeSymbol({
					name: "value",
					kind: "property",
					filePath: "/fake/src/index.ts",
					line: 5,
					documentation: undefined,
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e006 = result.errors.filter((e) => e.code === "E006");
		expect(e006).toHaveLength(0);
	});
});

describe("enforce — E007 interface member missing documentation", () => {
	it("emits E007 for an interface with an undocumented property", async () => {
		const sym = makeSymbol({
			name: "ForgeOptions",
			kind: "interface",
			documentation: { summary: "Options for forge." },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					filePath: "/fake/src/index.ts",
					line: 8,
					documentation: undefined,
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e007 = result.errors.filter((e) => e.code === "E007");
		expect(e007).toHaveLength(1);
		expect(e007[0].message).toContain("timeout");
		expect(e007[0].message).toContain("ForgeOptions");
	});

	it("passes when all interface properties have documentation", async () => {
		const sym = makeSymbol({
			name: "ForgeOptions",
			kind: "interface",
			documentation: { summary: "Options for forge." },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					filePath: "/fake/src/index.ts",
					line: 8,
					documentation: { summary: "The timeout in milliseconds." },
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e007 = result.errors.filter((e) => e.code === "E007");
		expect(e007).toHaveLength(0);
	});

	it("does not emit E007 for class symbols (E006 covers those)", async () => {
		const sym = makeSymbol({
			name: "MyClass",
			kind: "class",
			documentation: { summary: "A class." },
			children: [
				makeSymbol({
					name: "name",
					kind: "property",
					filePath: "/fake/src/index.ts",
					line: 5,
					documentation: undefined,
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e007 = result.errors.filter((e) => e.code === "E007");
		expect(e007).toHaveLength(0);
	});
});

describe("enforce — suggestedFix population", () => {
	it("populates suggestedFix on E001 errors", async () => {
		const sym = makeSymbol({ name: "doThing", documentation: undefined });
		const result = await runEnforce([sym]);
		const e001 = result.errors.find((e) => e.code === "E001");
		expect(e001?.suggestedFix).toBeDefined();
		expect(e001?.suggestedFix).toContain("doThing");
		expect(e001?.symbolName).toBe("doThing");
		expect(e001?.symbolKind).toBe("function");
	});

	it("populates suggestedFix on E002 errors", async () => {
		const sym = makeSymbol({
			name: "greet",
			kind: "function",
			signature: "(name: string) => void",
			documentation: { summary: "Greets." },
		});
		const result = await runEnforce([sym]);
		const e002 = result.errors.find((e) => e.code === "E002");
		expect(e002?.suggestedFix).toBeDefined();
		expect(e002?.suggestedFix).toContain("name");
		expect(e002?.symbolName).toBe("greet");
	});

	it("populates suggestedFix on E003 errors", async () => {
		const sym = makeSymbol({
			name: "getCount",
			kind: "function",
			signature: "() => number",
			documentation: { summary: "Returns the count." },
		});
		const result = await runEnforce([sym]);
		const e003 = result.errors.find((e) => e.code === "E003");
		expect(e003?.suggestedFix).toBeDefined();
		expect(e003?.suggestedFix).toContain("@returns");
	});

	it("populates suggestedFix on E004 errors", async () => {
		const sym = makeSymbol({
			name: "parseConfig",
			kind: "function",
			signature: "(raw: string) => void",
			documentation: {
				summary: "Parses config.",
				params: [{ name: "raw", description: "Raw string." }],
			},
		});
		const result = await runEnforce([sym]);
		const e004 = result.errors.find((e) => e.code === "E004");
		expect(e004?.suggestedFix).toBeDefined();
		expect(e004?.suggestedFix).toContain("@example");
		expect(e004?.suggestedFix).toContain("parseConfig");
	});

	it("populates suggestedFix on E006 errors", async () => {
		const sym = makeSymbol({
			name: "MyClass",
			kind: "class",
			documentation: { summary: "A class." },
			children: [
				makeSymbol({
					name: "run",
					kind: "method",
					filePath: "/fake/src/index.ts",
					line: 15,
					documentation: undefined,
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e006 = result.errors.find((e) => e.code === "E006");
		expect(e006?.suggestedFix).toBeDefined();
		expect(e006?.suggestedFix).toContain("run");
		expect(e006?.symbolName).toBe("run");
	});

	it("populates suggestedFix on E007 errors", async () => {
		const sym = makeSymbol({
			name: "MyInterface",
			kind: "interface",
			documentation: { summary: "An interface." },
			children: [
				makeSymbol({
					name: "enabled",
					kind: "property",
					filePath: "/fake/src/index.ts",
					line: 6,
					documentation: undefined,
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e007 = result.errors.find((e) => e.code === "E007");
		expect(e007?.suggestedFix).toBeDefined();
		expect(e007?.suggestedFix).toContain("enabled");
		expect(e007?.symbolName).toBe("enabled");
	});
});

describe("enforce — E008 dead {@link} references", () => {
	it("passes when {@link} targets an existing symbol", async () => {
		const sym = makeSymbol({
			name: "doThing",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				links: [{ target: "doThing", line: 1 }],
			},
		});
		const result = await runEnforce([sym]);
		const e008 = result.errors.filter((e) => e.code === "E008");
		expect(e008).toHaveLength(0);
	});

	it("emits E008 when {@link NonExistent} references an unknown symbol", async () => {
		const sym = makeSymbol({
			name: "doThing",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				links: [{ target: "NonExistent", line: 3 }],
			},
		});
		const result = await runEnforce([sym]);
		const e008 = result.errors.filter((e) => e.code === "E008");
		expect(e008).toHaveLength(1);
		expect(e008[0].message).toContain("NonExistent");
		expect(e008[0].message).toContain("doThing");
	});

	it("passes when {@link ClassName.method} references an existing qualified name", async () => {
		const parentSym = makeSymbol({
			name: "MyService",
			kind: "class",
			documentation: {
				summary: "A service.",
				links: [{ target: "MyService.connect", line: 1 }],
			},
			children: [
				makeSymbol({
					name: "connect",
					kind: "method",
					filePath: "/fake/src/module.ts",
					line: 20,
					documentation: { summary: "Connects the service." },
				}),
			],
		});
		const result = await runEnforce([parentSym]);
		const e008 = result.errors.filter((e) => e.code === "E008");
		expect(e008).toHaveLength(0);
	});

	it("emits E008 when {@link ClassName.missingMethod} references an unknown qualified name", async () => {
		const parentSym = makeSymbol({
			name: "MyService",
			kind: "class",
			documentation: {
				summary: "A service.",
				links: [{ target: "MyService.disconnect", line: 1 }],
			},
			children: [
				makeSymbol({
					name: "connect",
					kind: "method",
					filePath: "/fake/src/module.ts",
					line: 20,
					documentation: { summary: "Connects the service." },
				}),
			],
		});
		const result = await runEnforce([parentSym]);
		const e008 = result.errors.filter((e) => e.code === "E008");
		expect(e008).toHaveLength(1);
		expect(e008[0].message).toContain("MyService.disconnect");
	});

	it("populates suggestedFix on E008 errors", async () => {
		const sym = makeSymbol({
			name: "helper",
			documentation: {
				summary: "A helper.",
				examples: [{ code: "helper();", language: "typescript", line: 5 }],
				links: [{ target: "GoneSymbol", line: 2 }],
			},
		});
		const result = await runEnforce([sym]);
		const e008 = result.errors.find((e) => e.code === "E008");
		expect(e008?.suggestedFix).toBeDefined();
		expect(e008?.suggestedFix).toContain("GoneSymbol");
		expect(e008?.symbolName).toBe("helper");
		expect(e008?.symbolKind).toBe("function");
	});

	it("does not emit E008 when the symbol has no links", async () => {
		const sym = makeSymbol({
			name: "standalone",
			documentation: {
				summary: "No links here.",
				examples: [{ code: "standalone();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const e008 = result.errors.filter((e) => e.code === "E008");
		expect(e008).toHaveLength(0);
	});
});

describe("enforce — W003 deprecated without reason", () => {
	it("emits W003 when @deprecated tag has no explanation", async () => {
		const sym = makeSymbol({
			name: "legacyFn",
			documentation: {
				summary: "Old function.",
				deprecated: "true",
			},
		});
		const result = await runEnforce([sym]);
		const w003 = result.warnings.filter((w) => w.code === "W003");
		expect(w003).toHaveLength(1);
	});

	it("does not emit W003 when @deprecated has an explanation", async () => {
		const sym = makeSymbol({
			name: "legacyFn",
			documentation: {
				summary: "Old function.",
				deprecated: "Use newFn instead.",
			},
		});
		const result = await runEnforce([sym]);
		const w003 = result.warnings.filter((w) => w.code === "W003");
		expect(w003).toHaveLength(0);
	});
});

describe("enforce — per-rule configuration", () => {
	it('rule set to "off" suppresses that check entirely', async () => {
		const sym = makeSymbol({ name: "noSummary", documentation: undefined });
		const result = await runEnforce([sym], {
			rules: { "require-summary": "off" },
		});
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001).toHaveLength(0);
	});

	it('rule set to "warn" produces a warning instead of an error', async () => {
		const sym = makeSymbol({
			name: "noExample",
			kind: "function",
			signature: "(x: string) => void",
			documentation: {
				summary: "Does something.",
				params: [{ name: "x", description: "The input." }],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-example": "warn" },
		});
		const e004 = result.errors.filter((e) => e.code === "E004");
		const w004 = result.warnings.filter((w) => w.code === "E004");
		expect(e004).toHaveLength(0);
		expect(w004).toHaveLength(1);
	});

	it('rule set to "error" produces an error', async () => {
		const sym = makeSymbol({ name: "noSummary", documentation: undefined });
		const result = await runEnforce([sym], {
			rules: { "require-summary": "error" },
		});
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001).toHaveLength(1);
		expect(result.success).toBe(false);
	});

	it('strict mode promotes "warn" rules to errors', async () => {
		const sym = makeSymbol({
			name: "noExample",
			kind: "function",
			signature: "(x: string) => void",
			documentation: {
				summary: "Does something.",
				params: [{ name: "x", description: "The input." }],
			},
		});
		const result = await runEnforce([sym], {
			strict: true,
			rules: { "require-example": "warn" },
		});
		// With strict=true the "warn" should be promoted to "error"
		const e004AsError = result.errors.filter((e) => e.code === "E004");
		expect(e004AsError).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "E004")).toHaveLength(0);
	});

	it("default rules match expected severities", async () => {
		expect(DEFAULT_RULES["require-summary"]).toBe("error");
		expect(DEFAULT_RULES["require-param"]).toBe("error");
		expect(DEFAULT_RULES["require-returns"]).toBe("error");
		expect(DEFAULT_RULES["require-example"]).toBe("error");
		expect(DEFAULT_RULES["require-package-doc"]).toBe("warn");
		expect(DEFAULT_RULES["require-class-member-doc"]).toBe("error");
		expect(DEFAULT_RULES["require-interface-member-doc"]).toBe("error");
		expect(DEFAULT_RULES["require-remarks"]).toBe("error");
		expect(DEFAULT_RULES["require-default-value"]).toBe("warn");
		expect(DEFAULT_RULES["require-type-param"]).toBe("error");
		expect(DEFAULT_RULES["require-see"]).toBe("warn");
		expect(DEFAULT_RULES["require-release-tag"]).toBe("error");
		expect(DEFAULT_RULES["require-fresh-guides"]).toBe("warn");
		expect(DEFAULT_RULES["require-guide-coverage"]).toBe("warn");
	});

	it("custom rules override defaults while keeping other defaults intact", async () => {
		// Turn off require-example; require-summary should still be "error"
		const sym = makeSymbol({
			name: "noSummaryNoExample",
			kind: "function",
			documentation: undefined,
		});
		const result = await runEnforce([sym], {
			rules: { "require-example": "off" },
		});
		// E001 (require-summary) still fires as an error
		const e001 = result.errors.filter((e) => e.code === "E001");
		expect(e001).toHaveLength(1);
		// E004 (require-example) is suppressed
		const e004 = result.errors.filter((e) => e.code === "E004");
		expect(e004).toHaveLength(0);
	});

	it("require-package-doc defaults to warn, not error", async () => {
		// An index.ts symbol without @packageDocumentation should produce a warning only
		const sym = makeSymbol({
			name: "doThing",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e005Error = result.errors.filter((e) => e.code === "E005");
		const e005Warn = result.warnings.filter((w) => w.code === "E005");
		expect(e005Error).toHaveLength(0);
		expect(e005Warn).toHaveLength(1);
		// Should still succeed since there are no errors
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// W006 TSDoc parser syntax messages
// ---------------------------------------------------------------------------

describe("enforce — W006 TSDoc parser syntax messages", () => {
	it("emits W006 for each parseMessage on a symbol's documentation", async () => {
		const sym = makeSymbol({
			name: "badDoc",
			documentation: {
				summary: "Has parse errors.",
				examples: [{ code: "badDoc();", language: "typescript", line: 5 }],
				parseMessages: [
					{
						messageId: "tsdoc-param-tag-missing-hyphen",
						text: "The @param block should be followed by a parameter name and then a hyphen",
						line: 10,
					},
				],
			},
		});
		const result = await runEnforce([sym]);
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006).toHaveLength(1);
		expect(w006[0].message).toContain("tsdoc-param-tag-missing-hyphen");
		expect(w006[0].message).toContain("TSDoc syntax:");
		expect(w006[0].line).toBe(10);
	});

	it("emits multiple W006 for multiple parseMessages", async () => {
		const sym = makeSymbol({
			name: "veryBadDoc",
			documentation: {
				summary: "Has many parse errors.",
				examples: [{ code: "veryBadDoc();", language: "typescript", line: 5 }],
				parseMessages: [
					{
						messageId: "tsdoc-param-tag-missing-hyphen",
						text: "The @param block should be followed by a parameter name and then a hyphen",
						line: 10,
					},
					{
						messageId: "tsdoc-undefined-tag",
						text: 'The TSDoc tag "@unknownTag" is not defined',
						line: 12,
					},
					{
						messageId: "tsdoc-code-fence-opening-indent",
						text: "The opening backtick for a code fence must appear at the start of the line",
						line: 15,
					},
				],
			},
		});
		const result = await runEnforce([sym]);
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006).toHaveLength(3);
		expect(w006[0].message).toContain("tsdoc-param-tag-missing-hyphen");
		expect(w006[1].message).toContain("tsdoc-undefined-tag");
		expect(w006[2].message).toContain("tsdoc-code-fence-opening-indent");
	});

	it("does not emit W006 when there are no parseMessages", async () => {
		const sym = makeSymbol({
			name: "goodDoc",
			documentation: {
				summary: "Clean documentation.",
				examples: [{ code: "goodDoc();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006).toHaveLength(0);
	});

	it("does not emit W006 when parseMessages is an empty array", async () => {
		const sym = makeSymbol({
			name: "cleanDoc",
			documentation: {
				summary: "No parse errors.",
				examples: [{ code: "cleanDoc();", language: "typescript", line: 5 }],
				parseMessages: [],
			},
		});
		const result = await runEnforce([sym]);
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006).toHaveLength(0);
	});

	it("respects require-tsdoc-syntax set to 'off'", async () => {
		const sym = makeSymbol({
			name: "badDoc",
			documentation: {
				summary: "Has parse errors.",
				examples: [{ code: "badDoc();", language: "typescript", line: 5 }],
				parseMessages: [
					{
						messageId: "tsdoc-param-tag-missing-hyphen",
						text: "Missing hyphen",
						line: 10,
					},
				],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-tsdoc-syntax": "off" },
		});
		const w006 = result.warnings.filter((w) => w.code === "W006");
		const e006 = result.errors.filter((e) => e.code === "W006");
		expect(w006).toHaveLength(0);
		expect(e006).toHaveLength(0);
	});

	it("respects require-tsdoc-syntax set to 'error'", async () => {
		const sym = makeSymbol({
			name: "badDoc",
			documentation: {
				summary: "Has parse errors.",
				examples: [{ code: "badDoc();", language: "typescript", line: 5 }],
				parseMessages: [
					{
						messageId: "tsdoc-undefined-tag",
						text: "Undefined tag @foo",
						line: 10,
					},
				],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-tsdoc-syntax": "error" },
		});
		const w006Errors = result.errors.filter((e) => e.code === "W006");
		const w006Warnings = result.warnings.filter((w) => w.code === "W006");
		expect(w006Errors).toHaveLength(1);
		expect(w006Warnings).toHaveLength(0);
		expect(result.success).toBe(false);
	});

	it("promotes W006 to error in strict mode", async () => {
		const sym = makeSymbol({
			name: "badDoc",
			documentation: {
				summary: "Has parse errors.",
				examples: [{ code: "badDoc();", language: "typescript", line: 5 }],
				parseMessages: [
					{
						messageId: "tsdoc-code-fence-opening-indent",
						text: "Code fence indentation problem",
						line: 10,
					},
				],
			},
		});
		const result = await runEnforce([sym], { strict: true });
		const w006Errors = result.errors.filter((e) => e.code === "W006");
		const w006Warnings = result.warnings.filter((w) => w.code === "W006");
		expect(w006Errors).toHaveLength(1);
		expect(w006Warnings).toHaveLength(0);
	});

	it("W006 default severity is warn (success remains true)", async () => {
		const sym = makeSymbol({
			name: "badDoc",
			documentation: {
				summary: "Has parse errors.",
				examples: [{ code: "badDoc();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				parseMessages: [
					{
						messageId: "tsdoc-param-tag-missing-hyphen",
						text: "Missing hyphen",
						line: 10,
					},
				],
			},
		});
		const result = await runEnforce([sym]);
		expect(result.success).toBe(true);
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006).toHaveLength(1);
	});

	it("includes symbolName and symbolKind in W006 diagnostics", async () => {
		const sym = makeSymbol({
			name: "myMethod",
			kind: "method",
			documentation: {
				summary: "A method.",
				parseMessages: [
					{
						messageId: "tsdoc-escape-right-brace",
						text: "A right curly brace must be escaped",
						line: 3,
					},
				],
			},
		});
		const result = await runEnforce([sym]);
		const w006 = result.warnings.find((w) => w.code === "W006");
		expect(w006).toBeDefined();
		expect(w006?.symbolName).toBe("myMethod");
		expect(w006?.symbolKind).toBe("method");
	});

	it("emits W006 for parseMessages on child symbols", async () => {
		const sym = makeSymbol({
			name: "MyClass",
			kind: "class",
			documentation: { summary: "A class." },
			children: [
				makeSymbol({
					name: "badMethod",
					kind: "method",
					filePath: "/fake/src/module.ts",
					line: 20,
					documentation: {
						summary: "A method with parse errors.",
						parseMessages: [
							{
								messageId: "tsdoc-inline-tag-missing-braces",
								text: "Inline tag is missing braces",
								line: 20,
							},
						],
					},
				}),
			],
		});
		const result = await runEnforce([sym]);
		const w006 = result.warnings.filter((w) => w.code === "W006");
		expect(w006).toHaveLength(1);
		expect(w006[0].message).toContain("tsdoc-inline-tag-missing-braces");
		expect(w006[0].symbolName).toBe("badMethod");
	});
});

// ---------------------------------------------------------------------------
// E013 — @remarks required on public functions/classes
// ---------------------------------------------------------------------------

describe("enforce — E013 missing @remarks", () => {
	it("emits E013 for an exported function missing @remarks", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const e013 = result.errors.filter((e) => e.code === "E013");
		expect(e013).toHaveLength(1);
		expect(e013[0].message).toContain("doThing");
		expect(e013[0].message).toContain("function");
		expect(e013[0].message).toContain("@remarks");
	});

	it("emits E013 for an exported class missing @remarks", async () => {
		const sym = makeSymbol({
			name: "MyService",
			kind: "class",
			documentation: {
				summary: "A service.",
			},
		});
		const result = await runEnforce([sym]);
		const e013 = result.errors.filter((e) => e.code === "E013");
		expect(e013).toHaveLength(1);
		expect(e013[0].message).toContain("MyService");
		expect(e013[0].message).toContain("class");
	});

	it("passes when an exported function has @remarks", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Detailed description of doThing."] },
			},
		});
		const result = await runEnforce([sym]);
		const e013 = result.errors.filter((e) => e.code === "E013");
		expect(e013).toHaveLength(0);
	});

	it("does not emit E013 for interfaces", async () => {
		const sym = makeSymbol({
			name: "MyInterface",
			kind: "interface",
			documentation: { summary: "An interface." },
		});
		const result = await runEnforce([sym]);
		const e013 = result.errors.filter((e) => e.code === "E013");
		expect(e013).toHaveLength(0);
	});

	it("does not emit E013 for variables", async () => {
		const sym = makeSymbol({
			name: "MY_CONST",
			kind: "variable",
			documentation: { summary: "A constant." },
		});
		const result = await runEnforce([sym]);
		const e013 = result.errors.filter((e) => e.code === "E013");
		expect(e013).toHaveLength(0);
	});

	it("respects require-remarks set to 'off'", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-remarks": "off" },
		});
		const e013 = result.errors.filter((e) => e.code === "E013");
		expect(e013).toHaveLength(0);
	});

	it("respects require-remarks set to 'warn'", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-remarks": "warn" },
		});
		const e013Warnings = result.warnings.filter((w) => w.code === "E013");
		const e013Errors = result.errors.filter((e) => e.code === "E013");
		expect(e013Warnings).toHaveLength(1);
		expect(e013Errors).toHaveLength(0);
	});

	it("strict mode promotes E013 'warn' to error", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym], {
			strict: true,
			rules: { "require-remarks": "warn" },
		});
		const e013Errors = result.errors.filter((e) => e.code === "E013");
		expect(e013Errors).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "E013")).toHaveLength(0);
	});

	it("populates suggestedFix on E013 errors", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const e013 = result.errors.find((e) => e.code === "E013");
		expect(e013?.suggestedFix).toBeDefined();
		expect(e013?.suggestedFix).toContain("@remarks");
		expect(e013?.suggestedFix).toContain("doThing");
		expect(e013?.symbolName).toBe("doThing");
		expect(e013?.symbolKind).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// E014 — @defaultValue on optional properties with defaults
// ---------------------------------------------------------------------------

describe("enforce — E014 missing @defaultValue on optional properties", () => {
	it("emits E014 for an optional property missing @defaultValue", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					signature: "number | undefined",
					documentation: { summary: "The timeout." },
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e014 = result.warnings.filter((w) => w.code === "E014");
		expect(e014).toHaveLength(1);
		expect(e014[0].message).toContain("timeout");
		expect(e014[0].message).toContain("MyConfig");
		expect(e014[0].message).toContain("@defaultValue");
	});

	it("passes when an optional property has @defaultValue", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					signature: "number | undefined",
					documentation: {
						summary: "The timeout.",
						tags: { defaultValue: ["3000"] },
					},
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e014Errors = result.errors.filter((e) => e.code === "E014");
		const e014Warns = result.warnings.filter((w) => w.code === "E014");
		expect(e014Errors).toHaveLength(0);
		expect(e014Warns).toHaveLength(0);
	});

	it("does not emit E014 for required (non-optional) properties", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "name",
					kind: "property",
					signature: "string",
					documentation: { summary: "The name." },
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e014 = [...result.errors, ...result.warnings].filter((d) => d.code === "E014");
		expect(e014).toHaveLength(0);
	});

	it("does not emit E014 for function parameters (only interface/type children)", async () => {
		const sym = makeSymbol({
			name: "greet",
			kind: "function",
			signature: "(name?: string) => void",
			documentation: {
				summary: "Greets someone.",
				params: [{ name: "name", description: "Name." }],
				tags: { remarks: ["Details."] },
				examples: [{ code: "greet();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const e014 = [...result.errors, ...result.warnings].filter((d) => d.code === "E014");
		expect(e014).toHaveLength(0);
	});

	it("emits E014 for type alias children with optional properties", async () => {
		const sym = makeSymbol({
			name: "Options",
			kind: "type",
			documentation: { summary: "Options type." },
			children: [
				makeSymbol({
					name: "verbose",
					kind: "property",
					signature: "boolean | undefined",
					documentation: { summary: "Enable verbose mode." },
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e014 = result.warnings.filter((w) => w.code === "E014");
		expect(e014).toHaveLength(1);
		expect(e014[0].message).toContain("verbose");
		expect(e014[0].message).toContain("Options");
	});

	it("respects require-default-value set to 'off'", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					signature: "number | undefined",
					documentation: { summary: "The timeout." },
				}),
			],
		});
		const result = await runEnforce([sym], {
			rules: { "require-default-value": "off" },
		});
		const e014 = [...result.errors, ...result.warnings].filter((d) => d.code === "E014");
		expect(e014).toHaveLength(0);
	});

	it("respects require-default-value set to 'error'", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					signature: "number | undefined",
					documentation: { summary: "The timeout." },
				}),
			],
		});
		const result = await runEnforce([sym], {
			rules: { "require-default-value": "error" },
		});
		const e014Errors = result.errors.filter((e) => e.code === "E014");
		expect(e014Errors).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "E014")).toHaveLength(0);
	});

	it("strict mode promotes E014 'warn' to error", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					signature: "number | undefined",
					documentation: { summary: "The timeout." },
				}),
			],
		});
		const result = await runEnforce([sym], { strict: true });
		const e014Errors = result.errors.filter((e) => e.code === "E014");
		expect(e014Errors).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "E014")).toHaveLength(0);
	});

	it("populates suggestedFix on E014 diagnostics", async () => {
		const sym = makeSymbol({
			name: "MyConfig",
			kind: "interface",
			documentation: { summary: "A config.", tags: { remarks: ["Details."] } },
			children: [
				makeSymbol({
					name: "timeout",
					kind: "property",
					signature: "number | undefined",
					documentation: { summary: "The timeout." },
				}),
			],
		});
		const result = await runEnforce([sym]);
		const e014 = result.warnings.find((w) => w.code === "E014");
		expect(e014?.suggestedFix).toBeDefined();
		expect(e014?.suggestedFix).toContain("@defaultValue");
		expect(e014?.suggestedFix).toContain("timeout");
		expect(e014?.symbolName).toBe("timeout");
	});
});

// ---------------------------------------------------------------------------
// E015 — @typeParam on generic symbols
// ---------------------------------------------------------------------------

describe("enforce — E015 missing @typeParam on generic symbols", () => {
	it("emits E015 for a generic function missing @typeParam", async () => {
		const sym = makeSymbol({
			name: "identity",
			kind: "function",
			signature: "<T>(value: T) => T",
			documentation: {
				summary: "Returns the value.",
				params: [{ name: "value", description: "The value." }],
				returns: { description: "The same value." },
				examples: [{ code: "identity(42);", language: "typescript", line: 5 }],
				tags: { remarks: ["A detailed identity fn."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(1);
		expect(e015[0].message).toContain("T");
		expect(e015[0].message).toContain("identity");
		expect(e015[0].message).toContain("@typeParam");
	});

	it("passes when all type params are documented", async () => {
		const sym = makeSymbol({
			name: "identity",
			kind: "function",
			signature: "<T>(value: T) => T",
			documentation: {
				summary: "Returns the value.",
				params: [{ name: "value", description: "The value." }],
				returns: { description: "The same value." },
				examples: [{ code: "identity(42);", language: "typescript", line: 5 }],
				tags: {
					remarks: ["A detailed identity fn."],
					typeParam: ["T - The type of value."],
				},
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(0);
	});

	it("emits E015 for each undocumented type param in multi-param generics", async () => {
		const sym = makeSymbol({
			name: "mapValues",
			kind: "function",
			signature: "<K, V>(map: Map<K, V>) => V[]",
			documentation: {
				summary: "Extracts values from a map.",
				params: [{ name: "map", description: "The map." }],
				returns: { description: "The values." },
				examples: [{ code: "mapValues(new Map());", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(2);
		const messages = e015.map((e) => e.message);
		expect(messages.some((m) => m.includes('"K"'))).toBe(true);
		expect(messages.some((m) => m.includes('"V"'))).toBe(true);
	});

	it("handles constrained type params like <T extends Foo>", async () => {
		const sym = makeSymbol({
			name: "process",
			kind: "function",
			signature: "<T extends Record<string, unknown>>(input: T) => T",
			documentation: {
				summary: "Processes input.",
				params: [{ name: "input", description: "The input." }],
				returns: { description: "Processed input." },
				examples: [{ code: "process({});", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(1);
		expect(e015[0].message).toContain('"T"');
	});

	it("does not emit E015 for non-generic functions", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			signature: "(name: string) => void",
			documentation: {
				summary: "Does a thing.",
				params: [{ name: "name", description: "Name." }],
				examples: [{ code: "doThing('hi');", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(0);
	});

	it("emits E015 for generic interfaces", async () => {
		const sym = makeSymbol({
			name: "Container",
			kind: "interface",
			signature: "<T>",
			documentation: {
				summary: "A container.",
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(1);
		expect(e015[0].message).toContain('"T"');
		expect(e015[0].message).toContain("Container");
	});

	it("emits E015 for generic classes", async () => {
		const sym = makeSymbol({
			name: "Stack",
			kind: "class",
			signature: "<T>",
			documentation: {
				summary: "A stack.",
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(1);
		expect(e015[0].message).toContain('"T"');
		expect(e015[0].message).toContain("Stack");
	});

	it("respects require-type-param set to 'off'", async () => {
		const sym = makeSymbol({
			name: "identity",
			kind: "function",
			signature: "<T>(value: T) => T",
			documentation: {
				summary: "Returns the value.",
				params: [{ name: "value", description: "The value." }],
				returns: { description: "The same value." },
				examples: [{ code: "identity(42);", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-type-param": "off" },
		});
		const e015 = result.errors.filter((e) => e.code === "E015");
		expect(e015).toHaveLength(0);
	});

	it("respects require-type-param set to 'warn'", async () => {
		const sym = makeSymbol({
			name: "identity",
			kind: "function",
			signature: "<T>(value: T) => T",
			documentation: {
				summary: "Returns the value.",
				params: [{ name: "value", description: "The value." }],
				returns: { description: "The same value." },
				examples: [{ code: "identity(42);", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-type-param": "warn" },
		});
		const e015Warnings = result.warnings.filter((w) => w.code === "E015");
		const e015Errors = result.errors.filter((e) => e.code === "E015");
		expect(e015Warnings).toHaveLength(1);
		expect(e015Errors).toHaveLength(0);
	});

	it("strict mode promotes E015 'warn' to error", async () => {
		const sym = makeSymbol({
			name: "identity",
			kind: "function",
			signature: "<T>(value: T) => T",
			documentation: {
				summary: "Returns the value.",
				params: [{ name: "value", description: "The value." }],
				returns: { description: "The same value." },
				examples: [{ code: "identity(42);", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			strict: true,
			rules: { "require-type-param": "warn" },
		});
		const e015Errors = result.errors.filter((e) => e.code === "E015");
		expect(e015Errors).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "E015")).toHaveLength(0);
	});

	it("populates suggestedFix on E015 errors", async () => {
		const sym = makeSymbol({
			name: "identity",
			kind: "function",
			signature: "<T>(value: T) => T",
			documentation: {
				summary: "Returns the value.",
				params: [{ name: "value", description: "The value." }],
				returns: { description: "The same value." },
				examples: [{ code: "identity(42);", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const e015 = result.errors.find((e) => e.code === "E015");
		expect(e015?.suggestedFix).toBeDefined();
		expect(e015?.suggestedFix).toContain("@typeParam");
		expect(e015?.suggestedFix).toContain("T");
		expect(e015?.symbolName).toBe("identity");
		expect(e015?.symbolKind).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// W005 — @see for referenced symbols
// ---------------------------------------------------------------------------

describe("enforce — W005 missing @see for {@link} references", () => {
	it("emits W005 when a symbol has {@link} references but no @see tags", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		const result = await runEnforce([sym]);
		const w005 = result.warnings.filter((w) => w.code === "W005");
		expect(w005).toHaveLength(1);
		expect(w005[0].message).toContain("doThing");
		expect(w005[0].message).toContain("{@link}");
		expect(w005[0].message).toContain("@see");
	});

	it("does not emit W005 when the symbol has both {@link} and @see", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."], see: ["otherThing"] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		const result = await runEnforce([sym]);
		const w005 = result.warnings.filter((w) => w.code === "W005");
		expect(w005).toHaveLength(0);
	});

	it("does not emit W005 when the symbol has no {@link} references", async () => {
		const sym = makeSymbol({
			name: "standalone",
			kind: "function",
			documentation: {
				summary: "A standalone function.",
				examples: [{ code: "standalone();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const w005 = result.warnings.filter((w) => w.code === "W005");
		expect(w005).toHaveLength(0);
	});

	it("does not emit W005 when links is an empty array", async () => {
		const sym = makeSymbol({
			name: "standalone",
			kind: "function",
			documentation: {
				summary: "A standalone function.",
				examples: [{ code: "standalone();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [],
			},
		});
		const result = await runEnforce([sym]);
		const w005 = result.warnings.filter((w) => w.code === "W005");
		expect(w005).toHaveLength(0);
	});

	it("respects require-see set to 'off'", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-see": "off" },
		});
		const w005 = [...result.errors, ...result.warnings].filter((d) => d.code === "W005");
		expect(w005).toHaveLength(0);
	});

	it("respects require-see set to 'error'", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-see": "error" },
		});
		const w005Errors = result.errors.filter((e) => e.code === "W005");
		const w005Warnings = result.warnings.filter((w) => w.code === "W005");
		expect(w005Errors).toHaveLength(1);
		expect(w005Warnings).toHaveLength(0);
		expect(result.success).toBe(false);
	});

	it("strict mode promotes W005 'warn' to error", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		const result = await runEnforce([sym], { strict: true });
		const w005Errors = result.errors.filter((e) => e.code === "W005");
		expect(w005Errors).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "W005")).toHaveLength(0);
	});

	it("W005 default severity is warn (success remains true)", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		// Add target symbol so E008 does not fire
		const target = makeSymbol({
			name: "otherThing",
			kind: "variable",
			documentation: { summary: "Another thing." },
		});
		const result = await runEnforce([sym, target]);
		expect(result.success).toBe(true);
		const w005 = result.warnings.filter((w) => w.code === "W005");
		expect(w005).toHaveLength(1);
	});

	it("populates suggestedFix on W005 warnings", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
				links: [{ target: "otherThing", line: 3 }],
			},
		});
		const result = await runEnforce([sym]);
		const w005 = result.warnings.find((w) => w.code === "W005");
		expect(w005?.suggestedFix).toBeDefined();
		expect(w005?.suggestedFix).toContain("@see");
		expect(w005?.symbolName).toBe("doThing");
		expect(w005?.symbolKind).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// findDeprecatedUsages unit tests
// ---------------------------------------------------------------------------

describe("findDeprecatedUsages — unit", () => {
	it("returns empty array when no symbols are deprecated", () => {
		const sym = makeSymbol({
			name: "activeApi",
			filePath: "/project/packages/core/src/api.ts",
			exported: true,
			documentation: { summary: "An active API." },
		});
		const result = findDeprecatedUsages([sym]);
		expect(result).toHaveLength(0);
	});

	it("returns empty array when there are no links", () => {
		const deprecated = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			exported: true,
			documentation: { summary: "Old API.", deprecated: "Use newApi instead." },
		});
		const consumer = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			exported: true,
			documentation: { summary: "Consumer." },
		});
		const result = findDeprecatedUsages([deprecated, consumer]);
		expect(result).toHaveLength(0);
	});

	it("returns a usage when a cross-package link targets a deprecated symbol", () => {
		const deprecated = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			exported: true,
			documentation: { summary: "Old API.", deprecated: "Use newApi instead." },
		});
		const consumer = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			exported: true,
			documentation: {
				summary: "Consumer.",
				links: [{ target: "oldApi", line: 5 }],
			},
		});
		const result = findDeprecatedUsages([deprecated, consumer]);
		expect(result).toHaveLength(1);
		expect(result[0].deprecatedSymbol).toBe("oldApi");
		expect(result[0].sourcePackage).toBe("core");
		expect(result[0].consumingFile).toBe("/project/packages/cli/src/app.ts");
		expect(result[0].line).toBe(5);
		expect(result[0].deprecationMessage).toBe("Use newApi instead.");
	});

	it("does not flag a same-package link to a deprecated symbol", () => {
		const deprecated = makeSymbol({
			name: "oldHelper",
			filePath: "/project/packages/core/src/old.ts",
			exported: true,
			documentation: { summary: "Old helper.", deprecated: "Use newHelper instead." },
		});
		const consumer = makeSymbol({
			name: "wrapper",
			filePath: "/project/packages/core/src/wrapper.ts",
			exported: true,
			documentation: {
				summary: "Wrapper.",
				links: [{ target: "oldHelper", line: 3 }],
			},
		});
		const result = findDeprecatedUsages([deprecated, consumer]);
		expect(result).toHaveLength(0);
	});

	it("does not flag a link that targets a non-deprecated symbol", () => {
		const activeSymbol = makeSymbol({
			name: "activeApi",
			filePath: "/project/packages/core/src/api.ts",
			exported: true,
			documentation: { summary: "An active API." },
		});
		const consumer = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			exported: true,
			documentation: {
				summary: "Consumer.",
				links: [{ target: "activeApi", line: 7 }],
			},
		});
		const result = findDeprecatedUsages([activeSymbol, consumer]);
		expect(result).toHaveLength(0);
	});

	it("does not flag a link from the same file as the deprecated symbol", () => {
		const deprecated = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			exported: true,
			documentation: { summary: "Old API.", deprecated: "Use newApi instead." },
		});
		const sameFile = makeSymbol({
			name: "relatedDoc",
			filePath: "/project/packages/core/src/old.ts",
			exported: true,
			documentation: {
				summary: "Related doc in same file.",
				links: [{ target: "oldApi", line: 2 }],
			},
		});
		const result = findDeprecatedUsages([deprecated, sameFile]);
		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// W004 integration tests (via enforce)
// ---------------------------------------------------------------------------

describe("enforce — W004 cross-package deprecated symbol usage", () => {
	it("emits no W004 when there are no deprecated symbols", async () => {
		const sym = makeSymbol({
			name: "activeApi",
			filePath: "/project/packages/core/src/api.ts",
			documentation: {
				summary: "An active API.",
				examples: [{ code: "activeApi();", language: "typescript", line: 5 }],
			},
		});
		const result = await runEnforce([sym]);
		const w004 = result.warnings.filter((w) => w.code === "W004");
		expect(w004).toHaveLength(0);
	});

	it("emits no W004 for same-package reference to a deprecated symbol", async () => {
		const deprecatedSymbol = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			documentation: {
				summary: "Old API.",
				deprecated: "Use newApi instead.",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
			},
		});
		const consumingSymbol = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/core/src/wrapper.ts",
			documentation: {
				summary: "Uses the old API within same package.",
				examples: [{ code: "consumer();", language: "typescript", line: 5 }],
				links: [{ target: "oldApi", line: 3 }],
			},
		});
		const result = await runEnforce([deprecatedSymbol, consumingSymbol]);
		const w004 = result.warnings.filter((w) => w.code === "W004");
		expect(w004).toHaveLength(0);
	});

	it("emits W004 for a cross-package reference to a deprecated symbol", async () => {
		const deprecatedSymbol = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			documentation: {
				summary: "Old API.",
				deprecated: "Use newApi instead.",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
			},
		});
		const consumingSymbol = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			documentation: {
				summary: "Uses the old API.",
				examples: [{ code: "consumer();", language: "typescript", line: 5 }],
				links: [{ target: "oldApi", line: 5 }],
			},
		});
		const result = await runEnforce([deprecatedSymbol, consumingSymbol]);
		const w004 = result.warnings.filter((w) => w.code === "W004");
		expect(w004).toHaveLength(1);
		expect(w004[0].message).toContain("oldApi");
		expect(w004[0].message).toContain("core");
		expect(w004[0].message).toContain("Use newApi instead.");
	});

	it("includes the deprecation message in the W004 warning", async () => {
		const deprecatedSymbol = makeSymbol({
			name: "legacyFn",
			filePath: "/project/packages/core/src/legacy.ts",
			documentation: {
				summary: "Legacy function.",
				deprecated: "Migrate to modernFn for better performance.",
				examples: [{ code: "legacyFn();", language: "typescript", line: 5 }],
			},
		});
		const consumingSymbol = makeSymbol({
			name: "caller",
			filePath: "/project/packages/cli/src/cmd.ts",
			documentation: {
				summary: "Calls the legacy function.",
				examples: [{ code: "caller();", language: "typescript", line: 5 }],
				links: [{ target: "legacyFn", line: 8 }],
			},
		});
		const result = await runEnforce([deprecatedSymbol, consumingSymbol]);
		const w004 = result.warnings.filter((w) => w.code === "W004");
		expect(w004).toHaveLength(1);
		expect(w004[0].message).toContain("Migrate to modernFn for better performance.");
	});

	it("W004 is a warning not an error, so success remains true", async () => {
		const deprecatedSymbol = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			documentation: {
				summary: "Old API.",
				deprecated: "Use newApi instead.",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const consumingSymbol = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			documentation: {
				summary: "Uses the old API.",
				examples: [{ code: "consumer();", language: "typescript", line: 5 }],
				links: [{ target: "oldApi", line: 5 }],
				tags: { remarks: ["Details."], see: ["oldApi"] },
			},
		});
		const result = await runEnforce([deprecatedSymbol, consumingSymbol]);
		expect(result.success).toBe(true);
		expect(result.errors.filter((e) => e.code === "W004")).toHaveLength(0);
		expect(result.warnings.filter((w) => w.code === "W004")).toHaveLength(1);
	});

	it("W004 is promoted to an error in strict mode", async () => {
		const deprecatedSymbol = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			documentation: {
				summary: "Old API.",
				deprecated: "Use newApi instead.",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
			},
		});
		const consumingSymbol = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			documentation: {
				summary: "Uses the old API.",
				examples: [{ code: "consumer();", language: "typescript", line: 5 }],
				links: [{ target: "oldApi", line: 5 }],
			},
		});
		const result = await runEnforce([deprecatedSymbol, consumingSymbol], { strict: true });
		const w004AsError = result.errors.filter((e) => e.code === "W004");
		expect(w004AsError).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "W004")).toHaveLength(0);
	});

	it("populates suggestedFix and symbolName on W004 warnings", async () => {
		const deprecatedSymbol = makeSymbol({
			name: "oldApi",
			filePath: "/project/packages/core/src/old.ts",
			documentation: {
				summary: "Old API.",
				deprecated: "Use newApi instead.",
				examples: [{ code: "oldApi();", language: "typescript", line: 5 }],
			},
		});
		const consumingSymbol = makeSymbol({
			name: "consumer",
			filePath: "/project/packages/cli/src/app.ts",
			documentation: {
				summary: "Uses the old API.",
				examples: [{ code: "consumer();", language: "typescript", line: 5 }],
				links: [{ target: "oldApi", line: 5 }],
			},
		});
		const result = await runEnforce([deprecatedSymbol, consumingSymbol]);
		const w004 = result.warnings.find((w) => w.code === "W004");
		expect(w004?.suggestedFix).toBeDefined();
		expect(w004?.suggestedFix).toContain("oldApi");
		expect(w004?.symbolName).toBe("oldApi");
	});
});

// ---------------------------------------------------------------------------
// E009 — tsconfig strictness regression
// ---------------------------------------------------------------------------

describe("enforce — E009 tsconfig strictness regression", () => {
	afterEach(() => {
		vi.mocked(readFileSync).mockRestore();
	});

	it("passes when all required flags are true", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({
					compilerOptions: { strict: true, strictNullChecks: true, noImplicitAny: true },
				});
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				tsconfig: { enabled: true, requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"] },
			},
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(0);
	});

	it("emits E009 when a required flag is set to false", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({
					compilerOptions: { strict: false, strictNullChecks: true, noImplicitAny: true },
				});
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				tsconfig: { enabled: true, requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"] },
			},
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(1);
		expect(e009[0].message).toContain('"strict"');
		expect(e009[0].message).toContain("disabled");
	});

	it("emits E009 when a required flag is missing from compilerOptions", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({
					compilerOptions: { strict: true },
				});
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { tsconfig: { enabled: true, requiredFlags: ["strict", "strictNullChecks"] } },
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(1);
		expect(e009[0].message).toContain('"strictNullChecks"');
		expect(e009[0].message).toContain("missing");
	});

	it("emits multiple E009 for multiple failing flags", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({ compilerOptions: {} });
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				tsconfig: { enabled: true, requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"] },
			},
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(3);
	});

	it("skips E009 when guards.tsconfig.enabled is false", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({ compilerOptions: { strict: false } });
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { tsconfig: { enabled: false, requiredFlags: ["strict"] } },
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(0);
	});

	it("skips E009 gracefully when tsconfig.json is not found", async () => {
		vi.mocked(readFileSync).mockImplementation(() => {
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { tsconfig: { enabled: true, requiredFlags: ["strict"] } },
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(0);
	});

	it("emits E009 with parse error when tsconfig.json is invalid JSON", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return "{ not valid json";
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { tsconfig: { enabled: true, requiredFlags: ["strict"] } },
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(1);
		expect(e009[0].message).toContain("failed to parse");
	});

	it("handles tsconfig.json with no compilerOptions", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({ extends: "./base.json" });
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { tsconfig: { enabled: true, requiredFlags: ["strict"] } },
		});
		const e009 = result.errors.filter((e) => e.code === "E009");
		expect(e009).toHaveLength(1);
		expect(e009[0].message).toContain('"strict"');
		expect(e009[0].message).toContain("missing");
	});

	it("E009 is always an error (not in RULE_MAP, not configurable)", async () => {
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith("tsconfig.json")) {
				return JSON.stringify({ compilerOptions: { strict: false } });
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { tsconfig: { enabled: true, requiredFlags: ["strict"] } },
		});
		expect(result.success).toBe(false);
		const e009Errors = result.errors.filter((e) => e.code === "E009");
		const e009Warnings = result.warnings.filter((w) => w.code === "E009");
		expect(e009Errors).toHaveLength(1);
		expect(e009Warnings).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// E010 — forge-ts config drift detection
// ---------------------------------------------------------------------------

describe("enforce — E010 config drift detection", () => {
	/** Helper to build a valid ForgeLockManifest JSON string. */
	function makeLockJson(rules: Record<string, string>): string {
		return JSON.stringify({
			version: "1.0.0",
			lockedAt: "2026-03-20T00:00:00.000Z",
			lockedBy: "test",
			config: { rules },
		});
	}

	/** Set up fs mocks so readLockFile finds and reads the lock file. */
	function mockLockFile(lockJson: string): void {
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			return String(filePath).endsWith(".forge-lock.json");
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			if (String(filePath).endsWith(".forge-lock.json")) {
				return lockJson;
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
	}

	afterEach(() => {
		vi.mocked(readFileSync).mockRestore();
		vi.mocked(existsSync).mockRestore();
	});

	it("emits E010 when a rule is weakened from error to warn", async () => {
		mockLockFile(makeLockJson({ "require-summary": "error" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-summary": "warn" },
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(1);
		expect(e010[0].message).toContain("require-summary");
		expect(e010[0].message).toContain('"error"');
		expect(e010[0].message).toContain('"warn"');
	});

	it("emits E010 when a rule is weakened from warn to off", async () => {
		mockLockFile(makeLockJson({ "require-package-doc": "warn" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-package-doc": "off" },
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(1);
		expect(e010[0].message).toContain("require-package-doc");
		expect(e010[0].message).toContain('"warn"');
		expect(e010[0].message).toContain('"off"');
	});

	it("emits E010 when a rule is weakened from error to off", async () => {
		mockLockFile(makeLockJson({ "require-summary": "error" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-summary": "off" },
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(1);
		expect(e010[0].message).toContain('"error"');
		expect(e010[0].message).toContain('"off"');
	});

	it("does NOT emit E010 when a rule is strengthened from warn to error", async () => {
		mockLockFile(makeLockJson({ "require-package-doc": "warn" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-package-doc": "error" },
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(0);
	});

	it("does NOT emit E010 when a rule is strengthened from off to error", async () => {
		mockLockFile(makeLockJson({ "require-summary": "off" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-summary": "error" },
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(0);
	});

	it("does NOT emit E010 when rule severity matches the lock", async () => {
		mockLockFile(makeLockJson({ "require-summary": "error" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-summary": "error" },
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(0);
	});

	it("emits no E010 when .forge-lock.json does not exist", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		const result = await runEnforceWithConfig([], {});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(0);
	});

	it("emits multiple E010 for multiple drifted rules", async () => {
		mockLockFile(
			makeLockJson({
				"require-summary": "error",
				"require-param": "error",
				"require-returns": "warn",
			}),
		);
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: {
					...DEFAULT_RULES,
					"require-summary": "warn",
					"require-param": "off",
					"require-returns": "warn", // same as lock, no drift
				},
			},
		});
		const e010 = result.errors.filter((e) => e.code === "E010");
		expect(e010).toHaveLength(2);
		const messages = e010.map((e) => e.message);
		expect(messages.some((m) => m.includes("require-summary"))).toBe(true);
		expect(messages.some((m) => m.includes("require-param"))).toBe(true);
	});

	it("E010 is always an error (not configurable via RULE_MAP)", async () => {
		mockLockFile(makeLockJson({ "require-summary": "error" }));
		const result = await runEnforceWithConfig([], {
			enforce: {
				enabled: true,
				minVisibility: Visibility.Public,
				strict: false,
				rules: { ...DEFAULT_RULES, "require-summary": "off" },
			},
		});
		expect(result.success).toBe(false);
		const e010Errors = result.errors.filter((e) => e.code === "E010");
		const e010Warnings = result.warnings.filter((w) => w.code === "E010");
		expect(e010Errors).toHaveLength(1);
		expect(e010Warnings).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// W007 — Stale guide FORGE:AUTO detection
// ---------------------------------------------------------------------------

describe("enforce — W007 stale guide FORGE:AUTO detection", () => {
	afterEach(() => {
		vi.mocked(readFileSync).mockRestore();
		vi.mocked(existsSync).mockRestore();
		vi.mocked(readdirSync).mockRestore();
	});

	/** Set up fs mocks so guide files are found and read. */
	function mockGuideFiles(files: Record<string, string>): void {
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			// The guides directory exists
			if (p.endsWith("/guides") || p.endsWith("\\guides")) return true;
			return false;
		});
		vi.mocked(readdirSync).mockImplementation(() => {
			return Object.keys(files) as unknown as ReturnType<typeof readdirSync>;
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			for (const [name, content] of Object.entries(files)) {
				if (p.endsWith(name)) return content;
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
	}

	it("emits W007 when FORGE:AUTO section references a symbol that no longer exists", async () => {
		const sym = makeSymbol({
			name: "bar",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "bar();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"",
				"<!-- FORGE:AUTO-START guide-getting-started -->",
				"Use `foo` to get started.",
				"Also use `bar` for more features.",
				"<!-- FORGE:AUTO-END guide-getting-started -->",
			].join("\n"),
		});
		const result = await runEnforce([sym]);
		const w007 = result.warnings.filter((w) => w.code === "W007");
		// "foo" does not exist in the symbol graph, so W007 fires for it
		expect(w007).toHaveLength(1);
		expect(w007[0].message).toContain("foo");
		expect(w007[0].message).toContain("getting-started.md");
	});

	it("does not emit W007 when FORGE:AUTO section references existing symbols", async () => {
		const sym = makeSymbol({
			name: "bar",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "bar();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"",
				"<!-- FORGE:AUTO-START guide-getting-started -->",
				"Use `bar` to get started.",
				"<!-- FORGE:AUTO-END guide-getting-started -->",
			].join("\n"),
		});
		const result = await runEnforce([sym]);
		const w007 = result.warnings.filter((w) => w.code === "W007");
		expect(w007).toHaveLength(0);
	});

	it("does not emit W007 when no guide files exist", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		const sym = makeSymbol({
			name: "bar",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "bar();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const w007 = result.warnings.filter((w) => w.code === "W007");
		expect(w007).toHaveLength(0);
	});

	it("does not emit W007 when guide has no FORGE:AUTO sections", async () => {
		const sym = makeSymbol({
			name: "bar",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "bar();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"manual-guide.md": [
				"# Manual Guide",
				"",
				"This guide is entirely hand-written.",
				"It mentions `nonexistent` but has no FORGE:AUTO markers.",
			].join("\n"),
		});
		const result = await runEnforce([sym]);
		const w007 = result.warnings.filter((w) => w.code === "W007");
		expect(w007).toHaveLength(0);
	});

	it('suppresses W007 when require-fresh-guides is "off"', async () => {
		const sym = makeSymbol({
			name: "bar",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "bar();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"<!-- FORGE:AUTO-START guide-getting-started -->",
				"Use `nonexistent` to get started.",
				"<!-- FORGE:AUTO-END guide-getting-started -->",
			].join("\n"),
		});
		const result = await runEnforce([sym], {
			rules: { "require-fresh-guides": "off" },
		});
		const w007 = result.warnings.filter((w) => w.code === "W007");
		const e007 = result.errors.filter((e) => e.code === "W007");
		expect(w007).toHaveLength(0);
		expect(e007).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// W008 — Undocumented public symbol in guides
// ---------------------------------------------------------------------------

describe("enforce — W008 undocumented public symbol in guides", () => {
	afterEach(() => {
		vi.mocked(readFileSync).mockRestore();
		vi.mocked(existsSync).mockRestore();
		vi.mocked(readdirSync).mockRestore();
	});

	/** Set up fs mocks so guide files are found and read. */
	function mockGuideFiles(files: Record<string, string>): void {
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith("/guides") || p.endsWith("\\guides")) return true;
			return false;
		});
		vi.mocked(readdirSync).mockImplementation(() => {
			return Object.keys(files) as unknown as ReturnType<typeof readdirSync>;
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			for (const [name, content] of Object.entries(files)) {
				if (p.endsWith(name)) return content;
			}
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
	}

	it("emits W008 when an exported symbol is not mentioned in any guide", async () => {
		const sym = makeSymbol({
			name: "myFunc",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "myFunc();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"",
				"This guide does not mention the function at all.",
			].join("\n"),
		});
		const result = await runEnforce([sym]);
		const w008 = result.warnings.filter((w) => w.code === "W008");
		expect(w008).toHaveLength(1);
		expect(w008[0].message).toContain("myFunc");
	});

	it("does not emit W008 when an exported symbol is mentioned in a guide", async () => {
		const sym = makeSymbol({
			name: "myFunc",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "myFunc();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"",
				"Call `myFunc` to initialize the system.",
			].join("\n"),
		});
		const result = await runEnforce([sym]);
		const w008 = result.warnings.filter((w) => w.code === "W008");
		expect(w008).toHaveLength(0);
	});

	it("does not emit W008 when no guide files exist", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		const sym = makeSymbol({
			name: "myFunc",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "myFunc();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym]);
		const w008 = result.warnings.filter((w) => w.code === "W008");
		expect(w008).toHaveLength(0);
	});

	it("does not emit W008 for symbols not exported from index.ts", async () => {
		const sym = makeSymbol({
			name: "internalHelper",
			filePath: "/fake/src/utils.ts",
			documentation: {
				summary: "An internal helper.",
				examples: [{ code: "internalHelper();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"",
				"This guide does not mention the internal helper.",
			].join("\n"),
		});
		const result = await runEnforce([sym]);
		const w008 = result.warnings.filter((w) => w.code === "W008");
		expect(w008).toHaveLength(0);
	});

	it('suppresses W008 when require-guide-coverage is "off"', async () => {
		const sym = makeSymbol({
			name: "myFunc",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "A function.",
				examples: [{ code: "myFunc();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": [
				"# Getting Started",
				"",
				"This guide does not mention the function.",
			].join("\n"),
		});
		const result = await runEnforce([sym], {
			rules: { "require-guide-coverage": "off" },
		});
		const w008 = result.warnings.filter((w) => w.code === "W008");
		const e008 = result.errors.filter((e) => e.code === "W008");
		expect(w008).toHaveLength(0);
		expect(e008).toHaveLength(0);
	});

	it("emits W008 for multiple uncovered symbols", async () => {
		const sym1 = makeSymbol({
			name: "funcA",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "Function A.",
				examples: [{ code: "funcA();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const sym2 = makeSymbol({
			name: "funcB",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "Function B.",
				examples: [{ code: "funcB();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const sym3 = makeSymbol({
			name: "funcC",
			filePath: "/fake/src/index.ts",
			documentation: {
				summary: "Function C.",
				examples: [{ code: "funcC();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		mockGuideFiles({
			"getting-started.md": ["# Getting Started", "", "Only funcA is mentioned here."].join("\n"),
		});
		const result = await runEnforce([sym1, sym2, sym3]);
		const w008 = result.warnings.filter((w) => w.code === "W008");
		// funcB and funcC are not mentioned
		expect(w008).toHaveLength(2);
		const names = w008.map((w) => w.message);
		expect(names.some((m) => m.includes("funcB"))).toBe(true);
		expect(names.some((m) => m.includes("funcC"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// E011 — Biome config weakening detection
// ---------------------------------------------------------------------------

describe("enforce — E011 Biome config weakening detection", () => {
	afterEach(() => {
		vi.mocked(readFileSync).mockRestore();
		vi.mocked(existsSync).mockRestore();
	});

	/** Helper to build a valid ForgeLockManifest JSON string with biome rules. */
	function makeLockJsonWithBiome(biomeRules: Record<string, string>): string {
		return JSON.stringify({
			version: "1.0.0",
			lockedAt: "2026-03-20T00:00:00.000Z",
			lockedBy: "test",
			config: {
				rules: {},
				biome: {
					enabled: true,
					lockedRules: Object.keys(biomeRules),
					rules: biomeRules,
				},
			},
		});
	}

	/** Helper to build a biome.json string. */
	function makeBiomeJson(rules: Record<string, Record<string, string>>): string {
		return JSON.stringify({
			linter: {
				rules: Object.fromEntries(
					Object.entries(rules).map(([group, groupRules]) => [group, groupRules]),
				),
			},
		});
	}

	/** Set up fs mocks for lock file + biome.json. */
	function mockBiomeAndLock(lockJson: string, biomeJson: string): void {
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith(".forge-lock.json")) return true;
			if (p.endsWith("biome.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith(".forge-lock.json")) return lockJson;
			if (p.endsWith("biome.json")) return biomeJson;
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
	}

	it("emits E011 when a biome rule is weakened from error to warn", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		const biomeJson = makeBiomeJson({ style: { noVar: "warn" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(1);
		expect(e011[0].message).toContain("style/noVar");
		expect(e011[0].message).toContain('"error"');
		expect(e011[0].message).toContain('"warn"');
	});

	it("emits E011 when a biome rule is weakened from error to off", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		const biomeJson = makeBiomeJson({ style: { noVar: "off" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(1);
		expect(e011[0].message).toContain('"error"');
		expect(e011[0].message).toContain('"off"');
	});

	it("emits E011 when a biome rule is weakened from warn to off", async () => {
		const lockJson = makeLockJsonWithBiome({ "correctness/noUnusedVariables": "warn" });
		const biomeJson = makeBiomeJson({ correctness: { noUnusedVariables: "off" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["correctness/noUnusedVariables"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(1);
		expect(e011[0].message).toContain('"warn"');
		expect(e011[0].message).toContain('"off"');
	});

	it("does NOT emit E011 when biome rule stays the same", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		const biomeJson = makeBiomeJson({ style: { noVar: "error" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(0);
	});

	it("does NOT emit E011 when biome rule is strengthened", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "warn" });
		const biomeJson = makeBiomeJson({ style: { noVar: "error" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(0);
	});

	it("emits E011 when a locked rule is missing from current biome.json (treated as off)", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		// biome.json has no style rules at all
		const biomeJson = makeBiomeJson({});
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(1);
		expect(e011[0].message).toContain('"off"');
	});

	it("emits E011 for multiple weakened rules", async () => {
		const lockJson = makeLockJsonWithBiome({
			"style/noVar": "error",
			"correctness/noUnusedVariables": "error",
		});
		const biomeJson = makeBiomeJson({
			style: { noVar: "warn" },
			correctness: { noUnusedVariables: "off" },
		});
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: {
				biome: { enabled: true, lockedRules: ["style/noVar", "correctness/noUnusedVariables"] },
			},
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(2);
	});

	it("skips E011 when guards.biome.enabled is false", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		const biomeJson = makeBiomeJson({ style: { noVar: "off" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: false, lockedRules: [] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(0);
	});

	it("skips E011 when no lock file exists", async () => {
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith("biome.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith("biome.json")) return makeBiomeJson({ style: { noVar: "off" } });
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(0);
	});

	it("skips E011 when biome.json does not exist", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith(".forge-lock.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith(".forge-lock.json")) return lockJson;
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(0);
	});

	it("emits E011 when biome.json contains invalid JSON", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		vi.mocked(existsSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith(".forge-lock.json")) return true;
			if (p.endsWith("biome.json")) return true;
			return false;
		});
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith(".forge-lock.json")) return lockJson;
			if (p.endsWith("biome.json")) return "{ not valid json";
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		const e011 = result.errors.filter((e) => e.code === "E011");
		expect(e011).toHaveLength(1);
		expect(e011[0].message).toContain("failed to parse");
	});

	it("E011 is always an error (not in RULE_MAP)", async () => {
		const lockJson = makeLockJsonWithBiome({ "style/noVar": "error" });
		const biomeJson = makeBiomeJson({ style: { noVar: "off" } });
		mockBiomeAndLock(lockJson, biomeJson);
		const result = await runEnforceWithConfig([], {
			guards: { biome: { enabled: true, lockedRules: ["style/noVar"] } },
		});
		expect(result.success).toBe(false);
		const e011Errors = result.errors.filter((e) => e.code === "E011");
		const e011Warnings = result.warnings.filter((w) => w.code === "E011");
		expect(e011Errors).toHaveLength(1);
		expect(e011Warnings).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// E012 — package.json engine field tampering
// ---------------------------------------------------------------------------

describe("enforce — E012 package.json engine field tampering", () => {
	afterEach(() => {
		vi.mocked(readFileSync).mockRestore();
		vi.mocked(existsSync).mockRestore();
	});

	/** Set up fs mocks for package.json. */
	function mockPackageJson(pkg: Record<string, unknown>): void {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readFileSync).mockImplementation((filePath: unknown) => {
			const p = String(filePath);
			if (p.endsWith("package.json")) return JSON.stringify(pkg);
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
	}

	it("passes when package.json has all required fields and correct engine version", async () => {
		mockPackageJson({
			type: "module",
			engines: { node: ">=22.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(0);
	});

	it("emits E012 when a required field is missing from package.json", async () => {
		mockPackageJson({
			engines: { node: ">=22.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(1);
		expect(e012[0].message).toContain('"type"');
		expect(e012[0].message).toContain("missing");
	});

	it("emits E012 for multiple missing required fields", async () => {
		mockPackageJson({});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		// "type" missing + "engines" missing
		expect(e012).toHaveLength(2);
	});

	it("emits E012 when engines.node specifies a version lower than minNodeVersion", async () => {
		mockPackageJson({
			type: "module",
			engines: { node: ">=18.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(1);
		expect(e012[0].message).toContain('"engines.node"');
		expect(e012[0].message).toContain(">=18.0.0");
		expect(e012[0].message).toContain("22.0.0");
	});

	it("passes when engines.node version equals minNodeVersion", async () => {
		mockPackageJson({
			type: "module",
			engines: { node: ">=22.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(0);
	});

	it("passes when engines.node version is higher than minNodeVersion", async () => {
		mockPackageJson({
			type: "module",
			engines: { node: ">=24.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(0);
	});

	it("emits E012 when engines exists but engines.node is missing", async () => {
		mockPackageJson({
			type: "module",
			engines: { pnpm: ">=9.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(1);
		expect(e012[0].message).toContain('"engines.node"');
		expect(e012[0].message).toContain("missing");
	});

	it("skips E012 when guards.packageJson.enabled is false", async () => {
		mockPackageJson({});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: false,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(0);
	});

	it("skips E012 gracefully when package.json does not exist", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readFileSync).mockImplementation(() => {
			throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(0);
	});

	it("E012 is always an error (not in RULE_MAP)", async () => {
		mockPackageJson({});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type"],
				},
			},
		});
		expect(result.success).toBe(false);
		const e012Errors = result.errors.filter((e) => e.code === "E012");
		const e012Warnings = result.warnings.filter((w) => w.code === "E012");
		expect(e012Errors).toHaveLength(1);
		expect(e012Warnings).toHaveLength(0);
	});

	it("handles caret version ranges like ^22.0.0", async () => {
		mockPackageJson({
			type: "module",
			engines: { node: "^18.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(1);
		expect(e012[0].message).toContain("lower than");
	});

	it("handles tilde version ranges like ~22.0.0", async () => {
		mockPackageJson({
			type: "module",
			engines: { node: "~22.0.0" },
		});
		const result = await runEnforceWithConfig([], {
			guards: {
				packageJson: {
					enabled: true,
					minNodeVersion: "22.0.0",
					requiredFields: ["type", "engines"],
				},
			},
		});
		const e012 = result.errors.filter((e) => e.code === "E012");
		expect(e012).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// E016 — Release tag required on public symbols
// ---------------------------------------------------------------------------

describe("enforce — E016 release tag required on public symbols", () => {
	it("emits E016 for an exported symbol with no release tag", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(1);
		expect(e016[0].message).toContain("doThing");
		expect(e016[0].message).toContain("release tag");
		expect(e016[0].message).toContain("@public");
	});

	it("passes when an exported symbol has @public", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."], public: [""] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(0);
	});

	it("passes when an exported symbol has @beta", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."], beta: [""] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(0);
	});

	it("passes when an exported symbol has @internal", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."], internal: [""] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(0);
	});

	it("passes when an exported symbol has @alpha", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."], alpha: [""] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(0);
	});

	it("emits E016 for a symbol with no documentation at all", async () => {
		const sym = makeSymbol({
			name: "naked",
			kind: "variable",
			documentation: undefined,
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(1);
		expect(e016[0].message).toContain("naked");
	});

	it("emits E016 for a symbol with documentation but no tags at all", async () => {
		const sym = makeSymbol({
			name: "partialDoc",
			kind: "function",
			documentation: {
				summary: "Has a summary but no tags.",
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(1);
	});

	it("does not emit E016 for non-exported symbols", async () => {
		const sym = makeSymbol({
			name: "internalHelper",
			kind: "function",
			exported: false,
			documentation: {
				summary: "Not exported.",
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.filter((e) => e.code === "E016");
		expect(e016).toHaveLength(0);
	});

	it('respects require-release-tag set to "off"', async () => {
		const sym = makeSymbol({
			name: "noTag",
			kind: "function",
			documentation: {
				summary: "No release tag.",
				examples: [{ code: "noTag();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "off" },
		});
		const e016 = [...result.errors, ...result.warnings].filter((d) => d.code === "E016");
		expect(e016).toHaveLength(0);
	});

	it('respects require-release-tag set to "warn"', async () => {
		const sym = makeSymbol({
			name: "noTag",
			kind: "function",
			documentation: {
				summary: "No release tag.",
				examples: [{ code: "noTag();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "warn" },
		});
		const e016Warnings = result.warnings.filter((w) => w.code === "E016");
		const e016Errors = result.errors.filter((e) => e.code === "E016");
		expect(e016Warnings).toHaveLength(1);
		expect(e016Errors).toHaveLength(0);
	});

	it("strict mode promotes E016 'warn' to error", async () => {
		const sym = makeSymbol({
			name: "noTag",
			kind: "function",
			documentation: {
				summary: "No release tag.",
				examples: [{ code: "noTag();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			strict: true,
			rules: { "require-release-tag": "warn" },
		});
		const e016Errors = result.errors.filter((e) => e.code === "E016");
		expect(e016Errors).toHaveLength(1);
		expect(result.warnings.filter((w) => w.code === "E016")).toHaveLength(0);
	});

	it("populates suggestedFix on E016 errors", async () => {
		const sym = makeSymbol({
			name: "doThing",
			kind: "function",
			documentation: {
				summary: "Does a thing.",
				examples: [{ code: "doThing();", language: "typescript", line: 5 }],
				tags: { remarks: ["Details."] },
			},
		});
		const result = await runEnforce([sym], {
			rules: { "require-release-tag": "error" },
		});
		const e016 = result.errors.find((e) => e.code === "E016");
		expect(e016?.suggestedFix).toBe("@public");
		expect(e016?.symbolName).toBe("doThing");
		expect(e016?.symbolKind).toBe("function");
	});

	it("works for all symbol kinds (class, interface, type, enum, variable)", async () => {
		const kinds = ["class", "interface", "type", "enum", "variable"] as const;
		for (const kind of kinds) {
			const sym = makeSymbol({
				name: `My${kind}`,
				kind,
				documentation: {
					summary: `A ${kind}.`,
					tags: { remarks: ["Details."] },
				},
			});
			const result = await runEnforce([sym], {
				rules: { "require-release-tag": "error" },
			});
			const e016 = result.errors.filter((e) => e.code === "E016");
			expect(e016.length).toBeGreaterThanOrEqual(1);
			expect(e016.some((e) => e.message.includes(`My${kind}`))).toBe(true);
		}
	});
});
