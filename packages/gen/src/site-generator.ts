import { basename, relative } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { type DiscoveredGuide, discoverGuides } from "./guide-discovery.js";
import { parseBlocks, parseInline, stringifyWithFrontmatter } from "./markdown-utils.js";
import {
	type MdBlock,
	type MdListItem,
	type MdPhrasing,
	type MdTableRow,
	md,
	serializeMarkdown,
	slugLink,
	textListItem,
	textP,
	toAnchor,
	truncate,
} from "./mdast-builders.js";

/**
 * A single generated documentation page.
 * @public
 */
export interface DocPage {
	/** Relative path from outDir (e.g., "packages/core/index.md") */
	path: string;
	/** Page content (Markdown or MDX) */
	content: string;
	/** Frontmatter fields */
	frontmatter: Record<string, string | number | boolean>;
	/**
	 * When true, this page is scaffolding intended for human/agent editing.
	 * Stub pages are created only on the first build and never overwritten,
	 * preserving manual edits across subsequent `forge-ts build` runs.
	 * Auto-generated pages (stub=false) are always regenerated from source.
	 * @defaultValue false
	 */
	stub?: boolean;
}

/**
 * Options controlling the doc site generator.
 * @public
 */
export interface SiteGeneratorOptions {
	/** Output format */
	format: "markdown" | "mdx";
	/**
	 * SSG target for frontmatter.
	 * @defaultValue undefined
	 */
	ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress" | "fumadocs";
	/** Project name */
	projectName: string;
	/**
	 * Project description.
	 * @defaultValue undefined
	 */
	projectDescription?: string;
	/**
	 * Repository URL (auto-detected from package.json).
	 * @defaultValue undefined
	 */
	repositoryUrl?: string;
	/**
	 * npm package name for install commands.
	 * @defaultValue undefined
	 */
	packageName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape MDX-unsafe characters in text that appears outside code fences.
 *
 * MDX parses `<Word>` as JSX tags and `{expr}` as JS expressions.
 * In documentation content (summaries, descriptions, table cells), these
 * come from TypeScript generics (`Array<string>`) and TSDoc inline tags
 * (`{@link Foo}`). We escape them so MDX treats them as literal text.
 *
 * This is exported so SSG adapters can apply it during page transformation.
 *
 * @remarks
 * Replaces `{`, `}`, `<`, and `>` with backslash-escaped or HTML-entity equivalents.
 * Only angle brackets adjacent to word characters are escaped to avoid over-escaping.
 *
 * @param text - Raw text that may contain MDX-unsafe characters.
 * @returns The input string with `{`, `}`, `<`, and `>` escaped for safe MDX rendering.
 * @example
 * ```typescript
 * const safe = escapeMdx("Array<string>");
 * console.log(safe); // "Array&lt;string&gt;"
 * ```
 * @public
 */
export function escapeMdx(text: string): string {
	return (
		text
			// Escape { and } — prevents MDX expression parsing of {@link}, {Type}, etc.
			.replace(/\{/g, "\\{")
			.replace(/\}/g, "\\}")
			// Escape < and > that look like JSX tags — prevents MDX tag parsing
			// of Array<string>, Record<K, V>, Promise<void>, etc.
			// Only escape angle brackets that are followed by word chars (tag-like).
			.replace(/<(\w)/g, "&lt;$1")
			.replace(/(\w)>/g, "$1&gt;")
	);
}

/** Build a frontmatter block string from the fields map using gray-matter. */
function serializeFrontmatter(fields: Record<string, string | number | boolean>): string {
	if (Object.keys(fields).length === 0) return "";
	// stringifyWithFrontmatter produces `---\ndata\n---\n\nbody` — we only need the frontmatter prefix
	return stringifyWithFrontmatter("", fields);
}

/**
 * Build frontmatter fields for the given SSG target.
 * @internal
 */
function buildFrontmatterFields(
	title: string,
	description: string,
	ssgTarget: SiteGeneratorOptions["ssgTarget"],
	sidebarPosition?: number,
): Record<string, string | number | boolean> {
	if (!ssgTarget) return {};

	switch (ssgTarget) {
		case "docusaurus": {
			const fields: Record<string, string | number | boolean> = {
				title,
				sidebar_label: title,
			};
			if (sidebarPosition !== undefined) {
				fields.sidebar_position = sidebarPosition;
			}
			if (description) {
				fields.description = description;
			}
			return fields;
		}
		case "mintlify": {
			const fields: Record<string, string | number | boolean> = { title };
			if (description) {
				fields.description = description;
			}
			return fields;
		}
		case "nextra":
			return { title };
		case "vitepress": {
			const fields: Record<string, string | number | boolean> = { title, outline: "deep" };
			if (description) {
				fields.description = description;
			}
			return fields;
		}
		case "fumadocs": {
			const fields: Record<string, string | number | boolean> = { title };
			if (description) {
				fields.description = description;
			}
			return fields;
		}
		default:
			return {};
	}
}

// ---------------------------------------------------------------------------
// Package grouping
// ---------------------------------------------------------------------------

/**
 * Groups symbols by their package based on file path.
 *
 * For monorepos (symbols under `packages/<name>/`) the package name is
 * derived from the directory segment immediately after `packages/`.
 * For non-monorepo projects all symbols fall under the project name.
 *
 * @remarks
 * Uses relative path analysis to detect monorepo `packages/<name>/` structure.
 * Root-level config and test files are excluded from the result.
 *
 * @param symbols - All extracted symbols.
 * @param rootDir - Absolute path to the project root.
 * @returns A map from package name to symbol list.
 * @example
 * ```typescript
 * import { groupSymbolsByPackage } from "@forge-ts/gen";
 * const grouped = groupSymbolsByPackage(symbols, "/path/to/project");
 * console.log(grouped.has("core")); // true for monorepo
 * ```
 * @public
 */
export function groupSymbolsByPackage(
	symbols: ForgeSymbol[],
	rootDir: string,
): Map<string, ForgeSymbol[]> {
	const result = new Map<string, ForgeSymbol[]>();

	for (const symbol of symbols) {
		const rel = relative(rootDir, symbol.filePath);
		// Skip root-level config/test files that aren't part of any package
		if (!rel.startsWith("packages") && !rel.startsWith("src")) continue;
		// Detect monorepo structure: packages/<name>/...
		const monorepoMatch = /^packages[\\/]([^\\/]+)[\\/]/.exec(rel);
		const packageName = monorepoMatch ? monorepoMatch[1] : basename(rootDir);

		const list = result.get(packageName) ?? [];
		list.push(symbol);
		result.set(packageName, list);
	}

	return result;
}

// ---------------------------------------------------------------------------
// Symbol kind sets
// ---------------------------------------------------------------------------

const TYPE_KINDS: ReadonlySet<ForgeSymbol["kind"]> = new Set(["interface", "type", "enum"]);

const FUNCTION_KINDS: ReadonlySet<ForgeSymbol["kind"]> = new Set(["function", "class"]);

// ---------------------------------------------------------------------------
// ORIENT: Landing page (index)
// ---------------------------------------------------------------------------

/**
 * Render the root landing page following the 5-stage information architecture.
 *
 * Structure: intro sentence, Features, Installation, Quick Example, Packages table, Next Steps.
 * @internal
 */
function renderProjectIndexPage(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	options: SiteGeneratorOptions,
): string {
	const nodes: MdBlock[] = [];

	// Intro — no h1, frontmatter title handles the heading
	if (options.projectDescription) {
		nodes.push(
			md.paragraph(
				md.strong(md.text(options.projectName)),
				md.text(` — ${options.projectDescription}`),
			),
		);
	} else {
		nodes.push(
			md.paragraph(
				md.strong(md.text(options.projectName)),
				md.text(
					" is a TypeScript documentation toolkit that performs a single AST traversal of your project and produces API docs, OpenAPI specs, executable doctests, and AI context files in one pass.",
				),
			),
		);
	}

	// Features section
	nodes.push(md.heading(2, md.text("Features")));

	const pkgCount = symbolsByPackage.size;
	const featureItems: MdListItem[] = [];
	if (pkgCount > 1) {
		featureItems.push(textListItem(`${pkgCount} packages with full TypeScript support`));
	} else {
		featureItems.push(textListItem("Full TypeScript support with TSDoc extraction"));
	}
	featureItems.push(textListItem("Auto-generated API reference from source code"));
	featureItems.push(
		md.listItem(
			md.paragraph(
				md.text("Executable "),
				md.inlineCode("@example"),
				md.text(" blocks as doctests"),
			),
		),
	);
	featureItems.push(textListItem("AI-ready context files from a single build pass"));
	nodes.push(md.list(featureItems));

	// Installation section
	nodes.push(md.heading(2, md.text("Installation")));
	nodes.push(md.code("bash", `npm install -D ${options.packageName ?? "@forge-ts/cli"}`));

	// Quick Example — prefer entry-point functions from index.ts files,
	// then fall back to any exported function with an @example.
	let firstExample: { code: string; language: string } | undefined;
	// Pass 1: entry-point functions (from index.ts)
	outer1: for (const [, symbols] of symbolsByPackage) {
		for (const s of symbols) {
			if (!s.exported || s.kind !== "function") continue;
			if (!s.filePath.endsWith("index.ts")) continue;
			const ex = s.documentation?.examples?.[0];
			if (ex) {
				firstExample = ex;
				break outer1;
			}
		}
	}
	// Pass 2: any exported function
	if (!firstExample) {
		outer2: for (const [, symbols] of symbolsByPackage) {
			for (const s of symbols) {
				if (!s.exported || s.kind !== "function") continue;
				const ex = s.documentation?.examples?.[0];
				if (ex) {
					firstExample = ex;
					break outer2;
				}
			}
		}
	}

	if (firstExample) {
		nodes.push(md.heading(2, md.text("Quick Example")));
		nodes.push(md.code(firstExample.language || "typescript", firstExample.code.trim()));
	}

	// Packages table
	if (symbolsByPackage.size > 0) {
		nodes.push(md.heading(2, md.text("Packages")));

		const headerRow = md.tableRow(
			md.tableCell(md.text("Package")),
			md.tableCell(md.text("Description")),
		);
		const dataRows: MdTableRow[] = [];
		for (const [pkgName, symbols] of symbolsByPackage) {
			// Prefer the summary from the index.ts file-level symbol (@packageDocumentation)
			const indexFile = symbols.find(
				(s) => s.kind === "file" && s.filePath.endsWith("index.ts") && s.documentation?.summary,
			);
			const pkgDoc = indexFile?.documentation?.summary;
			const exported = symbols.filter(
				(s) => s.exported && s.kind !== "method" && s.kind !== "property",
			);
			const rawDesc = pkgDoc ?? `${exported.length} exported symbol(s).`;
			const desc = truncate(rawDesc);
			dataRows.push(
				md.tableRow(
					md.tableCell(md.link(slugLink(`packages/${pkgName}/index`), md.inlineCode(pkgName))),
					md.tableCell(md.text(desc)),
				),
			);
		}
		nodes.push(md.table(null, headerRow, ...dataRows));
	}

	// Next Steps
	nodes.push(md.heading(2, md.text("Next Steps")));
	nodes.push(
		md.list([
			md.listItem(
				md.paragraph(
					md.link("/getting-started", md.text("Getting Started")),
					md.text(" — Step-by-step guide"),
				),
			),
			md.listItem(
				md.paragraph(
					md.link("/packages", md.text("API Reference")),
					md.text(" — Full API documentation"),
				),
			),
			md.listItem(
				md.paragraph(md.link("/concepts", md.text("Concepts")), md.text(" — How it works")),
			),
		]),
	);

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// ORIENT: Getting Started (tutorial)
// ---------------------------------------------------------------------------

/**
 * Render a step-by-step getting started tutorial page.
 * @internal
 */
function renderGettingStartedPage(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	options: SiteGeneratorOptions,
): string {
	// Find the first exported function with an example — prefer index.ts entry points
	let firstExample: { code: string; language: string } | undefined;

	for (const [, symbols] of symbolsByPackage) {
		for (const s of symbols) {
			if (!s.exported || s.kind !== "function") continue;
			if (!s.filePath.endsWith("index.ts")) continue;
			const ex = s.documentation?.examples?.[0];
			if (ex) {
				firstExample = ex;
				break;
			}
		}
		if (firstExample) break;
	}
	if (!firstExample) {
		for (const [, symbols] of symbolsByPackage) {
			for (const s of symbols) {
				if (!s.exported || s.kind !== "function") continue;
				const ex = s.documentation?.examples?.[0];
				if (ex) {
					firstExample = ex;
					break;
				}
			}
			if (firstExample) break;
		}
	}

	const nodes: MdBlock[] = [];

	// No h1 — frontmatter title handles the heading
	nodes.push(
		md.paragraph(
			md.text("Get up and running with "),
			md.strong(md.text(options.projectName)),
			md.text(" in minutes."),
		),
	);

	if (options.projectDescription) {
		nodes.push(md.paragraph(...parseInline(options.projectDescription)));
	}

	// Step 1: Install
	nodes.push(md.heading(2, md.text("Step 1: Install")));
	nodes.push(
		md.paragraph(
			md.text("Install the "),
			md.inlineCode(options.packageName ?? "@forge-ts/cli"),
			md.text(" package using your preferred package manager:"),
		),
	);
	nodes.push(md.code("bash", `npm install -D ${options.packageName ?? "@forge-ts/cli"}`));
	nodes.push(textP("Or with pnpm:"));
	nodes.push(md.code("bash", `pnpm add -D ${options.packageName ?? "@forge-ts/cli"}`));

	// Step 2: Configure
	nodes.push(md.heading(2, md.text("Step 2: Configure")));
	nodes.push(
		md.paragraph(
			md.text("Create a "),
			md.inlineCode("forge-ts.config.ts"),
			md.text(" file in your project root:"),
		),
	);
	nodes.push(
		md.code(
			"typescript",
			[
				'import { defineConfig } from "@forge-ts/core";',
				"",
				"export default defineConfig({",
				'  rootDir: ".",',
				'  outDir: "docs/generated",',
				'  gen: { enabled: true, formats: ["markdown"] },',
				"});",
			].join("\n"),
		),
	);

	// Step 3: Write TSDoc
	nodes.push(md.heading(2, md.text("Step 3: Write TSDoc")));
	nodes.push(
		textP(
			"Add TSDoc comments to your exported functions and types. Good TSDoc includes a summary, @param tags, @returns, @example blocks, and a visibility tag:",
		),
	);
	nodes.push(
		md.code(
			"typescript",
			[
				"/**",
				" * Adds two numbers together.",
				" *",
				" * @param a - The first operand.",
				" * @param b - The second operand.",
				" * @returns The sum of a and b.",
				" * @example",
				" * ```typescript",
				" * add(1, 2); // => 3",
				" * ```",
				" * @public",
				" */",
				"export function add(a: number, b: number): number {",
				"  return a + b;",
				"}",
			].join("\n"),
		),
	);

	// Step 4: Generate docs
	nodes.push(md.heading(2, md.text("Step 4: Generate docs")));
	nodes.push(textP("Run forge-ts check to validate TSDoc coverage, then build your docs:"));
	nodes.push(md.code("bash", "npx forge-ts check"));
	nodes.push(textP("Then build the documentation site:"));
	nodes.push(md.code("bash", "npx forge-ts build"));

	if (firstExample) {
		nodes.push(textP("Your code examples become live documentation:"));
		nodes.push(md.code(firstExample.language || "typescript", firstExample.code.trim()));
	}

	// CLI Commands quick reference
	nodes.push(md.heading(2, md.text("CLI Commands")));
	nodes.push(textP("Quick reference for all forge-ts CLI commands:"));
	const cliHeaderRow = md.tableRow(
		md.tableCell(md.text("Command")),
		md.tableCell(md.text("Description")),
	);
	const cliRows: MdTableRow[] = [
		md.tableRow(
			md.tableCell(md.inlineCode("forge-ts check")),
			md.tableCell(md.text("Lint TSDoc coverage and report rule violations")),
		),
		md.tableRow(
			md.tableCell(md.inlineCode("forge-ts build")),
			md.tableCell(md.text("Generate documentation from source code")),
		),
		md.tableRow(
			md.tableCell(md.inlineCode("forge-ts docs init --target fumadocs")),
			md.tableCell(md.text("Scaffold a documentation site for an SSG target")),
		),
		md.tableRow(
			md.tableCell(md.inlineCode("forge-ts docs dev")),
			md.tableCell(md.text("Preview the generated documentation site locally")),
		),
		md.tableRow(
			md.tableCell(md.inlineCode("forge-ts test")),
			md.tableCell(md.text("Run @example blocks as executable doctests")),
		),
	];
	nodes.push(md.table(null, cliHeaderRow, ...cliRows));

	nodes.push(md.heading(2, md.text("What's Next?")));
	nodes.push(
		md.list([
			md.listItem(
				md.paragraph(
					md.link("/concepts", md.text("Concepts")),
					md.text(" — Understand how forge-ts works"),
				),
			),
			md.listItem(
				md.paragraph(
					md.link("/packages", md.text("API Reference")),
					md.text(" — Full API documentation"),
				),
			),
			md.listItem(
				md.paragraph(md.link("/guides", md.text("Guides")), md.text(" — Practical how-to guides")),
			),
		]),
	);

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// LEARN: Concepts (stub)
// ---------------------------------------------------------------------------

/**
 * Render the concepts stub page with key abstractions from package docs.
 * @internal
 */
function renderConceptsPage(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	options: SiteGeneratorOptions,
): string {
	const nodes: MdBlock[] = [];

	nodes.push(
		md.paragraph(
			md.text("This page explains the core concepts behind "),
			md.strong(md.text(options.projectName)),
			md.text("."),
		),
	);
	nodes.push(
		md.blockquote(
			textP("This is a stub page. Edit this file to add your project's conceptual documentation."),
			textP("Auto-generated sections below (inside FORGE:AUTO markers) update on every build."),
		),
	);

	// Auto-enriched section: How It Works — regenerated even in existing stubs
	const pkgDoc = [...symbolsByPackage.values()]
		.flatMap((syms) => syms.map((s) => s.documentation?.tags?.packageDocumentation?.[0]))
		.find(Boolean);

	nodes.push(md.html("<!-- FORGE:AUTO-START how-it-works -->"));
	nodes.push(md.heading(2, md.text("How It Works")));
	if (pkgDoc) {
		nodes.push(md.paragraph(...parseInline(pkgDoc)));
	} else {
		nodes.push(
			textP(
				`${options.projectName} processes your TypeScript source with a single AST traversal, extracting TSDoc comments and type information to generate documentation.`,
			),
		);
	}
	nodes.push(md.html("<!-- FORGE:AUTO-END how-it-works -->"));

	// Auto-enriched section: Key Abstractions — regenerated even in existing stubs
	const allTypeSymbols = [...symbolsByPackage.values()]
		.flat()
		.filter((s) => s.exported && TYPE_KINDS.has(s.kind));

	if (allTypeSymbols.length > 0) {
		nodes.push(md.html("<!-- FORGE:AUTO-START key-abstractions -->"));
		nodes.push(md.heading(2, md.text("Key Abstractions")));
		const items: MdListItem[] = [];
		for (const s of allTypeSymbols) {
			const desc = s.documentation?.summary ?? `The \`${s.name}\` ${s.kind}.`;
			items.push(
				md.listItem(
					md.paragraph(md.strong(md.inlineCode(s.name)), md.text(" — "), ...parseInline(desc)),
				),
			);
		}
		nodes.push(md.list(items));
		nodes.push(md.html("<!-- FORGE:AUTO-END key-abstractions -->"));
	}

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// BUILD: Guides index (stub)
// ---------------------------------------------------------------------------

/**
 * Render the guides index page.
 *
 * When discovered guides are available, renders a listing with links.
 * Falls back to a stub when no guides are discovered.
 *
 * @internal
 */
function renderGuidesIndexPage(guides: DiscoveredGuide[]): string {
	const nodes: MdBlock[] = [];

	nodes.push(textP("Practical how-to guides for common tasks."));

	if (guides.length === 0) {
		nodes.push(
			md.blockquote(
				textP(
					"Add your guides to the `guides/` directory. Each `.md` or `.mdx` file will appear here automatically.",
				),
			),
		);
		nodes.push(md.heading(2, md.text("Getting Things Done")));
		nodes.push(
			textP(
				"Guides will appear here as you add them. Start by creating a file like `guides/my-guide.md`.",
			),
		);
	} else {
		nodes.push(md.html("<!-- FORGE:AUTO-START guide-listing -->"));
		nodes.push(md.heading(2, md.text("Available Guides")));

		const items: MdListItem[] = [];
		for (const guide of guides) {
			items.push(
				md.listItem(
					md.paragraph(
						md.link(slugLink(`guides/${guide.slug}`), md.strong(md.text(guide.title))),
						md.text(` — ${guide.description}`),
					),
				),
			);
		}
		nodes.push(md.list(items));
		nodes.push(md.html("<!-- FORGE:AUTO-END guide-listing -->"));
	}

	return serializeMarkdown(md.root(...nodes));
}

/**
 * Render a single discovered guide page with auto-generated content.
 *
 * Each guide page contains:
 * - A FORGE:AUTO section with code-derived content (signatures, examples, property tables)
 * - A TODO placeholder where user content should go
 *
 * @internal
 */
function renderGuidePage(guide: DiscoveredGuide): string {
	const nodes: MdBlock[] = [];

	nodes.push(md.paragraph(md.text(guide.description)));

	// TODO placeholder for user content
	nodes.push(
		md.blockquote(
			textP(
				"TODO: Add your own content to this guide. The sections below are auto-generated from code.",
			),
		),
	);

	// FORGE:AUTO section with code-derived content
	nodes.push(md.html(`<!-- FORGE:AUTO-START guide-${guide.slug} -->`));

	if (guide.source === "config-interface") {
		renderConfigGuideContent(nodes, guide.symbols);
	} else if (guide.source === "error-types") {
		renderErrorGuideContent(nodes, guide.symbols);
	} else if (guide.source === "entry-point") {
		renderEntryPointGuideContent(nodes, guide.symbols);
	} else {
		// guide-tag and category: generic symbol listing
		renderGenericGuideContent(nodes, guide.symbols);
	}

	nodes.push(md.html(`<!-- FORGE:AUTO-END guide-${guide.slug} -->`));

	return serializeMarkdown(md.root(...nodes));
}

/**
 * Render config guide content: property tables for each config interface.
 */
function renderConfigGuideContent(nodes: MdBlock[], symbols: ForgeSymbol[]): void {
	nodes.push(md.heading(2, md.text("Configuration Interfaces")));

	for (const s of symbols) {
		nodes.push(md.heading(3, md.inlineCode(s.name)));

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(s.documentation.summary)));
		}

		const children = (s.children ?? []).filter((c) => c.kind === "property" || c.kind === "method");

		if (children.length > 0) {
			const headerRow = md.tableRow(
				md.tableCell(md.text("Property")),
				md.tableCell(md.text("Type")),
				md.tableCell(md.text("Description")),
			);
			const dataRows: MdTableRow[] = [];
			for (const child of children) {
				const typePhrasing: MdPhrasing = child.signature
					? md.inlineCode(child.signature)
					: md.text("\u2014");
				const description = child.documentation?.summary || child.name;
				dataRows.push(
					md.tableRow(
						md.tableCell(md.inlineCode(child.name)),
						md.tableCell(typePhrasing),
						md.tableCell(...parseInline(description)),
					),
				);
			}
			nodes.push(md.table(null, headerRow, ...dataRows));
		}

		// Show example if available
		const examples = s.documentation?.examples ?? [];
		if (examples.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Example"))));
			nodes.push(md.code(examples[0].language || "typescript", examples[0].code.trim()));
		}
	}
}

/**
 * Render error guide content: error classes and @throws documentation.
 */
function renderErrorGuideContent(nodes: MdBlock[], symbols: ForgeSymbol[]): void {
	nodes.push(md.heading(2, md.text("Error Types")));

	for (const s of symbols) {
		const ext = s.kind === "function" ? "()" : "";
		nodes.push(md.heading(3, md.inlineCode(`${s.name}${ext}`)));

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(s.documentation.summary)));
		}

		if (s.signature) {
			nodes.push(md.code("typescript", s.signature));
		}

		const throws = s.documentation?.throws ?? [];
		if (throws.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Throws"))));
			const throwItems: MdListItem[] = [];
			for (const t of throws) {
				const parts: MdPhrasing[] = [];
				if (t.type) {
					parts.push(md.inlineCode(t.type));
					parts.push(md.text(" — "), ...parseInline(t.description));
				} else {
					parts.push(...parseInline(t.description));
				}
				throwItems.push(md.listItem(md.paragraph(...parts)));
			}
			nodes.push(md.list(throwItems));
		}
	}
}

