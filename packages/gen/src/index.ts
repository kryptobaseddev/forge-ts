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
export { generateSkillMd, generateSkillPackage, type SkillPackage } from "./skill.js";
export { generateSSGConfigs, type SSGConfigFile } from "./ssg-config.js";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createWalker, type ForgeConfig, type ForgeResult } from "@forge-ts/core";
import { DEFAULT_TARGET, getAdapter } from "./adapters/index.js";
import type { AdapterContext } from "./adapters/types.js";
import { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
import { generateMarkdown } from "./markdown.js";
import { syncReadme } from "./readme-sync.js";
import { generateDocSite, groupSymbolsByPackage } from "./site-generator.js";
import { generateSkillPackage } from "./skill.js";

/**
 * Updates auto-enriched sections in an existing stub file.
 * Replaces content between `<!-- FORGE:AUTO-START id -->` and
 * `<!-- FORGE:AUTO-END id -->` markers with fresh content from the
 * newly generated version. Manual content outside markers is preserved.
 *
 * @param existing - The current file content on disk.
 * @param generated - The freshly generated content with updated markers.
 * @returns The merged content, or null if no markers were found to update.
 * @internal
 */
function updateAutoSections(existing: string, generated: string): string | null {
	const markerPattern = /<!-- FORGE:AUTO-START (\S+) -->([\s\S]*?)<!-- FORGE:AUTO-END \1 -->/g;

	// Extract all auto sections from the generated content
	const newSections = new Map<string, string>();
	let match: RegExpExecArray | null;
	// biome-ignore lint: manual exec loop is clearest for named captures
	while ((match = markerPattern.exec(generated)) !== null) {
		newSections.set(match[1], match[0]);
	}

	if (newSections.size === 0) return null;

	// Replace each marker section in the existing content
	let updated = existing;
	let changed = false;
	for (const [id, replacement] of newSections) {
		const sectionPattern = new RegExp(
			`<!-- FORGE:AUTO-START ${id} -->[\\s\\S]*?<!-- FORGE:AUTO-END ${id} -->`,
		);
		if (sectionPattern.test(updated)) {
			updated = updated.replace(sectionPattern, replacement);
			changed = true;
		}
	}

	return changed ? updated : null;
}

/**
 * Options for the generation pipeline.
 *
 * @public
 */
export interface GenerateOptions {
	/**
	 * When true, overwrite stub pages even if they already exist on disk.
	 * Normally stub pages (concepts, guides, faq, contributing, changelog)
	 * are only created on the first build to preserve manual edits.
	 * Use this to reset stubs to their scaffolding state.
	 *
	 * @example
	 * ```typescript
	 * await generate(config, { forceStubs: true });
	 * ```
	 */
	forceStubs?: boolean;
}

/**
 * Runs the full generation pipeline: walk → render → write.
 *
 * Auto-generated pages are always regenerated from source code.
 * Stub pages (scaffolding for human/agent editing) are only created
 * if they don't already exist, preserving manual edits across builds.
 * Pass `{ forceStubs: true }` to overwrite stubs.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @param options - Optional generation flags (e.g., forceStubs).
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
export async function generate(
	config: ForgeConfig,
	options?: GenerateOptions,
): Promise<ForgeResult> {
	const start = Date.now();
	const forceStubs = options?.forceStubs ?? false;

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

		// Transform pages through the adapter (adds correct frontmatter and extensions).
		// The adapter propagates the stub flag from DocPage to GeneratedFile.
		const transformedPages = adapter.transformPages(pages, adapterContext);
		for (const file of transformedPages) {
			const filePath = join(config.outDir, file.path);

			// Stub pages: preserve manual edits across subsequent builds.
			// If the stub exists on disk, update only FORGE:AUTO marker sections
			// (progressive enrichment) while leaving manual content untouched.
			// With --force-stubs, overwrite the entire file.
			if (file.stub && existsSync(filePath) && !forceStubs) {
				const existingContent = await readFile(filePath, "utf8");
				const merged = updateAutoSections(existingContent, file.content);
				if (merged) {
					await writeFile(filePath, merged, "utf8");
				}
				continue;
			}

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

		// Skill package generation — follows gen.llmsTxt unless skill.enabled is explicitly false
		const skillEnabled = config.skill.enabled !== false;
		if (skillEnabled) {
			const skillPkg = generateSkillPackage(symbols, config);
			const skillDir = join(config.outDir, skillPkg.directoryName);
			await mkdir(skillDir, { recursive: true });
			for (const file of skillPkg.files) {
				const filePath = join(skillDir, file.path);
				await mkdir(dirname(filePath), { recursive: true });
				await writeFile(filePath, file.content, "utf8");
			}
		}
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
