import { basename, relative } from "node:path";
import type { ExtractedExample } from "./extractor.js";

/**
 * Options for virtual test file generation.
 * @since 0.14.0
 * @public
 */
export interface GeneratorOptions {
	/** Directory where virtual test files will be written. */
	cacheDir: string;
}

/**
 * A generated virtual test file.
 * @since 0.14.0
 * @public
 */
export interface VirtualTestFile {
	/** Absolute path where the file will be written. */
	path: string;
	/** File contents (valid TypeScript). */
	content: string;
}

/**
 * Converts `// => value` comment patterns in example code to `assert.strictEqual` calls.
 *
 * @param code - Raw example code from the TSDoc block.
 * @returns Code with assertion comments replaced by actual assertion calls.
 * @internal
 */
function processAssertions(code: string): string {
	return code
		.split("\n")
		.map((line) => {
			// Match: expression // => expected
			const arrowMatch = line.match(/^(\s*)(.+?)\s*\/\/\s*=>\s*(.+)$/);
			if (arrowMatch) {
				const [, indent, expr, expected] = arrowMatch;
				return `${indent}assert.strictEqual(${expr.trim()}, ${expected.trim()});`;
			}
			return line;
		})
		.join("\n");
}

/**
 * Builds a base64-encoded inline source map that maps generated test file lines
 * back to the original TSDoc `@example` block in the source file.
 *
 * @param generatedFile - Absolute path of the generated test file.
 * @param examples - Examples contained in this file, each carrying its source location.
 * @param lineMap - Array mapping each generated line index (0-based) to its original line.
 * @returns A `//# sourceMappingURL=data:...` comment string.
 * @internal
 */
function buildInlineSourceMap(
	generatedFile: string,
	examples: ExtractedExample[],
	lineMap: Array<{ generatedLine: number; originalLine: number; sourceFile: string }>,
): string {
	// Collect unique source files
	const sources = [...new Set(examples.map((e) => e.filePath))];

	// Build mappings: each entry is [generatedLine, sourceIndex, originalLine, 0] (0-based)
	// VLQ encoding is complex; we generate a minimal valid source map with explicit mappings
	const mappings: string[] = [];
	let lastGenLine = 0;

	for (const entry of lineMap) {
		// Fill gaps with empty mappings
		while (lastGenLine < entry.generatedLine) {
			mappings.push(";");
			lastGenLine++;
		}
		const sourceIdx = sources.indexOf(entry.sourceFile);
		// Each mapping segment: [genCol=0, srcIdx, srcLine(0-based), srcCol=0]
		// Encode as VLQ - use a simple approach with base64 VLQ
		const seg = encodeVlqSegment(0, sourceIdx, entry.originalLine - 1, 0);
		mappings.push(seg);
		lastGenLine++;
	}

	const sourceMap = {
		version: 3,
		file: basename(generatedFile),
		sources,
		sourcesContent: null,
		names: [],
		mappings: mappings.join(";"),
	};

	const encoded = Buffer.from(JSON.stringify(sourceMap)).toString("base64");
	return `//# sourceMappingURL=data:application/json;base64,${encoded}`;
}

/**
 * Encodes a single source map segment using Base64 VLQ encoding.
 * Each field is relative to the previous segment's value.
 * @internal
 */
function encodeVlqSegment(...fields: number[]): string {
	return fields.map(encodeVlq).join("");
}

/** VLQ Base64 alphabet. @internal */
const VLQ_BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encodes a single signed integer as Base64 VLQ.
 * @internal
 */
function encodeVlq(value: number): string {
	// Convert to unsigned VLQ (sign bit in LSB)
	let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
	let result = "";
	do {
		let digit = vlq & 0x1f;
		vlq >>>= 5;
		if (vlq > 0) {
			digit |= 0x20; // continuation bit
		}
		result += VLQ_BASE64[digit];
	} while (vlq > 0);
	return result;
}

