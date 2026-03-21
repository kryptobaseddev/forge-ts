import { relative } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { stringifyWithFrontmatter } from "./markdown-utils.js";
import {
	type MdBlock,
	type MdListItem,
	md,
	rawBlock,
	serializeMarkdown,
	toAnchor,
} from "./mdast-builders.js";

/**
 * Options controlling Markdown output.
 * @public
 */
export interface MarkdownOptions {
	/** Whether to use MDX syntax (default: Markdown). */
	mdx?: boolean;
}

/** Display labels for each symbol kind. */
const KIND_LABELS: Record<ForgeSymbol["kind"], string> = {
	function: "Functions",
	class: "Classes",
	interface: "Interfaces",
	type: "Types",
	enum: "Enums",
	variable: "Variables",
	method: "Methods",
	property: "Properties",
};

/** Canonical ordering for top-level kind groups. */
const KIND_ORDER: Array<ForgeSymbol["kind"]> = [
	"function",
	"class",
	"interface",
	"type",
	"enum",
	"variable",
];

/** Build the frontmatter block for the configured SSG target using gray-matter. */
function buildFrontmatter(config: ForgeConfig, _mdx: boolean): string {
	const target = config.gen.ssgTarget;
	if (!target) return "";

	const fields: Record<string, string | number | boolean> = {};

	switch (target) {
		case "docusaurus":
			fields.sidebar_position = 1;
			fields.title = "API Reference";
			break;
		case "mintlify":
			fields.title = "API Reference";
			break;
		case "nextra":
			fields.title = "API Reference";
			fields.description = "Auto-generated API reference";
			break;
		case "vitepress":
			fields.title = "API Reference";
			fields.outline = "deep";
			break;
	}

	return stringifyWithFrontmatter("", fields);
}

/** Build MDX import block for custom components. */
function buildMdxImports(): string {
	return 'import { Callout } from "@components/Callout";\n\n';
}

// ---------------------------------------------------------------------------
// Symbol rendering (AST-based)
// ---------------------------------------------------------------------------

/**
 * Renders a symbol section as mdast blocks.
 * Used for both top-level symbols (depth=3) and children (depth=4+).
 * @internal
 */
function renderSymbolBlocks(symbol: ForgeSymbol, rootDir: string, depth: number): MdBlock[] {
	const nodes: MdBlock[] = [];
	const ext = symbol.kind === "function" || symbol.kind === "method" ? "()" : "";
	const headingDepth = Math.min(depth, 6) as 1 | 2 | 3 | 4 | 5 | 6;
	nodes.push(md.heading(headingDepth, md.inlineCode(`${symbol.name}${ext}`)));

	if (symbol.documentation?.deprecated) {
		// Deprecation text may contain markdown formatting from TSDoc
		nodes.push(rawBlock(`> **Deprecated**: ${symbol.documentation.deprecated}`));
	}

	// Source location
	const rel = relative(rootDir, symbol.filePath);
	nodes.push(rawBlock(`_Defined in \`${rel}:${symbol.line}\`_`));

	if (symbol.signature) {
		nodes.push(md.code("typescript", symbol.signature));
	}

	if (symbol.documentation?.summary) {
		// Summary may contain markdown formatting from TSDoc
		nodes.push(rawBlock(symbol.documentation.summary));
	}

	const params = symbol.documentation?.params ?? [];
	if (params.length > 0) {
		nodes.push(rawBlock("**Parameters**"));
		const paramItems: MdListItem[] = [];
		for (const p of params) {
			const typeStr = p.type ? ` (\`${p.type}\`)` : "";
			// Description may contain markdown from TSDoc
			paramItems.push(md.listItem(rawBlock(`\`${p.name}\`${typeStr} — ${p.description}`)));
		}
		nodes.push(md.list(paramItems));
	}

	if (symbol.documentation?.returns) {
		const retType = symbol.documentation.returns.type
			? ` (\`${symbol.documentation.returns.type}\`)`
			: "";
		nodes.push(rawBlock(`**Returns**${retType}: ${symbol.documentation.returns.description}`));
	}

	const throws = symbol.documentation?.throws ?? [];
	if (throws.length > 0) {
		nodes.push(rawBlock("**Throws**"));
		const throwItems: MdListItem[] = [];
		for (const t of throws) {
			const typeStr = t.type ? `\`${t.type}\` — ` : "";
			throwItems.push(md.listItem(rawBlock(`${typeStr}${t.description}`)));
		}
		nodes.push(md.list(throwItems));
	}

	const examples = symbol.documentation?.examples ?? [];
	if (examples.length > 0) {
		nodes.push(rawBlock("**Examples**"));
		for (const ex of examples) {
			nodes.push(md.code(ex.language, ex.code.trim()));
		}
	}

	// Render children (class members, enum values, interface properties)
	const children = symbol.children ?? [];
	if (children.length > 0 && depth < 5) {
		for (const child of children) {
			nodes.push(...renderSymbolBlocks(child, rootDir, depth + 1));
		}
	}

	return nodes;
}