/**
 * Render entry point guide content: function signatures and examples.
 */
function renderEntryPointGuideContent(nodes: MdBlock[], symbols: ForgeSymbol[]): void {
	nodes.push(md.heading(2, md.text("Key Functions")));

	for (const s of symbols) {
		const paramSig = s.documentation?.params
			? s.documentation.params.map((p) => p.name).join(", ")
			: "";
		const heading = `${s.name}(${paramSig})`;
		nodes.push(md.heading(3, md.text(heading)));

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(s.documentation.summary)));
		}

		if (s.signature) {
			nodes.push(md.code("typescript", s.signature));
		}

		const examples = s.documentation?.examples ?? [];
		if (examples.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Example"))));
			nodes.push(md.code(examples[0].language || "typescript", examples[0].code.trim()));
		}
	}
}

/**
 * Render generic guide content for @guide-tag and @category guides.
 * Lists symbols with their signatures and examples.
 */
function renderGenericGuideContent(nodes: MdBlock[], symbols: ForgeSymbol[]): void {
	nodes.push(md.heading(2, md.text("Related Symbols")));

	for (const s of symbols) {
		const ext = s.kind === "function" ? "()" : "";
		nodes.push(md.heading(3, md.inlineCode(`${s.name}${ext}`)));

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(s.documentation.summary)));
		}

		if (s.signature) {
			nodes.push(md.code("typescript", s.signature));
		}

		const examples = s.documentation?.examples ?? [];
		if (examples.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Example"))));
			nodes.push(md.code(examples[0].language || "typescript", examples[0].code.trim()));
		}
	}
}

