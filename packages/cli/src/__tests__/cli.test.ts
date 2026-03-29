import { join } from "node:path";
import type { ForgeConfig, ForgeResult, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBarometer } from "../commands/barometer.js";
import { runBuild } from "../commands/build.js";
import { getStagedFiles, runCheck } from "../commands/check.js";
import { runTest } from "../commands/test.js";
import { configureLogger, forgeLogger } from "../forge-logger.js";
import { type CommandOutput, emitResult, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@forge-ts/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@forge-ts/core")>();
	return {
		...actual,
		loadConfig: vi.fn(),
		createWalker: vi.fn(),
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

vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>();
	return {
		...actual,
		execSync: vi.fn().mockReturnValue(""),
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
		bypass: { dailyBudget: 3, durationHours: 4 },
		guards: {
			tsconfig: { enabled: false, requiredFlags: {} },
			biome: { enabled: false, lockedRules: [] },
			packageJson: { enabled: false, minNodeVersion: "18.0.0", requiredFields: [] },
		},
		project: {},
		...overrides,
	} as ForgeConfig;
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
// getStagedFiles tests
// ---------------------------------------------------------------------------

describe("getStagedFiles", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns .ts and .tsx files from git diff output", async () => {
		const { execSync } = await import("node:child_process");
		vi.mocked(execSync).mockReturnValue("src/index.ts\nsrc/app.tsx\nREADME.md\nsrc/style.css\n");

		const files = getStagedFiles("/fake");
		expect(files).toEqual(["src/index.ts", "src/app.tsx"]);
	});

	it("returns empty array when no staged .ts files", async () => {
		const { execSync } = await import("node:child_process");
		vi.mocked(execSync).mockReturnValue("README.md\npackage.json\n");

		const files = getStagedFiles("/fake");
		expect(files).toEqual([]);
	});

	it("returns null when git command fails", async () => {
		const { execSync } = await import("node:child_process");
		vi.mocked(execSync).mockImplementation(() => {
			throw new Error("not a git repository");
		});

		const files = getStagedFiles("/fake");
		expect(files).toBeNull();
	});

	it("handles empty git output", async () => {
		const { execSync } = await import("node:child_process");
		vi.mocked(execSync).mockReturnValue("");

		const files = getStagedFiles("/fake");
		expect(files).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// runCheck --staged tests
// ---------------------------------------------------------------------------

describe("runCheck --staged", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns instant success when no staged files", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");
		const { execSync } = await import("node:child_process");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(execSync).mockReturnValue("");

		const output = await runCheck({ cwd: "/fake", staged: true });

		expect(output.success).toBe(true);
		expect(output.data.summary.errors).toBe(0);
		expect(output.data.summary.symbols).toBe(0);
		// enforce should NOT have been called
		expect(enforce).not.toHaveBeenCalled();
	});

	it("filters errors to staged files only", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");
		const { execSync } = await import("node:child_process");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(execSync).mockReturnValue("src/staged.ts\n");
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				symbols: [makeSymbol("stagedFn", { filePath: "/fake/src/staged.ts" })],
				errors: [
					{
						code: "E001",
						message: "Missing summary on stagedFn",
						filePath: "/fake/src/staged.ts",
						line: 1,
						column: 0,
					},
					{
						code: "E001",
						message: "Missing summary on otherFn",
						filePath: "/fake/src/other.ts",
						line: 5,
						column: 0,
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake", staged: true });

		// Only the error from the staged file should remain
		expect(output.data.summary.errors).toBe(1);
		expect(output.success).toBe(false);
	});

	it("preserves cross-file rule diagnostics even when not in staged files", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");
		const { execSync } = await import("node:child_process");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(execSync).mockReturnValue("src/staged.ts\n");
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				symbols: [makeSymbol("stagedFn", { filePath: "/fake/src/staged.ts" })],
				errors: [
					{
						code: "E005",
						message: "Missing @packageDocumentation",
						filePath: "/fake/src/index.ts",
						line: 1,
						column: 0,
					},
					{
						code: "E009",
						message: "tsconfig strictness regression",
						filePath: "/fake/tsconfig.json",
						line: 1,
						column: 0,
					},
				],
			}),
		);

		const output = await runCheck({ cwd: "/fake", staged: true });

		// Cross-file rules should be preserved
		expect(output.data.summary.errors).toBe(2);
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

	it("MVI level is recorded in envelope _meta", () => {
		const minimalChunks: string[] = [];
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			minimalChunks.push(chunk as string);
			return true;
		});
		emitResult(makeOutput({ count: 1 }), { json: true, mvi: "minimal" }, () => "");

		const parsed = JSON.parse(minimalChunks.join(""));
		expect(parsed._meta.mvi).toBe("minimal");
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
// forgeLogger / configureLogger tests
// ---------------------------------------------------------------------------

