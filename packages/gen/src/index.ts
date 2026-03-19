/**
 * @forge-ts/gen — Markdown/MDX documentation and llms.txt generator.
 *
 * Generates human- and machine-readable documentation from the forge-ts
 * symbol graph, with optional README injection.
 *
 * @packageDocumentation
 * @public
 */

export * from "./adapters/index.js";
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

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createWalker, type ForgeConfig, type ForgeResult } from "@forge-ts/core";
import { DEFAULT_TARGET, getAdapter } from "./adapters/index.js";
import type { AdapterContext } from "./adapters/types.js";
import { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
import { generateMarkdown } from "./markdown.js";
import { syncReadme } from "./readme-sync.js";
import { generateDocSite, groupSymbolsByPackage } from "./site-generator.js";

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

	// Multi-page site output — writes directly to outDir via adapters
	const resolvedRoot = config.rootDir === "." ? process.cwd() : config.rootDir;
	const projectName = resolvedRoot.split("/").pop() ?? "Project";
	const symbolsByPackage = groupSymbolsByPackage(symbols, config.rootDir);

	const target = config.gen.ssgTarget ?? DEFAULT_TARGET;
	const adapter = getAdapter(target);

	for (const format of config.gen.formats) {
		const pages = generateDocSite(symbolsByPackage, config, {
			format,
			ssgTarget: config.gen.ssgTarget,
			projectName,
			repositoryUrl: config.project.repository,
			packageName: config.project.packageName,
		});

		const adapterContext: AdapterContext = {
			config,
			projectName,
			pages,
			symbols,
			outDir: config.outDir,
		};

		// Transform pages through the adapter (adds correct frontmatter and extensions)
		const transformedPages = adapter.transformPages(pages, adapterContext);
		for (const file of transformedPages) {
			const filePath = join(config.outDir, file.path);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, file.content, "utf8");
		}

		// Generate platform config files only when ssgTarget is explicitly set
		if (config.gen.ssgTarget) {
			const configFiles = adapter.generateConfig(adapterContext);
			for (const file of configFiles) {
				const filePath = join(config.outDir, file.path);
				await mkdir(dirname(filePath), { recursive: true });
				await writeFile(filePath, file.content, "utf8");
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