// ---------------------------------------------------------------------------
// REFERENCE: Package API overview (api/index)
// ---------------------------------------------------------------------------

/**
 * Render the API overview page for a package — a full symbol table.
 * @internal
 */
function renderApiIndexPage(pkgName: string, symbols: ForgeSymbol[]): string {
	const exported = symbols.filter(
		(s) => s.exported && s.kind !== "method" && s.kind !== "property",
	);

	const functions = exported.filter((s) => FUNCTION_KINDS.has(s.kind));
	const types = exported.filter((s) => TYPE_KINDS.has(s.kind));
	const others = exported.filter((s) => !FUNCTION_KINDS.has(s.kind) && !TYPE_KINDS.has(s.kind));

	const nodes: MdBlock[] = [];

	// Find @packageDocumentation summary
	const pkgDoc = symbols.map((s) => s.documentation?.tags?.packageDocumentation?.[0]).find(Boolean);
	if (pkgDoc) {
		nodes.push(md.paragraph(...parseInline(pkgDoc)));
	} else {
		nodes.push(
			md.paragraph(md.text("API reference for the "), md.inlineCode(pkgName), md.text(" package.")),
		);
	}

	const renderGroup = (group: ForgeSymbol[], heading: string, pathSuffix: string) => {
		if (group.length === 0) return;
		nodes.push(md.heading(2, md.text(heading)));

		const headerRow = md.tableRow(
			md.tableCell(md.text("Symbol")),
			md.tableCell(md.text("Kind")),
			md.tableCell(md.text("Description")),
		);
		const dataRows: MdTableRow[] = [];
		for (const s of group) {
			const ext = s.kind === "function" ? "()" : "";
			const anchor = toAnchor(`${s.name}${ext}`);
			const rawSummary = s.documentation?.summary ?? "";
			const summary = truncate(rawSummary);
			dataRows.push(
				md.tableRow(
					md.tableCell(
						md.link(
							`${slugLink(`packages/${pkgName}/${pathSuffix}`)}#${anchor}`,
							md.inlineCode(`${s.name}${ext}`),
						),
					),
					md.tableCell(md.text(s.kind)),
					md.tableCell(...parseInline(summary)),
				),
			);
		}
		nodes.push(md.table(null, headerRow, ...dataRows));
	};

	renderGroup(functions, "Functions & Classes", "reference/functions");
	renderGroup(types, "Types & Interfaces", "reference/types");
	renderGroup(others, "Other Exports", "reference/functions");

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Package overview (packages/<name>/index)
// ---------------------------------------------------------------------------

/**
 * Renders the overview (index) page for a package.
 *
 * This is the landing page for a package — distinct from the reference/index
 * page which is the detailed API table. The overview provides installation,
 * a quick usage example, and a high-level exports table linking to reference pages.
 * @internal
 */
function renderPackageOverviewPage(
	packageName: string,
	symbols: ForgeSymbol[],
	_options: SiteGeneratorOptions,
): string {
	const exported = symbols.filter(
		(s) => s.exported && s.kind !== "method" && s.kind !== "property",
	);

	// Find @packageDocumentation content from tags
	const pkgDocSymbol = symbols.find(
		(s) => s.kind === "file" && s.documentation?.tags?.packageDocumentation,
	);
	const pkgDoc = symbols.map((s) => s.documentation?.tags?.packageDocumentation?.[0]).find(Boolean);
	const pkgRemarks = pkgDocSymbol?.documentation?.remarks;

	const nodes: MdBlock[] = [];

	// No h1 — frontmatter title handles the heading in SSGs

	// npm scope display and installation
	nodes.push(md.paragraph(md.text("npm package: "), md.inlineCode(`@forge-ts/${packageName}`)));

	// Installation
	nodes.push(md.heading(2, md.text("Installation")));
	nodes.push(md.code("bash", `npm install @forge-ts/${packageName}`));

	// Description from @packageDocumentation
	nodes.push(md.heading(2, md.text("Description")));
	if (pkgDoc) {
		nodes.push(md.paragraph(...parseInline(pkgDoc)));
	} else {
		nodes.push(md.paragraph(md.text("The "), md.inlineCode(packageName), md.text(" package.")));
	}

	// Key Concepts from @remarks if available
	if (pkgRemarks) {
		nodes.push(md.heading(2, md.text("Key Concepts")));
		const remarkBlocks = parseBlocks(pkgRemarks);
		if (remarkBlocks.length > 0) {
			nodes.push(...remarkBlocks);
		} else {
			nodes.push(md.paragraph(...parseInline(pkgRemarks)));
		}
	}

	// Quick Usage — find first exported function with an @example from index.ts
	let quickExample: { code: string; language: string } | undefined;
	for (const s of exported) {
		if (s.kind !== "function") continue;
		if (!s.filePath.endsWith("index.ts")) continue;
		const ex = s.documentation?.examples?.[0];
		if (ex) {
			quickExample = ex;
			break;
		}
	}
	// Fallback: any exported function with an example
	if (!quickExample) {
		for (const s of exported) {
			if (s.kind !== "function") continue;
			const ex = s.documentation?.examples?.[0];
			if (ex) {
				quickExample = ex;
				break;
			}
		}
	}
	if (quickExample) {
		nodes.push(md.heading(2, md.text("Quick Usage")));
		nodes.push(md.code(quickExample.language || "typescript", quickExample.code.trim()));
	}

	// Exports Overview — link to reference/functions and reference/types pages
	if (exported.length > 0) {
		const functions = exported.filter((s) => FUNCTION_KINDS.has(s.kind));
		const types = exported.filter((s) => TYPE_KINDS.has(s.kind));
		const others = exported.filter((s) => !FUNCTION_KINDS.has(s.kind) && !TYPE_KINDS.has(s.kind));

		const renderGroup = (group: ForgeSymbol[], heading: string, pathSuffix: string) => {
			if (group.length === 0) return;
			nodes.push(md.heading(2, md.text(heading)));

			const headerRow = md.tableRow(
				md.tableCell(md.text("Symbol")),
				md.tableCell(md.text("Kind")),
				md.tableCell(md.text("Description")),
			);
			const dataRows: MdTableRow[] = [];
			for (const s of group) {
				const ext = s.kind === "function" ? "()" : "";
				const anchor = toAnchor(`${s.name}${ext}`);
				const rawSummary = s.documentation?.summary ?? "";
				const summary = truncate(rawSummary);
				dataRows.push(
					md.tableRow(
						md.tableCell(
							md.link(
								`${slugLink(`packages/${packageName}/${pathSuffix}`)}#${anchor}`,
								md.inlineCode(`${s.name}${ext}`),
							),
						),
						md.tableCell(md.text(s.kind)),
						md.tableCell(...parseInline(summary)),
					),
				);
			}
			nodes.push(md.table(null, headerRow, ...dataRows));
		};

		renderGroup(functions, "Functions & Classes", "reference/functions");
		renderGroup(types, "Types & Interfaces", "reference/types");
		renderGroup(others, "Other Exports", "reference/functions");
	}

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Types page
// ---------------------------------------------------------------------------

/**
 * Renders the types page for a package (interfaces, type aliases, enums).
 * @internal
 */
function renderTypesPage(
	packageName: string,
	symbols: ForgeSymbol[],
	_options: SiteGeneratorOptions,
): string {
	const typeSymbols = symbols.filter((s) => s.exported && TYPE_KINDS.has(s.kind));

	const nodes: MdBlock[] = [];
	// No h1 — frontmatter title handles the heading
	nodes.push(
		textP("Type contracts exported by this package: interfaces, type aliases, and enums."),
	);

	for (const s of typeSymbols) {
		nodes.push(md.heading(2, md.text(s.name)));

		if (s.documentation?.deprecated) {
			nodes.push(
				md.blockquote(
					md.paragraph(
						md.strong(md.text("Deprecated")),
						md.text(": "),
						...parseInline(s.documentation.deprecated),
					),
				),
			);
		}

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(s.documentation.summary)));
		}

		if (s.signature && s.kind !== "interface") {
			nodes.push(md.code("typescript", s.signature));
		}

		const children = (s.children ?? []).filter((c) => c.kind === "property" || c.kind === "method");

		if (children.length > 0) {
			const headerRow = md.tableRow(
				md.tableCell(md.text("Property")),
				md.tableCell(md.text("Type")),
				md.tableCell(md.text("Required")),
				md.tableCell(md.text("Description")),
			);
			const dataRows: MdTableRow[] = [];
			for (const child of children) {
				const typePhrasing: MdPhrasing = child.signature
					? md.inlineCode(child.signature)
					: md.text("\u2014");
				const optional =
					child.signature?.includes("?") || child.signature?.includes("undefined") ? "No" : "Yes";
				const description = child.documentation?.summary || child.name;
				dataRows.push(
					md.tableRow(
						md.tableCell(md.inlineCode(child.name)),
						md.tableCell(typePhrasing),
						md.tableCell(md.text(optional)),
						md.tableCell(...parseInline(description)),
					),
				);
			}
			nodes.push(md.table(null, headerRow, ...dataRows));
		}
	}

	// Suppress unused variable warning
	void packageName;

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Functions page
// ---------------------------------------------------------------------------

