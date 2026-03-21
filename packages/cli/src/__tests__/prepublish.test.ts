import type { ForgeConfig, ForgeResult } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runPrepublish } from "../commands/prepublish.js";
import { resolveExitCode } from "../output.js";

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

// ---------------------------------------------------------------------------
// runPrepublish tests
// ---------------------------------------------------------------------------

describe("runPrepublish", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns success=true when both check and build pass", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(makeResult());

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output.success).toBe(true);
		expect(output.data.success).toBe(true);
		expect(output.data.check.success).toBe(true);
		expect(output.data.build).toBeDefined();
		expect(output.data.build?.success).toBe(true);
		expect(output.data.summary.steps).toBe(2);
		expect(output.data.summary.passed).toBe(2);
		expect(output.data.summary.failed).toBe(0);
		expect(resolveExitCode(output)).toBe(0);
	});

	it("returns success=false and skips build when check fails", async () => {
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

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output.success).toBe(false);
		expect(output.data.check.success).toBe(false);
		expect(output.data.check.errors).toBe(1);
		expect(output.data.build).toBeUndefined();
		expect(output.data.skippedReason).toContain("Check failed");
		expect(output.data.summary.steps).toBe(1);
		expect(output.data.summary.passed).toBe(0);
		expect(output.data.summary.failed).toBe(1);
		expect(resolveExitCode(output)).toBe(1);
	});

	it("returns success=false when check passes but build fails", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(enforce).mockResolvedValue(makeResult());
		vi.mocked(generateApi).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "A001",
						message: "API generation failed",
						filePath: "",
						line: 0,
						column: 0,
					},
				],
			}),
		);

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output.success).toBe(false);
		expect(output.data.check.success).toBe(true);
		expect(output.data.build).toBeDefined();
		expect(output.data.build?.success).toBe(false);
		expect(output.data.summary.steps).toBe(2);
		expect(output.data.summary.passed).toBe(1);
		expect(output.data.summary.failed).toBe(1);
		expect(resolveExitCode(output)).toBe(1);
	});

	it("passes strict flag to check step", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		const config = makeConfig();
		vi.mocked(loadConfig).mockResolvedValue(config);
		vi.mocked(enforce).mockResolvedValue(makeResult());

		await runPrepublish({ cwd: "/fake", strict: true });

		// The config should have had strict set to true by runCheck
		expect(config.enforce.strict).toBe(true);
	});

	it("includes check error and warning counts in result", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(
			makeResult({
				success: false,
				errors: [
					{
						code: "E001",
						message: "error 1",
						filePath: "/fake/src/a.ts",
						line: 1,
						column: 0,
					},
					{
						code: "E002",
						message: "error 2",
						filePath: "/fake/src/b.ts",
						line: 5,
						column: 0,
					},
				],
				warnings: [
					{
						code: "W001",
						message: "warn 1",
						filePath: "/fake/src/a.ts",
						line: 2,
						column: 0,
					},
				],
			}),
		);

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output.data.check.errors).toBe(2);
		expect(output.data.check.warnings).toBe(1);
	});

	it("includes build step counts when both steps run", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");
		const { generateApi } = await import("@forge-ts/api");

		vi.mocked(loadConfig).mockResolvedValue(
			makeConfig({
				api: { enabled: true, openapi: true, openapiPath: "/fake/docs/openapi.json" },
			}),
		);
		vi.mocked(enforce).mockResolvedValue(makeResult());
		vi.mocked(generateApi).mockResolvedValue(makeResult({ duration: 42 }));

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output.data.build?.steps).toBeGreaterThan(0);
		expect(output.data.build?.succeeded).toBeGreaterThanOrEqual(0);
	});

	it("LAFS envelope structure is correct on success", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(makeResult());

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output).toHaveProperty("operation", "prepublish");
		expect(output).toHaveProperty("success", true);
		expect(output.data).toHaveProperty("success", true);
		expect(output.data).toHaveProperty("summary");
		expect(output.data.summary).toHaveProperty("steps");
		expect(output.data.summary).toHaveProperty("passed");
		expect(output.data.summary).toHaveProperty("failed");
		expect(output.data.summary).toHaveProperty("duration");
		expect(output.data).toHaveProperty("check");
		expect(output.data).toHaveProperty("build");
		expect(output).toHaveProperty("duration");
	});

	it("LAFS envelope structure is correct on check failure", async () => {
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

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output).toHaveProperty("operation", "prepublish");
		expect(output).toHaveProperty("success", false);
		expect(output.errors).toBeDefined();
		expect(output.data).toHaveProperty("skippedReason");
	});

	it("has duration on all results", async () => {
		const { loadConfig } = await import("@forge-ts/core");
		const { enforce } = await import("@forge-ts/enforcer");

		vi.mocked(loadConfig).mockResolvedValue(makeConfig());
		vi.mocked(enforce).mockResolvedValue(makeResult());

		const output = await runPrepublish({ cwd: "/fake" });

		expect(output.duration).toBeGreaterThanOrEqual(0);
		expect(output.data.summary.duration).toBeGreaterThanOrEqual(0);
		expect(output.data.check.duration).toBeGreaterThanOrEqual(0);
	});
});
