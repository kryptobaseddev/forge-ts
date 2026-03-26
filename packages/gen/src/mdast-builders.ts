/**
 * Mdast AST node builders and markdown serialization.
 *
 * Provides concise factory functions for constructing mdast trees
 * and a serializer that produces well-formed markdown via remark-stringify.
 *
 * @internal
 */

import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

// ---------------------------------------------------------------------------
// Mdast type definitions (subset used by forge-ts generation)
// ---------------------------------------------------------------------------

/** Inline leaf node: literal text. */
export interface MdText {
	/** Node discriminant — always `"text"`. */
	type: "text";
	/** The raw text content. */
	value: string;
}

/** Inline leaf node: code span. */
export interface MdInlineCode {
	/** Node discriminant — always `"inlineCode"`. */
	type: "inlineCode";
	/** The code span content (without surrounding backticks). */
	value: string;
}

/** Inline container: strong emphasis (bold). */
export interface MdStrong {
	/** Node discriminant — always `"strong"`. */
	type: "strong";
	/** Inline content rendered in bold. */
	children: MdPhrasing[];
}

/** Inline container: emphasis (italic). */
export interface MdEmphasis {
	/** Node discriminant — always `"emphasis"`. */
	type: "emphasis";
	/** Inline content rendered in italic. */
	children: MdPhrasing[];
}

/** Inline container: hyperlink. */
export interface MdLink {
	/** Node discriminant — always `"link"`. */
	type: "link";
	/** The link destination URL. */
	url: string;
	/** Inline content rendered as the link text. */
	children: MdPhrasing[];
}

/** Union of all inline (phrasing) content types. */
export type MdPhrasing = MdText | MdInlineCode | MdStrong | MdEmphasis | MdLink;

/** Block node: heading (depth 1-6). */
export interface MdHeading {
	/** Node discriminant — always `"heading"`. */
	type: "heading";
	/** Heading level: 1 for `#`, 2 for `##`, up to 6 for `######`. */
	depth: 1 | 2 | 3 | 4 | 5 | 6;
	/** Inline content of the heading. */
	children: MdPhrasing[];
}

/** Block node: paragraph. */
export interface MdParagraph {
	/** Node discriminant — always `"paragraph"`. */
	type: "paragraph";
	/** Inline content of the paragraph. */
	children: MdPhrasing[];
}

/** Block node: fenced code block. */
export interface MdCode {
	/** Node discriminant — always `"code"`. */
	type: "code";
	/**
	 * Language tag for syntax highlighting.
	 * @defaultValue null
	 */
	lang?: string | null;
	/** The code content (without the fence delimiters). */
	value: string;
}

/** Block node: blockquote. */
export interface MdBlockquote {
	/** Node discriminant — always `"blockquote"`. */
	type: "blockquote";
	/** Block-level content inside the quote. */
	children: MdBlock[];
}

/** Block node: raw HTML (including comments). */
export interface MdHtml {
	/** Node discriminant — always `"html"`. */
	type: "html";
	/** The raw HTML string. */
	value: string;
}

/** Block node: horizontal rule. */
export interface MdThematicBreak {
	/** Node discriminant — always `"thematicBreak"`. */
	type: "thematicBreak";
}

/** List item container. */
export interface MdListItem {
	/** Node discriminant — always `"listItem"`. */
	type: "listItem";
	/**
	 * Whether blank lines separate this item's children.
	 * @defaultValue false
	 */
	spread?: boolean;
	/** Block-level content of the list item. */
	children: MdBlock[];
}

/** Block node: ordered or unordered list. */
export interface MdList {
	/** Node discriminant — always `"list"`. */
	type: "list";
	/**
	 * `true` for numbered lists, `false` for bullet lists.
	 * @defaultValue false
	 */
	ordered?: boolean;
	/**
	 * Whether blank lines separate list items.
	 * @defaultValue false
	 */
	spread?: boolean;
	/** The list items. */
	children: MdListItem[];
}

/** GFM table cell. */
export interface MdTableCell {
	/** Node discriminant — always `"tableCell"`. */
	type: "tableCell";
	/** Inline content of the cell. */
	children: MdPhrasing[];
}

/** GFM table row. */
export interface MdTableRow {
	/** Node discriminant — always `"tableRow"`. */
	type: "tableRow";
	/** Cells in this row. */
	children: MdTableCell[];
}

/** GFM table. */
export interface MdTable {
	/** Node discriminant — always `"table"`. */
	type: "table";
	/**
	 * Column alignment directives for each column.
	 * @defaultValue undefined
	 */
	align?: ("left" | "center" | "right" | null)[];
	/** Rows of the table (first row is the header). */
	children: MdTableRow[];
}