/**
 * Renders the functions page for a package (functions and classes).
 * @internal
 */
function renderFunctionsPage(
	packageName: string,
	symbols: ForgeSymbol[],
	_options: SiteGeneratorOptions,
): string {
	const fnSymbols = symbols.filter((s) => s.exported && FUNCTION_KINDS.has(s.kind));

	const nodes: MdBlock[] = [];
	// No h1 — frontmatter title handles the heading
	nodes.push(textP("Functions and classes exported by this package."));

	for (const s of fnSymbols) {
		const paramSig =
			s.kind === "function" && s.documentation?.params
				? s.documentation.params.map((p) => p.name).join(", ")
				: "";
		const heading = s.kind === "function" ? `${s.name}(${paramSig})` : s.name;

		nodes.push(md.heading(2, md.text(heading)));

		if (s.documentation?.deprecated) {
			nodes.push(
				md.blockquote(
					md.paragraph(
						md.strong(md.text("Deprecated")),
						md.text(": "),
						...parseInline(s.documentation.deprecated),
					),
				),
			);
		}

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(s.documentation.summary)));
		}

		if (s.signature) {
			nodes.push(md.paragraph(md.strong(md.text("Signature"))));
			nodes.push(md.code("typescript", s.signature));
		}

		const params = s.documentation?.params ?? [];
		if (params.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Parameters"))));

			const headerRow = md.tableRow(
				md.tableCell(md.text("Name")),
				md.tableCell(md.text("Type")),
				md.tableCell(md.text("Description")),
			);
			const dataRows: MdTableRow[] = [];
			for (const p of params) {
				// Fall back to extracting type from signature when param.type is absent
				let resolvedType = p.type;
				if (!resolvedType && s.signature) {
					// Try to match `paramName: SomeType` in the signature
					const typeMatch = new RegExp(`\\b${p.name}\\s*[?:]\\s*([^,)]+)`).exec(s.signature);
					if (typeMatch) {
						resolvedType = typeMatch[1].trim();
					}
				}
				const typePhrasing: MdPhrasing = resolvedType
					? md.inlineCode(resolvedType)
					: md.text("\u2014");
				dataRows.push(
					md.tableRow(
						md.tableCell(md.inlineCode(p.name)),
						md.tableCell(typePhrasing),
						md.tableCell(...parseInline(p.description)),
					),
				);
			}
			nodes.push(md.table(null, headerRow, ...dataRows));
		}

		if (s.documentation?.returns) {
			const retParts: MdPhrasing[] = [md.strong(md.text("Returns"))];
			if (s.documentation.returns.type) {
				retParts.push(md.text(" "));
				retParts.push(md.inlineCode(s.documentation.returns.type));
			}
			retParts.push(md.text(" — "), ...parseInline(s.documentation.returns.description));
			nodes.push(md.paragraph(...retParts));
		}

		const throws = s.documentation?.throws ?? [];
		if (throws.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Throws"))));
			const throwItems: MdListItem[] = [];
			for (const t of throws) {
				const throwParts: MdPhrasing[] = [];
				if (t.type) {
					throwParts.push(md.inlineCode(t.type));
					throwParts.push(md.text(" — "), ...parseInline(t.description));
				} else {
					throwParts.push(...parseInline(t.description));
				}
				throwItems.push(md.listItem(md.paragraph(...throwParts)));
			}
			nodes.push(md.list(throwItems));
		}

		const examples = s.documentation?.examples ?? [];
		if (examples.length > 0) {
			const ex = examples[0];
			nodes.push(md.paragraph(md.strong(md.text("Example"))));
			nodes.push(md.code(ex.language || "typescript", ex.code.trim()));
		}

		// Render class methods
		const methods = (s.children ?? []).filter((c) => c.kind === "method");
		if (methods.length > 0) {
			nodes.push(md.paragraph(md.strong(md.text("Methods"))));
			for (const method of methods) {
				nodes.push(md.heading(3, md.text(`${method.name}()`)));
				if (method.documentation?.summary) {
					nodes.push(md.paragraph(...parseInline(method.documentation.summary)));
				}
				if (method.signature) {
					nodes.push(md.code("typescript", method.signature));
				}
			}
		}
	}

	// Suppress unused variable warning
	void packageName;

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Examples page
// ---------------------------------------------------------------------------

