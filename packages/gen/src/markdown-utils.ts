/**
 * Shared markdown/MDX utilities powered by gray-matter and the unified/remark ecosystem.
 *
 * Provides:
 * - Frontmatter parsing and serialization (gray-matter)
 * - AST-aware MDX sanitization (remark-parse + position-based transforms)
 * - AST-aware FORGE:AUTO section updates (remark-parse + position-based splicing)
 *
 * @internal
 */

import matter from "gray-matter";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import type { MdBlock, MdPhrasing, MdText } from "./mdast-builders.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of parsing frontmatter from markdown/MDX content.
 * @public
 */
export interface FrontmatterResult {
	/** The body content without the frontmatter block. */
	body: string;
	/** The parsed frontmatter data as a key-value map. */
	data: Record<string, unknown>;
}

/** A targeted string replacement anchored to source positions. */
interface PositionedTransform {
	start: number;
	end: number;
	replacement: string;
}

/** A source range in the original content string. */
interface SourceRange {
	start: number;
	end: number;
}

/** A matched FORGE:AUTO section with its content and position. */
interface AutoSection {
	id: string;
	/** The full text from START marker through END marker (inclusive). */
	fullText: string;
	start: number;
	end: number;
}

// ---------------------------------------------------------------------------
// Remark processor factory
// ---------------------------------------------------------------------------

/**
 * Create a remark parser configured for standard markdown with GFM tables
 * and YAML frontmatter support.
 */
function createParser() {
	return unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);
}

/**
 * Create an MDX-aware parser for processing existing MDX files.
 * Falls back to the standard parser if MDX parsing fails (e.g., malformed content).
 */
function createMdxParser() {
	return unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);
}

/**
 * Get protected ranges, trying MDX-aware parsing first for robustness
 * with existing MDX files that may contain JSX expressions.
 */
function getProtectedRangesSafe(content: string): SourceRange[] {
	try {
		return getProtectedRangesFromTree(createMdxParser().parse(content));
	} catch {
		// Fallback to standard parser if MDX parsing fails
		return getProtectedRangesFromTree(createParser().parse(content));
	}
}

// ---------------------------------------------------------------------------
// Frontmatter utilities (powered by gray-matter)
// ---------------------------------------------------------------------------

/**
 * Parse frontmatter from markdown/MDX content.
 *
 * Uses gray-matter for robust YAML parsing — handles multi-line values,
 * quoted strings, and edge cases that regex-based stripping misses.
 *
 * @param content - The full file content including frontmatter.
 * @returns The body (without frontmatter) and the parsed data object.
 * @public
 */
export function parseFrontmatter(content: string): FrontmatterResult {
	const result = matter(content);
	return { body: result.content, data: result.data as Record<string, unknown> };
}

/**
 * Serialize content with frontmatter prepended.
 *
 * Produces the standard format:
 * ```
 * ---
 * key: value
 * ---
 *
 * body
 * ```
 *
 * @param body - The markdown body content (without frontmatter).
 * @param data - The frontmatter fields to serialize.
 * @returns The combined frontmatter + body string.
 * @public
 */
export function stringifyWithFrontmatter(
	body: string,
	data: Record<string, string | number | boolean>,
): string {
	if (Object.keys(data).length === 0) return body;
	// gray-matter.stringify expects the body to start with \n for proper spacing
	const normalizedBody = body.startsWith("\n") ? body : `\n${body}`;
	return matter.stringify(normalizedBody, data);
}

/**
 * Strip frontmatter from content, returning only the body.
 *
 * @param content - The full file content including frontmatter.
 * @returns The body content without the frontmatter block.
 * @public
 */
export function stripFrontmatter(content: string): string {
	return matter(content).content;
}

// ---------------------------------------------------------------------------
// TSDoc content parsing
// ---------------------------------------------------------------------------

/** Cached parser for TSDoc content that may contain markdown formatting. */
const inlineParser = unified().use(remarkParse).use(remarkGfm);

/**
 * Parse a markdown string and extract inline (phrasing) content.
 *
 * Use for TSDoc text that may contain backtick code, bold, links, etc.
 * The returned nodes can be spread into paragraphs, table cells, or
 * any other context that accepts inline content.
 *
 * This prevents double-escaping: backticks become proper `inlineCode`
 * nodes instead of text that gets escaped by the serializer.
 *
 * @param markdown - The TSDoc content string (may contain markdown).
 * @returns Array of inline mdast nodes.
 * @public
 */
