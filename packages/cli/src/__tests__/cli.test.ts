import type { ForgeConfig, ForgeResult, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBuild } from "../commands/build.js";
import { runCheck } from "../commands/check.js";
import { runTest } from "../commands/test.js";
import { createLogger } from "../logger.js";
import { type CommandOutput, emitResult, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@forge-ts/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/core")>();
	return {
		...actual,
		loadConfig: vi.fn(),
	};
});

vi.mock("@forge-ts/enforcer", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/enforcer")>();
	return {
		...actual,
		enforce: vi.fn(),
	};
});

vi.mock("@forge-ts/doctest", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/doctest")>();
	return {
		...actual,
		doctest: vi.fn(),
	};
});

vi.mock("@forge-ts/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/api")>();
	return {
		...actual,
		generateApi: vi.fn(),
	};
});

vi.mock("@forge-ts/gen", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/gen")>();
	return {
		...actual,
		generate: vi.fn(),
	};
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ForgeConfig> = {}): ForgeConfig {
	return {
		rootDir: "/fake",
		tsconfig: "/fake/tsconfig.json",
		outDir: "/fake/docs",
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
		},
		doctest: { enabled: false, cacheDir: "/fake/.cache" },
		api: { enabled: false, openapi: false, openapiPath: "/fake/docs/openapi.json" },
		gen: { enabled: false, formats: [], llmsTxt: false, readmeSync: false },
		...overrides,
	};
}

function makeResult(overrides: Partial<ForgeResult> = {}): ForgeResult {
	return {
		success: true,
		symbols: [],
		errors: [],
		warnings: [],
		duration: 1,
		...overrides,
	};
}

function makeSymbol(name: string, overrides: Partial<ForgeSymbol> = {}): ForgeSymbol {
	return {
		name,
		kind: "function",
		visibility: Visibility.Public,
		filePath: "/fake/src/index.ts",
		line: 1,
		column: 0,
		exported: true,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// runCheck tests
// ---------------------------------------------------------------------------

describe("runCheck", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns success=true for a project with no exported symbols", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(makeResult({ symbols: [] }));

		const output = await runCheck({ cwd: "/fake" });
		expect(output.success).toBe(true);
		expect(resolveExitCode(output)).toBe(0);
	});

	it("returns success=true when all symbols are documented", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		const sym = makeSymbol("doThing", {
			documentation: { summary: "Does a thing." },
		});

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(makeResult({ symbols: [sym] }));

		const output = await runCheck({ cwd: "/fake" });
		expect(output.success).toBe(true);
		expect(output.data.summary.symbols).toBe(1);
		expect(resolveExitCode(output)).toBe(0);
	});

	it("returns success=false when enforce produces errors", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "E001",
						message: "Missing summary on doThing",
						filePath: "/fake/src/index.ts",
						line: 1,
						column: 0,
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake" });
		expect(output.success).toBe(false);
		expect(output.data.summary.errors).toBe(1);
		expect(resolveExitCode(output)).toBe(1);
	});

	it("returns success=false in strict mode when result is failure", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		const config = makeConfig();
		vi.mocked(loadConfig).mockResolvedValue(config);
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "W003",
						message: "Deprecated without reason",
						filePath: "/fake/src/index.ts",
						line: 5,
						column: 0,
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake", strict: true });
		expect(output.success).toBe(false);
		expect(resolveExitCode(output)).toBe(1);
		// verify strict was set on config before calling enforce
		expect(config.enforce.strict).toBe(true);
	});

	it("passes verbose flag through (no throw)", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(makeResult());

		const output = await runCheck({ verbose: true });
		expect(output.success).toBe(true);
	});

	it("result summary includes error and warning counts", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "E002",
						message: "Missing @param on fn",
						filePath: "/fake/src/a.ts",
						line: 10,
						column: 2,
						symbolName: "fn",
						symbolKind: "function",
					},
				],
				warnings: [
					{
						code: "W001",
						message: "Undocumented return type",
						filePath: "/fake/src/a.ts",
						line: 10,
						column: 2,
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake" });
		expect(output.data.summary.errors).toBe(1);
		expect(output.data.summary.warnings).toBe(1);
		expect(output.data.summary.files).toBe(1);
	});

	it("standard MVI level includes byFile array", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "E004",
						message: "Missing @example block",
						filePath: "/fake/src/math.ts",
						line: 15,
						column: 0,
						symbolName: "add",
						symbolKind: "function",
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake", mvi: "standard" });
		expect(output.data.byFile).toBeDefined();
		expect(output.data.byFile).toHaveLength(1);
		expect(output.data.byFile?.[0]?.file).toBe("/fake/src/math.ts");
		expect(output.data.byFile?.[0]?.errors[0]?.code).toBe("E004");
		expect(output.data.byFile?.[0]?.errors[0]?.symbol).toBe("add");
		expect(output.data.byFile?.[0]?.errors[0]?.kind).toBe("function");
		expect(output.data.byFile?.[0]?.errors[0]?.suggestedFix).toBeUndefined();
	});

	it("minimal MVI level omits byFile", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "E001",
						message: "Missing summary",
						filePath: "/fake/src/index.ts",
						line: 1,
						column: 0,
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake", mvi: "minimal" });
		expect(output.data.byFile).toBeUndefined();
		expect(output.data.summary.errors).toBe(1);
	});

	it("full MVI level includes suggestedFix and agentAction", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "E004",
						message: "Missing @example block",
						filePath: "/fake/src/math.ts",
						line: 15,
						column: 0,
						symbolName: "add",
						symbolKind: "function",
						suggestedFix: "@example\n * add(1, 2); // 3",
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake", mvi: "full" });
		expect(output.data.byFile).toBeDefined();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const fileGroup = output.data.byFile?.[0];
		const err = fileGroup?.errors[0];
		expect(err?.suggestedFix).toBe("@example\n * add(1, 2); // 3");
		expect(err?.agentAction).toBe("retry_modified");
	});
});

