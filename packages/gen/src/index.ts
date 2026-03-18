/**
 * @forge-ts/gen — Markdown/MDX documentation and llms.txt generator.
 *
 * Generates human- and machine-readable documentation from the forge-ts
 * symbol graph, with optional README injection.
 *
 * @packageDocumentation
 * @public
 */

export { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
export {
	generateMarkdown,
	type MarkdownOptions,
} from "./markdown.js";
export { type ReadmeSyncOptions, syncReadme } from "./readme-sync.js";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWalker, type ForgeConfig, type ForgeResult } from "@forge-ts/core";
import { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
import { generateMarkdown } from "./markdown.js";
import { syncReadme } from "./readme-sync.js";

/**
 * Runs the full generation pipeline: walk → render → write.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} describing the outcome.
 * @public
 */
export async function generate(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();

	const walker = createWalker(config);
	const symbols = walker.walk();

	await mkdir(config.outDir, { recursive: true });

	for (const format of config.gen.formats) {
		const content = generateMarkdown(symbols, config, {
			mdx: format === "mdx",
		});
		const ext = format === "mdx" ? "mdx" : "md";
		await writeFile(join(config.outDir, `api-reference.${ext}`), content, "utf8");
	}

	if (config.gen.llmsTxt) {
		const llms = generateLlmsTxt(symbols, config);
		await writeFile(join(config.outDir, "llms.txt"), llms, "utf8");

		const llmsFull = generateLlmsFullTxt(symbols, config);
		await writeFile(join(config.outDir, "llms-full.txt"), llmsFull, "utf8");
	}

	if (config.gen.readmeSync) {
		await syncReadme(join(config.rootDir, "README.md"), symbols);
	}

	return {
		success: true,
		symbols,
		errors: [],
		warnings: [],
		duration: Date.now() - start,
	};
}
