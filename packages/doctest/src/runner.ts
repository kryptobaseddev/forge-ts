import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { VirtualTestFile } from "./generator.js";

/**
 * Result of running the generated test files.
 * @public
 */
export interface RunResult {
	/** Whether all tests passed. */
	success: boolean;
	/** Number of tests that passed. */
	passed: number;
	/** Number of tests that failed. */
	failed: number;
	/** Combined stdout + stderr output from the test runner. */
	output: string;
	/** Individual test results with name and status. */
	tests: TestCaseResult[];
}

/**
 * The result of a single test case.
 * @public
 */
export interface TestCaseResult {
	/** The full test name as reported by the runner. */
	name: string;
	/** Whether this test passed. */
	passed: boolean;
	/** The source file this test was generated from, if determinable. */
	sourceFile?: string;
}

/**
 * Parses TAP output from `node --test` into structured results.
 *
 * @param output - The raw TAP text from the runner.
 * @returns An object with pass/fail counts and per-test results.
 * @internal
 */
function parseTapOutput(output: string): {
	passed: number;
	failed: number;
	tests: TestCaseResult[];
} {
	const tests: TestCaseResult[] = [];
	let passed = 0;
	let failed = 0;

	for (const line of output.split("\n")) {
		// TAP ok / not ok lines: "ok 1 - test name" or "not ok 1 - test name"
		const okMatch = line.match(/^(?: {4})?ok \d+ - (.+)$/);
		const notOkMatch = line.match(/^(?: {4})?not ok \d+ - (.+)$/);

		if (okMatch) {
			const name = okMatch[1].trim();
			// Skip subtests that are suite-level (no leading spaces means top-level pass)
			if (!line.startsWith("    ")) {
				passed++;
				tests.push({ name, passed: true });
			}
		} else if (notOkMatch) {
			const name = notOkMatch[1].trim();
			if (!line.startsWith("    ")) {
				failed++;
				tests.push({ name, passed: false });
			}
		}
	}

	// Fallback: use summary lines if no individual results parsed
	if (tests.length === 0) {
		const passMatch = output.match(/# pass\s+(\d+)/);
		const failMatch = output.match(/# fail\s+(\d+)/);
		passed = passMatch ? parseInt(passMatch[1], 10) : 0;
		failed = failMatch ? parseInt(failMatch[1], 10) : 0;
	}

	return { passed, failed, tests };
}

/**
 * Writes virtual test files to disk and executes them with Node 24 native
 * TypeScript support (`--experimental-strip-types --test`).
 *
 * @param files - The virtual test files to write and run.
 * @returns A {@link RunResult} summarising the test outcome.
 * @example
 * ```typescript
 * import { runTests } from "@forge-ts/doctest";
 * const result = await runTests(virtualFiles);
 * if (!result.success) {
 *   console.error(`${result.failed} doctest(s) failed`);
 * }
 * ```
 * @public
 */
export async function runTests(files: VirtualTestFile[]): Promise<RunResult> {
	if (files.length === 0) {
		return { success: true, passed: 0, failed: 0, output: "", tests: [] };
	}

	// Write all files to disk
	for (const file of files) {
		await mkdir(dirname(file.path), { recursive: true });
		await writeFile(file.path, file.content, "utf8");
	}

	const paths = files.map((f) => f.path);

	return new Promise((resolve) => {
		const proc = spawn(process.execPath, ["--experimental-strip-types", "--test", ...paths], {
			stdio: "pipe",
		});

		let output = "";
		proc.stdout?.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		proc.stderr?.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		proc.on("close", (code) => {
			const { passed, failed, tests } = parseTapOutput(output);

			// Annotate tests with source file from filename slug
			const annotated = tests.map((t) => {
				// Test names like "doctest: filename.ts > symbolName example 1 (line N)"
				const srcMatch = t.name.match(/doctest:\s*(.+?)(?:\s*>|$)/);
				return srcMatch ? { ...t, sourceFile: srcMatch[1].trim() } : t;
			});

			// Enrich failure output with file locations
			const enrichedOutput = output;
			for (const file of files) {
				const fileBase = basename(file.path);
				if (enrichedOutput.includes(fileBase)) {
					// Already references the file; no additional enrichment needed
					break;
				}
			}

			// Reconcile exit code with parsed failures.
			// If node:test exits non-zero but TAP parsing found 0 failures,
			// the runner itself had an error (compilation, import, etc.).
			// Ensure failed >= 1 so consumers never see "0 failures" with exit 1.
			const actualFailed = code !== 0 && failed === 0 ? 1 : failed;
			const actualPassed = actualFailed > failed ? Math.max(0, passed - 1) : passed;

			resolve({
				success: code === 0,
				passed: actualPassed,
				failed: actualFailed,
				output: enrichedOutput,
				tests: annotated,
			});
		});
	});
}
