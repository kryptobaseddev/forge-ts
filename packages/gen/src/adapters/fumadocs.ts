/**
 * Fumadocs SSG adapter (App Router, content/docs layout).
 *
 * Implements the {@link SSGAdapter} contract for the Fumadocs platform.
 * Generates `meta.json` navigation files, Next.js App Router scaffolding,
 * and Tailwind v4 + fumadocs-ui configuration.
 *
 * @packageDocumentation
 * @public
 */

import { sanitizeForMdx, stringifyWithFrontmatter, stripFrontmatter } from "../markdown-utils.js";
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

/** Convert a slug segment to a human-readable label. */
function slugToLabel(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/** Render a Fumadocs meta.json file from a title and ordered pages array. */
function renderMetaJson(title: string, pages: string[]): string {
	return `${JSON.stringify({ title, pages }, null, 2)}\n`;
}

/**
 * Build all meta.json files for Fumadocs navigation.
 * Generates one meta.json per directory, covering every level of nesting.
 * Paths are relative to outDir (no content/docs prefix — the Fumadocs site
 * references outDir directly via source.config.ts `dir`).
 */
function buildMetaFiles(pages: DocPage[]): GeneratedFile[] {
	// Collect all unique directory paths and their immediate children.
	const dirEntries = new Map<string, Set<string>>();
	const allDirs = new Set<string>();

	for (const page of pages) {
		const slug = pageSlug(page.path);
		const parts = slug.split("/");

		for (let i = 1; i <= parts.length; i++) {
			const dirPath = parts.slice(0, i - 1).join("/");
			const child = parts[i - 1];

			if (!dirEntries.has(dirPath)) {
				dirEntries.set(dirPath, new Set());
			}
			const entries = dirEntries.get(dirPath);
			if (entries) entries.add(child);

			// Track which children are themselves directories
			if (i < parts.length) {
				allDirs.add(parts.slice(0, i).join("/"));
			}
		}
	}

	const sortFn = (a: string, b: string): number => {
		if (a === "index") return -1;
		if (b === "index") return 1;
		return a.localeCompare(b);
	};

	const files: GeneratedFile[] = [];

	for (const [dirPath, children] of dirEntries) {
		// Separate pages from subdirectories for separator grouping
		const pageChildren: string[] = [];
		const subDirChildren: string[] = [];

		for (const child of children) {
			const childPath = dirPath ? `${dirPath}/${child}` : child;
			if (allDirs.has(childPath)) {
				subDirChildren.push(child);
			} else {
				pageChildren.push(child);
			}
		}

		pageChildren.sort(sortFn);
		subDirChildren.sort(sortFn);

		// Build pages array: pages first, then separator + subdirectories
		const pagesArray: string[] = [...pageChildren];
		if (subDirChildren.length > 0 && pageChildren.length > 0) {
			// Add separators before directory groups at the root level
			if (!dirPath) {
				for (const dir of subDirChildren) {
					pagesArray.push(`---${slugToLabel(dir)}---`);
					pagesArray.push(dir);
				}
			} else {
				pagesArray.push(...subDirChildren);
			}
		} else {
			pagesArray.push(...subDirChildren);
		}

		const title = dirPath ? slugToLabel(dirPath.split("/").pop() ?? dirPath) : "Documentation";
		const metaPath = dirPath ? `${dirPath}/meta.json` : "meta.json";

		files.push({
			path: metaPath,
			content: renderMetaJson(title, pagesArray),
		});
	}

	return files;
}

/** Build source.config.ts for Fumadocs MDX. */
function buildSourceConfig(contentDir: string): string {
	return (
		`import { defineDocs, defineConfig } from "fumadocs-mdx/config";\n\n` +
		`export const docs = defineDocs({\n` +
		`  dir: "${contentDir}",\n` +
		`  docs: {\n` +
		`    // Only include .mdx files, ignore other content in the output dir\n` +
		`    files: ["**/*.mdx"],\n` +
		`  },\n` +
		`});\n\n` +
		`export default defineConfig({\n` +
		`  mdxOptions: {\n` +
		`    // Add remark/rehype plugins here\n` +
		`  },\n` +
		`});\n`
	);
}

/** Build next.config.mjs for Fumadocs. */
function buildNextConfig(): string {
	return (
		`import { createMDX } from "fumadocs-mdx/next";\n\n` +
		`const withMDX = createMDX();\n\n` +
		`/** @type {import('next').NextConfig} */\n` +
		`const config = {\n` +
		`  output: "export",\n` +
		`  // Set basePath for GitHub Pages (e.g., "/repo-name")\n` +
		`  // basePath: "/your-repo",\n` +
		`};\n\n` +
		`export default withMDX(config);\n`
	);
}

/** Build the root app/layout.tsx for Fumadocs. */
function buildAppLayout(_context: AdapterContext): string {
	return (
		`import { RootProvider } from "fumadocs-ui/provider/next";\n` +
		`import "./global.css";\n` +
		`import type { ReactNode } from "react";\n\n` +
		`export default function RootLayout({ children }: { children: ReactNode }) {\n` +
		`  return (\n` +
		`    <html lang="en" suppressHydrationWarning>\n` +
		`      <body>\n` +
		`        <RootProvider>{children}</RootProvider>\n` +
		`      </body>\n` +
		`    </html>\n` +
		`  );\n` +
		`}\n`
	);
}

/** Build the docs section layout at src/app/docs/layout.tsx. */
function buildDocsLayout(): string {
	return (
		`import { DocsLayout } from "fumadocs-ui/layouts/docs";\n` +
		`import { source } from "@/lib/source";\n` +
		`import type { ReactNode } from "react";\n\n` +
		`export default function Layout({ children }: { children: ReactNode }) {\n` +
		`  return (\n` +
		`    <DocsLayout tree={source.pageTree}>\n` +
		`      {children}\n` +
		`    </DocsLayout>\n` +
		`  );\n` +
		`}\n`
	);
}

/** Build the catch-all page at src/app/docs/[[...slug]]/page.tsx. */
function buildCatchAllPage(): string {
	return (
		`import { source } from "@/lib/source";\n` +
		`import { notFound } from "next/navigation";\n` +
		`import {\n` +
		`  DocsBody,\n` +
		`  DocsDescription,\n` +
		`  DocsPage,\n` +
		`  DocsTitle,\n` +
		`} from "fumadocs-ui/page";\n` +
		`import defaultMdxComponents from "fumadocs-ui/mdx";\n\n` +
		`export default async function Page(props: {\n` +
		`  params: Promise<{ slug?: string[] }>;\n` +
		`}) {\n` +
		`  const params = await props.params;\n` +
		`  const page = source.getPage(params.slug);\n` +
		`  if (!page) notFound();\n\n` +
		`  const MDX = page.data.body;\n\n` +
		`  return (\n` +
		`    <DocsPage toc={page.data.toc}>\n` +
		`      <DocsTitle>{page.data.title}</DocsTitle>\n` +
		`      <DocsDescription>{page.data.description}</DocsDescription>\n` +
		`      <DocsBody>\n` +
		`        <MDX components={{ ...defaultMdxComponents }} />\n` +
		`      </DocsBody>\n` +
		`    </DocsPage>\n` +
		`  );\n` +
		`}\n\n` +
		`export function generateStaticParams() {\n` +
		`  return source.generateParams();\n` +
		`}\n\n` +
		`export async function generateMetadata(props: {\n` +
		`  params: Promise<{ slug?: string[] }>;\n` +
		`}) {\n` +
		`  const params = await props.params;\n` +
		`  const page = source.getPage(params.slug);\n` +
		`  if (!page) notFound();\n\n` +
		`  return {\n` +
		`    title: page.data.title,\n` +
		`    description: page.data.description,\n` +
		`  };\n` +
		`}\n`
	);
}

/** Build the source loader at src/lib/source.ts. */
function buildSourceLoader(): string {
	return (
		`import { docs } from "../../.source/server";\n` +
		`import { loader } from "fumadocs-core/source";\n\n` +
		`export const source = loader({\n` +
		`  baseUrl: "/docs",\n` +
		`  source: docs.toFumadocsSource(),\n` +
		`});\n`
	);
}

/** Build package.json for the Fumadocs docs app. */
function buildPackageJson(context: AdapterContext): string {
	const pkg = {
		name: `${context.projectName}-docs`,
		version: "0.0.0",
		private: true,
		scripts: {
			"docs:dev": "next dev",
			"docs:build": "next build",
			"docs:serve": "next start",
		},
		dependencies: {
			"fumadocs-core": "^16",
			"fumadocs-mdx": "^14",
			"fumadocs-ui": "^16",
			next: "^16",
			react: "^19",
			"react-dom": "^19",
		},
		devDependencies: {
			"@types/react": "^19",
			typescript: "^5",
			tailwindcss: "^4",
			"@tailwindcss/postcss": "^4",
		},
	};
	return `${JSON.stringify(pkg, null, 2)}\n`;
}

/** Build postcss.config.mjs for Tailwind v4. */
function buildPostcssConfig(): string {
	return (
		`/** @type {import('postcss').Config} */\n` +
		`const config = {\n` +
		`  plugins: {\n` +
		`    "@tailwindcss/postcss": {},\n` +
		`  },\n` +
		`};\n\n` +
		`export default config;\n`
	);
}

/** Build tsconfig.json for the Fumadocs Next.js app. */
function buildTsConfig(): string {
	const tsconfig = {
		compilerOptions: {
			target: "ESNext",
			module: "ESNext",
			moduleResolution: "Bundler",
			jsx: "preserve",
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			paths: {
				"@/*": ["./src/*"],
			},
		},
		include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".source/**/*.ts"],
		exclude: ["node_modules"],
	};
	return `${JSON.stringify(tsconfig, null, 2)}\n`;
}

