/**
 * TSDoc `@example` block extractor and test runner for forge-ts projects.
 *
 * Extracts fenced TypeScript code blocks from `@example` tags in TSDoc
 * comments, transpiles them into virtual `node:test` test files, and executes
 * those files using the native Node.js test runner — turning documentation
 * examples into living tests that break the build when they go stale.
 *
 * @remarks
 * The pipeline has three stages: **extract** (`extractExamples`) reads the
 * `ForgeSymbol[]` graph and collects every fenced code block found inside an
 * `@example` tag; **generate** (`generateTestFiles`) wraps each snippet in a
 * `node:test` `it()` call and writes the result to a cache directory;
 * **run** (`runTests`) spawns the Node test runner against those files and
 * parses TAP output into structured `TestCaseResult` records.
 *
 * The top-level `doctest()` function composes all three stages. Individual
 * stages are also exported so callers can customise caching, filtering, or
 * test output handling without re-running the full pipeline.
 *
 * Key exports:
 * - `doctest` — Run the full extract → generate → run pipeline.
 * - `extractExamples` — Collect `@example` code blocks from a symbol graph.
 * - `generateTestFiles` — Wrap extracted examples in `node:test` scaffolding.
 * - `runTests` — Execute generated test files and return structured results.
 * - `ExtractedExample` — A single extracted code snippet with source location.
 * - `VirtualTestFile` — A generated test file path and content pair.
 * - `RunResult` / `TestCaseResult` — Structured test execution outcome types.
 * - `GeneratorOptions` — Options for `generateTestFiles` (e.g., `cacheDir`).
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { doctest } from "@forge-ts/doctest";
 *
 * const config = await loadConfig();
 * const result = await doctest(config);
 * if (!result.success) {
 *   console.error(`${result.errors.length} doctest failure(s)`);
 * }
 * ```
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
 * @remarks
 * Composes three sub-stages in sequence:
 *
 * 1. **Extract** — `createWalker(config).walk()` produces the `ForgeSymbol[]`
 *    graph; `extractExamples` collects every fenced code block found inside an
 *    `@example` tag, recording the originating symbol name and source line.
 *
 * 2. **Generate** — `generateTestFiles` wraps each snippet in a `node:test`
 *    `it()` call and writes the resulting `.mjs` files to `config.doctest.cacheDir`.
 *    Files are keyed by a hash of their content so unchanged examples are not
 *    re-emitted on subsequent runs.
 *
 * 3. **Run** — `runTests` spawns `node --test` against the generated files,
 *    captures TAP output, and parses it into structured `TestCaseResult` records.
 *    A non-zero exit code or any failed test causes `result.success` to be `false`.
 *
 * Error code `D001` is emitted when one or more tests fail (the count is
 * included in the message). Error code `D002` is emitted when the runner
 * exits non-zero without any parsed test failures, which typically indicates
 * a compilation or import error in the generated files.
 *
 * @param config - The resolved `ForgeConfig` for the project. The
 *   `config.doctest.cacheDir` field controls where generated test files are
 *   written; all other doctest behaviour uses `config.rootDir` and `config.tsconfig`.
 * @returns A `ForgeResult` whose `success` field is `true` only when every
 *   extracted example passes. `errors` contains `D001`/`D002` diagnostics on
 *   failure; `symbols` is the full symbol graph from the walk step.
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { doctest } from "@forge-ts/doctest";
 *
 * const config = await loadConfig();
 * const result = await doctest(config);
 * if (!result.success) {
 *   console.error(`${result.errors.length} doctest failure(s)`);
 *   process.exit(1);
 * }
 * ```
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
