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
	requiresFrontmatter: false,
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

/** Build all _meta.json files for the Nextra navigation. */
function buildMetaFiles(pages: DocPage[]): GeneratedFile[] {
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

	const files: GeneratedFile[] = [];

	// Root _meta.json
	const rootMeta: Record<string, string> = {};
	for (const slug of topLevel) {
		const segment = slug.split("/").pop() ?? slug;
		rootMeta[segment] = slugToLabel(segment);
	}
	if (byPackage.size > 0) {
		rootMeta.packages = "Packages";
	}
	files.push({
		path: "_meta.json",
		content: `${JSON.stringify(rootMeta, null, 2)}\n`,
	});

	// Per-package _meta.json
	for (const [pkgName, slugs] of byPackage) {
		const pkgMeta: Record<string, string> = {};
		for (const slug of slugs) {
			const segment = slug.split("/").pop() ?? slug;
			pkgMeta[segment] = slugToLabel(segment);
		}
		files.push({
			path: `packages/${pkgName}/_meta.json`,
			content: `${JSON.stringify(pkgMeta, null, 2)}\n`,
		});
	}

	// packages/_meta.json when there are multiple packages
	if (byPackage.size > 1) {
		const packagesMeta: Record<string, string> = {};
		for (const pkgName of byPackage.keys()) {
			packagesMeta[pkgName] = pkgName;
		}
		files.push({
			path: "packages/_meta.json",
			content: `${JSON.stringify(packagesMeta, null, 2)}\n`,
		});
	}

	return files;
}

/** Add Nextra-compatible frontmatter to a doc page (title only — description optional). */
function addNextraFrontmatter(page: DocPage): string {
	const title = String(page.frontmatter.title ?? "");
	if (!title) {
		return page.content;
	}

	const lines = ["---", `title: "${title}"`, "---", ""];
	const body = page.content.replace(/^---[\s\S]*?---\n+/, "");
	return lines.join("\n") + body;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Nextra SSG adapter.
 * Implements the {@link SSGAdapter} contract for the Nextra platform.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("nextra");
 * const configs = adapter.generateConfig(context);
 * console.log(configs[0].path); // "_meta.json"
 * ```
 * @public
 */
export const nextraAdapter: SSGAdapter = {
	target: "nextra",
	displayName: "Nextra",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		// T026 will implement full scaffolding
		return {
			target: "nextra",
			files: [],
			dependencies: {},
			devDependencies: {
				nextra: "^3.0.0",
				"nextra-theme-docs": "^3.0.0",
				next: "^14.0.0",
			},
			scripts: {
				"docs:dev": "next dev",
				"docs:build": "next build",
			},
			instructions: [`Run \`npm run docs:dev\` inside ${context.outDir} to preview your docs`],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		return pages.map((page) => ({
			path: page.path.replace(/\.md$/, ".mdx"),
			content: addNextraFrontmatter(page),
		}));
	},

	generateConfig(context: AdapterContext): GeneratedFile[] {
		return buildMetaFiles(context.pages);
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return existsSync(join(outDir, "_meta.json")) || existsSync(join(outDir, "next.config.js"));
	},
};

// Self-register
registerAdapter(nextraAdapter);