// ---------------------------------------------------------------------------
// runBuild tests
// ---------------------------------------------------------------------------

describe("runBuild", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns success=true and skips disabled api/gen by default", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");
		const { generate } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: false, openapi: false, openapiPath: "/fake/docs/openapi.json" },
			}),
		);

		const output = await runBuild({ cwd: "/fake" });
		expect(output.success).toBe(true);
		expect(resolveExitCode(output)).toBe(0);
		expect(generateApi).not.toHaveBeenCalled();
		expect(generate).not.toHaveBeenCalled();
	});

	it("calls generateApi when api.enabled is true", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(generateApi).mockResolvedValue(makeResult());

		const output = await runBuild({ cwd: "/fake" });
		expect(output.success).toBe(true);
		expect(resolveExitCode(output)).toBe(0);
		expect(generateApi).toHaveBeenCalledOnce();
	});

	it("returns success=false when generateApi fails", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(generateApi).mockResolvedValue(
			makeResult({
				success: false,
				errors: [{ code: "A001", message: "api error", filePath: "", line: 0, column: 0 }],
			}),
		);

		const output = await runBuild({ cwd: "/fake" });
		expect(output.success).toBe(false);
		expect(resolveExitCode(output)).toBe(1);
	});

	it("calls generate when gen.enabled is true", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generate } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				gen: { enabled: true, formats: ["markdown"], llmsTxt: false, readmeSync: false },
			}),
		);
		vi.mocked(generate).mockResolvedValue(makeResult());

		const output = await runBuild({ cwd: "/fake" });
		expect(output.success).toBe(true);
		expect(generate).toHaveBeenCalledOnce();
	});

	it("skips api when skipApi flag is set", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);

		const output = await runBuild({ cwd: "/fake", skipApi: true });
		expect(output.success).toBe(true);
		expect(generateApi).not.toHaveBeenCalled();
	});

	it("skips gen when skipGen flag is set", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generate } = await import("@forge-ts/gen");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				gen: { enabled: true, formats: ["markdown"], llmsTxt: false, readmeSync: false },
			}),
		);

		const output = await runBuild({ cwd: "/fake", skipGen: true });
		expect(output.success).toBe(true);
		expect(generate).not.toHaveBeenCalled();
	});

	it("result includes typed steps", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(generateApi).mockResolvedValue(makeResult({ duration: 42 }));

		const output = await runBuild({ cwd: "/fake" });
		const apiStep = output.data.steps.find((s) => s.name === "api");
		expect(apiStep?.status).toBe("success");
		expect(apiStep?.outputPath).toBe("/fake/docs/openapi.json");
	});

	it("result includes summary with step counts", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(generateApi).mockResolvedValue(makeResult({ duration: 42 }));

		const output = await runBuild({ cwd: "/fake" });
		expect(output.data.summary.steps).toBeGreaterThan(0);
		expect(output.data.summary.succeeded).toBeGreaterThanOrEqual(0);
		expect(output.data.summary.failed).toBe(0);
	});

	it("standard MVI level includes generatedFiles", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(generateApi).mockResolvedValue(makeResult());

		const output = await runBuild({ cwd: "/fake", mvi: "standard" });
		expect(output.data.generatedFiles).toBeDefined();
		expect(output.data.generatedFiles).toContain("/fake/docs/openapi.json");
	});

	it("minimal MVI level omits generatedFiles", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(generateApi).mockResolvedValue(makeResult());

		const output = await runBuild({ cwd: "/fake", mvi: "minimal" });
		expect(output.data.generatedFiles).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// runTest tests
// ---------------------------------------------------------------------------

describe("runTest", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns success=true when all doctests pass", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { doctest } = await import("@forge-ts/doctest");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(doctest).mockResolvedValue(makeResult({ duration: 10 }));

		const output = await runTest({ cwd: "/fake" });
		expect(output.success).toBe(true);
		expect(output.data.summary.failed).toBe(0);
		expect(resolveExitCode(output)).toBe(0);
	});

	it("returns success=false when doctests fail", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { doctest } = await import("@forge-ts/doctest");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(doctest).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "D001",
						message: "assertion failed",
						filePath: "/fake/src/a.ts",
						line: 1,
						column: 0,
					},
				],
			}),
		);

		const output = await runTest({ cwd: "/fake" });
		expect(output.success).toBe(false);
		expect(output.data.summary.failed).toBe(1);
		expect(output.data.failures?.[0]?.message).toBe("assertion failed");
		expect(resolveExitCode(output)).toBe(1);
	});

	it("standard MVI level includes failures array", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { doctest } = await import("@forge-ts/doctest");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(doctest).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "D001",
						message: "assertion failed",
						filePath: "/fake/src/a.ts",
						line: 1,
						column: 0,
					},
				],
			}),
		);

		const output = await runTest({ cwd: "/fake", mvi: "standard" });
		expect(output.data.failures).toBeDefined();
		expect(output.data.failures).toHaveLength(1);
	});

	it("minimal MVI level omits failures array", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { doctest } = await import("@forge-ts/doctest");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(doctest).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "D001",
						message: "assertion failed",
						filePath: "/fake/src/a.ts",
						line: 1,
						column: 0,
					},
				],
			}),
		);

		const output = await runTest({ cwd: "/fake", mvi: "minimal" });
		expect(output.data.failures).toBeUndefined();
		expect(output.data.summary.failed).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// emitResult tests