export function parseInline(markdown: string): MdPhrasing[] {
	if (!markdown) return [];
	const tree = inlineParser.parse(markdown);
	const first = tree.children[0];
	if (first?.type === "paragraph") {
		// biome-ignore lint: mdast children are compatible with our MdPhrasing
		return (first as any).children as MdPhrasing[];
	}
	return [{ type: "text", value: markdown } as MdText];
}

/**
 * Parse a markdown string and extract block-level content.
 *
 * Use for multi-line TSDoc content that may contain headings,
 * lists, blockquotes, code blocks, etc.
 *
 * @param markdown - The markdown string to parse.
 * @returns Array of block-level mdast nodes.
 * @public
 */
export function parseBlocks(markdown: string): MdBlock[] {
	if (!markdown) return [];
	const tree = inlineParser.parse(markdown);
	// biome-ignore lint: mdast children are compatible with our MdBlock
	return tree.children as unknown as MdBlock[];
}

// ---------------------------------------------------------------------------
// Protected range detection
// ---------------------------------------------------------------------------

/**
 * Extract protected ranges from a parsed tree.
 * Protected ranges include: fenced code blocks, indented code blocks,
 * inline code spans, and YAML frontmatter. Content inside these ranges
 * must not be transformed during sanitization or marker detection.
 */
function getProtectedRangesFromTree(
	tree: ReturnType<ReturnType<typeof createParser>["parse"]>,
): SourceRange[] {
	const ranges: SourceRange[] = [];

	visit(tree, (node) => {
		const pos = node.position;
		if (!pos?.start.offset || !pos?.end.offset) return;

		if (node.type === "code" || node.type === "inlineCode" || node.type === "yaml") {
			ranges.push({
				start: pos.start.offset,
				end: pos.end.offset,
			});
			return SKIP;
		}
	});

	return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Check whether a character offset falls inside a protected range.
 * Uses binary search for efficiency on large documents.
 */
function isProtected(offset: number, ranges: SourceRange[]): boolean {
	let lo = 0;
	let hi = ranges.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const r = ranges[mid];
		if (offset < r.start) {
			hi = mid - 1;
		} else if (offset >= r.end) {
			lo = mid + 1;
		} else {
			return true;
		}
	}
	return false;
}

// ---------------------------------------------------------------------------
// MDX sanitization (AST-aware, position-based)
// ---------------------------------------------------------------------------

/**
 * Sanitize markdown content for MDX compatibility using AST-aware processing.
 *
 * Parses the document with remark to understand its structure, then applies
 * targeted string replacements only to text and HTML comment nodes —
 * code blocks, inline code, and frontmatter are automatically preserved.
 *
 * Transformations applied outside code:
 * - HTML comments to MDX comments
 * - Curly braces in text escaped (prevents MDX expression parsing)
 * - Angle brackets around word chars escaped (prevents JSX tag parsing)
 *
 * @param content - The markdown content to sanitize.
 * @returns The sanitized content safe for MDX consumption.
 * @public
 */
export function sanitizeForMdx(content: string): string {
	const tree = createParser().parse(content);
	const transforms: PositionedTransform[] = [];

	visit(tree, (node) => {
		const pos = node.position;
		if (!pos?.start.offset || !pos?.end.offset) return;

		const start = pos.start.offset;
		const end = pos.end.offset;

		// Convert HTML comments to MDX comments
		if (node.type === "html") {
			const original = content.slice(start, end);
			const commentMatch = /^<!--([\s\S]*?)-->$/.exec(original);
			if (commentMatch) {
				transforms.push({
					start,
					end,
					replacement: `{/*${commentMatch[1]}*/}`,
				});
			}
			return SKIP;
		}

		// Escape MDX-unsafe characters in text nodes
		if (node.type === "text") {
			const original = content.slice(start, end);
			const escaped = original
				// Escape { and } — prevents MDX expression parsing
				// Skip { that's part of an MDX comment we might have created
				.replace(/\{(?!\/\*)/g, "\\{")
				.replace(/(?<!\*\/)\}/g, "\\}")
				// Escape < followed by a word char (JSX tag-like)
				.replace(/<(\w)/g, "&lt;$1")
				// Escape > preceded by a word char
				.replace(/(\w)>/g, "$1&gt;");
			if (escaped !== original) {
				transforms.push({ start, end, replacement: escaped });
			}
			return SKIP;
		}

		// Skip code and frontmatter nodes entirely
		if (node.type === "code" || node.type === "inlineCode" || node.type === "yaml") {
			return SKIP;
		}
	});

	// Apply transforms in reverse position order to preserve earlier offsets
	let result = content;
	for (const t of transforms.sort((a, b) => b.start - a.start)) {
		result = result.slice(0, t.start) + t.replacement + result.slice(t.end);
	}

	return result;
}

