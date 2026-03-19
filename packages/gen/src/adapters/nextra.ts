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

/**
 * Render a plain object as a JS module export.
 * Values are always strings so we can use JSON.stringify on the object
 * and then replace the surrounding braces with a default export statement.
 */
function renderMetaJs(meta: Record<string, string>): string {
	const json = JSON.stringify(meta, null, 2);
	return `export default ${json};\n`;
}

/** Build all _meta.js files for the Nextra v4 navigation. */
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

	// Root _meta.js (content/ directory in Nextra v4)
	const rootMeta: Record<string, string> = {};
	for (const slug of topLevel) {
		const segment = slug.split("/").pop() ?? slug;
		rootMeta[segment] = slugToLabel(segment);
	}
	if (byPackage.size > 0) {
		rootMeta.packages = "Packages";
	}
	files.push({
		path: "content/_meta.js",
		content: renderMetaJs(rootMeta),
	});

	// Per-package _meta.js
	for (const [pkgName, slugs] of byPackage) {
		const pkgMeta: Record<string, string> = {};
		for (const slug of slugs) {
			const segment = slug.split("/").pop() ?? slug;
			pkgMeta[segment] = slugToLabel(segment);
		}
		files.push({
			path: `content/packages/${pkgName}/_meta.js`,
			content: renderMetaJs(pkgMeta),
		});
	}

	// content/packages/_meta.js when there are multiple packages
	if (byPackage.size > 1) {
		const packagesMeta: Record<string, string> = {};
		for (const pkgName of byPackage.keys()) {
			packagesMeta[pkgName] = pkgName;
		}
		files.push({
			path: "content/packages/_meta.js",
			content: renderMetaJs(packagesMeta),
		});
	}

	return files;
}

/** Build the app/layout.tsx content for Nextra v4. */
function buildAppLayout(context: AdapterContext): string {
	const { projectName } = context;
	return (
		`import { Layout } from "nextra-theme-docs";\n` +
		`import { Head } from "nextra/components";\n` +
		`import { getPageMap } from "nextra/page-map";\n` +
		`import type { ReactNode } from "react";\n\n` +
		`export const metadata = {\n` +
		`  title: {\n` +
		`    template: \`%s – ${projectName}\`,\n` +
		`  },\n` +
		`};\n\n` +
		`export default async function RootLayout({ children }: { children: ReactNode }) {\n` +
		`  const pageMap = await getPageMap();\n` +
		`  return (\n` +
		`    <html lang="en" suppressHydrationWarning>\n` +
		`      <Head />\n` +
		`      <body>\n` +
		`        <Layout pageMap={pageMap} docsRepositoryBase="">\n` +
		`          {children}\n` +
		`        </Layout>\n` +
		`      </body>\n` +
		`    </html>\n` +
		`  );\n` +
		`}\n`
	);
}

/** Build the app/[[...mdxPath]]/page.tsx content for Nextra v4. */
function buildCatchAllPage(): string {
	return (
		`import { generateStaticParamsFor, importPage } from "nextra/pages";\n\n` +
		`export const generateStaticParams = generateStaticParamsFor("mdxPath");\n\n` +
		`export async function generateMetadata(props: {\n` +
		`  params: Promise<Record<string, string[]>>;\n` +
		`}) {\n` +
		`  const params = await props.params;\n` +
		`  const { metadata } = await importPage(params.mdxPath);\n` +
		`  return metadata;\n` +
		`}\n\n` +
		`const Wrapper = importPage;\n` +
		`export default async function Page(props: {\n` +
		`  params: Promise<Record<string, string[]>>;\n` +
		`}) {\n` +
		`  const params = await props.params;\n` +
		`  const result = await importPage(params.mdxPath);\n` +
		`  const { default: MDXContent } = result;\n` +
		`  return <MDXContent {...props} params={params} />;\n` +
		`}\n`
	);
}

/** Build mdx-components.ts for Nextra v4. */
function buildMdxComponents(): string {
	return (
		`import { useMDXComponents as getNextraComponents } from "nextra-theme-docs";\n\n` +
		`export function useMDXComponents(components: Record<string, unknown>) {\n` +
		`  return getNextraComponents(components);\n` +
		`}\n`
	);
}

/** Build next.config.ts for Nextra v4. */
function buildNextConfig(): string {
	return (
		`import nextra from "nextra";\n\n` +
		`const withNextra = nextra({\n` +
		`  contentDirBasePath: "/",\n` +
		`});\n\n` +
		`export default withNextra({\n` +
		`  output: "export",\n` +
		`  images: { unoptimized: true },\n` +
		`});\n`
	);
}

/** Build package.json for Nextra v4. */
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
			next: "^15",
			nextra: "^4",
			"nextra-theme-docs": "^4",
			react: "^19",
			"react-dom": "^19",
		},
	};
	return `${JSON.stringify(pkg, null, 2)}\n`;
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
 * Nextra SSG adapter (v4, App Router).
 * Implements the {@link SSGAdapter} contract for the Nextra platform.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("nextra");
 * const configs = adapter.generateConfig(context);
 * console.log(configs[0].path); // "content/_meta.js"
 * ```
 * @public
 */
export const nextraAdapter: SSGAdapter = {
	target: "nextra",
	displayName: "Nextra",
	styleGuide,

	scaffold(context: AdapterContext): ScaffoldManifest {
		const metaFiles = buildMetaFiles(context.pages);
		return {
			target: "nextra",
			files: [
				{ path: "next.config.ts", content: buildNextConfig() },
				{ path: "package.json", content: buildPackageJson(context) },
				{ path: "mdx-components.ts", content: buildMdxComponents() },
				{ path: "app/layout.tsx", content: buildAppLayout(context) },
				{ path: "app/[[...mdxPath]]/page.tsx", content: buildCatchAllPage() },
				...metaFiles,
			],
			dependencies: {
				next: "^15",
				nextra: "^4",
				"nextra-theme-docs": "^4",
				react: "^19",
				"react-dom": "^19",
			},
			devDependencies: {},
			scripts: {
				"docs:dev": "next dev",
				"docs:build": "next build",
				"docs:serve": "next start",
			},
			instructions: [`Run \`npm run docs:dev\` inside ${context.outDir} to preview your docs`],
		};
	},

	transformPages(pages: DocPage[], _context: AdapterContext): GeneratedFile[] {
		return pages.map((page) => ({
			path: page.path.replace(/\.md$/, ".mdx"),
			content: addNextraFrontmatter(page),
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
			cwd: outDir,
			label: "Nextra Dev Server (Next.js)",
			url: "http://localhost:3000",
		};
	},

	async detectExisting(outDir: string): Promise<boolean> {
		const { existsSync } = await import("node:fs");
		const { join } = await import("node:path");
		return (
			existsSync(join(outDir, "content/_meta.js")) ||
			existsSync(join(outDir, "next.config.ts")) ||
			existsSync(join(outDir, "next.config.js"))
		);
	},
};

// Self-register
registerAdapter(nextraAdapter);