// ---------------------------------------------------------------------------

describe("emitResult", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function makeOutput<T>(data: T, success = true): CommandOutput<T> {
		return {
			operation: "check",
			success,
			data,
			errors: success ? [] : [{ code: "E001", message: "fail" }],
			duration: 5,
		};
	}

	it("in JSON mode outputs valid JSON with $schema field", () => {
		const chunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			chunks.push(chunk as string);
			return true;
		});

		emitResult(makeOutput({ count: 1 }), { json: true }, () => "human");

		const raw = chunks.join("");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		expect(parsed.$schema).toBe("https://lafs.dev/schemas/v1/envelope.schema.json");
	});

	it("in JSON mode emits LAFSEnvelope structure with success field", () => {
		const chunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			chunks.push(chunk as string);
			return true;
		});

		emitResult(makeOutput({ count: 1 }), { json: true }, () => "human");

		const parsed = JSON.parse(chunks.join("")) as Record<string, unknown>;
		expect(parsed.success).toBe(true);
		expect(parsed._meta).toBeDefined();
	});

	it("in human mode calls the formatter and logs the result", () => {
		const logLines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logLines.push(args.join(" "));
		});

		emitResult(makeOutput({ count: 1 }), { human: true }, () => "human output");

		expect(logLines).toContain("human output");
	});

	it("in quiet mode suppresses output", () => {
		const chunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			chunks.push(chunk as string);
			return true;
		});
		const logLines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logLines.push(args.join(" "));
		});

		emitResult(makeOutput({ count: 1 }), { quiet: true }, () => "should not appear");

		expect(chunks).toHaveLength(0);
		expect(logLines).toHaveLength(0);
	});

	it("MVI level minimal produces smaller JSON than full", () => {
		const minimalChunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			minimalChunks.push(chunk as string);
			return true;
		});
		emitResult(makeOutput({ count: 1 }), { json: true, mvi: "minimal" }, () => "");
		vi.restoreAllMocks();

		const fullChunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			fullChunks.push(chunk as string);
			return true;
		});
		emitResult(makeOutput({ count: 1 }), { json: true, mvi: "full" }, () => "");

		const minLen = minimalChunks.join("").length;
		const fullLen = fullChunks.join("").length;
		expect(minLen).toBeLessThan(fullLen);
	});

	it("failure output in JSON mode includes error envelope", () => {
		const chunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			chunks.push(chunk as string);
			return true;
		});

		emitResult(makeOutput({ count: 0 }, false), { json: true }, () => "error output");

		const parsed = JSON.parse(chunks.join("")) as Record<string, unknown>;
		expect(parsed.success).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// resolveExitCode tests
