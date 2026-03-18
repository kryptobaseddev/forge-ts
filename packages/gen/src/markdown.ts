import { relative } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@codluv/forge-core";

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

/** Convert a label to a GitHub-compatible anchor slug. */
function toAnchor(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

/** Build the frontmatter block for the configured SSG target. */
function buildFrontmatter(config: ForgeConfig, mdx: boolean): string {
	const target = config.gen.ssgTarget;
	if (!target) return "";

	const lines: string[] = ["---"];

	switch (target) {
		case "docusaurus":
			lines.push("sidebar_position: 1");
			lines.push("title: API Reference");
			break;
		case "mintlify":
			lines.push("title: API Reference");
			break;
		case "nextra":
			lines.push("title: API Reference");
			lines.push("description: Auto-generated API reference");
			break;
		case "vitepress":
			lines.push("title: API Reference");
			lines.push("outline: deep");
			break;
	}

	lines.push("---");
	if (mdx) {
		lines.push("");
	}
	return `${lines.join("\n")}\n`;
}

/** Build MDX import block for custom components. */
function buildMdxImports(): string {
	return 'import { Callout } from "@components/Callout";\n\n';
}

/**
 * Render a deprecation notice banner.
 * @internal
 */
function renderDeprecation(deprecated: string): string {
	return `> **Deprecated**: ${deprecated}\n`;
}

/**
 * Render source location line.
 * @internal
 */
function renderSourceLink(symbol: ForgeSymbol, rootDir: string): string {
	const rel = relative(rootDir, symbol.filePath);
	return `_Defined in \`${rel}:${symbol.line}\`_\n`;
}

/**
 * Renders a symbol at H3 level (used for both top-level and children).
 * @internal
 */
function renderSymbolSection(
	symbol: ForgeSymbol,
	rootDir: string,
	mdx: boolean,
	depth: number,
): string {
	const lines: string[] = [];
	const hashes = "#".repeat(depth);
	const ext = symbol.kind === "function" || symbol.kind === "method" ? "()" : "";
	lines.push(`${hashes} \`${symbol.name}${ext}\``);
	lines.push("");

	if (symbol.documentation?.deprecated) {
		lines.push(renderDeprecation(symbol.documentation.deprecated));
	}

	lines.push(renderSourceLink(symbol, rootDir));

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

	// Render children (class members, enum values, interface properties)
	const children = symbol.children ?? [];
	if (children.length > 0 && depth < 5) {
		const childDepth = depth + 1;
		for (const child of children) {
			lines.push(renderSymbolSection(child, rootDir, mdx, childDepth));
		}
	}

	return lines.join("\n");
}

/**
 * Build a Table of Contents from grouped symbols.
 * @internal
 */
function buildToc(groups: Map<ForgeSymbol["kind"], ForgeSymbol[]>): string {
	const lines: string[] = [];
	lines.push("## Table of Contents");
	lines.push("");

	for (const kind of KIND_ORDER) {
		const group = groups.get(kind);
		if (!group || group.length === 0) continue;

		const label = KIND_LABELS[kind];
		const anchor = toAnchor(label);
		lines.push(`- [${label}](#${anchor})`);

		for (const symbol of group) {
			const ext = kind === "function" ? "()" : "";
			const displayName = `${symbol.name}${ext}`;
			const symAnchor = toAnchor(displayName);
			lines.push(`  - [\`${displayName}\`](#${symAnchor})`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * Generates a Markdown (or MDX) string from a list of symbols.
 *
 * @param symbols - The symbols to document.
 * @param config - The resolved {@link ForgeConfig}.
 * @param options - Rendering options.
 * @returns The generated Markdown string.
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

	const parts: string[] = [];

	// Frontmatter
	const frontmatter = buildFrontmatter(config, mdx);
	if (frontmatter) {
		parts.push(frontmatter);
	}

	// MDX imports
	if (mdx) {
		parts.push(buildMdxImports());
	}

	// Page title + preamble
	parts.push("# API Reference\n");
	parts.push(
		`Generated by [forge-ts](https://github.com/forge-ts/forge-ts) from \`${config.rootDir}\`.\n`,
	);

	// Table of Contents
	if (topLevel.length > 0) {
		parts.push(buildToc(groups));
	}

	// Symbol groups
	for (const kind of KIND_ORDER) {
		const group = groups.get(kind);
		if (!group || group.length === 0) continue;

		const label = KIND_LABELS[kind];
		parts.push(`## ${label}\n`);

		for (const symbol of group) {
			parts.push(renderSymbolSection(symbol, config.rootDir, mdx, 3));
			parts.push("");
		}
	}

	return `${parts
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}