/**
 * Renders the examples page for a package — aggregates all @example blocks.
 * @internal
 */
function renderExamplesPage(
	packageName: string,
	symbols: ForgeSymbol[],
	_options: SiteGeneratorOptions,
): string {
	const exported = symbols.filter(
		(s) => s.exported && s.kind !== "method" && s.kind !== "property",
	);

	const nodes: MdBlock[] = [];
	// No h1 — frontmatter title handles the heading
	nodes.push(textP("All usage examples from the package, aggregated for quick reference."));

	let hasExamples = false;

	for (const s of exported) {
		const examples = s.documentation?.examples ?? [];
		if (examples.length === 0) continue;

		hasExamples = true;
		const ext = s.kind === "function" ? "()" : "";
		nodes.push(md.heading(2, md.inlineCode(`${s.name}${ext}`)));

		if (s.documentation?.summary) {
			nodes.push(md.paragraph(md.emphasis(...parseInline(s.documentation.summary))));
		}

		nodes.push(
			md.paragraph(
				md.link(
					`${slugLink(`packages/${packageName}/reference/functions`)}#${toAnchor(s.name)}`,
					md.text("View in API reference"),
				),
			),
		);

		for (const ex of examples) {
			nodes.push(md.code(ex.language || "typescript", ex.code.trim()));
		}
	}

	if (!hasExamples) {
		nodes.push(md.paragraph(md.emphasis(md.text("No examples documented yet."))));
	}

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Configuration page
// ---------------------------------------------------------------------------

/**
 * Helper to render a flat property table for a list of symbol children.
 * @internal
 */
function renderPropertyTable(children: ForgeSymbol[]): MdBlock {
	const headerRow = md.tableRow(
		md.tableCell(md.text("Property")),
		md.tableCell(md.text("Type")),
		md.tableCell(md.text("Required")),
		md.tableCell(md.text("Description")),
	);
	const dataRows: MdTableRow[] = [];
	for (const child of children) {
		const typePhrasing: MdPhrasing = child.signature
			? md.inlineCode(child.signature)
			: md.text("\u2014");
		const optional =
			child.signature?.includes("?") || child.signature?.includes("undefined") ? "No" : "Yes";
		const description = child.documentation?.summary || child.name;
		dataRows.push(
			md.tableRow(
				md.tableCell(md.inlineCode(child.name)),
				md.tableCell(typePhrasing),
				md.tableCell(md.text(optional)),
				md.tableCell(...parseInline(description)),
			),
		);
	}
	return md.table(null, headerRow, ...dataRows);
}

/**
 * Complete list of forge-ts enforcement rules (E001-E020, W001-W020).
 * These are well-known rule codes — kept as a constant so the config page
 * always documents them even if the symbol graph doesn't carry the full list.
 * @internal
 */
const ENFORCEMENT_RULES: ReadonlyArray<{
	code: string;
	rule: string;
	severity: "error" | "warn";
	description: string;
}> = [
	{
		code: "E001",
		rule: "require-summary",
		severity: "error",
		description: "Exported symbol missing TSDoc summary",
	},
	{
		code: "E002",
		rule: "require-param",
		severity: "error",
		description: "Function parameter missing @param tag",
	},
	{
		code: "E003",
		rule: "require-returns",
		severity: "error",
		description: "Function missing @returns tag",
	},
	{
		code: "E004",
		rule: "require-example",
		severity: "error",
		description: "Exported symbol missing @example block",
	},
	{
		code: "E005",
		rule: "no-unresolved-link",
		severity: "error",
		description: "{@link} target cannot be resolved",
	},
	{
		code: "E006",
		rule: "no-broken-param",
		severity: "error",
		description: "@param tag references nonexistent parameter",
	},
	{
		code: "E007",
		rule: "no-duplicate-param",
		severity: "error",
		description: "Duplicate @param tag for the same parameter",
	},
	{
		code: "E008",
		rule: "require-throws",
		severity: "error",
		description: "Function throws without @throws tag",
	},
	{
		code: "E009",
		rule: "no-missing-type",
		severity: "error",
		description: "Type annotation missing on exported symbol",
	},
	{
		code: "E010",
		rule: "require-package-doc",
		severity: "error",
		description: "Package entry point missing @packageDocumentation",
	},
	{
		code: "E011",
		rule: "no-internal-export",
		severity: "error",
		description: "@internal symbol is publicly exported",
	},
	{
		code: "E012",
		rule: "require-deprecation-notice",
		severity: "error",
		description: "Deprecated symbol missing @deprecated description",
	},
	{
		code: "E013",
		rule: "no-any-type",
		severity: "error",
		description: "Exported symbol uses the `any` type",
	},
	{
		code: "E014",
		rule: "require-readonly",
		severity: "error",
		description: "Public interface property should be readonly",
	},
	{
		code: "E015",
		rule: "no-empty-doc",
		severity: "error",
		description: "TSDoc comment is empty or whitespace-only",
	},
	{
		code: "E016",
		rule: "require-release-tag",
		severity: "error",
		description: "Exported symbol missing @public, @beta, or @internal tag",
	},
	{
		code: "E017",
		rule: "no-untagged-override",
		severity: "error",
		description: "Overriding method missing @override tag",
	},
	{
		code: "E018",
		rule: "require-generic-doc",
		severity: "error",
		description: "Generic type parameter missing @typeParam tag",
	},
	{
		code: "E019",
		rule: "no-floating-promise",
		severity: "error",
		description: "Async function result not documented or handled",
	},
	{
		code: "E020",
		rule: "require-module-doc",
		severity: "error",
		description: "Module file missing file-level documentation",
	},
	{
		code: "W001",
		rule: "prefer-remarks",
		severity: "warn",
		description: "Complex symbol benefits from @remarks section",
	},
	{
		code: "W002",
		rule: "prefer-example",
		severity: "warn",
		description: "Public API symbol has no @example block",
	},
	{
		code: "W003",
		rule: "prefer-returns-type",
		severity: "warn",
		description: "@returns tag missing type annotation",
	},
	{
		code: "W004",
		rule: "prefer-param-type",
		severity: "warn",
		description: "@param tag missing type annotation",
	},
	{
		code: "W005",
		rule: "prefer-see-also",
		severity: "warn",
		description: "Symbol references related items without @see",
	},
	{
		code: "W006",
		rule: "prefer-since",
		severity: "warn",
		description: "New public symbol missing @since tag",
	},
	{
		code: "W007",
		rule: "prefer-default-value",
		severity: "warn",
		description: "Optional property missing @defaultValue tag",
	},
	{
		code: "W008",
		rule: "prefer-alpha-tag",
		severity: "warn",
		description: "Unstable API missing @alpha tag",
	},
	{
		code: "W009",
		rule: "prefer-short-summary",
		severity: "warn",
		description: "Summary line exceeds recommended length",
	},
	{
		code: "W010",
		rule: "prefer-verb-summary",
		severity: "warn",
		description: "Summary should begin with a verb",
	},
	{
		code: "W011",
		rule: "prefer-period-summary",
		severity: "warn",
		description: "Summary line should end with a period",
	},
	{
		code: "W012",
		rule: "prefer-capitalized-summary",
		severity: "warn",
		description: "Summary line should begin with a capital letter",
	},
	{
		code: "W013",
		rule: "prefer-no-this",
		severity: "warn",
		description: "TSDoc should not use first-person pronouns",
	},
	{
		code: "W014",
		rule: "prefer-throws-type",
		severity: "warn",
		description: "@throws tag missing exception type",
	},
	{
		code: "W015",
		rule: "prefer-consistent-returns",
		severity: "warn",
		description: "Return type inconsistent with @returns tag",
	},
	{
		code: "W016",
		rule: "prefer-no-html",
		severity: "warn",
		description: "TSDoc contains raw HTML instead of markdown",
	},
	{
		code: "W017",
		rule: "prefer-explicit-visibility",
		severity: "warn",
		description: "Exported symbol missing explicit visibility tag",
	},
	{
		code: "W018",
		rule: "prefer-description-length",
		severity: "warn",
		description: "@param description is too short to be useful",
	},
	{
		code: "W019",
		rule: "prefer-example-title",
		severity: "warn",
		description: "@example block missing a descriptive title comment",
	},
	{
		code: "W020",
		rule: "prefer-no-magic-numbers",
		severity: "warn",
		description: "Numeric literal in signature should have a named constant",
	},
];

/**
 * SSG targets supported by forge-ts and what each produces.
 * @internal
 */
const SSG_TARGETS: ReadonlyArray<{ target: string; description: string }> = [
	{
		target: "fumadocs",
		description: "Next.js-based doc site with full-text search and MDX support",
	},
	{
		target: "docusaurus",
		description: "React-based docs with versioning, i18n, and sidebar navigation",
	},
	{
		target: "nextra",
		description: "Next.js docs theme with MDX, built-in search, and GitHub integration",
	},
	{
		target: "vitepress",
		description: "Vite + Vue-based static docs with deep Markdown customization",
	},
	{
		target: "mintlify",
		description: "Hosted docs platform with OpenAPI integration and analytics",
	},
];

/**
 * Render the configuration reference page.
 * @internal
 */
function renderConfigurationPage(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	options: SiteGeneratorOptions,
): string {
	// Look for a ForgeConfig-like type across all packages
	const configSymbol = [...symbolsByPackage.values()]
		.flat()
		.find((s) => s.exported && TYPE_KINDS.has(s.kind) && /config/i.test(s.name));

	const nodes: MdBlock[] = [];

	// Intro paragraph
	nodes.push(
		md.paragraph(
			md.strong(md.text(options.projectName)),
			md.text(" is configured through a single "),
			md.inlineCode("forge-ts.config.ts"),
			md.text(
				" file in your project root. The configuration controls TSDoc enforcement rules, documentation generation, doctest execution, OpenAPI output, and AI context file generation.",
			),
		),
	);

	// Config file example
	nodes.push(md.heading(2, md.text("forge-ts.config.ts")));
	nodes.push(
		md.paragraph(
			md.text("Create a "),
			md.inlineCode("forge-ts.config.ts"),
			md.text(" file in your project root:"),
		),
	);
	nodes.push(
		md.code(
			"typescript",
			[
				'import { defineConfig } from "@forge-ts/core";',
				"",
				"export default defineConfig({",
				'  rootDir: ".",',
				'  outDir: "docs/generated",',
				"  enforce: {",
				"    enabled: true,",
				'    rules: { E001: "error", E016: "error" },',
				"  },",
				"  gen: {",
				"    enabled: true,",
				'    formats: ["markdown"],',
				"    llmsTxt: true,",
				"  },",
				"  doctest: { enabled: true },",
				"});",
			].join("\n"),
		),
	);

	// ForgeConfig type — top-level flat table plus nested sections per subsection
	if (configSymbol) {
		nodes.push(md.heading(2, md.inlineCode(configSymbol.name)));

		if (configSymbol.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(configSymbol.documentation.summary)));
		}
		if (configSymbol.documentation?.remarks) {
			nodes.push(md.paragraph(...parseInline(configSymbol.documentation.remarks)));
		}

		const topChildren = (configSymbol.children ?? []).filter(
			(c) => c.kind === "property" || c.kind === "method",
		);

		// Flat top-level properties table (all children, even those with sub-children)
		if (topChildren.length > 0) {
			nodes.push(renderPropertyTable(topChildren));
		}

		// Nested sections: for each top-level property that has its own children,
		// render an h3 section with property table and any @remarks/@defaultValue.
		for (const child of topChildren) {
			const grandchildren = (child.children ?? []).filter(
				(c) => c.kind === "property" || c.kind === "method",
			);
			if (grandchildren.length === 0) continue;

			nodes.push(md.heading(3, md.inlineCode(child.name)));

			if (child.documentation?.summary) {
				nodes.push(md.paragraph(...parseInline(child.documentation.summary)));
			}
			if (child.documentation?.remarks) {
				const remarkBlocks = parseBlocks(child.documentation.remarks);
				if (remarkBlocks.length > 0) {
					nodes.push(...remarkBlocks);
				} else {
					nodes.push(md.paragraph(...parseInline(child.documentation.remarks)));
				}
			}
			const defaultVal = child.documentation?.tags?.defaultValue?.[0];
			if (defaultVal) {
				nodes.push(
					md.paragraph(md.strong(md.text("Default:")), md.text(" "), md.inlineCode(defaultVal)),
				);
			}

			nodes.push(renderPropertyTable(grandchildren));
		}
	}

	// Enforcement Rules section
	nodes.push(md.heading(2, md.text("Enforcement Rules")));
	nodes.push(
		textP(
			"forge-ts ships with 40 enforcement rules: 20 error-level (E001-E020) and 20 warning-level (W001-W020). Configure them in the enforce.rules object.",
		),
	);

	const rulesHeaderRow = md.tableRow(
		md.tableCell(md.text("Code")),
		md.tableCell(md.text("Rule")),
		md.tableCell(md.text("Severity")),
		md.tableCell(md.text("Description")),
	);
	const rulesDataRows: MdTableRow[] = ENFORCEMENT_RULES.map((r) =>
		md.tableRow(
			md.tableCell(md.inlineCode(r.code)),
			md.tableCell(md.inlineCode(r.rule)),
			md.tableCell(md.inlineCode(r.severity)),
			md.tableCell(md.text(r.description)),
		),
	);
	nodes.push(md.table(null, rulesHeaderRow, ...rulesDataRows));

	// SSG Targets section
	nodes.push(md.heading(2, md.text("SSG Targets")));
	nodes.push(
		textP(
			"The gen.ssgTarget option controls which documentation platform the generated files target. Each platform receives platform-specific frontmatter and link formats.",
		),
	);

	const ssgHeaderRow = md.tableRow(
		md.tableCell(md.text("Target")),
		md.tableCell(md.text("Description")),
	);
	const ssgDataRows: MdTableRow[] = SSG_TARGETS.map((t) =>
		md.tableRow(md.tableCell(md.inlineCode(t.target)), md.tableCell(md.text(t.description))),
	);
	nodes.push(md.table(null, ssgHeaderRow, ...ssgDataRows));

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Changelog (stub)
// ---------------------------------------------------------------------------

