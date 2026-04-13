/**
 * Documentation generation pipeline for the forge-ts toolchain.
 *
 * Converts the `ForgeSymbol[]` graph produced by `@forge-ts/core` into
 * human- and machine-readable output: multi-page Markdown or MDX site files,
 * `llms.txt` / `llms-full.txt` LLM-context companions, a Codebase Knowledge
 * Manifest (`ckm.json`), SKILL.md agent skill packages, and OpenAPI-compatible
 * site scaffolding for Docusaurus, Mintlify, Nextra, VitePress, and Fumadocs.
 *
 * @remarks
 * The top-level `generate()` function orchestrates the full pipeline in a
 * single call: walk → render → write. Auto-generated pages are always
 * overwritten from source; stub pages (concepts, guides, FAQ) are written only
 * once so manual edits survive subsequent builds. Pass `{ forceStubs: true }`
 * to reset stubs to their scaffolded state.
 *
 * SSG adapters are selected via `config.gen.ssgTarget`. Each adapter
 * transforms `DocPage` objects into platform-specific frontmatter and file
 * extensions, and optionally emits platform config files (e.g.,
 * `mint.json` for Mintlify, `_meta.ts` for Fumadocs).
 *
 * Key exports:
 * - `generate` — Run the full walk → render → write pipeline.
 * - `generateDocSite` — Produce per-page `DocPage[]` from a symbol graph.
 * - `getAdapter` — Retrieve the SSG adapter for a given `SSGTarget`.
 * - `generateMarkdown` — Render symbols to a single flat Markdown/MDX string.
 * - `generateLlmsTxt` / `generateLlmsFullTxt` — Produce `llms.txt` companions.
 * - `generateCKM` — Build a `CKMManifest` (Codebase Knowledge Manifest).
 * - `generateSkillPackage` — Produce a SKILL.md agent skill package.
 * - `syncReadme` — Inject auto-generated sections back into `README.md`.
 * - `GenerateOptions` — Options accepted by `generate()`.
 * - `SiteGeneratorOptions` / `DocPage` — Page-level generation types.
 * - `SSGConfigFile` — A platform config file emitted by an SSG adapter.
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { generate } from "@forge-ts/gen";
 *
 * const config = await loadConfig();
 * const result = await generate(config);
 * console.log(result.writtenFiles?.length); // number of files written
 * ```
 *
 * @packageDocumentation
 * @public
 */

