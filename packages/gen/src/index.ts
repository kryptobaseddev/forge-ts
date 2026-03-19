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
export {
	type DocPage,
	generateDocSite,
	groupSymbolsByPackage,
	type SiteGeneratorOptions,
} from "./site-generator.js";
export { generateSSGConfigs, type SSGConfigFile } from "./ssg-config.js";
export * from "./adapters/index.js";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWalker, type ForgeConfig, type ForgeResult } from "@forge-ts/core";
import { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
import { generateMarkdown } from "./markdown.js";
import { syncReadme } from "./readme-sync.js";
import { generateDocSite, groupSymbolsByPackage } from "./site-generator.js";
import { generateSSGConfigs } from "./ssg-config.js";

/**
 * Runs the full generation pipeline: walk → render → write.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} describing the outcome.
 * @example
 * ```typescript
 * import { generate } from "@forge-ts/gen";
 * const result = await generate(config);
 * console.log(result.success); // true if all files were written
 * ```
 * @public
 * @packageDocumentation
 */
export async function generate(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();

	const walker = createWalker(config);
	const symbols = walker.walk();

	await mkdir(config.outDir, { recursive: true });

	// Legacy flat output — kept for backward compatibility
	for (const format of config.gen.formats) {
		const content = generateMarkdown(symbols, config, {
			mdx: format === "mdx",
		});
		const ext = format === "mdx" ? "mdx" : "md";
		await writeFile(join(config.outDir, `api-reference.${ext}`), content, "utf8");
	}

	// Multi-page site output — writes directly to outDir
	const projectName = config.rootDir.split("/").pop() ?? "Project";
	const symbolsByPackage = groupSymbolsByPackage(symbols, config.rootDir);

	for (const format of config.gen.formats) {
		const pages = generateDocSite(symbolsByPackage, config, {
			format,
			ssgTarget: config.gen.ssgTarget,
			projectName,
		});

		for (const page of pages) {
			const pagePath = join(config.outDir, page.path);
			const pageDir = pagePath.substring(0, pagePath.lastIndexOf("/"));
			await mkdir(pageDir, { recursive: true });
			await writeFile(pagePath, page.content, "utf8");
		}

		if (config.gen.ssgTarget) {
			const configFiles = generateSSGConfigs(pages, config.gen.ssgTarget, projectName);
			for (const configFile of configFiles) {
				const configPath = join(config.outDir, configFile.path);
				const configDir = configPath.substring(0, configPath.lastIndexOf("/"));
				await mkdir(configDir, { recursive: true });
				await writeFile(configPath, configFile.content, "utf8");
			}
		}
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