// ---------------------------------------------------------------------------

describe("resolveExitCode", () => {
	it("returns 0 for success", () => {
		const output: CommandOutput<unknown> = {
			operation: "check",
			success: true,
			data: {},
		};
		expect(resolveExitCode(output)).toBe(0);
	});

	it("returns 1 for failure", () => {
		const output: CommandOutput<unknown> = {
			operation: "check",
			success: false,
			data: {},
		};
		expect(resolveExitCode(output)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// createLogger tests
// ---------------------------------------------------------------------------

describe("createLogger", () => {
	it("respects color: false (no ANSI codes in output)", () => {
		const logger = createLogger({ colors: false });
		const lines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			lines.push(args.join(" "));
		});

		logger.success("it worked");
		logger.info("just info");

		const joined = lines.join("\n");
		expect(joined).not.toContain("\x1b[");
		vi.restoreAllMocks();
	});

	it("emits ANSI codes when colors: true", () => {
		const logger = createLogger({ colors: true });
		const lines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			lines.push(args.join(" "));
		});

		logger.success("it worked");

		const joined = lines.join("\n");
		expect(joined).toContain("\x1b[");
		vi.restoreAllMocks();
	});

	it("formats step output with label, detail and duration", () => {
		const logger = createLogger({ colors: false });
		const lines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			lines.push(args.join(" "));
		});

		logger.step("API", "Generated OpenAPI spec", 123);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("API");
		expect(lines[0]).toContain("Generated OpenAPI spec");
		expect(lines[0]).toContain("123ms");
		vi.restoreAllMocks();
	});

	it("formats step output without duration when omitted", () => {
		const logger = createLogger({ colors: false });
		const lines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			lines.push(args.join(" "));
		});

		logger.step("Gen", "Wrote llms.txt");

		expect(lines[0]).toContain("Gen");
		expect(lines[0]).toContain("Wrote llms.txt");
		// No duration parenthetical should appear
		expect(lines[0]).not.toMatch(/\(\d+ms\)/);
		vi.restoreAllMocks();
	});

	it("logs warn to console.warn and error to console.error", () => {
		const logger = createLogger({ colors: false });
		const warnLines: string[] = [];
		const errorLines: string[] = [];
		vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
			warnLines.push(args.join(" "));
		});
		vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
			errorLines.push(args.join(" "));
		});

		logger.warn("something might be wrong");
		logger.error("something broke");

		expect(warnLines[0]).toContain("something might be wrong");
		expect(errorLines[0]).toContain("something broke");
		vi.restoreAllMocks();
	});
});