export * from "./adapters/index.js";
export {
	type CKMConcept,
	type CKMConfigEntry,
	type CKMConstraint,
	type CKMManifest,
	type CKMOperation,
	type CKMOperationInput,
	type CKMWorkflow,
	generateCKM,
} from "./ckm-generator.js";
export { type DiscoveredGuide, discoverGuides, type GuideSource } from "./guide-discovery.js";
export { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
export {
	generateMarkdown,
	type MarkdownOptions,
} from "./markdown.js";
export {
	type FrontmatterResult,
	isStubModified,
	parseBlocks,
	parseFrontmatter,
	parseInline,
	sanitizeForMdx,
	stringifyWithFrontmatter,
	stripFrontmatter,
	stubHash,
	updateStubSections,
} from "./markdown-utils.js";
export { md, serializeMarkdown, slugLink, toAnchor, truncate } from "./mdast-builders.js";
export { type ReadmeSyncOptions, syncReadme } from "./readme-sync.js";
export {
	type DocPage,
	escapeMdx,
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
import { generateCKM } from "./ckm-generator.js";
import { generateLlmsFullTxt, generateLlmsTxt } from "./llms.js";
import { generateMarkdown } from "./markdown.js";
import { updateAutoSections } from "./markdown-utils.js";
import { syncReadme } from "./readme-sync.js";
import { generateDocSite, groupSymbolsByPackage } from "./site-generator.js";
import { generateSkillPackage } from "./skill.js";

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
	 * @defaultValue false
	 * @example
	 * ```typescript
	 * await generate(config, { forceStubs: true });
	 * ```
	 */
	forceStubs?: boolean;
}

/**
 * Runs the full documentation generation pipeline: walk → render → write.
 *
 * Auto-generated pages are always regenerated from source code on each run.
 * Stub pages (concepts, guides, FAQ, contributing, changelog) are written
 * only the first time, preserving manual edits across subsequent builds.
 * Pass `{ forceStubs: true }` to reset stubs to their scaffolded state.
 *
 * @remarks
 * Orchestrates the following stages in order:
 *
 * 1. **Walk** — `createWalker(config).walk()` produces the `ForgeSymbol[]` graph.
 *
 * 2. **Flat output** — For each format in `config.gen.formats`, writes a legacy
 *    single-file `api-reference.md` / `api-reference.mdx` to `config.outDir`.
 *
 * 3. **Multi-page site** — `generateDocSite` produces `DocPage[]`; the selected
 *    SSG adapter (`getAdapter(config.gen.ssgTarget)`) transforms them into
 *    platform-specific files with correct frontmatter and extensions. Stub
 *    pages that already exist on disk are merged rather than overwritten via
 *    `updateAutoSections`, preserving the `FORGE:AUTO` marker regions while
 *    leaving manually authored content untouched.
 *
 * 4. **llms.txt** — When `config.gen.llmsTxt` is enabled, writes `llms.txt`
 *    and `llms-full.txt` to `config.outDir`, and generates a SKILL.md skill
 *    package unless `config.skill.enabled` is explicitly `false`.
 *
 * 5. **CKM** — When `config.gen.ckm` is enabled (the default), writes
 *    `ckm.json` (a Codebase Knowledge Manifest) to `config.outDir`.
 *
 * 6. **README sync** — When `config.gen.readmeSync` is enabled, updates
 *    auto-generated sections in the project `README.md`.
 *
 * @param config - The resolved `ForgeConfig` for the project.
 * @param options - Optional generation flags (see `GenerateOptions`).
 * @returns A `ForgeResult` whose `writtenFiles` lists every path written.
 *   `success` is always `true` on normal completion; file-system errors throw.
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { generate } from "@forge-ts/gen";
 *
 * const config = await loadConfig();
 * const result = await generate(config);
 * console.log(`Wrote ${result.writtenFiles?.length ?? 0} files`);
 * ```
 * @public
 */
export async function generate(
	config: ForgeConfig,
	options?: GenerateOptions,
): Promise<ForgeResult> {
	const start = Date.now();
	const forceStubs = options?.forceStubs ?? false;
	const writtenFiles: string[] = [];

	const walker = createWalker(config);
	const symbols = walker.walk();

	await mkdir(config.outDir, { recursive: true });

	// Legacy flat output — kept for backward compatibility
	for (const format of config.gen.formats) {
		const content = generateMarkdown(symbols, config, {
			mdx: format === "mdx",
		});
		const ext = format === "mdx" ? "mdx" : "md";
		const filePath = join(config.outDir, `api-reference.${ext}`);
		await writeFile(filePath, content, "utf8");
		writtenFiles.push(filePath);
	}

	// Multi-page site output — writes directly to outDir via adapters
	const projectName =
		config.project.packageName ??
		(() => {
			const resolvedRoot = config.rootDir === "." ? process.cwd() : config.rootDir;
			return resolvedRoot.split("/").pop() ?? "Project";
		})();
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
					writtenFiles.push(filePath);
				}
				continue;
			}

			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, file.content, "utf8");
			writtenFiles.push(filePath);
		}

		// Generate platform config files only when ssgTarget is explicitly set
		if (config.gen.ssgTarget) {
			const configFiles = adapter.generateConfig(adapterContext);
			for (const file of configFiles) {
				const filePath = join(config.outDir, file.path);
				await mkdir(dirname(filePath), { recursive: true });
				await writeFile(filePath, file.content, "utf8");
				writtenFiles.push(filePath);
			}
		}
	}

	if (config.gen.llmsTxt) {
		const llmsPath = join(config.outDir, "llms.txt");
		const llms = generateLlmsTxt(symbols, config);
		await writeFile(llmsPath, llms, "utf8");
		writtenFiles.push(llmsPath);

		const llmsFullPath = join(config.outDir, "llms-full.txt");
		const llmsFull = generateLlmsFullTxt(symbols, config);
		await writeFile(llmsFullPath, llmsFull, "utf8");
		writtenFiles.push(llmsFullPath);

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
				writtenFiles.push(filePath);
			}
		}
	}

	if (config.gen.ckm !== false) {
		const ckmManifest = generateCKM(symbols, config);
		const ckmPath = join(config.outDir, "ckm.json");
		await writeFile(ckmPath, JSON.stringify(ckmManifest, null, 2), "utf8");
		writtenFiles.push(ckmPath);
	}

	if (config.gen.readmeSync) {
		const readmePath = join(config.rootDir, "README.md");
		await syncReadme(readmePath, symbols);
		writtenFiles.push(readmePath);
	}

	return {
		success: true,
		symbols,
		errors: [],
		warnings: [],
		duration: Date.now() - start,
		writtenFiles: [...new Set(writtenFiles)],
	};
}