describe("forgeLogger", () => {
	afterEach(() => {
		// Reset to default info level after each test
		forgeLogger.level = 3;
	});

	it("exposes info, warn, error, success methods", () => {
		expect(typeof forgeLogger.info).toBe("function");
		expect(typeof forgeLogger.warn).toBe("function");
		expect(typeof forgeLogger.error).toBe("function");
		expect(typeof forgeLogger.success).toBe("function");
		expect(typeof forgeLogger.debug).toBe("function");
	});

	it("has forge-ts tag in defaults", () => {
		expect(forgeLogger.options.defaults?.tag).toBe("forge-ts");
	});
});

describe("configureLogger", () => {
	afterEach(() => {
		// Reset to default info level after each test
		forgeLogger.level = 3;
	});

	it("sets level to 0 (silent) when quiet is true", () => {
		configureLogger({ quiet: true });
		expect(forgeLogger.level).toBe(0);
	});

	it("sets level to 0 (silent) when json is true", () => {
		configureLogger({ json: true });
		expect(forgeLogger.level).toBe(0);
	});

	it("sets level to 4 (debug) when verbose is true", () => {
		configureLogger({ verbose: true });
		expect(forgeLogger.level).toBe(4);
	});

	it("sets level to 3 (info) by default", () => {
		forgeLogger.level = 0; // set to something else first
		configureLogger({});
		expect(forgeLogger.level).toBe(3);
	});

	it("quiet takes precedence over verbose", () => {
		configureLogger({ quiet: true, verbose: true });
		expect(forgeLogger.level).toBe(0);
	});

	it("json takes precedence over verbose", () => {
		configureLogger({ json: true, verbose: true });
		expect(forgeLogger.level).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// runBarometer tests
// ---------------------------------------------------------------------------

describe("runBarometer", () => {
	const tmpDir = join(process.cwd(), ".forge-test-tmp");

	afterEach(async () => {
		vi.clearAllMocks();
		// Clean up temp dir
		const { rm } = await import("node:fs/promises");
		await rm(tmpDir, { recursive: true, force: true });
	});

	function makeBarometerConfig() {
		return makeConfig({ rootDir: tmpDir });
	}

	it("generates questions from exported symbols", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");

		const sym = makeSymbol("doThing", {
			kind: "function",
			signature: "(input: string) => boolean",
			documentation: { summary: "Does a thing." },
		});

		vi.mocked(loadConfig).mockResolvedValue(makeBarometerConfig());
		vi.mocked(createWalker).mockReturnValue({ walk: () => [sym] } as ReturnType<
			typeof createWalker
		>);

		const output = await runBarometer({ cwd: tmpDir });
		expect(output.success).toBe(true);
		expect(output.data.questions.length).toBeGreaterThan(0);

		// Should include signature questions about doThing
		const returnQ = output.data.questions.find(
			(q) => q.question.includes("doThing()") && q.question.includes("return"),
		);
		expect(returnQ).toBeDefined();
		expect(returnQ?.answer).toBe("boolean");
	});

	it("redacts answers when questionsOnly is true", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");

		const sym = makeSymbol("doThing", {
			kind: "function",
			signature: "(input: string) => boolean",
			documentation: { summary: "Does a thing." },
		});

		vi.mocked(loadConfig).mockResolvedValue(makeBarometerConfig());
		vi.mocked(createWalker).mockReturnValue({ walk: () => [sym] } as ReturnType<
			typeof createWalker
		>);

		const output = await runBarometer({ cwd: tmpDir, questionsOnly: true });
		expect(output.success).toBe(true);

		// Every answer must be "(redacted)"
		for (const q of output.data.questions) {
			expect(q.answer).toBe("(redacted)");
		}
	});

	it("includes W014-W020 rule questions", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({ rootDir: tmpDir, project: { packageName: "forge-ts" } }),
		);
		vi.mocked(createWalker).mockReturnValue({ walk: () => [] } as ReturnType<typeof createWalker>);

		const output = await runBarometer({ cwd: tmpDir });

		// Should generate questions for all rules including W014-W020
		const ruleCodes = new Set(
			output.data.questions.filter((q) => q.category === "rules").map((q) => q.source.symbol),
		);
		for (const code of ["W014", "W015", "W016", "W017", "W018", "W019", "W020"]) {
			expect(ruleCodes.has(code)).toBe(true);
		}
	});

	it("skips rule and config questions for consumer projects", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({ rootDir: tmpDir, project: { packageName: "@consumer/lib" } }),
		);
		vi.mocked(createWalker).mockReturnValue({ walk: () => [] } as ReturnType<typeof createWalker>);

		const output = await runBarometer({ cwd: tmpDir });
		const ruleQs = output.data.questions.filter((q) => q.category === "rules");
		const configQs = output.data.questions.filter((q) => q.category === "config");
		expect(ruleQs).toHaveLength(0);
		expect(configQs).toHaveLength(0);
	});

	it("includes instructions in questions-only output", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");

		vi.mocked(loadConfig).mockResolvedValue(makeBarometerConfig());
		vi.mocked(createWalker).mockReturnValue({ walk: () => [] } as ReturnType<typeof createWalker>);

		const output = await runBarometer({ cwd: tmpDir, questionsOnly: true });
		expect(output.data.instructions).toBeDefined();
		expect(output.data.instructions?.task).toContain("ONLY the documentation");
		expect(output.data.instructions?.docsPath).toBe("docs/generated/");
		expect(output.data.instructions?.responseFormat.example.answers).toBeDefined();
	});

	it("does not include instructions when questionsOnly is false", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");

		vi.mocked(loadConfig).mockResolvedValue(makeBarometerConfig());
		vi.mocked(createWalker).mockReturnValue({ walk: () => [] } as ReturnType<typeof createWalker>);

		const output = await runBarometer({ cwd: tmpDir });
		expect(output.data.instructions).toBeUndefined();
	});

	it("writes full answers to disk even when questionsOnly is true", async () => {
		const { loadConfig, createWalker } = await import("@forge-ts/core");
		const { readFile: readFileAsync } = await import("node:fs/promises");

		const sym = makeSymbol("doThing", {
			kind: "function",
			signature: "(input: string) => boolean",
			documentation: { summary: "Does a thing." },
		});

		vi.mocked(loadConfig).mockResolvedValue(makeBarometerConfig());
		vi.mocked(createWalker).mockReturnValue({ walk: () => [sym] } as ReturnType<
			typeof createWalker
		>);

		await runBarometer({ cwd: tmpDir, questionsOnly: true });

		// The disk file should have full answers, not redacted
		const diskContent = JSON.parse(
			await readFileAsync(join(tmpDir, ".forge", "barometer.json"), "utf8"),
		);
		const sigQuestions = diskContent.questions.filter(
			(q: { category: string }) => q.category === "signature",
		);
		for (const q of sigQuestions) {
			expect(q.answer).not.toBe("(redacted)");
		}
		// Instructions should not be in the disk file
		expect(diskContent.instructions).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// runBarometerScore tests
// ---------------------------------------------------------------------------

describe("runBarometerScore", () => {
	const tmpDir = join(process.cwd(), ".forge-score-test-tmp");

	afterEach(async () => {
		vi.clearAllMocks();
		const { rm } = await import("node:fs/promises");
		await rm(tmpDir, { recursive: true, force: true });
	});

	async function setupAnswerKey(
		questions: Array<{ id: string; answer: string; category: string }>,
	) {
		const { mkdir: mkdirAsync, writeFile: writeFileAsync } = await import("node:fs/promises");
		const forgeDir = join(tmpDir, ".forge");
		await mkdirAsync(forgeDir, { recursive: true });
		const result = {
			$schema: "https://forge-ts.dev/schemas/v1/barometer.schema.json",
			version: "1.0.0",
			project: "test",
			generated: new Date().toISOString(),
			symbolCount: 1,
			questions: questions.map((q) => ({
				id: q.id,
				category: q.category,
				difficulty: "easy",
				question: `Question ${q.id}`,
				answer: q.answer,
				source: { symbol: "test", file: "test.ts", field: "test" },
			})),
			rubric: { scale: [], scoring: "" },
		};
		await writeFileAsync(join(forgeDir, "barometer.json"), JSON.stringify(result), "utf8");
	}

	async function writeAnswers(answers: Array<{ id: string; answer: string }>) {
		const { mkdir: mkdirAsync, writeFile: writeFileAsync } = await import("node:fs/promises");
		await mkdirAsync(tmpDir, { recursive: true });
		const path = join(tmpDir, "agent-answers.json");
		await writeFileAsync(path, JSON.stringify({ answers }), "utf8");
		return path;
	}

	it("scores exact matches as correct", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		await setupAnswerKey([
			{ id: "Q001", answer: "boolean", category: "signature" },
			{ id: "Q002", answer: "string", category: "signature" },
		]);
		const answersPath = await writeAnswers([
			{ id: "Q001", answer: "boolean" },
			{ id: "Q002", answer: "string" },
		]);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.success).toBe(true);
		expect(output.data.correct).toBe(2);
		expect(output.data.score).toBe(100);
	});

	it("scores partial matches as partial", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		await setupAnswerKey([{ id: "Q001", answer: "boolean", category: "signature" }]);
		const answersPath = await writeAnswers([{ id: "Q001", answer: "It returns a boolean value" }]);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.data.partial).toBe(1);
		expect(output.data.correct).toBe(0);
		expect(output.data.score).toBe(50);
	});

	it("scores multi-word superset answers as correct", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		await setupAnswerKey([
			{
				id: "Q001",
				answer: "delimited block markers for cooperative installation",
				category: "remarks",
			},
		]);
		const answersPath = await writeAnswers([
			{
				id: "Q001",
				answer:
					"Delegates to npx validate, using delimited block markers for cooperative installation with other tools",
			},
		]);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.data.correct).toBe(1);
		expect(output.data.score).toBe(100);
	});

	it("scores remarks answers with high word overlap as correct", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		await setupAnswerKey([
			{
				id: "Q001",
				answer: "the first bullet point as a concise release summary",
				category: "remarks",
			},
		]);
		const answersPath = await writeAnswers([
			{
				id: "Q001",
				answer:
					"Uses the first bullet point from a matching changelog entry as a concise release summary",
			},
		]);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		// High word overlap (>80%) should score as correct for remarks
		expect(output.data.correct).toBe(1);
	});

	it("scores empty answers as wrong", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		await setupAnswerKey([{ id: "Q001", answer: "boolean", category: "signature" }]);
		const answersPath = await writeAnswers([{ id: "Q001", answer: "" }]);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.data.wrong).toBe(1);
		expect(output.data.score).toBe(0);
	});

	it("scores unanswered questions as wrong", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		await setupAnswerKey([
			{ id: "Q001", answer: "boolean", category: "signature" },
			{ id: "Q002", answer: "string", category: "signature" },
		]);
		// Only answer Q001
		const answersPath = await writeAnswers([{ id: "Q001", answer: "boolean" }]);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.data.correct).toBe(1);
		expect(output.data.wrong).toBe(1);
		expect(output.data.score).toBe(50);
	});

	it("returns error when answer key is missing", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		const { mkdir: mkdirAsync, writeFile: writeFileAsync } = await import("node:fs/promises");
		await mkdirAsync(tmpDir, { recursive: true });
		const answersPath = join(tmpDir, "answers.json");
		await writeFileAsync(answersPath, JSON.stringify({ answers: [] }), "utf8");

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.success).toBe(false);
		expect(output.errors?.[0]?.code).toBe("BAROMETER_NO_KEY");
	});

	it("assigns correct rating band", async () => {
		const { runBarometerScore: scoreFn } = await import("../commands/barometer.js");
		const questions = Array.from({ length: 10 }, (_, i) => ({
			id: `Q${String(i + 1).padStart(3, "0")}`,
			answer: `answer${i}`,
			category: "signature",
		}));
		await setupAnswerKey(questions);
		// Answer 9 of 10 correctly
		const answersPath = await writeAnswers(
			questions.slice(0, 9).map((q) => ({ id: q.id, answer: q.answer })),
		);

		const output = await scoreFn({ cwd: tmpDir, answersPath });
		expect(output.data.rating).toBe("Elite SSoT");
		expect(output.data.score).toBe(90);
	});
});