/**
 * Render the changelog stub page.
 * @internal
 */
function renderChangelogPage(options: SiteGeneratorOptions): string {
	const repoUrl = options.repositoryUrl ?? "";
	const nodes: MdBlock[] = [];

	nodes.push(
		md.paragraph(
			md.text("Release history for "),
			md.strong(md.text(options.projectName)),
			md.text("."),
		),
	);
	nodes.push(
		md.blockquote(textP("This is a stub page. Link to or embed your `CHANGELOG.md` here.")),
	);

	if (repoUrl) {
		nodes.push(
			md.paragraph(
				md.text("See "),
				md.link(`${repoUrl}/blob/main/CHANGELOG.md`, md.text("CHANGELOG.md")),
				md.text(" for the full release history."),
			),
		);
	} else {
		nodes.push(
			md.paragraph(
				md.text("See your project's "),
				md.inlineCode("CHANGELOG.md"),
				md.text(" for the full release history."),
			),
		);
	}

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// COMMUNITY: FAQ (stub)
// ---------------------------------------------------------------------------

/**
 * Render the FAQ stub page.
 * @internal
 */
function renderFaqPage(options: SiteGeneratorOptions): string {
	const nodes: MdBlock[] = [];

	nodes.push(
		md.paragraph(
			md.text("Frequently asked questions about "),
			md.strong(md.text(options.projectName)),
			md.text("."),
		),
	);
	nodes.push(
		md.blockquote(textP("This is a stub page. Common questions will be added here as they arise.")),
	);

	nodes.push(md.heading(2, md.text("How do I configure forge-ts?")));
	nodes.push(
		md.paragraph(
			md.text("Create a "),
			md.inlineCode("forge-ts.config.ts"),
			md.text(" file in your project root. See "),
			md.link("/configuration", md.text("Configuration")),
			md.text("."),
		),
	);

	nodes.push(md.heading(2, md.text("What TypeScript version is required?")));
	nodes.push(textP("forge-ts requires TypeScript 5.0 or later."));

	nodes.push(md.heading(2, md.text("How do I run @example blocks as tests?")));
	nodes.push(md.code("bash", "npx forge-ts test"));

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// COMMUNITY: Contributing (stub)
// ---------------------------------------------------------------------------

/**
 * Render the contributing stub page.
 * @internal
 */
function renderContributingPage(options: SiteGeneratorOptions): string {
	const repoUrl = options.repositoryUrl ?? "";
	const nodes: MdBlock[] = [];

	nodes.push(
		md.paragraph(
			md.text("Contributing to "),
			md.strong(md.text(options.projectName)),
			md.text("."),
		),
	);
	nodes.push(
		md.blockquote(textP("This is a stub page. Link to or embed your `CONTRIBUTING.md` here.")),
	);

	if (repoUrl) {
		nodes.push(
			md.paragraph(
				md.text("See "),
				md.link(`${repoUrl}/blob/main/CONTRIBUTING.md`, md.text("CONTRIBUTING.md")),
				md.text(" for contribution guidelines."),
			),
		);
	} else {
		nodes.push(
			md.paragraph(
				md.text("See your project's "),
				md.inlineCode("CONTRIBUTING.md"),
				md.text(" for contribution guidelines."),
			),
		);
	}

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generates a full multi-page documentation site from symbols grouped by package.
 *
 * Follows a 5-stage information architecture:
 * 1. ORIENT — Landing page, Getting Started
 * 2. LEARN — Concepts (stub)
 * 3. BUILD — Guides (stub)
 * 4. REFERENCE — API Reference, Types, Configuration, Changelog
 * 5. COMMUNITY — FAQ, Contributing (stubs)
 *
 * @remarks
 * Auto-generated reference pages are rebuilt on every run, while stub pages
 * (concepts, guides, FAQ, contributing) are only created if they don't exist.
 *
 * @param symbolsByPackage - Symbols grouped by package name.
 * @param config - The resolved {@link ForgeConfig}.
 * @param options - Site generation options.
 * @returns An array of {@link DocPage} objects ready to be written to disk.
 * @example
 * ```typescript
 * import { generateDocSite, groupSymbolsByPackage } from "@forge-ts/gen";
 * const grouped = groupSymbolsByPackage(symbols, config.rootDir);
 * const pages = generateDocSite(grouped, config, { format: "markdown", projectName: "my-project" });
 * console.log(pages.length > 0); // true
 * ```
 * @public
 */
export function generateDocSite(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	config: ForgeConfig,
	options: SiteGeneratorOptions,
): DocPage[] {
	const ext = options.format === "mdx" ? "mdx" : "md";
	const pages: DocPage[] = [];

	// -------------------------------------------------------------------------
	// ORIENT
	// -------------------------------------------------------------------------

	// Project landing page
	const indexContent = renderProjectIndexPage(symbolsByPackage, options);
	const indexFrontmatter = buildFrontmatterFields(
		options.projectName,
		options.projectDescription ?? "",
		options.ssgTarget,
		1,
	);
	pages.push({
		path: `index.${ext}`,
		content: `${serializeFrontmatter(indexFrontmatter)}${indexContent.trimEnd()}\n`,
		frontmatter: indexFrontmatter,
	});

	// Getting started
	const gettingStartedContent = renderGettingStartedPage(symbolsByPackage, options);
	const gettingStartedFrontmatter = buildFrontmatterFields(
		"Getting Started",
		`Quick start guide for ${options.projectName}`,
		options.ssgTarget,
		2,
	);
	pages.push({
		path: `getting-started.${ext}`,
		content: `${serializeFrontmatter(gettingStartedFrontmatter)}${gettingStartedContent.trimEnd()}\n`,
		frontmatter: gettingStartedFrontmatter,
	});

	// -------------------------------------------------------------------------
	// LEARN
	// -------------------------------------------------------------------------

	const conceptsContent = renderConceptsPage(symbolsByPackage, options);
	const conceptsFrontmatter = buildFrontmatterFields(
		"Concepts",
		`Core concepts behind ${options.projectName}`,
		options.ssgTarget,
		3,
	);
	pages.push({
		path: `concepts.${ext}`,
		content: `${serializeFrontmatter(conceptsFrontmatter)}${conceptsContent.trimEnd()}\n`,
		frontmatter: conceptsFrontmatter,
		stub: true,
	});

	// -------------------------------------------------------------------------
	// BUILD — Guide discovery and generation
	// -------------------------------------------------------------------------

	// Filter out guides whose slug collides with root-level pages
	// (getting-started, configuration already exist as canonical root pages).
	const ROOT_PAGE_SLUGS = new Set(["getting-started", "configuration", "concepts"]);
	const discoveredGuides = discoverGuides(symbolsByPackage, config).filter(
		(g) => !ROOT_PAGE_SLUGS.has(g.slug),
	);

	const guidesContent = renderGuidesIndexPage(discoveredGuides);
	const guidesFrontmatter = buildFrontmatterFields(
		"Guides",
		`How-to guides for ${options.projectName}`,
		options.ssgTarget,
		4,
	);
	pages.push({
		path: `guides/index.${ext}`,
		content: `${serializeFrontmatter(guidesFrontmatter)}${guidesContent.trimEnd()}\n`,
		frontmatter: guidesFrontmatter,
		stub: true,
	});

	// Individual discovered guide pages
	for (const guide of discoveredGuides) {
		const guideContent = renderGuidePage(guide);
		const guideFm = buildFrontmatterFields(guide.title, guide.description, options.ssgTarget);
		pages.push({
			path: `guides/${guide.slug}.${ext}`,
			content: `${serializeFrontmatter(guideFm)}${guideContent.trimEnd()}\n`,
			frontmatter: guideFm,
			stub: true,
		});
	}

	// -------------------------------------------------------------------------
	// REFERENCE — per-package pages
	// -------------------------------------------------------------------------

	let pkgPosition = 1;
	for (const [pkgName, symbols] of symbolsByPackage) {
		const pkgBase = `packages/${pkgName}`;

		// Package overview index
		const overviewContent = renderPackageOverviewPage(pkgName, symbols, options);
		const overviewFrontmatter = buildFrontmatterFields(
			pkgName,
			`${pkgName} package overview`,
			options.ssgTarget,
			pkgPosition,
		);
		pages.push({
			path: `${pkgBase}/index.${ext}`,
			content: `${serializeFrontmatter(overviewFrontmatter)}${overviewContent.trimEnd()}\n`,
			frontmatter: overviewFrontmatter,
		});

		// reference/index — symbol table overview
		const apiIndexContent = renderApiIndexPage(pkgName, symbols);
		const apiIndexFrontmatter = buildFrontmatterFields(
			`${pkgName} — API Reference`,
			`Full API reference for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/reference/index.${ext}`,
			content: `${serializeFrontmatter(apiIndexFrontmatter)}${apiIndexContent.trimEnd()}\n`,
			frontmatter: apiIndexFrontmatter,
		});

		// reference/functions
		const functionsContent = renderFunctionsPage(pkgName, symbols, options);
		const functionsFrontmatter = buildFrontmatterFields(
			`${pkgName} — Functions`,
			`Functions and classes for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/reference/functions.${ext}`,
			content: `${serializeFrontmatter(functionsFrontmatter)}${functionsContent.trimEnd()}\n`,
			frontmatter: functionsFrontmatter,
		});

		// reference/types
		const typesContent = renderTypesPage(pkgName, symbols, options);
		const typesFrontmatter = buildFrontmatterFields(
			`${pkgName} — Types`,
			`Type contracts for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/reference/types.${ext}`,
			content: `${serializeFrontmatter(typesFrontmatter)}${typesContent.trimEnd()}\n`,
			frontmatter: typesFrontmatter,
		});

		// reference/examples
		const examplesContent = renderExamplesPage(pkgName, symbols, options);
		const examplesFrontmatter = buildFrontmatterFields(
			`${pkgName} — Examples`,
			`Usage examples for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/reference/examples.${ext}`,
			content: `${serializeFrontmatter(examplesFrontmatter)}${examplesContent.trimEnd()}\n`,
			frontmatter: examplesFrontmatter,
		});

		pkgPosition++;
	}

	// -------------------------------------------------------------------------
	// REFERENCE — project-level
	// -------------------------------------------------------------------------

	const configContent = renderConfigurationPage(symbolsByPackage, options);
	const configFrontmatter = buildFrontmatterFields(
		"Configuration",
		`Configuration reference for ${options.projectName}`,
		options.ssgTarget,
	);
	pages.push({
		path: `configuration.${ext}`,
		content: `${serializeFrontmatter(configFrontmatter)}${configContent.trimEnd()}\n`,
		frontmatter: configFrontmatter,
	});

	const changelogContent = renderChangelogPage(options);
	const changelogFrontmatter = buildFrontmatterFields(
		"Changelog",
		`Release history for ${options.projectName}`,
		options.ssgTarget,
	);
	pages.push({
		path: `changelog.${ext}`,
		content: `${serializeFrontmatter(changelogFrontmatter)}${changelogContent.trimEnd()}\n`,
		frontmatter: changelogFrontmatter,
		stub: true,
	});

	// -------------------------------------------------------------------------
	// COMMUNITY
	// -------------------------------------------------------------------------

	const faqContent = renderFaqPage(options);
	const faqFrontmatter = buildFrontmatterFields(
		"FAQ",
		`Frequently asked questions about ${options.projectName}`,
		options.ssgTarget,
	);
	pages.push({
		path: `faq.${ext}`,
		content: `${serializeFrontmatter(faqFrontmatter)}${faqContent.trimEnd()}\n`,
		frontmatter: faqFrontmatter,
		stub: true,
	});

	const contributingContent = renderContributingPage(options);
	const contributingFrontmatter = buildFrontmatterFields(
		"Contributing",
		`How to contribute to ${options.projectName}`,
		options.ssgTarget,
	);
	pages.push({
		path: `contributing.${ext}`,
		content: `${serializeFrontmatter(contributingFrontmatter)}${contributingContent.trimEnd()}\n`,
		frontmatter: contributingFrontmatter,
		stub: true,
	});

	// Suppress unused variable warning — config is available for future use
	void config;

	return pages;
}
