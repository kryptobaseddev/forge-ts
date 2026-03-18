import type { DocPage } from "./site-generator.js";

/**
 * A single generated SSG configuration file.
 * @public
 */
export interface SSGConfigFile {
	/** Relative path from outDir (e.g., "mint.json", "_meta.json") */
	path: string;
	/** File content */
	content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the file extension from a page path, returning the slug. */
function pageSlug(pagePath: string): string {
	return pagePath.replace(/\.[^.]+$/, "");
}

/**
 * Partition pages into top-level pages and package pages.
 *
 * Top-level pages are those not nested under `packages/`.
 * Package pages are grouped by their package directory segment.
 */
function partitionPages(pages: DocPage[]): {
	topLevel: string[];
	byPackage: Map<string, string[]>;
} {
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

	return { topLevel, byPackage };
}

/** Convert a slug segment to a human-readable label. */
function slugToLabel(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

// ---------------------------------------------------------------------------
// Mintlify
// ---------------------------------------------------------------------------

interface MintlifyNavigationPage {
	group: string;
	pages: Array<string | MintlifyNavigationPage>;
}

interface MintlifyConfig {
	$schema: string;
	name: string;
	navigation: MintlifyNavigationPage[];
}

function generateMintlifyConfig(pages: DocPage[], projectName: string): SSGConfigFile {
	const { topLevel, byPackage } = partitionPages(pages);

	const navigation: MintlifyNavigationPage[] = [];

	if (topLevel.length > 0) {
		navigation.push({
			group: "Getting Started",
			pages: topLevel,
		});
	}

	if (byPackage.size > 0) {
		const packageGroups: MintlifyNavigationPage[] = [];
		for (const [pkgName, slugs] of byPackage) {
			packageGroups.push({
				group: pkgName,
				pages: slugs,
			});
		}
		navigation.push({
			group: "Packages",
			pages: packageGroups as unknown as Array<string | MintlifyNavigationPage>,
		});
	}

	const config: MintlifyConfig = {
		$schema: "https://mintlify.com/schema.json",
		name: projectName,
		navigation,
	};

	return {
		path: "mint.json",
		content: `${JSON.stringify(config, null, 2)}\n`,
	};
}

// ---------------------------------------------------------------------------
// Docusaurus
// ---------------------------------------------------------------------------

interface DocusaurusCategory {
	type: "category";
	label: string;
	items: Array<string | DocusaurusCategory>;
}

type DocusaurusSidebarItem = string | DocusaurusCategory;

function generateDocusaurusConfig(pages: DocPage[], _projectName: string): SSGConfigFile {
	const { topLevel, byPackage } = partitionPages(pages);

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
	const content =
		`/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */\n` +
		`const sidebars = ${json};\n` +
		`module.exports = sidebars;\n`;

	return {
		path: "sidebars.js",
		content,
	};
}

// ---------------------------------------------------------------------------
// Nextra
// ---------------------------------------------------------------------------

function generateNextraConfigs(pages: DocPage[], _projectName: string): SSGConfigFile[] {
	const { topLevel, byPackage } = partitionPages(pages);
	const files: SSGConfigFile[] = [];

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

	// Per-package _meta.json files
	for (const [pkgName, slugs] of byPackage) {
		const pkgMeta: Record<string, string> = {};
		for (const slug of slugs) {
			// slug is e.g. "packages/core/api-reference"
			const segment = slug.split("/").pop() ?? slug;
			pkgMeta[segment] = slugToLabel(segment);
		}

		// packages/<pkgName>/_meta.json
		files.push({
			path: `packages/${pkgName}/_meta.json`,
			content: `${JSON.stringify(pkgMeta, null, 2)}\n`,
		});
	}

	// If there are multiple packages, also write a packages/_meta.json
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

// ---------------------------------------------------------------------------
// VitePress
// ---------------------------------------------------------------------------

interface VitePressItem {
	text: string;
	link: string;
}

interface VitePressGroup {
	text: string;
	items: VitePressItem[];
}

function generateVitePressConfig(pages: DocPage[], _projectName: string): SSGConfigFile {
	const { topLevel, byPackage } = partitionPages(pages);
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

	return {
		path: ".vitepress/sidebar.json",
		content: `${JSON.stringify(sidebar, null, 2)}\n`,
	};
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Generate navigation configuration file(s) for the given SSG target.
 *
 * Returns one file for most targets, but multiple files for Nextra (which
 * uses per-directory `_meta.json` files).
 *
 * @param pages - The {@link DocPage} array produced by `generateDocSite`.
 * @param target - The SSG target.
 * @param projectName - The project name (used in config metadata).
 * @returns An array of {@link SSGConfigFile} objects ready to be written to disk.
 * @public
 */
export function generateSSGConfigs(
	pages: DocPage[],
	target: "docusaurus" | "mintlify" | "nextra" | "vitepress",
	projectName: string,
): SSGConfigFile[] {
	switch (target) {
		case "mintlify":
			return [generateMintlifyConfig(pages, projectName)];
		case "docusaurus":
			return [generateDocusaurusConfig(pages, projectName)];
		case "nextra":
			return generateNextraConfigs(pages, projectName);
		case "vitepress":
			return [generateVitePressConfig(pages, projectName)];
		default: {
			// Exhaustiveness guard — TypeScript will catch unhandled variants at
			// compile time, but we want a safe runtime fallback too.
			const _exhaustive: never = target;
			void _exhaustive;
			return [];
		}
	}
}