/** Build src/app/global.css with Tailwind v4 and Fumadocs UI styles. */
function buildGlobalCss(): string {
	return `@import "tailwindcss";\n@import "fumadocs-ui/css/neutral.css";\n@import "fumadocs-ui/css/preset.css";\n`;
}

/** Add Fumadocs-compatible frontmatter and sanitize MDX content. */
function addFumadocsFrontmatter(page: DocPage): string {
	const title = String(page.frontmatter.title ?? "");
	const description = String(page.frontmatter.description ?? "");

	let body = stripFrontmatter(page.content);
	// Sanitize HTML comments and unsafe chars for strict MDX
	body = sanitizeForMdx(body);

	const data: Record<string, string> = {};
	if (title) data.title = title;
	if (description) data.description = description;

	if (Object.keys(data).length === 0) {
		return body;
	}
	return stringifyWithFrontmatter(body, data);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Fumadocs SSG adapter (App Router, content/docs layout).
 * Implements the {@link SSGAdapter} contract for the Fumadocs platform.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("fumadocs");
 * const configs = adapter.generateConfig(context);
 * console.log(configs[0].path); // "content/docs/meta.json"
 * ```
 * @public
 */
export const fumadocsAdapter: SSGAdapter = {
	target: "fumadocs",
	displayName: "Fumadocs",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		// The Fumadocs site scaffold lives in a sibling "site/" directory
		// next to outDir. source.config.ts points back to outDir for content.
		const contentDir = "../generated";
		return {
			target: "fumadocs",
			files: [
				{ path: "../site/source.config.ts", content: buildSourceConfig(contentDir) },
				{ path: "../site/next.config.mjs", content: buildNextConfig() },
				{ path: "../site/package.json", content: buildPackageJson(context) },
				{ path: "../site/tsconfig.json", content: buildTsConfig() },
				{ path: "../site/postcss.config.mjs", content: buildPostcssConfig() },
				{ path: "../site/src/app/layout.tsx", content: buildAppLayout(context) },
				{ path: "../site/src/app/global.css", content: buildGlobalCss() },
				{ path: "../site/src/app/docs/layout.tsx", content: buildDocsLayout() },
				{
					path: "../site/src/app/docs/[[...slug]]/page.tsx",
					content: buildCatchAllPage(),
				},
				{ path: "../site/src/lib/source.ts", content: buildSourceLoader() },
			],
			dependencies: {
				"fumadocs-core": "^16",
				"fumadocs-mdx": "^14",
				"fumadocs-ui": "^16",
				next: "^16",
				react: "^19",
				"react-dom": "^19",
			},
			devDependencies: {
				"@types/react": "^19",
				typescript: "^5",
				tailwindcss: "^4",
				"@tailwindcss/postcss": "^4",
			},
			scripts: {
				"docs:dev": "next dev",
				"docs:build": "next build",
				"docs:serve": "next start",
			},
			instructions: [
				`Run \`pnpm install && pnpm run docs:dev\` inside docs/site to preview your docs`,
			],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		return pages.map((page) => ({
			path: page.path.replace(/\.md$/, ".mdx"),
			content: addFumadocsFrontmatter(page),
			stub: page.stub,
		}));
	},

	generateConfig(context: AdapterContext): GeneratedFile[] {
		return buildMetaFiles(context.pages);
	},

	getDevCommand(outDir: string) {
		return {
			bin: "npx",
			args: ["next", "dev"],
			cwd: `${outDir}/../site`,
			label: "Fumadocs Dev Server (Next.js)",
			url: "http://localhost:3000",
		};
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return (
			existsSync(join(outDir, "../site/source.config.ts")) ||
			existsSync(join(outDir, "../site/next.config.mjs"))
		);
	},
};

// Self-register
registerAdapter(fumadocsAdapter);
