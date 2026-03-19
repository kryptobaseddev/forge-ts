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
	pageExtension: "md",
	supportsMdx: false,
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

/** Convert a slug segment to a human-readable label. */
function slugToLabel(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

interface VitePressItem {
	text: string;
	link: string;
}

interface VitePressGroup {
	text: string;
	items: VitePressItem[];
}

/** Build the sidebar JSON from doc pages. */
function buildSidebar(pages: DocPage[]): VitePressGroup[] {
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

	const sidebar: VitePressGroup[] = [];

	if (topLevel.length > 0) {
		const items: VitePressItem[] = topLevel.map((slug) => {
			const segment = slug.split("/").pop() ?? slug;
			const link = slug === "index" ? "/" : `/${slug}`;
			return { text: slugToLabel(segment), link };
		});
		sidebar.push({ text: "Getting Started", items });
	}

	for (const [pkgName, slugs] of byPackage) {
		const items: VitePressItem[] = slugs.map((slug) => {
			const segment = slug.split("/").pop() ?? slug;
			const isIndex = segment === "index";
			const link = isIndex ? `/packages/${pkgName}/` : `/${slug}`;
			return { text: slugToLabel(segment), link };
		});
		sidebar.push({ text: pkgName, items });
	}

	return sidebar;
}

/** Add VitePress-compatible frontmatter to a doc page. */
function addVitepressFrontmatter(page: DocPage): string {
	const title = String(page.frontmatter.title ?? "");
	const description = page.frontmatter.description
		? String(page.frontmatter.description)
		: undefined;

	const lines = ["---", `title: "${title}"`, "outline: deep"];
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
 * VitePress SSG adapter.
 * Implements the {@link SSGAdapter} contract for the VitePress platform.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("vitepress");
 * const configs = adapter.generateConfig(context);
 * console.log(configs[0].path); // ".vitepress/sidebar.json"
 * ```
 * @public
 */
export const vitepressAdapter: SSGAdapter = {
	target: "vitepress",
	displayName: "VitePress",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		// T026 will implement full scaffolding
		return {
			target: "vitepress",
			files: [],
			dependencies: {},
			devDependencies: {
				vitepress: "^1.0.0",
			},
			scripts: {
				"docs:dev": "vitepress dev",
				"docs:build": "vitepress build",
				"docs:preview": "vitepress preview",
			},
			instructions: [`Run \`npm run docs:dev\` inside ${context.outDir} to preview your docs`],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		// VitePress uses .md (not .mdx)
		return pages.map((page) => ({
			path: page.path.endsWith(".mdx") ? page.path.replace(/\.mdx$/, ".md") : page.path,
			content: addVitepressFrontmatter(page),
		}));
	},

	generateConfig(context: AdapterContext): GeneratedFile[] {
		const sidebar = buildSidebar(context.pages);
		return [
			{
				path: ".vitepress/sidebar.json",
				content: `${JSON.stringify(sidebar, null, 2)}\n`,
			},
		];
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return existsSync(join(outDir, ".vitepress"));
	},
};

// Self-register
registerAdapter(vitepressAdapter);
