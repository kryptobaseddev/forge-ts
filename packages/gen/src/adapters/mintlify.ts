import type { DocPage } from "../site-generator.js";
import { registerAdapter } from "./registry.js";
import type {
	AdapterContext,
	GeneratedFile,
	ScaffoldManifest,
	SSGAdapter,
	SSGStyleGuide,
} from "./types.js";

// ---------------------------------------------------------------------------
// Style guide
// ---------------------------------------------------------------------------

const styleGuide: SSGStyleGuide = {
	pageExtension: "mdx",
	supportsMdx: true,
	requiresFrontmatter: true,
	maxHeadingDepth: 3,
	defaultImports: [],
	codeBlockLanguage: "typescript",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the file extension from a page path, returning the slug. */
function pageSlug(pagePath: string): string {
	return pagePath.replace(/\.[^.]+$/, "");
}

/** A navigation group with pages (Mintlify v4 format). */
interface MintlifyNavGroup {
	group: string;
	pages: Array<string | MintlifyNavGroup>;
}

/** A navigation tab containing groups (Mintlify v4 format). */
interface MintlifyNavTab {
	tab: string;
	groups: MintlifyNavGroup[];
}

/** Mintlify v4 docs.json structure. */
interface MintlifyDocsJson {
	name: string;
	theme: string;
	colors: { primary: string; light: string; dark: string };
	navigation: { tabs: MintlifyNavTab[] };
	footer: { socials: Record<string, string> };
}

/** Build the docs.json navigation config from doc pages (Mintlify v4 format). */
function buildDocsJson(context: AdapterContext): MintlifyDocsJson {
	const { pages, projectName } = context;
	const topLevel: string[] = [];
	const byPackage = new Map<string, string[]>();

	for (const page of pages) {
		const slug = pageSlug(page.path);
		const packageMatch = /^packages\/([^/]+)\/(.+)$/.exec(slug);
		if (packageMatch) {
			const pkgName = packageMatch[1];
			const list = byPackage.get(pkgName) ?? [];
			list.push(slug);
			byPackage.set(pkgName, list);
		} else {
			topLevel.push(slug);
		}
	}

	const tabs: MintlifyNavTab[] = [];

	// Documentation tab with getting started pages
	if (topLevel.length > 0) {
		tabs.push({
			tab: "Documentation",
			groups: [{ group: "Getting Started", pages: topLevel }],
		});
	}

	// API Reference tab with per-package groups
	if (byPackage.size > 0) {
		const groups: MintlifyNavGroup[] = [];
		for (const [pkgName, slugs] of byPackage) {
			groups.push({ group: `@forge-ts/${pkgName}`, pages: slugs });
		}
		tabs.push({ tab: "API Reference", groups });
	}

	return {
		name: projectName,
		theme: "mint",
		colors: { primary: "#0ea5e9", light: "#38bdf8", dark: "#0284c7" },
		navigation: { tabs },
		footer: { socials: { github: "https://github.com/kryptobaseddev/forge-ts" } },
	};
}

/** Add Mintlify-compatible frontmatter to a doc page. */
function addMintlifyFrontmatter(page: DocPage): string {
	const title = String(page.frontmatter.title ?? "");
	const description = page.frontmatter.description
		? String(page.frontmatter.description)
		: undefined;

	const lines = ["---", `title: "${title}"`];
	if (description) {
		lines.push(`description: "${description}"`);
	}
	lines.push("---", "");

	// Strip existing frontmatter block if present, then prepend ours
	const body = page.content.replace(/^---[\s\S]*?---\n+/, "");
	return lines.join("\n") + body;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Mintlify SSG adapter.
 * Implements the {@link SSGAdapter} contract for the Mintlify platform.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("mintlify");
 * const configs = adapter.generateConfig(context);
 * console.log(configs[0].path); // "docs.json"
 * ```
 * @public
 */
export const mintlifyAdapter: SSGAdapter = {
	target: "mintlify",
	displayName: "Mintlify",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		const docsJson = buildDocsJson(context);
		return {
			target: "mintlify",
			files: [{ path: "docs.json", content: JSON.stringify(docsJson, null, 2) }],
			dependencies: {},
			devDependencies: {},
			scripts: {},
			instructions: [
				"Preview locally: npx @mintlify/cli dev",
				"Deploy: Push to GitHub and connect at mintlify.com",
			],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		return pages.map((page) => {
			let content = addMintlifyFrontmatter(page);
			// Strip any top-level h1 lines — Mintlify renders frontmatter title as h1
			content = content.replace(/^# .+$/m, "").replace(/\n{3,}/g, "\n\n");
			// Ensure opening code fences that have no language tag get a typescript tag.
			// We track fence state so we only tag opening fences, not closing ones.
			let insideFence = false;
			content = content
				.split("\n")
				.map((line) => {
					if (insideFence) {
						if (/^```\s*$/.test(line)) {
							insideFence = false;
						}
						return line;
					}
					// Opening fence with a language — track but don't modify
					if (/^```\S/.test(line)) {
						insideFence = true;
						return line;
					}
					// Opening fence with no language — add typescript
					if (/^```\s*$/.test(line)) {
						insideFence = true;
						return "```typescript";
					}
					return line;
				})
				.join("\n");
			return {
				path: page.path.replace(/\.md$/, ".mdx"),
				content,
			};
		});
	},

	generateConfig(context: AdapterContext): GeneratedFile[] {
		const config = buildDocsJson(context);
		return [
			{
				path: "docs.json",
				content: `${JSON.stringify(config, null, 2)}\n`,
			},
		];
	},

	getDevCommand(outDir: string) {
		return {
			bin: "npx",
			args: ["@mintlify/cli", "dev"],
			cwd: outDir,
			label: "Mintlify Dev Server",
			url: "http://localhost:3000",
		};
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return existsSync(join(outDir, "docs.json"));
	},
};

// Self-register
registerAdapter(mintlifyAdapter);
