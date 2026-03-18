import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ForgeSymbol } from "@codluv/forge-core";
import { Visibility } from "@codluv/forge-core";
import { describe, expect, it } from "vitest";
import { extractExamples } from "../extractor.js";
import { generateTestFiles } from "../generator.js";
import { runTests } from "../runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSymbol(overrides: Partial<ForgeSymbol> = {}): ForgeSymbol {
	return {
		name: "myFn",
		kind: "function",
		visibility: Visibility.Public,
		filePath: "/project/src/math.ts",
		line: 10,
		column: 0,
		exported: true,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

describe("extractExamples", () => {
	it("extracts examples from symbols with @example blocks", () => {
		const symbols: ForgeSymbol[] = [
			makeSymbol({
				name: "add",
				documentation: {
					examples: [{ code: "add(1, 2)", language: "typescript", line: 5 }],
				},
			}),
		];

		const result = extractExamples(symbols);

		expect(result).toHaveLength(1);
		expect(result[0].symbolName).toBe("add");
		expect(result[0].code).toBe("add(1, 2)");
		expect(result[0].language).toBe("typescript");
		expect(result[0].line).toBe(5);
		expect(result[0].index).toBe(0);
	});

	it("returns empty array for symbols without examples", () => {
		const symbols: ForgeSymbol[] = [
			makeSymbol({ documentation: { summary: "A function with no examples." } }),
		];

		expect(extractExamples(symbols)).toHaveLength(0);
	});

	it("returns empty array when symbols have no documentation", () => {
		const symbols: ForgeSymbol[] = [makeSymbol({ documentation: undefined })];

		expect(extractExamples(symbols)).toHaveLength(0);
	});

	it("handles multiple examples per symbol", () => {
		const symbols: ForgeSymbol[] = [
			makeSymbol({
				name: "multiply",
				documentation: {
					examples: [
						{ code: "multiply(2, 3)", language: "typescript", line: 10 },
						{ code: "multiply(4, 5)", language: "typescript", line: 20 },
					],
				},
			}),
		];

		const result = extractExamples(symbols);

		expect(result).toHaveLength(2);
		expect(result[0].index).toBe(0);
		expect(result[1].index).toBe(1);
		expect(result[0].code).toBe("multiply(2, 3)");
		expect(result[1].code).toBe("multiply(4, 5)");
	});

	it("preserves language identifiers", () => {
		const symbols: ForgeSymbol[] = [
			makeSymbol({
				documentation: {
					examples: [{ code: "add(1, 2)", language: "javascript", line: 1 }],
				},
			}),
		];

		expect(extractExamples(symbols)[0].language).toBe("javascript");
	});

	it("flattens examples from multiple symbols", () => {
		const symbols: ForgeSymbol[] = [
			makeSymbol({
				name: "fn1",
				filePath: "/project/src/a.ts",
				documentation: { examples: [{ code: "fn1()", language: "typescript", line: 1 }] },
			}),
			makeSymbol({
				name: "fn2",
				filePath: "/project/src/b.ts",
				documentation: { examples: [{ code: "fn2()", language: "typescript", line: 2 }] },
			}),
		];

		const result = extractExamples(symbols);
		expect(result).toHaveLength(2);
		expect(result[0].symbolName).toBe("fn1");
		expect(result[1].symbolName).toBe("fn2");
	});
});

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

describe("generateTestFiles", () => {
	const cacheDir = "/tmp/forge-doctest-cache";

	it("generates one file per unique source file", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
			{
				symbolName: "sub",
				filePath: "/project/src/math.ts",
				line: 15,
				code: "sub(3, 1)",
				language: "typescript",
				index: 0,
			},
		];

		const files = generateTestFiles(examples, { cacheDir });

		expect(files).toHaveLength(1);
	});

	it("generates separate files for different source files", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
			{
				symbolName: "greet",
				filePath: "/project/src/strings.ts",
				line: 8,
				code: "greet('world')",
				language: "typescript",
				index: 0,
			},
		];

		const files = generateTestFiles(examples, { cacheDir });

		expect(files).toHaveLength(2);
	});

	it("includes import statement for the tested symbol", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain("import { add } from");
		expect(file.content).toContain("math.js");
	});

	it("includes node:test and assert imports", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain('from "node:test"');
		expect(file.content).toContain('from "node:assert/strict"');
	});

	it("generates source map comment at end of file", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain("//# sourceMappingURL=data:application/json;base64,");
	});

	it("handles // => assertion patterns", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2) // => 3",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain("assert.strictEqual(add(1, 2), 3);");
		expect(file.content).not.toContain("// => 3");
	});

	it("preserves code lines without // => patterns unchanged", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "const result = add(1, 2);\nconsole.log(result);",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain("const result = add(1, 2);");
		expect(file.content).toContain("console.log(result);");
	});

	it("includes example line number in the it() description", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 42,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain("(line 42)");
	});

	it("returns empty array for empty examples input", () => {
		expect(generateTestFiles([], { cacheDir })).toHaveLength(0);
	});

	it("collects multiple symbol names for a single import statement", () => {
		const examples = [
			{
				symbolName: "add",
				filePath: "/project/src/math.ts",
				line: 5,
				code: "add(1, 2)",
				language: "typescript",
				index: 0,
			},
			{
				symbolName: "sub",
				filePath: "/project/src/math.ts",
				line: 15,
				code: "sub(5, 3)",
				language: "typescript",
				index: 0,
			},
		];

		const [file] = generateTestFiles(examples, { cacheDir });

		expect(file.content).toContain("add, sub");
	});
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

describe("runTests", () => {
	it("returns success for empty file list", async () => {
		const result = await runTests([]);

		expect(result.success).toBe(true);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
		expect(result.output).toBe("");
		expect(result.tests).toHaveLength(0);
	});

	it("(integration) runs a passing test file and reports success", async () => {
		const dir = join(tmpdir(), `forge-doctest-runner-${Date.now()}`);
		await mkdir(dir, { recursive: true });

		try {
			const filePath = join(dir, "simple.test.ts");
			const content = [
				`import { describe, it } from "node:test";`,
				`import assert from "node:assert/strict";`,
				``,
				`describe("simple", () => {`,
				`\tit("one plus one", () => {`,
				`\t\tassert.strictEqual(1 + 1, 2);`,
				`\t});`,
				`});`,
				``,
			].join("\n");

			await writeFile(filePath, content, "utf8");

			const result = await runTests([{ path: filePath, content }]);

			expect(result.success).toBe(true);
			expect(result.failed).toBe(0);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("(integration) reports failure for a failing assertion", async () => {
		const dir = join(tmpdir(), `forge-doctest-runner-fail-${Date.now()}`);
		await mkdir(dir, { recursive: true });

		try {
			const filePath = join(dir, "failing.test.ts");
			const content = [
				`import { describe, it } from "node:test";`,
				`import assert from "node:assert/strict";`,
				``,
				`describe("failing", () => {`,
				`\tit("intentional fail", () => {`,
				`\t\tassert.strictEqual(1 + 1, 999);`,
				`\t});`,
				`});`,
				``,
			].join("\n");

			await writeFile(filePath, content, "utf8");

			const result = await runTests([{ path: filePath, content }]);

			expect(result.success).toBe(false);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