/**
 * Generates a virtual test file for a set of extracted examples.
 *
 * Each example is wrapped in an `it()` block using the Node built-in
 * `node:test` runner so that no additional test framework is required.
 * Auto-imports the tested symbol from the source file, processes `// =>`
 * assertion patterns, and appends an inline source map.
 *
 * @remarks
 * Source file imports are rewritten from `.ts`/`.tsx` to `.js` for ESM
 * compatibility using `relative(...).replace(/\.tsx?$/, ".js")`. This ensures
 * the generated test files use valid ESM import specifiers at runtime.
 *
 * @param examples - Examples to include in the generated file.
 * @param options - Output configuration.
 * @returns An array of {@link VirtualTestFile} objects (one per source file).
 * @example
 * ```typescript
 * import { generateTestFiles } from "@forge-ts/doctest";
 * const files = generateTestFiles(examples, opts);
 * console.log(`Generated ${files.length} test file(s)`);
 * ```
 * @see VirtualTestFile
 * @since 0.14.0
 * @public
 */
export function generateTestFiles(
	examples: ExtractedExample[],
	options: GeneratorOptions,
): VirtualTestFile[] {
	// Group by source file
	const byFile = new Map<string, ExtractedExample[]>();
	for (const ex of examples) {
		const group = byFile.get(ex.filePath) ?? [];
		group.push(ex);
		byFile.set(ex.filePath, group);
	}

	const files: VirtualTestFile[] = [];

	for (const [sourcePath, exs] of byFile) {
		const slug = sourcePath
			.replace(/[^a-zA-Z0-9]/g, "_")
			.replace(/_+/g, "_")
			.toLowerCase();
		const testFilePath = `${options.cacheDir}/${slug}.test.ts`;

		// Compute relative import path from cacheDir to sourcePath,
		// replacing the extension with .js for ESM compatibility
		const relPath = relative(options.cacheDir, sourcePath).replace(/\.tsx?$/, ".js");
		const importPath = relPath.startsWith(".") ? relPath : `./${relPath}`;

		// Collect unique symbol names for the import
		const symbolNames = [...new Set(exs.map((ex) => ex.symbolName))];

		// Track line numbers for source map
		const lineMap: Array<{ generatedLine: number; originalLine: number; sourceFile: string }> = [];

		// Build it-blocks and track line positions
		const lines: string[] = [];

		// Header lines (0-based index):
		// 0: // Auto-generated...
		// 1: // Source: ...
		// 2: import { describe, it } from "node:test";
		// 3: import assert from "node:assert/strict";
		// 4: import { symbolNames } from "...";
		// 5: (empty)
		// 6: describe(...) {
		lines.push(`// Auto-generated by @forge-ts/doctest — do not edit`);
		lines.push(`// Source: ${sourcePath}`);
		lines.push(`import { describe, it } from "node:test";`);
		lines.push(`import assert from "node:assert/strict";`);
		lines.push(`import { ${symbolNames.join(", ")} } from "${importPath}";`);
		lines.push(``);
		lines.push(`describe("doctest: ${basename(sourcePath)}", () => {`);

		for (const ex of exs) {
			const itLine = lines.length; // 0-based line index of the it() call
			lineMap.push({ generatedLine: itLine, originalLine: ex.line, sourceFile: ex.filePath });

			lines.push(
				`\tit("${ex.symbolName} example ${ex.index + 1} (line ${ex.line})", async () => {`,
			);

			const processedCode = processAssertions(ex.code);
			for (const codeLine of processedCode.split("\n")) {
				lines.push(`\t\t${codeLine}`);
			}
			lines.push(`\t});`);
		}

		lines.push(`});`);
		lines.push(``);

		// Append inline source map
		const sourceMapComment = buildInlineSourceMap(testFilePath, exs, lineMap);
		lines.push(sourceMapComment);
		lines.push(``);

		const content = lines.join("\n");
		files.push({ path: testFilePath, content });
	}

	return files;
}
