import { basename, relative } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

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
}

/**
 * Options controlling the doc site generator.
 * @public
 */
export interface SiteGeneratorOptions {
	/** Output format */
	format: "markdown" | "mdx";
	/** SSG target for frontmatter */
	ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress";
	/** Project name */
	projectName: string;
	/** Project description */
	projectDescription?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a label to a GitHub-compatible anchor slug. */
function toAnchor(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

/** Escape pipe characters for use inside Markdown table cells. */
function escapePipe(text: string): string {
	return text.replace(/\|/g, "\\|");
}

/** Build a frontmatter block string from the fields map. */
function serializeFrontmatter(fields: Record<string, string | number | boolean>): string {
	if (Object.keys(fields).length === 0) return "";
	const lines = ["---"];
	for (const [key, value] of Object.entries(fields)) {
		lines.push(`${key}: ${value}`);
	}
	lines.push("---");
	return `${lines.join("\n")}\n\n`;
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
 * @param symbols - All extracted symbols.
 * @param rootDir - Absolute path to the project root.
 * @returns A map from package name to symbol list.
 * @public
 */
export function groupSymbolsByPackage(
	symbols: ForgeSymbol[],
	rootDir: string,
): Map<string, ForgeSymbol[]> {
	const result = new Map<string, ForgeSymbol[]>();

	for (const symbol of symbols) {
		const rel = relative(rootDir, symbol.filePath);
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
// Page renderers
// ---------------------------------------------------------------------------

const TYPE_KINDS: ReadonlySet<ForgeSymbol["kind"]> = new Set(["interface", "type", "enum"]);

const FUNCTION_KINDS: ReadonlySet<ForgeSymbol["kind"]> = new Set(["function", "class"]);

/** Render a property table row. */
function renderPropertyRow(child: ForgeSymbol): string {
	const name = `\`${child.name}\``;
	const type = child.signature ? `\`${escapePipe(child.signature)}\`` : "—";
	// Heuristic: optional if signature contains `?` or `| undefined`
	const optional =
		child.signature?.includes("?") || child.signature?.includes("undefined") ? "No" : "Yes";
	const description = escapePipe(child.documentation?.summary ?? "");
	return `| ${name} | ${type} | ${optional} | ${description} |`;
}

/**
 * Renders the overview (index) page for a package.
 * @internal
 */
function renderOverviewPage(
	packageName: string,
	symbols: ForgeSymbol[],
	_options: SiteGeneratorOptions,
): string {
	const exported = symbols.filter(
		(s) => s.exported && s.kind !== "method" && s.kind !== "property",
	);

	// Find @packageDocumentation summary from tags
	const pkgDoc = symbols.map((s) => s.documentation?.tags?.packageDocumentation?.[0]).find(Boolean);

	const lines: string[] = [];
	lines.push(`# ${packageName}`);
	lines.push("");

	if (pkgDoc) {
		lines.push(pkgDoc);
		lines.push("");
	}

	if (exported.length > 0) {
		lines.push("## Exported Symbols");
		lines.push("");
		lines.push("| Symbol | Kind | Description |");
		lines.push("|--------|------|-------------|");
		for (const s of exported) {
			const ext = s.kind === "function" ? "()" : "";
			const name = `[\`${s.name}${ext}\`](./api-reference.md#${toAnchor(`${s.name}${ext}`)})`;
			const summary = escapePipe(s.documentation?.summary ?? "");
			lines.push(`| ${name} | ${s.kind} | ${summary} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

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

	const lines: string[] = [];
	lines.push(`# ${packageName} — Types`);
	lines.push("");
	lines.push("Type contracts exported by this package: interfaces, type aliases, and enums.");
	lines.push("");

	for (const s of typeSymbols) {
		lines.push(`## ${s.name}`);
		lines.push("");

		if (s.documentation?.deprecated) {
			lines.push(`> **Deprecated**: ${s.documentation.deprecated}`);
			lines.push("");
		}

		if (s.documentation?.summary) {
			lines.push(s.documentation.summary);
			lines.push("");
		}

		if (s.signature && s.kind !== "interface") {
			lines.push("```typescript");
			lines.push(s.signature);
			lines.push("```");
			lines.push("");
		}

		const children = (s.children ?? []).filter((c) => c.kind === "property" || c.kind === "method");

		if (children.length > 0) {
			lines.push("| Property | Type | Required | Description |");
			lines.push("|----------|------|----------|-------------|");
			for (const child of children) {
				lines.push(renderPropertyRow(child));
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}

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

	const lines: string[] = [];
	lines.push(`# ${packageName} — Functions & Classes`);
	lines.push("");
	lines.push("Functions and classes exported by this package.");
	lines.push("");

	for (const s of fnSymbols) {
		const _ext = s.kind === "function" ? "()" : "";
		const paramSig =
			s.kind === "function" && s.documentation?.params
				? s.documentation.params.map((p) => p.name).join(", ")
				: "";
		const heading = s.kind === "function" ? `${s.name}(${paramSig})` : s.name;

		lines.push(`## ${heading}`);
		lines.push("");

		if (s.documentation?.deprecated) {
			lines.push(`> **Deprecated**: ${s.documentation.deprecated}`);
			lines.push("");
		}

		if (s.documentation?.summary) {
			lines.push(s.documentation.summary);
			lines.push("");
		}

		if (s.signature) {
			lines.push("**Signature**");
			lines.push("");
			lines.push("```typescript");
			lines.push(s.signature);
			lines.push("```");
			lines.push("");
		}

		const params = s.documentation?.params ?? [];
		if (params.length > 0) {
			lines.push("**Parameters**");
			lines.push("");
			lines.push("| Name | Type | Description |");
			lines.push("|------|------|-------------|");
			for (const p of params) {
				const type = p.type ? `\`${escapePipe(p.type)}\`` : "—";
				lines.push(`| \`${p.name}\` | ${type} | ${escapePipe(p.description)} |`);
			}
			lines.push("");
		}

		if (s.documentation?.returns) {
			const retType = s.documentation.returns.type ? ` \`${s.documentation.returns.type}\`` : "";
			lines.push(`**Returns**${retType} — ${s.documentation.returns.description}`);
			lines.push("");
		}

		const throws = s.documentation?.throws ?? [];
		if (throws.length > 0) {
			lines.push("**Throws**");
			lines.push("");
			for (const t of throws) {
				const typeStr = t.type ? `\`${t.type}\` — ` : "";
				lines.push(`- ${typeStr}${t.description}`);
			}
			lines.push("");
		}

		const examples = s.documentation?.examples ?? [];
		if (examples.length > 0) {
			const ex = examples[0];
			lines.push("**Example**");
			lines.push("");
			lines.push(`\`\`\`${ex.language}`);
			lines.push(ex.code.trim());
			lines.push("```");
			lines.push("");
		}

		// Render class methods
		const methods = (s.children ?? []).filter((c) => c.kind === "method");
		if (methods.length > 0) {
			lines.push("**Methods**");
			lines.push("");
			for (const method of methods) {
				lines.push(`### ${method.name}()`);
				lines.push("");
				if (method.documentation?.summary) {
					lines.push(method.documentation.summary);
					lines.push("");
				}
				if (method.signature) {
					lines.push("```typescript");
					lines.push(method.signature);
					lines.push("```");
					lines.push("");
				}
			}
		}
	}

	return lines.join("\n");
}

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

	const lines: string[] = [];
	lines.push(`# ${packageName} — Examples`);
	lines.push("");
	lines.push("All usage examples from the package, aggregated for quick reference.");
	lines.push("");

	let hasExamples = false;

	for (const s of exported) {
		const examples = s.documentation?.examples ?? [];
		if (examples.length === 0) continue;

		hasExamples = true;
		const ext = s.kind === "function" ? "()" : "";
		lines.push(`## \`${s.name}${ext}\``);
		lines.push("");

		if (s.documentation?.summary) {
			lines.push(`_${s.documentation.summary}_`);
			lines.push("");
		}

		lines.push(`[View in API reference](./api-reference.md#${toAnchor(s.name)})`);
		lines.push("");

		for (const ex of examples) {
			lines.push(`\`\`\`${ex.language}`);
			lines.push(ex.code.trim());
			lines.push("```");
			lines.push("");
		}
	}

	if (!hasExamples) {
		lines.push("_No examples documented yet._");
		lines.push("");
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// API reference renderer (full, scoped to one package)
// ---------------------------------------------------------------------------

const KIND_ORDER: ReadonlyArray<ForgeSymbol["kind"]> = [
	"function",
	"class",
	"interface",
	"type",
	"enum",
	"variable",
];

const KIND_LABELS: Record<string, string> = {
	function: "Functions",
	class: "Classes",
	interface: "Interfaces",
	type: "Types",
	enum: "Enums",
	variable: "Variables",
};

/** Render a single symbol section at the given heading depth. */
function renderApiSymbol(symbol: ForgeSymbol, depth: number): string {
	const hashes = "#".repeat(depth);
	const ext = symbol.kind === "function" || symbol.kind === "method" ? "()" : "";
	const lines: string[] = [];

	lines.push(`${hashes} \`${symbol.name}${ext}\``);
	lines.push("");

	if (symbol.documentation?.deprecated) {
		lines.push(`> **Deprecated**: ${symbol.documentation.deprecated}`);
		lines.push("");
	}

	if (symbol.signature) {
		lines.push("```typescript");
		lines.push(symbol.signature);
		lines.push("```");
		lines.push("");
	}

	if (symbol.documentation?.summary) {
		lines.push(symbol.documentation.summary);
		lines.push("");
	}

	const params = symbol.documentation?.params ?? [];
	if (params.length > 0) {
		lines.push("**Parameters**");
		lines.push("");
		for (const p of params) {
			const typeStr = p.type ? ` (\`${p.type}\`)` : "";
			lines.push(`- \`${p.name}\`${typeStr} — ${p.description}`);
		}
		lines.push("");
	}

	if (symbol.documentation?.returns) {
		const retType = symbol.documentation.returns.type
			? ` (\`${symbol.documentation.returns.type}\`)`
			: "";
		lines.push(`**Returns**${retType}: ${symbol.documentation.returns.description}`);
		lines.push("");
	}

	const throws = symbol.documentation?.throws ?? [];
	if (throws.length > 0) {
		lines.push("**Throws**");
		lines.push("");
		for (const t of throws) {
			const typeStr = t.type ? `\`${t.type}\` — ` : "";
			lines.push(`- ${typeStr}${t.description}`);
		}
		lines.push("");
	}

	const examples = symbol.documentation?.examples ?? [];
	if (examples.length > 0) {
		lines.push("**Examples**");
		lines.push("");
		for (const ex of examples) {
			lines.push(`\`\`\`${ex.language}`);
			lines.push(ex.code.trim());
			lines.push("```");
			lines.push("");
		}
	}

	const children = symbol.children ?? [];
	if (children.length > 0 && depth < 5) {
		for (const child of children) {
			lines.push(renderApiSymbol(child, depth + 1));
		}
	}

	return lines.join("\n");
}

/** Render a full API reference page for one package. */
function renderApiReferencePage(packageName: string, symbols: ForgeSymbol[]): string {
	const exported = symbols.filter(
		(s) => s.exported && s.kind !== "method" && s.kind !== "property",
	);

	const groups = new Map<ForgeSymbol["kind"], ForgeSymbol[]>();
	for (const s of exported) {
		const list = groups.get(s.kind) ?? [];
		list.push(s);
		groups.set(s.kind, list);
	}

	const lines: string[] = [];
	lines.push(`# ${packageName} — API Reference`);
	lines.push("");

	for (const kind of KIND_ORDER) {
		const group = groups.get(kind);
		if (!group || group.length === 0) continue;

		lines.push(`## ${KIND_LABELS[kind]}`);
		lines.push("");

		for (const s of group) {
			lines.push(renderApiSymbol(s, 3));
			lines.push("");
		}
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Project-level pages
// ---------------------------------------------------------------------------

/** Render the root index page listing all packages. */
function renderProjectIndexPage(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	options: SiteGeneratorOptions,
): string {
	const lines: string[] = [];
	lines.push(`# ${options.projectName}`);
	lines.push("");

	if (options.projectDescription) {
		lines.push(options.projectDescription);
		lines.push("");
	}

	lines.push("## Packages");
	lines.push("");

	for (const [pkgName, symbols] of symbolsByPackage) {
		const exported = symbols.filter(
			(s) => s.exported && s.kind !== "method" && s.kind !== "property",
		);
		const pkgDoc = symbols
			.map((s) => s.documentation?.tags?.packageDocumentation?.[0])
			.find(Boolean);
		const summary = pkgDoc ?? `${exported.length} exported symbol(s).`;
		lines.push(`### [${pkgName}](./packages/${pkgName}/index.md)`);
		lines.push("");
		lines.push(summary);
		lines.push("");
	}

	return lines.join("\n");
}

/** Render a getting-started page using the first @example from any exported function. */
function renderGettingStartedPage(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	options: SiteGeneratorOptions,
): string {
	// Find the first exported function with an example
	let firstExample: { code: string; language: string } | undefined;
	let firstSymbolName = "";
	let firstPackageName = "";

	outer: for (const [pkgName, symbols] of symbolsByPackage) {
		for (const s of symbols) {
			if (!s.exported || s.kind !== "function") continue;
			const ex = s.documentation?.examples?.[0];
			if (ex) {
				firstExample = ex;
				firstSymbolName = s.name;
				firstPackageName = pkgName;
				break outer;
			}
		}
	}

	const lines: string[] = [];
	lines.push("# Getting Started");
	lines.push("");
	lines.push(`Welcome to **${options.projectName}**.`);

	if (options.projectDescription) {
		lines.push("");
		lines.push(options.projectDescription);
	}

	lines.push("");
	lines.push("## Installation");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install ${options.projectName}`);
	lines.push("```");
	lines.push("");

	if (firstExample) {
		lines.push("## Quick Start");
		lines.push("");
		lines.push(
			`The following example demonstrates \`${firstSymbolName}\` from the \`${firstPackageName}\` package.`,
		);
		lines.push("");
		lines.push(`\`\`\`${firstExample.language}`);
		lines.push(firstExample.code.trim());
		lines.push("```");
		lines.push("");
	}

	lines.push("## Next Steps");
	lines.push("");
	lines.push("- Browse the [API Reference](./packages/)");
	for (const pkgName of symbolsByPackage.keys()) {
		lines.push(`  - [${pkgName}](./packages/${pkgName}/api-reference.md)`);
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generates a full multi-page documentation site from symbols grouped by package.
 *
 * Produces an index page, a getting-started page, and per-package pages for
 * the API reference, types, functions, and examples.
 *
 * @param symbolsByPackage - Symbols grouped by package name.
 * @param config - The resolved {@link ForgeConfig}.
 * @param options - Site generation options.
 * @returns An array of {@link DocPage} objects ready to be written to disk.
 * @public
 */
export function generateDocSite(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	config: ForgeConfig,
	options: SiteGeneratorOptions,
): DocPage[] {
	const ext = options.format === "mdx" ? "mdx" : "md";
	const pages: DocPage[] = [];

	// Project index
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

	// Per-package pages
	let pkgPosition = 1;
	for (const [pkgName, symbols] of symbolsByPackage) {
		const pkgBase = `packages/${pkgName}`;

		// Package index
		const overviewContent = renderOverviewPage(pkgName, symbols, options);
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

		// API reference
		const apiContent = renderApiReferencePage(pkgName, symbols);
		const apiFrontmatter = buildFrontmatterFields(
			`${pkgName} — API Reference`,
			`Full API reference for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/api-reference.${ext}`,
			content: `${serializeFrontmatter(apiFrontmatter)}${apiContent.trimEnd()}\n`,
			frontmatter: apiFrontmatter,
		});

		// Types page
		const typesContent = renderTypesPage(pkgName, symbols, options);
		const typesFrontmatter = buildFrontmatterFields(
			`${pkgName} — Types`,
			`Type contracts for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/types.${ext}`,
			content: `${serializeFrontmatter(typesFrontmatter)}${typesContent.trimEnd()}\n`,
			frontmatter: typesFrontmatter,
		});

		// Functions page
		const functionsContent = renderFunctionsPage(pkgName, symbols, options);
		const functionsFrontmatter = buildFrontmatterFields(
			`${pkgName} — Functions`,
			`Functions and classes for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/functions.${ext}`,
			content: `${serializeFrontmatter(functionsFrontmatter)}${functionsContent.trimEnd()}\n`,
			frontmatter: functionsFrontmatter,
		});

		// Examples page
		const examplesContent = renderExamplesPage(pkgName, symbols, options);
		const examplesFrontmatter = buildFrontmatterFields(
			`${pkgName} — Examples`,
			`Usage examples for the ${pkgName} package`,
			options.ssgTarget,
		);
		pages.push({
			path: `${pkgBase}/examples.${ext}`,
			content: `${serializeFrontmatter(examplesFrontmatter)}${examplesContent.trimEnd()}\n`,
			frontmatter: examplesFrontmatter,
		});

		pkgPosition++;
	}

	// Suppress unused variable warning — config is available for future use
	void config;

	return pages;
}
