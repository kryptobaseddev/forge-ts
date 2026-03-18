import { type ForgeConfig, type ForgeResult, type ForgeSymbol, Visibility } from "@forge-ts/core";
import { describe, expect, it, vi } from "vitest";
import { enforce } from "../enforcer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a minimal valid {@link ForgeConfig} for tests.
 */
function makeConfig(overrides?: Partial<ForgeConfig["enforce"]>): ForgeConfig {
	return {
		rootDir: "/fake",
		tsconfig: "/fake/tsconfig.json",
		outDir: "/fake/docs",
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			...overrides,
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
		filePath: "/fake/src/index.ts",
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
			documentation: { summary: "Does a thing." },
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
