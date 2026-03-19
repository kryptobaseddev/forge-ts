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
	maxHeadingDepth: 4,
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

interface DocusaurusCategory {
	type: "category";
	label: string;
	items: Array<string | DocusaurusCategory>;
}

type DocusaurusSidebarItem = string | DocusaurusCategory;

/** Build the sidebars.js content from doc pages. */
function buildSidebarsJs(pages: DocPage[]): string {
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

	const items: DocusaurusSidebarItem[] = [...topLevel];

	for (const [pkgName, slugs] of byPackage) {
		items.push({
			type: "category",
			label: pkgName,
			items: slugs,
		});
	}

	const sidebarObj = { docs: items };
	const json = JSON.stringify(sidebarObj, null, 2);

	return (
		`/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */\n` +
		`const sidebars = ${json};\n` +
		`module.exports = sidebars;\n`
	);
}

/** Add Docusaurus-compatible frontmatter to a doc page. */
function addDocusaurusFrontmatter(page: DocPage): string {
	const title = String(page.frontmatter.title ?? "");
	const description = page.frontmatter.description
		? String(page.frontmatter.description)
		: undefined;
	const sidebarLabel = page.frontmatter.sidebar_label
		? String(page.frontmatter.sidebar_label)
		: title;
	const sidebarPosition = page.frontmatter.sidebar_position;

	const lines = ["---", `title: "${title}"`, `sidebar_label: "${sidebarLabel}"`];
	if (sidebarPosition !== undefined) {
		lines.push(`sidebar_position: ${sidebarPosition}`);
	}
	if (description) {
		lines.push(`description: "${description}"`);
	}
	lines.push("---", "");

	const body = page.content.replace(/^---[\s\S]*?---\n+/, "");
	return lines.join("\n") + body;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Docusaurus SSG adapter.
 * Implements the {@link SSGAdapter} contract for the Docusaurus platform.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("docusaurus");
 * const configs = adapter.generateConfig(context);
 * console.log(configs[0].path); // "sidebars.js"
 * ```
 * @public
 */
export const docusaurusAdapter: SSGAdapter = {
	target: "docusaurus",
	displayName: "Docusaurus",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		// T026 will implement full scaffolding
		return {
			target: "docusaurus",
			files: [],
			dependencies: {},
			devDependencies: {
				"@docusaurus/core": "^3.0.0",
				"@docusaurus/preset-classic": "^3.0.0",
			},
			scripts: {
				"docs:dev": "docusaurus start",
				"docs:build": "docusaurus build",
			},
			instructions: [`Run \`npm run docs:dev\` inside ${context.outDir} to preview your docs`],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		return pages.map((page) => ({
			path: page.path.replace(/\.md$/, ".mdx"),
			content: addDocusaurusFrontmatter(page),
		}));
	},

	generateConfig(context: AdapterContext): GeneratedFile[] {
		return [
			{
				path: "sidebars.js",
				content: buildSidebarsJs(context.pages),
			},
		];
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return (
			existsSync(join(outDir, "sidebars.js")) || existsSync(join(outDir, "docusaurus.config.js"))
		);
	},
};

// Self-register
registerAdapter(docusaurusAdapter);
