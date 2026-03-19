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

/** Build the sidebars.ts content from doc pages. */
function buildSidebarsTs(pages: DocPage[]): string {
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
		`import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";\n\n` +
		`const sidebars: SidebarsConfig = ${json};\n\n` +
		`export default sidebars;\n`
	);
}

/** Build the docusaurus.config.ts content. */
function buildDocusaurusConfig(context: AdapterContext): string {
	const { projectName, projectDescription } = context;
	const description = projectDescription ?? `${projectName} documentation`;

	return (
		`import { themes as prismThemes } from "prism-react-renderer";\n` +
		`import type { Config } from "@docusaurus/types";\n` +
		`import type * as Preset from "@docusaurus/preset-classic";\n\n` +
		`const config: Config = {\n` +
		`  title: "${projectName}",\n` +
		`  tagline: "${description}",\n` +
		`  url: "https://your-domain.com",\n` +
		`  baseUrl: "/",\n` +
		`  onBrokenLinks: "throw",\n` +
		`  onBrokenMarkdownLinks: "warn",\n` +
		`  i18n: {\n` +
		`    defaultLocale: "en",\n` +
		`    locales: ["en"],\n` +
		`  },\n` +
		`  presets: [\n` +
		`    [\n` +
		`      "classic",\n` +
		`      {\n` +
		`        docs: {\n` +
		`          routeBasePath: "/",\n` +
		`          sidebarPath: "./sidebars.ts",\n` +
		`        },\n` +
		`        blog: false,\n` +
		`      } satisfies Preset.Options,\n` +
		`    ],\n` +
		`  ],\n` +
		`  themeConfig: {\n` +
		`    prism: {\n` +
		`      theme: prismThemes.github,\n` +
		`      darkTheme: prismThemes.dracula,\n` +
		`    },\n` +
		`  } satisfies Preset.ThemeConfig,\n` +
		`} satisfies Config;\n\n` +
		`export default config;\n`
	);
}

/** Build the package.json content for a Docusaurus site. */
function buildPackageJson(context: AdapterContext): string {
	const pkg = {
		name: `${context.projectName}-docs`,
		version: "0.0.0",
		private: true,
		scripts: {
			"docs:dev": "docusaurus start",
			"docs:build": "docusaurus build",
			"docs:serve": "docusaurus serve",
		},
		dependencies: {
			"@docusaurus/core": "^3.9.2",
			"@docusaurus/preset-classic": "^3.9.2",
			"@mdx-js/react": "^3.0.0",
			react: "^19.0.0",
			"react-dom": "^19.0.0",
			"prism-react-renderer": "^2.3.0",
		},
		devDependencies: {
			"@docusaurus/tsconfig": "^3.9.2",
			"@docusaurus/types": "^3.9.2",
		},
	};
	return `${JSON.stringify(pkg, null, 2)}\n`;
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
 * console.log(configs[0].path); // "sidebars.ts"
 * ```
 * @public
 */
export const docusaurusAdapter: SSGAdapter = {
	target: "docusaurus",
	displayName: "Docusaurus",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		return {
			target: "docusaurus",
			files: [
				{ path: "docusaurus.config.ts", content: buildDocusaurusConfig(context) },
				{ path: "sidebars.ts", content: buildSidebarsTs(context.pages) },
				{ path: "package.json", content: buildPackageJson(context) },
				{ path: "tsconfig.json", content: '{ "extends": "@docusaurus/tsconfig" }\n' },
			],
			dependencies: {
				"@docusaurus/core": "^3.9.2",
				"@docusaurus/preset-classic": "^3.9.2",
				"@mdx-js/react": "^3.0.0",
				react: "^19.0.0",
				"react-dom": "^19.0.0",
				"prism-react-renderer": "^2.3.0",
			},
			devDependencies: {
				"@docusaurus/tsconfig": "^3.9.2",
				"@docusaurus/types": "^3.9.2",
			},
			scripts: {
				"docs:dev": "docusaurus start",
				"docs:build": "docusaurus build",
				"docs:serve": "docusaurus serve",
			},
			instructions: [`Run \`npm run docs:dev\` inside ${context.outDir} to preview your docs`],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		return pages.map((page) => ({
			path: page.path.replace(/\.md$/, ".mdx"),
			content: addDocusaurusFrontmatter(page),
			stub: page.stub,
		}));
	},

	generateConfig(context: AdapterContext): GeneratedFile[] {
		return [
			{
				path: "sidebars.ts",
				content: buildSidebarsTs(context.pages),
			},
		];
	},

	getDevCommand(outDir: string) {
		return {
			bin: "npx",
			args: ["docusaurus", "start"],
			cwd: outDir,
			label: "Docusaurus Dev Server",
			url: "http://localhost:3000",
		};
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return (
			existsSync(join(outDir, "sidebars.ts")) ||
			existsSync(join(outDir, "docusaurus.config.ts")) ||
			existsSync(join(outDir, "docusaurus.config.js"))
		);
	},
};

// Self-register
registerAdapter(docusaurusAdapter);
