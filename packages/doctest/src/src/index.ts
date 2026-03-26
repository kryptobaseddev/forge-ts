/**
 * @forge-ts/doctest — TSDoc `@example` block extractor and test runner.
 *
 * Extracts fenced code blocks from `@example` tags in TSDoc comments,
 * generates virtual `node:test` test files, and executes them.
 *
 * @packageDocumentation
 */

export { type ExtractedExample, extractExamples } from "./extractor.js";
export {
	type GeneratorOptions,
	generateTestFiles,
	type VirtualTestFile,
} from "./generator.js";
export { type RunResult, runTests, type TestCaseResult } from "./runner.js";

import { createWalker, type ForgeConfig, type ForgeResult } from "@forge-ts/core";
import { extractExamples } from "./extractor.js";
import { generateTestFiles } from "./generator.js";
import { runTests } from "./runner.js";

/**
 * Runs the full doctest pipeline: extract → generate → run.
 *
 * @remarks
 * Orchestrates the three-phase pipeline: extracts `@example` blocks via the walker,
 * generates virtual `node:test` files, then executes them with native TS support.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} with success/failure and any diagnostics.
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { doctest } from "@forge-ts/doctest";
 * const config = await loadConfig();
 * const result = await doctest(config);
 * if (!result.success) {
 *   console.error(`${result.errors.length} doctest failure(s)`);
 * }
 * ```
 * @see ForgeConfig
 * @see ForgeResult
 * @since 0.14.0
 * @public
 */
export async function doctest(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();

	const walker = createWalker(config);
	const symbols = walker.walk();

	const examples = extractExamples(symbols);
	const files = generateTestFiles(examples, { cacheDir: config.doctest.cacheDir });
	const runResult = await runTests(files);

	const errors = [];
	if (runResult.failed > 0) {
		errors.push({
			code: "D001",
			message: `${runResult.failed} doctest(s) failed. See output for details.`,
			filePath: "",
			line: 0,
			column: 0,
		});
	} else if (!runResult.success) {
		// Runner exited non-zero without parsed test failures — likely a
		// compilation or import error in the generated test files.
		errors.push({
			code: "D002",
			message: `Doctest runner exited with an error. ${runResult.output ? `Output:\n${runResult.output.slice(0, 2000)}` : "No output captured."}`,
			filePath: "",
			line: 0,
			column: 0,
		});
	}

	return {
		success: runResult.success,
		symbols,
		errors,
		warnings: [],
		duration: Date.now() - start,
	};
}
