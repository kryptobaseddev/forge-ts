/**
 * @forge-ts/doctest — TSDoc `@example` block extractor and test runner.
 *
 * Extracts fenced code blocks from `@example` tags in TSDoc comments,
 * generates virtual `node:test` test files, and executes them.
 *
 * @packageDocumentation
 * @public
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
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} with success/failure and any diagnostics.
 * @public
 */
export async function doctest(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();

	const walker = createWalker(config);
	const symbols = walker.walk();

	const examples = extractExamples(symbols);
	const files = generateTestFiles(examples, { cacheDir: config.doctest.cacheDir });
	const runResult = await runTests(files);

	return {
		success: runResult.success,
		symbols,
		errors:
			runResult.failed > 0
				? [
						{
							code: "D001",
							message: `${runResult.failed} doctest(s) failed. See output for details.`,
							filePath: "",
							line: 0,
							column: 0,
						},
					]
				: [],
		warnings: [],
		duration: Date.now() - start,
	};
}
