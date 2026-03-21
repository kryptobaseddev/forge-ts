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
	type: "text";
	value: string;
}

/** Inline leaf node: code span. */
export interface MdInlineCode {
	type: "inlineCode";
	value: string;
}

/** Inline container: strong emphasis (bold). */
export interface MdStrong {
	type: "strong";
	children: MdPhrasing[];
}

/** Inline container: emphasis (italic). */
export interface MdEmphasis {
	type: "emphasis";
	children: MdPhrasing[];
}

/** Inline container: hyperlink. */
export interface MdLink {
	type: "link";
	url: string;
	children: MdPhrasing[];
}

/** Union of all inline (phrasing) content types. */
export type MdPhrasing = MdText | MdInlineCode | MdStrong | MdEmphasis | MdLink;

/** Block node: heading (depth 1-6). */
export interface MdHeading {
	type: "heading";
	depth: 1 | 2 | 3 | 4 | 5 | 6;
	children: MdPhrasing[];
}

/** Block node: paragraph. */
export interface MdParagraph {
	type: "paragraph";
	children: MdPhrasing[];
}

/** Block node: fenced code block. */
export interface MdCode {
	type: "code";
	lang?: string | null;
	value: string;
}

/** Block node: blockquote. */
export interface MdBlockquote {
	type: "blockquote";
	children: MdBlock[];
}

/** Block node: raw HTML (including comments). */
export interface MdHtml {
	type: "html";
	value: string;
}

/** Block node: horizontal rule. */
export interface MdThematicBreak {
	type: "thematicBreak";
}

/** List item container. */
export interface MdListItem {
	type: "listItem";
	spread?: boolean;
	children: MdBlock[];
}

/** Block node: ordered or unordered list. */
export interface MdList {
	type: "list";
	ordered?: boolean;
	spread?: boolean;
	children: MdListItem[];
}

/** GFM table cell. */
export interface MdTableCell {
	type: "tableCell";
	children: MdPhrasing[];
}

/** GFM table row. */
export interface MdTableRow {
	type: "tableRow";
	children: MdTableCell[];
}

/** GFM table. */
export interface MdTable {
	type: "table";
	align?: ("left" | "center" | "right" | null)[];
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
	type: "root";
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
 * @param tree - The mdast root node to serialize.
 * @returns The serialized markdown string.
 */
export function serializeMarkdown(tree: MdRoot): string {
	return String(serializer.stringify(tree));
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Shorthand: paragraph containing a single text node. */
export function textP(value: string): MdParagraph {
	return md.paragraph(md.text(value));
}

/** Shorthand: paragraph with bold intro text followed by regular text. */
export function boldIntroP(bold: string, rest: string): MdParagraph {
	return md.paragraph(md.strong(md.text(bold)), md.text(rest));
}

/** Shorthand: list item containing a single text paragraph. */
export function textListItem(value: string): MdListItem {
	return md.listItem(md.paragraph(md.text(value)));
}

/**
 * Wrap a raw markdown string as an HTML node.
 * Use for TSDoc content that may contain markdown formatting (backticks,
 * bold, links) which should pass through to the output verbatim rather
 * than being escaped by the serializer.
 */
export function rawBlock(markdown: string): MdHtml {
	return md.html(markdown);
}

/**
 * Truncate a string to at most maxLen chars.
 * Avoids cutting inside backtick-delimited code spans to prevent
 * broken inline code that would cause escaping issues.
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

/** Convert a label to a GitHub-compatible anchor slug. */
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
 */
export function slugLink(path: string): string {
	let slug = path.startsWith("./") ? path.slice(2) : path;
	slug = slug.replace(/\.(mdx?)$/, "");
	return `/${slug}`;
}
