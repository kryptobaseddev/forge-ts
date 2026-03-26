import type { ForgeSymbol } from "@forge-ts/core";

/**
 * A single extracted `@example` block ready for test generation.
 * @since 0.14.0
 * @public
 */
export interface ExtractedExample {
	/** The symbol this example belongs to. */
	symbolName: string;
	/** Absolute path to the source file. */
	filePath: string;
	/** 1-based line number of the `@example` tag. */
	line: number;
	/** The raw code inside the fenced block. */
	code: string;
	/** The language identifier (e.g. `"typescript"`). */
	language: string;
	/** Sequential index among examples for this symbol. */
	index: number;
}

/**
 * Extracts all `@example` blocks from a list of {@link ForgeSymbol} objects.
 *
 * @remarks
 * Iterates every symbol's `documentation.examples` array and flattens them into
 * a single list with source location metadata for downstream test generation.
 *
 * @param symbols - The symbols produced by the core AST walker.
 * @returns A flat array of {@link ExtractedExample} objects, one per code block.
 * @example
 * ```typescript
 * import { createWalker, loadConfig } from "@forge-ts/core";
 * import { extractExamples } from "@forge-ts/doctest";
 * const config = await loadConfig();
 * const symbols = createWalker(config).walk();
 * const examples = extractExamples(symbols);
 * console.log(`Found ${examples.length} examples`);
 * ```
 * @see ExtractedExample
 * @since 0.14.0
 * @public
 */
export function extractExamples(symbols: ForgeSymbol[]): ExtractedExample[] {
	const results: ExtractedExample[] = [];

	for (const symbol of symbols) {
		const examples = symbol.documentation?.examples ?? [];
		for (let i = 0; i < examples.length; i++) {
			const ex = examples[i];
			results.push({
				symbolName: symbol.name,
				filePath: symbol.filePath,
				line: ex.line,
				code: ex.code,
				language: ex.language,
				index: i,
			});
		}
	}

	return results;
}
