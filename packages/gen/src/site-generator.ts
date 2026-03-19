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
	/** Repository URL (auto-detected from package.json). */
	repositoryUrl?: string;
	/** npm package name for install commands. */
	packageName?: string;
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

/**
 * Strip `.md` or `.mdx` extension from a link path and normalise leading `./`.
 * Produces bare slug links compatible with Mintlify and most other SSGs.
 * @internal
 */
function slugLink(path: string): string {
	// Remove leading ./ if present
	let slug = path.startsWith("./") ? path.slice(2) : path;
	// Remove .md / .mdx extension
	slug = slug.replace(/\.(mdx?)$/, "");
	return `/${slug}`;
}

/** Truncate a description to at most maxLen chars. */
function truncate(text: string, maxLen = 80): string {
	if (text.length <= maxLen) return text;
	return `${text.slice(0, maxLen - 3)}...`;
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
	const lines: string[] = [];

	// Intro — no h1, frontmatter title handles the heading
	if (options.projectDescription) {
		lines.push(`**${options.projectName}** — ${options.projectDescription}`);
	} else {
		lines.push(
			`**${options.projectName}** is a TypeScript documentation toolkit that performs a single AST traversal of your project and produces API docs, OpenAPI specs, executable doctests, and AI context files in one pass.`,
		);
	}
	lines.push("");

	// Features section
	lines.push("## Features");
	lines.push("");

	const pkgCount = symbolsByPackage.size;
	if (pkgCount > 1) {
		lines.push(`- ${pkgCount} packages with full TypeScript support`);
	} else {
		lines.push("- Full TypeScript support with TSDoc extraction");
	}
	lines.push("- Auto-generated API reference from source code");
	lines.push("- Executable `@example` blocks as doctests");
	lines.push("- AI-ready context files from a single build pass");
	lines.push("");

	// Installation section
	lines.push("## Installation");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install -D ${options.packageName ?? "@forge-ts/cli"}`);
	lines.push("```");
	lines.push("");

	// Quick Example — first @example from any exported function
	let firstExample: { code: string; language: string } | undefined;
	outer: for (const [, symbols] of symbolsByPackage) {
		for (const s of symbols) {
			if (!s.exported || s.kind !== "function") continue;
			const ex = s.documentation?.examples?.[0];
			if (ex) {
				firstExample = ex;
				break outer;
			}
		}
	}

	if (firstExample) {
		lines.push("## Quick Example");
		lines.push("");
		lines.push(`\`\`\`${firstExample.language || "typescript"}`);
		lines.push(firstExample.code.trim());
		lines.push("```");
		lines.push("");
	}

	// Packages table
	if (symbolsByPackage.size > 0) {
		lines.push("## Packages");
		lines.push("");
		lines.push("| Package | Description |");
		lines.push("|---------|-------------|");
		for (const [pkgName, symbols] of symbolsByPackage) {
			const pkgDoc = symbols
				.map((s) => s.documentation?.tags?.packageDocumentation?.[0])
				.find(Boolean);
			const exported = symbols.filter(
				(s) => s.exported && s.kind !== "method" && s.kind !== "property",
			);
			const rawDesc = pkgDoc ?? `${exported.length} exported symbol(s).`;
			const desc = escapePipe(truncate(rawDesc));
			const link = `[\`${pkgName}\`](${slugLink(`packages/${pkgName}/index`)})`;
			lines.push(`| ${link} | ${desc} |`);
		}
		lines.push("");
	}

	// Next Steps
	lines.push("## Next Steps");
	lines.push("");
	lines.push(`- [Getting Started](/getting-started) — Step-by-step guide`);
	lines.push(`- [API Reference](/packages) — Full API documentation`);
	lines.push(`- [Concepts](/concepts) — How it works`);

	return lines.join("\n");
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
	// Find the first exported function with an example
	let firstExample: { code: string; language: string } | undefined;

	outer: for (const [, symbols] of symbolsByPackage) {
		for (const s of symbols) {
			if (!s.exported || s.kind !== "function") continue;
			const ex = s.documentation?.examples?.[0];
			if (ex) {
				firstExample = ex;
				break outer;
			}
		}
	}

	const lines: string[] = [];

	// No h1 — frontmatter title handles the heading
	lines.push(`Get up and running with **${options.projectName}** in minutes.`);

	if (options.projectDescription) {
		lines.push("");
		lines.push(options.projectDescription);
	}

	lines.push("");
	lines.push("## Step 1: Install");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install -D ${options.packageName ?? "@forge-ts/cli"}`);
	lines.push("```");
	lines.push("");

	lines.push("## Step 2: Add TSDoc to your code");
	lines.push("");
	lines.push("Add TSDoc comments to your exported functions and types:");
	lines.push("");
	lines.push("```typescript");
	lines.push("/**");
	lines.push(" * Adds two numbers together.");
	lines.push(" * @param a - First number");
	lines.push(" * @param b - Second number");
	lines.push(" * @returns The sum of a and b");
	lines.push(" * @example");
	lines.push(" * ```typescript");
	lines.push(" * const result = add(1, 2); // => 3");
	lines.push(" * ```");
	lines.push(" */");
	lines.push("export function add(a: number, b: number): number {");
	lines.push("  return a + b;");
	lines.push("}");
	lines.push("```");
	lines.push("");

	lines.push("## Step 3: Run forge-ts check");
	lines.push("");
	lines.push("Lint your TSDoc coverage before generating docs:");
	lines.push("");
	lines.push("```bash");
	lines.push("npx forge-ts check");
	lines.push("```");
	lines.push("");
	lines.push("Expected output:");
	lines.push("");
	lines.push("```");
	lines.push("forge-ts: checking TSDoc coverage...");
	lines.push("  ✓ All public symbols documented");
	lines.push("```");
	lines.push("");

	lines.push("## Step 4: Generate docs");
	lines.push("");
	lines.push("Build your documentation site:");
	lines.push("");
	lines.push("```bash");
	lines.push("npx forge-ts build");
	lines.push("```");
	lines.push("");

	if (firstExample) {
		lines.push("Your code examples become live documentation:");
		lines.push("");
		lines.push(`\`\`\`${firstExample.language || "typescript"}`);
		lines.push(firstExample.code.trim());
		lines.push("```");
		lines.push("");
	}

	lines.push("## What's Next?");
	lines.push("");
	lines.push("- [Concepts](/concepts) — Understand how forge-ts works");
	lines.push("- [API Reference](/packages) — Full API documentation");
	lines.push("- [Guides](/guides) — Practical how-to guides");

	return lines.join("\n");
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
	const lines: string[] = [];

	lines.push(`This page explains the core concepts behind **${options.projectName}**.`);
	lines.push("");
	lines.push(
		"> This is a stub page. Edit this file to add your project's conceptual documentation.",
	);
	lines.push("");

	// Auto-generated description from @packageDocumentation
	const pkgDoc = [...symbolsByPackage.values()]
		.flatMap((syms) => syms.map((s) => s.documentation?.tags?.packageDocumentation?.[0]))
		.find(Boolean);

	lines.push("## How It Works");
	lines.push("");
	if (pkgDoc) {
		lines.push(pkgDoc);
	} else {
		lines.push(
			`${options.projectName} processes your TypeScript source with a single AST traversal, extracting TSDoc comments and type information to generate documentation.`,
		);
	}
	lines.push("");

	// Key abstractions — list exported types as bullet points
	const allTypeSymbols = [...symbolsByPackage.values()]
		.flat()
		.filter((s) => s.exported && TYPE_KINDS.has(s.kind));

	if (allTypeSymbols.length > 0) {
		lines.push("## Key Abstractions");
		lines.push("");
		for (const s of allTypeSymbols) {
			const desc = s.documentation?.summary ?? `The \`${s.name}\` ${s.kind}.`;
			lines.push(`- **\`${s.name}\`** — ${desc}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// BUILD: Guides index (stub)
// ---------------------------------------------------------------------------

/**
 * Render the guides index stub page.
 * @internal
 */
function renderGuidesIndexPage(): string {
	return [
		"Practical how-to guides for common tasks.",
		"",
		"> Add your guides to the `guides/` directory. Each `.md` or `.mdx` file will appear here automatically.",
		"",
		"## Getting Things Done",
		"",
		"Guides will appear here as you add them. Start by creating a file like `guides/my-guide.md`.",
		"",
	].join("\n");
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

	const lines: string[] = [];

	// Find @packageDocumentation summary
	const pkgDoc = symbols.map((s) => s.documentation?.tags?.packageDocumentation?.[0]).find(Boolean);
	if (pkgDoc) {
		lines.push(pkgDoc);
		lines.push("");
	} else {
		lines.push(`API reference for the \`${pkgName}\` package.`);
		lines.push("");
	}

	const renderGroup = (group: ForgeSymbol[], heading: string, pathSuffix: string) => {
		if (group.length === 0) return;
		lines.push(`## ${heading}`);
		lines.push("");
		lines.push("| Symbol | Kind | Description |");
		lines.push("|--------|------|-------------|");
		for (const s of group) {
			const ext = s.kind === "function" ? "()" : "";
			const anchor = toAnchor(`${s.name}${ext}`);
			const link = `[\`${s.name}${ext}\`](${slugLink(`packages/${pkgName}/${pathSuffix}`)}#${anchor})`;
			const rawSummary = s.documentation?.summary ?? "";
			const summary = escapePipe(truncate(rawSummary));
			lines.push(`| ${link} | ${s.kind} | ${summary} |`);
		}
		lines.push("");
	};

	renderGroup(functions, "Functions & Classes", "api/functions");
	renderGroup(types, "Types & Interfaces", "api/types");
	renderGroup(others, "Other Exports", "api/functions");

	return lines.join("\n");
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

	const lines: string[] = [];

	// No h1 — frontmatter title handles the heading in Mintlify and other SSGs

	if (pkgDoc) {
		lines.push(pkgDoc);
		lines.push("");
	}

	if (exported.length > 0) {
		// Group by kind: functions first, then types, then others
		const functions = exported.filter((s) => FUNCTION_KINDS.has(s.kind));
		const types = exported.filter((s) => TYPE_KINDS.has(s.kind));
		const others = exported.filter((s) => !FUNCTION_KINDS.has(s.kind) && !TYPE_KINDS.has(s.kind));

		const renderGroup = (group: ForgeSymbol[], heading: string) => {
			if (group.length === 0) return;
			lines.push(`## ${heading}`);
			lines.push("");
			lines.push("| Symbol | Kind | Description |");
			lines.push("|--------|------|-------------|");
			for (const s of group) {
				const ext = s.kind === "function" ? "()" : "";
				const name = `[\`${s.name}${ext}\`](${slugLink(`packages/${packageName}/api/index`)}#${toAnchor(`${s.name}${ext}`)})`;
				const rawSummary = s.documentation?.summary ?? "";
				const summary = escapePipe(truncate(rawSummary));
				lines.push(`| ${name} | ${s.kind} | ${summary} |`);
			}
			lines.push("");
		};

		renderGroup(functions, "Functions & Classes");
		renderGroup(types, "Types & Interfaces");
		renderGroup(others, "Other Exports");
	}

	return lines.join("\n");
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

	const lines: string[] = [];
	// No h1 — frontmatter title handles the heading
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
				const name = `\`${child.name}\``;
				const type = child.signature ? `\`${escapePipe(child.signature)}\`` : "—";
				const optional =
					child.signature?.includes("?") || child.signature?.includes("undefined") ? "No" : "Yes";
				const description = escapePipe(child.documentation?.summary || child.name);
				lines.push(`| ${name} | ${type} | ${optional} | ${description} |`);
			}
			lines.push("");
		}
	}

	// Suppress unused variable warning
	void packageName;

	return lines.join("\n");
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

	const lines: string[] = [];
	// No h1 — frontmatter title handles the heading
	lines.push("Functions and classes exported by this package.");
	lines.push("");

	for (const s of fnSymbols) {
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
				// Fall back to extracting type from signature when param.type is absent
				let resolvedType = p.type;
				if (!resolvedType && s.signature) {
					// Try to match `paramName: SomeType` in the signature
					const typeMatch = new RegExp(`\\b${p.name}\\s*[?:]\\s*([^,)]+)`).exec(s.signature);
					if (typeMatch) {
						resolvedType = typeMatch[1].trim();
					}
				}
				const type = resolvedType ? `\`${escapePipe(resolvedType)}\`` : "—";
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
			lines.push(`\`\`\`${ex.language || "typescript"}`);
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

	// Suppress unused variable warning
	void packageName;

	return lines.join("\n");
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

	const lines: string[] = [];
	// No h1 — frontmatter title handles the heading
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

		lines.push(
			`[View in API reference](${slugLink(`packages/${packageName}/api/functions`)}#${toAnchor(s.name)})`,
		);
		lines.push("");

		for (const ex of examples) {
			lines.push(`\`\`\`${ex.language || "typescript"}`);
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

	const lines: string[] = [];

	lines.push(`Configuration reference for **${options.projectName}**.`);
	lines.push("");
	lines.push("> This is a stub page. Edit this file to document your configuration options.");
	lines.push("");
	lines.push("## forge-ts.config.ts");
	lines.push("");
	lines.push("Create a `forge-ts.config.ts` file in your project root:");
	lines.push("");
	lines.push("```typescript");
	lines.push('import { defineConfig } from "@forge-ts/core";');
	lines.push("");
	lines.push("export default defineConfig({");
	lines.push('  rootDir: ".",');
	lines.push('  outDir: "docs/generated",');
	lines.push("});");
	lines.push("```");
	lines.push("");

	if (configSymbol) {
		lines.push(`## \`${configSymbol.name}\``);
		lines.push("");
		if (configSymbol.documentation?.summary) {
			lines.push(configSymbol.documentation.summary);
			lines.push("");
		}
		const children = (configSymbol.children ?? []).filter(
			(c) => c.kind === "property" || c.kind === "method",
		);
		if (children.length > 0) {
			lines.push("| Property | Type | Required | Description |");
			lines.push("|----------|------|----------|-------------|");
			for (const child of children) {
				const name = `\`${child.name}\``;
				const type = child.signature ? `\`${escapePipe(child.signature)}\`` : "—";
				const optional =
					child.signature?.includes("?") || child.signature?.includes("undefined") ? "No" : "Yes";
				const description = escapePipe(child.documentation?.summary || child.name);
				lines.push(`| ${name} | ${type} | ${optional} | ${description} |`);
			}
			lines.push("");
		}
	}

	return lines.join("\n");
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
	const changelogLink = repoUrl
		? `See [CHANGELOG.md](${repoUrl}/blob/main/CHANGELOG.md) for the full release history.`
		: "See your project's `CHANGELOG.md` for the full release history.";
	return [
		`Release history for **${options.projectName}**.`,
		"",
		"> This is a stub page. Link to or embed your `CHANGELOG.md` here.",
		"",
		changelogLink,
		"",
	].join("\n");
}

// ---------------------------------------------------------------------------
// COMMUNITY: FAQ (stub)
// ---------------------------------------------------------------------------

/**
 * Render the FAQ stub page.
 * @internal
 */
function renderFaqPage(options: SiteGeneratorOptions): string {
	return [
		`Frequently asked questions about **${options.projectName}**.`,
		"",
		"> This is a stub page. Common questions will be added here as they arise.",
		"",
		"## How do I configure forge-ts?",
		"",
		"Create a `forge-ts.config.ts` file in your project root. See [Configuration](/configuration).",
		"",
		"## What TypeScript version is required?",
		"",
		"forge-ts requires TypeScript 5.0 or later.",
		"",
		"## How do I run @example blocks as tests?",
		"",
		"```bash",
		"npx forge-ts test",
		"```",
		"",
	].join("\n");
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
	const contribLink = repoUrl
		? `See [CONTRIBUTING.md](${repoUrl}/blob/main/CONTRIBUTING.md) for contribution guidelines.`
		: "See your project's `CONTRIBUTING.md` for contribution guidelines.";
	return [
		`Contributing to **${options.projectName}**.`,
		"",
		"> This is a stub page. Link to or embed your `CONTRIBUTING.md` here.",
		"",
		contribLink,
		"",
	].join("\n");
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
	});

	// -------------------------------------------------------------------------
	// BUILD
	// -------------------------------------------------------------------------

	const guidesContent = renderGuidesIndexPage();
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
	});

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
	});

	// Suppress unused variable warning — config is available for future use
	void config;

	return pages;
}