/**
 * Build a Table of Contents as mdast blocks.
 * @internal
 */
function buildTocBlocks(groups: Map<ForgeSymbol["kind"], ForgeSymbol[]>): MdBlock[] {
	const tocItems: MdListItem[] = [];

	for (const kind of KIND_ORDER) {
		const group = groups.get(kind);
		if (!group || group.length === 0) continue;

		const label = KIND_LABELS[kind];
		const anchor = toAnchor(label);

		// Sub-items for each symbol in this group
		const subItems: MdListItem[] = [];
		for (const symbol of group) {
			const ext = kind === "function" ? "()" : "";
			const displayName = `${symbol.name}${ext}`;
			const symAnchor = toAnchor(displayName);
			subItems.push(
				md.listItem(md.paragraph(md.link(`#${symAnchor}`, md.inlineCode(displayName)))),
			);
		}

		tocItems.push(
			md.listItem(md.paragraph(md.link(`#${anchor}`, md.text(label))), md.list(subItems)),
		);
	}

	return [md.heading(2, md.text("Table of Contents")), md.list(tocItems)];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generates a Markdown (or MDX) string from a list of symbols.
 *
 * @param symbols - The symbols to document.
 * @param config - The resolved {@link ForgeConfig}.
 * @param options - Rendering options.
 * @returns The generated Markdown string.
 * @example
 * ```typescript
 * import { generateMarkdown } from "@forge-ts/gen";
 * const md = generateMarkdown(symbols, config, { mdx: false });
 * console.log(md.startsWith("# API Reference")); // true
 * ```
 * @public
 */
export function generateMarkdown(
	symbols: ForgeSymbol[],
	config: ForgeConfig,
	options: MarkdownOptions = {},
): string {
	const mdx = options.mdx ?? false;
	const exported = symbols.filter((s) => s.exported);

	// Group by kind (top-level only — children are nested under their parent)
	const topLevel = exported.filter((s) => s.kind !== "method" && s.kind !== "property");

	const groups = new Map<ForgeSymbol["kind"], ForgeSymbol[]>();
	for (const symbol of topLevel) {
		const list = groups.get(symbol.kind) ?? [];
		list.push(symbol);
		groups.set(symbol.kind, list);
	}

	// Build the body as mdast nodes
	const nodes: MdBlock[] = [];

	// Page title + preamble
	nodes.push(md.heading(1, md.text("API Reference")));
	nodes.push(
		md.paragraph(
			md.text("Generated by "),
			md.link("https://github.com/kryptobaseddev/forge-ts", md.text("forge-ts")),
			md.text(" from "),
			md.inlineCode(config.rootDir),
			md.text("."),
		),
	);

	// Table of Contents
	if (topLevel.length > 0) {
		nodes.push(...buildTocBlocks(groups));
	}

	// Symbol groups
	for (const kind of KIND_ORDER) {
		const group = groups.get(kind);
		if (!group || group.length === 0) continue;

		const label = KIND_LABELS[kind];
		nodes.push(md.heading(2, md.text(label)));

		for (const symbol of group) {
			nodes.push(...renderSymbolBlocks(symbol, config.rootDir, 3));
		}
	}

	// Serialize the body
	const body = serializeMarkdown(md.root(...nodes));

	// Prepend frontmatter and MDX imports (these are not markdown constructs)
	const parts: string[] = [];
	const frontmatter = buildFrontmatter(config, mdx);
	if (frontmatter) {
		parts.push(frontmatter);
	}
	if (mdx) {
		parts.push(buildMdxImports());
	}
	parts.push(body);

	return `${parts.join("").trimEnd()}\n`;
}
