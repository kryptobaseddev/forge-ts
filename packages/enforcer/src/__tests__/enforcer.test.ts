import {
	type EnforceRules,
	type ForgeConfig,
	type ForgeResult,
	type ForgeSymbol,
	Visibility,
} from "@forge-ts/core";
import { describe, expect, it, vi } from "vitest";
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
};

/**
 * Returns a minimal valid {@link ForgeConfig} for tests.
 * Rules default to the production defaults; pass `rules` inside `overrides`
 * to override individual entries.
 */
function makeConfig(overrides?: Partial<ForgeConfig["enforce"]>): ForgeConfig {
	const { rules: ruleOverrides, ...restOverrides } = overrides ?? {};
	return {
		rootDir: "/fake",
		tsconfig: "/fake/tsconfig.json",
		outDir: "/fake/docs",
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			rules: { ...DEFAULT_RULES, ...ruleOverrides },
			...restOverrides,
		},
		doctest: { enabled: false, cacheDir: "/fake/.cache" },
		api: { enabled: false, openapi: false, openapiPath: "/fake/docs/openapi.json" },
		gen: { enabled: false, formats: [], llmsTxt: false, readmeSync: false },
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
		expect(result.errors).toHaveLength(2);
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