// ---------------------------------------------------------------------------
// FORGE:AUTO section updates (AST-aware, position-based)
// ---------------------------------------------------------------------------

/**
 * Find all FORGE:AUTO marker pairs in content.
 *
 * Searches for both HTML comment and MDX comment formats:
 * - HTML: `&lt;!-- FORGE:AUTO-START id --&gt;` ... `&lt;!-- FORGE:AUTO-END id --&gt;`
 * - MDX: MDX comment equivalents wrapping FORGE:AUTO-START/END markers
 *
 * Uses the remark AST to identify protected ranges (code blocks) so that
 * markers appearing inside code are never matched.
 */
function findAutoSections(content: string): Map<string, AutoSection> {
	const protectedRanges = getProtectedRangesSafe(content);

	// Collect all marker positions (both HTML and MDX comment formats)
	const markers: Array<{ type: "start" | "end"; id: string; offset: number; length: number }> = [];

	const patterns: Array<{ regex: RegExp; type: "start" | "end" }> = [
		{ regex: /<!--\s*FORGE:AUTO-START\s+(\S+)\s*-->/g, type: "start" },
		{ regex: /<!--\s*FORGE:AUTO-END\s+(\S+)\s*-->/g, type: "end" },
		{ regex: /\{\/\*\s*FORGE:AUTO-START\s+(\S+)\s*\*\/\}/g, type: "start" },
		{ regex: /\{\/\*\s*FORGE:AUTO-END\s+(\S+)\s*\*\/\}/g, type: "end" },
	];

	for (const { regex, type } of patterns) {
		let match: RegExpExecArray | null;
		// biome-ignore lint: manual exec loop is clearest for regex iteration
		while ((match = regex.exec(content)) !== null) {
			if (!isProtected(match.index, protectedRanges)) {
				markers.push({
					type,
					id: match[1],
					offset: match.index,
					length: match[0].length,
				});
			}
		}
	}

	// Sort by position in document
	markers.sort((a, b) => a.offset - b.offset);

	// Match START/END pairs
	const sections = new Map<string, AutoSection>();
	for (let i = 0; i < markers.length; i++) {
		const m = markers[i];
		if (m.type !== "start") continue;

		// Find the first matching END after this START
		for (let j = i + 1; j < markers.length; j++) {
			if (markers[j].type === "end" && markers[j].id === m.id) {
				const sectionEnd = markers[j].offset + markers[j].length;
				sections.set(m.id, {
					id: m.id,
					fullText: content.slice(m.offset, sectionEnd),
					start: m.offset,
					end: sectionEnd,
				});
				break;
			}
		}
	}

	return sections;
}

/**
 * Updates auto-enriched sections in an existing stub file.
 *
 * Uses AST-aware parsing to find FORGE:AUTO markers, ensuring markers
 * inside code blocks are never accidentally matched. Replaces content
 * between `<!-- FORGE:AUTO-START id -->` and `<!-- FORGE:AUTO-END id -->`
 * markers (or their MDX comment equivalents) with fresh content from
 * the newly generated version.
 *
 * Manual content outside markers is preserved exactly — no reformatting.
 *
 * @param existing - The current file content on disk.
 * @param generated - The freshly generated content with updated markers.
 * @returns The merged content, or null if no markers were found to update.
 * @internal
 */
export function updateAutoSections(existing: string, generated: string): string | null {
	const newSections = findAutoSections(generated);
	if (newSections.size === 0) return null;

	const existingSections = findAutoSections(existing);
	if (existingSections.size === 0) return null;

	// Sort by position descending — replace from end to preserve earlier positions
	const sortedExisting = [...existingSections.entries()].sort(([, a], [, b]) => b.start - a.start);

	let result = existing;
	let changed = false;

	for (const [id, existingSection] of sortedExisting) {
		const newSection = newSections.get(id);
		if (newSection) {
			result =
				result.slice(0, existingSection.start) +
				newSection.fullText +
				result.slice(existingSection.end);
			changed = true;
		}
	}

	return changed ? result : null;
}
