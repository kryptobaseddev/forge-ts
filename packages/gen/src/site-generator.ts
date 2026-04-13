import { basename, relative } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { type DiscoveredGuide, discoverGuides } from "./guide-discovery.js";
import { parseInline, stringifyWithFrontmatter } from "./markdown-utils.js";
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

	nodes.push(md.heading(2, md.text("Step 1: Install")));
	nodes.push(md.code("bash", `npm install -D ${options.packageName ?? "@forge-ts/cli"}`));

	nodes.push(md.heading(2, md.text("Step 2: Add TSDoc to your code")));
	nodes.push(textP("Add TSDoc comments to your exported functions and types:"));
	nodes.push(
		md.code(
			"typescript",
			[
				"/**",
				" * Adds two numbers together.",
				" * @param a - First number",
				" * @param b - Second number",
				" * @returns The sum of a and b",
				" * @example",
				" * ```typescript",
				" * const result = add(1, 2); // => 3",
				" * ```",
				" */",
				"export function add(a: number, b: number): number {",
				"  return a + b;",
				"}",
			].join("\n"),
		),
	);

	nodes.push(md.heading(2, md.text("Step 3: Run forge-ts check")));
	nodes.push(textP("Lint your TSDoc coverage before generating docs:"));
	nodes.push(md.code("bash", "npx forge-ts check"));
	nodes.push(textP("Expected output:"));
	nodes.push(
		md.code(
			"",
			["forge-ts: checking TSDoc coverage...", "  \u2713 All public symbols documented"].join("\n"),
		),
	);

	nodes.push(md.heading(2, md.text("Step 4: Generate docs")));
	nodes.push(textP("Build your documentation site:"));
	nodes.push(md.code("bash", "npx forge-ts build"));

	if (firstExample) {
		nodes.push(textP("Your code examples become live documentation:"));
		nodes.push(md.code(firstExample.language || "typescript", firstExample.code.trim()));
	}

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

	renderGroup(functions, "Functions & Classes", "api/functions");
	renderGroup(types, "Types & Interfaces", "api/types");
	renderGroup(others, "Other Exports", "api/functions");

	return serializeMarkdown(md.root(...nodes));
}

// ---------------------------------------------------------------------------
// REFERENCE: Package overview (packages/<name>/index)
// ---------------------------------------------------------------------------

/**
 * Renders the overview (index) page for a package.
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

	// Find @packageDocumentation summary from tags
	const pkgDoc = symbols.map((s) => s.documentation?.tags?.packageDocumentation?.[0]).find(Boolean);

	const nodes: MdBlock[] = [];

	// No h1 — frontmatter title handles the heading in Mintlify and other SSGs

	if (pkgDoc) {
		nodes.push(md.paragraph(...parseInline(pkgDoc)));
	}

	if (exported.length > 0) {
		// Group by kind: functions first, then types, then others
		const functions = exported.filter((s) => FUNCTION_KINDS.has(s.kind));
		const types = exported.filter((s) => TYPE_KINDS.has(s.kind));
		const others = exported.filter((s) => !FUNCTION_KINDS.has(s.kind) && !TYPE_KINDS.has(s.kind));

		const renderGroup = (group: ForgeSymbol[], heading: string) => {
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
								`${slugLink(`packages/${packageName}/api/index`)}#${anchor}`,
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

		renderGroup(functions, "Functions & Classes");
		renderGroup(types, "Types & Interfaces");
		renderGroup(others, "Other Exports");
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
					`${slugLink(`packages/${packageName}/api/functions`)}#${toAnchor(s.name)}`,
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

	nodes.push(
		md.paragraph(
			md.text("Configuration reference for "),
			md.strong(md.text(options.projectName)),
			md.text("."),
		),
	);

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
				"});",
			].join("\n"),
		),
	);

	if (configSymbol) {
		nodes.push(md.heading(2, md.inlineCode(configSymbol.name)));

		if (configSymbol.documentation?.summary) {
			nodes.push(md.paragraph(...parseInline(configSymbol.documentation.summary)));
		}

		const children = (configSymbol.children ?? []).filter(
			(c) => c.kind === "property" || c.kind === "method",
		);
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

	const discoveredGuides = discoverGuides(symbolsByPackage, config);

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

		// api/index — symbol table overview
		const apiIndexContent = renderApiIndexPage(pkgName, symbols);
		const apiIndexFrontmatter = buildFrontmatterFields(
			`${pkgName} — API Reference`,
			`Full API reference for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/api/index.${ext}`,
			content: `${serializeFrontmatter(apiIndexFrontmatter)}${apiIndexContent.trimEnd()}\n`,
			frontmatter: apiIndexFrontmatter,
		});

		// api/functions
		const functionsContent = renderFunctionsPage(pkgName, symbols, options);
		const functionsFrontmatter = buildFrontmatterFields(
			`${pkgName} — Functions`,
			`Functions and classes for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/api/functions.${ext}`,
			content: `${serializeFrontmatter(functionsFrontmatter)}${functionsContent.trimEnd()}\n`,
			frontmatter: functionsFrontmatter,
		});

		// api/types
		const typesContent = renderTypesPage(pkgName, symbols, options);
		const typesFrontmatter = buildFrontmatterFields(
			`${pkgName} — Types`,
			`Type contracts for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/api/types.${ext}`,
			content: `${serializeFrontmatter(typesFrontmatter)}${typesContent.trimEnd()}\n`,
			frontmatter: typesFrontmatter,
		});

		// api/examples
		const examplesContent = renderExamplesPage(pkgName, symbols, options);
		const examplesFrontmatter = buildFrontmatterFields(
			`${pkgName} — Examples`,
			`Usage examples for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/api/examples.${ext}`,
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