/** Union of all block content types. */
export type MdBlock =
	| MdHeading
	| MdParagraph
	| MdCode
	| MdBlockquote
	| MdHtml
	| MdThematicBreak
	| MdList
	| MdTable;

/** Document root. */
export interface MdRoot {
	/** Node discriminant — always `"root"`. */
	type: "root";
	/** Top-level block content of the document. */
	children: MdBlock[];
}

// ---------------------------------------------------------------------------
// Node builder namespace
// ---------------------------------------------------------------------------

/**
 * Concise factory functions for building mdast nodes.
 *
 * Usage:
 * ```typescript
 * const tree = md.root(
 *   md.heading(2, md.text("API")),
 *   md.table(null,
 *     md.tableRow(md.tableCell(md.text("Name")), md.tableCell(md.text("Type"))),
 *     md.tableRow(md.tableCell(md.inlineCode("id")), md.tableCell(md.text("string"))),
 *   ),
 * );
 * ```
 */
export const md = {
	// Inline (phrasing) nodes
	text: (value: string): MdText => ({ type: "text", value }),
	inlineCode: (value: string): MdInlineCode => ({ type: "inlineCode", value }),
	strong: (...children: MdPhrasing[]): MdStrong => ({ type: "strong", children }),
	emphasis: (...children: MdPhrasing[]): MdEmphasis => ({ type: "emphasis", children }),
	link: (url: string, ...children: MdPhrasing[]): MdLink => ({ type: "link", url, children }),

	// Block nodes
	heading: (depth: 1 | 2 | 3 | 4 | 5 | 6, ...children: MdPhrasing[]): MdHeading => ({
		type: "heading",
		depth,
		children,
	}),
	paragraph: (...children: MdPhrasing[]): MdParagraph => ({ type: "paragraph", children }),
	code: (lang: string, value: string): MdCode => ({ type: "code", lang, value }),
	blockquote: (...children: MdBlock[]): MdBlockquote => ({ type: "blockquote", children }),
	html: (value: string): MdHtml => ({ type: "html", value }),
	thematicBreak: (): MdThematicBreak => ({ type: "thematicBreak" }),

	// List nodes
	listItem: (...children: MdBlock[]): MdListItem => ({
		type: "listItem",
		spread: false,
		children,
	}),
	list: (items: MdListItem[], ordered = false): MdList => ({
		type: "list",
		ordered,
		spread: false,
		children: items,
	}),

	// GFM table nodes
	tableCell: (...children: MdPhrasing[]): MdTableCell => ({ type: "tableCell", children }),
	tableRow: (...cells: MdTableCell[]): MdTableRow => ({ type: "tableRow", children: cells }),
	table: (
		align: ("left" | "center" | "right" | null)[] | null,
		...rows: MdTableRow[]
	): MdTable => ({
		type: "table",
		align: align ?? undefined,
		children: rows,
	}),

	// Root
	root: (...children: MdBlock[]): MdRoot => ({ type: "root", children }),
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Cached processor instance — avoids recreating on every call. */
const serializer = unified().use(remarkGfm).use(remarkFrontmatter).use(remarkStringify, {
	bullet: "-",
	emphasis: "*",
	strong: "*",
	fences: true,
	listItemIndent: "one",
	rule: "-",
});

/**
 * Serialize an mdast tree to a well-formed markdown string.
 *
 * Uses remark-stringify with GFM table support. The serializer handles
 * all escaping (pipes in table cells, special characters in text, etc.)
 * so callers never need manual escape functions.
 *
 * @remarks
 * A single cached unified processor is reused across calls for performance.
 * The processor is configured with remark-gfm and remark-frontmatter plugins.
 *
 * @param tree - The mdast root node to serialize.
 * @returns The serialized markdown string.
 * @example
 * ```typescript
 * const output = serializeMarkdown(md.root(md.heading(1, md.text("Hello"))));
 * console.log(output); // "# Hello\n"
 * ```
 */
export function serializeMarkdown(tree: MdRoot): string {
	return String(serializer.stringify(tree));
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Shorthand: paragraph containing a single text node.
 *
 * @remarks
 * Equivalent to `md.paragraph(md.text(value))` but saves nesting verbosity.
 *
 * @param value - The plain text content.
 * @returns An MdParagraph wrapping a single MdText child.
 * @example
 * ```typescript
 * const node = textP("Hello world");
 * // { type: "paragraph", children: [{ type: "text", value: "Hello world" }] }
 * ```
 */
export function textP(value: string): MdParagraph {
	return md.paragraph(md.text(value));
}

/**
 * Shorthand: paragraph with bold intro text followed by regular text.
 *
 * @remarks
 * Produces `**bold**rest` in one paragraph node, useful for definition-style lines.
 *
 * @param bold - Text to render in bold at the start.
 * @param rest - Plain text appended after the bold segment.
 * @returns An MdParagraph with a strong child followed by a text child.
 * @example
 * ```typescript
 * const node = boldIntroP("Note: ", "this is important.");
 * // renders as **Note: **this is important.
 * ```
 */
export function boldIntroP(bold: string, rest: string): MdParagraph {
	return md.paragraph(md.strong(md.text(bold)), md.text(rest));
}

/**
 * Shorthand: list item containing a single text paragraph.
 *
 * @remarks
 * Equivalent to `md.listItem(md.paragraph(md.text(value)))` but reduces nesting.
 *
 * @param value - The plain text content of the list item.
 * @returns An MdListItem wrapping a single text paragraph.
 * @example
 * ```typescript
 * const item = textListItem("First item");
 * const list = md.list([item, textListItem("Second item")]);
 * ```
 */
export function textListItem(value: string): MdListItem {
	return md.listItem(md.paragraph(md.text(value)));
}

/**
 * Wrap a raw markdown string as an HTML node.
 * Use for TSDoc content that may contain markdown formatting (backticks,
 * bold, links) which should pass through to the output verbatim rather
 * than being escaped by the serializer.
 *
 * @remarks
 * Bypasses remark-stringify escaping by storing content as an `html` node,
 * which the serializer emits verbatim. Use sparingly — prefer typed nodes.
 *
 * @param markdown - The raw markdown/HTML string to pass through unescaped.
 * @returns An MdHtml node wrapping the raw content.
 * @example
 * ```typescript
 * const badge = rawBlock("![badge](https://img.shields.io/badge/ok-green)");
 * const tree = md.root(badge);
 * ```
 */
export function rawBlock(markdown: string): MdHtml {
	return md.html(markdown);
}

/**
 * Truncate a string to at most maxLen chars.
 * Avoids cutting inside backtick-delimited code spans to prevent
 * broken inline code that would cause escaping issues.
 *
 * @remarks
 * Counts backticks before the cut point to detect open code spans.
 * If the cut falls inside a span, it backs up to before the opening backtick.
 *
 * @param text - The string to truncate.
 * @param maxLen - Maximum allowed length (including the trailing `...`).
 * @returns The original string if within maxLen, or a truncated version with `...`.
 * @example
 * ```typescript
 * truncate("A very long description of the API", 20);
 * // "A very long descr..."
 * ```
 */
export function truncate(text: string, maxLen = 80): string {
	if (text.length <= maxLen) return text;
	let cutPoint = maxLen - 3;
	// Count backticks before the cut point — if odd, we're inside a code span
	const prefix = text.slice(0, cutPoint);
	const backtickCount = (prefix.match(/`/g) || []).length;
	if (backtickCount % 2 !== 0) {
		// Inside a code span — back up to before the opening backtick
		const lastBacktick = prefix.lastIndexOf("`");
		if (lastBacktick > 0) {
			cutPoint = lastBacktick;
		}
	}
	return `${text.slice(0, cutPoint).trimEnd()}...`;
}

/**
 * Convert a label to a GitHub-compatible anchor slug.
 *
 * @remarks
 * Lowercases the input, strips non-alphanumeric characters (except spaces
 * and hyphens), and replaces whitespace runs with single hyphens.
 *
 * @param text - The heading or label text to slugify.
 * @returns A lowercase, hyphen-separated anchor string.
 * @example
 * ```typescript
 * toAnchor("My Function()"); // "my-function"
 * ```
 */
export function toAnchor(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

/**
 * Strip extension from a link path and normalize to a slug.
 * Produces bare slug links compatible with Mintlify and most SSGs.
 *
 * @remarks
 * Removes a leading `./` prefix and strips `.md` or `.mdx` extensions,
 * then prepends `/` for absolute-path links expected by most SSGs.
 *
 * @param path - The relative file path (e.g., `"./packages/core/index.md"`).
 * @returns An absolute slug path (e.g., `"/packages/core/index"`).
 * @example
 * ```typescript
 * slugLink("./packages/core/index.md"); // "/packages/core/index"
 * ```
 */
export function slugLink(path: string): string {
	let slug = path.startsWith("./") ? path.slice(2) : path;
	slug = slug.replace(/\.(mdx?)$/, "");
	return `/${slug}`;
}
