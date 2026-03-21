/**
 * Shared markdown/MDX utilities powered by gray-matter and the unified/remark ecosystem.
 *
 * Provides:
 * - Frontmatter parsing and serialization (gray-matter)
 * - AST-aware MDX sanitization (remark-parse + position-based transforms)
 * - AST-aware FORGE:AUTO section updates (remark-parse + position-based splicing)
 * - AST-aware FORGE:STUB section updates (generated once, preserved after user edits)
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

/** A matched FORGE:STUB section with its content, position, and hash. */
interface StubSection {
	id: string;
	/** The full text from STUB-START marker through STUB-END marker (inclusive). */
	fullText: string;
	/** The inner content between the START marker line and END marker line (excludes hash comment). */
	innerContent: string;
	/** The embedded hash from the FORGE:STUB-HASH comment, if present. */
	hash: string | undefined;
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

// ---------------------------------------------------------------------------
// FORGE:STUB section updates (AST-aware, hash-based change detection)
// ---------------------------------------------------------------------------

/**
 * Compute a short fingerprint hash for content change detection.
 *
 * Uses a simple DJB2-style hash converted to base-36 and truncated to
 * 8 characters. This is NOT cryptographic — just a quick fingerprint
 * to detect whether generated content has been manually edited.
 *
 * @param content - The content to hash.
 * @returns An 8-character alphanumeric hash string.
 * @internal
 */
export function stubHash(content: string): string {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		// hash * 33 + charCode (DJB2)
		hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
	}
	// Convert to unsigned 32-bit, then base-36 for compact representation
	return (hash >>> 0).toString(36).padStart(8, "0").slice(0, 8);
}

/**
 * Find all FORGE:STUB marker pairs in content.
 *
 * Searches for both HTML comment and MDX comment formats:
 * - HTML: `<!-- FORGE:STUB-START id -->` ... `<!-- FORGE:STUB-END id -->`
 * - MDX: `{/* FORGE:STUB-START id *\/}` ... `{/* FORGE:STUB-END id *\/}`
 *
 * Uses the remark AST to identify protected ranges (code blocks) so that
 * markers appearing inside code are never matched.
 */
function findStubSections(content: string): Map<string, StubSection> {
	const protectedRanges = getProtectedRangesSafe(content);

	// Collect all marker positions (both HTML and MDX comment formats)
	const markers: Array<{
		type: "start" | "end";
		id: string;
		offset: number;
		length: number;
	}> = [];

	const patterns: Array<{ regex: RegExp; type: "start" | "end" }> = [
		{ regex: /<!--\s*FORGE:STUB-START\s+(\S+)\s*-->/g, type: "start" },
		{ regex: /<!--\s*FORGE:STUB-END\s+(\S+)\s*-->/g, type: "end" },
		{ regex: /\{\/\*\s*FORGE:STUB-START\s+(\S+)\s*\*\/\}/g, type: "start" },
		{ regex: /\{\/\*\s*FORGE:STUB-END\s+(\S+)\s*\*\/\}/g, type: "end" },
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
	const sections = new Map<string, StubSection>();
	for (let i = 0; i < markers.length; i++) {
		const m = markers[i];
		if (m.type !== "start") continue;

		// Find the first matching END after this START
		for (let j = i + 1; j < markers.length; j++) {
			if (markers[j].type === "end" && markers[j].id === m.id) {
				const sectionEnd = markers[j].offset + markers[j].length;
				const fullText = content.slice(m.offset, sectionEnd);

				// Extract inner content: everything between the start marker line
				// and the end marker line, excluding the FORGE:STUB-HASH comment
				const startMarkerEnd = m.offset + m.length;
				const endMarkerStart = markers[j].offset;
				let inner = content.slice(startMarkerEnd, endMarkerStart);

				// Strip leading/trailing newline that wraps the inner content
				if (inner.startsWith("\n")) inner = inner.slice(1);
				if (inner.endsWith("\n")) inner = inner.slice(0, -1);

				// Extract hash from the inner content if present
				const hashPatterns = [
					/<!--\s*FORGE:STUB-HASH\s+(\S+)\s*-->/,
					/\{\/\*\s*FORGE:STUB-HASH\s+(\S+)\s*\*\/\}/,
				];
				let hash: string | undefined;
				for (const hp of hashPatterns) {
					const hm = hp.exec(inner);
					if (hm) {
						hash = hm[1];
						// Remove the hash line from inner content for comparison
						inner = inner.replace(hp, "").replace(/^\n/, "").replace(/\n$/, "");
						break;
					}
				}

				sections.set(m.id, {
					id: m.id,
					fullText,
					innerContent: inner,
					hash,
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
 * Checks if a FORGE:STUB section has been modified by the user.
 *
 * Compares the embedded hash (from the FORGE:STUB-HASH comment) against
 * a freshly computed hash of the current inner content (with the hash
 * comment itself stripped out). If the hashes diverge — meaning the user
 * edited the content — or the hash comment was removed, the section is
 * considered modified and should be preserved.
 *
 * @param existingContent - The full document content on disk.
 * @param stubId - The identifier of the FORGE:STUB section.
 * @param _generatedContent - Unused; kept for API symmetry. Detection is purely hash-based.
 * @returns `true` if the user has modified the stub (preserve it), `false` if unmodified (safe to regenerate).
 * @public
 */
export function isStubModified(
	existingContent: string,
	stubId: string,
	_generatedContent: string,
): boolean {
	const sections = findStubSections(existingContent);
	const section = sections.get(stubId);
	if (!section) return false; // Section not found — not modified (doesn't exist yet)

	// If there's no hash embedded, treat as modified (user may have removed it)
	if (!section.hash) return true;

	// Compare the embedded hash against the hash of the current inner content.
	// If they match, the user hasn't edited the content since generation.
	const currentHash = stubHash(section.innerContent);
	return section.hash !== currentHash;
}

/**
 * Updates FORGE:STUB sections in existing content.
 *
 * Behavior for each stub:
 * - If the stub doesn't exist yet, appends it at the end of the content.
 * - If the stub exists but is unmodified (hash matches generated content), regenerates it.
 * - If the stub exists and was modified by user (hash mismatch), PRESERVES user content.
 *
 * Each generated stub includes a `FORGE:STUB-HASH` comment containing a
 * fingerprint of the generated content. On subsequent builds, this hash is
 * compared to determine whether the user has made edits.
 *
 * @param existingContent - The current file content on disk.
 * @param stubs - Array of stub definitions with their IDs and generated content.
 * @returns The updated content with stubs inserted or refreshed as needed.
 * @public
 */
export function updateStubSections(
	existingContent: string,
	stubs: Array<{ id: string; content: string }>,
): string {
	const existingSections = findStubSections(existingContent);

	// Build a list of replacements (descending position) and appends
	const replacements: Array<{ start: number; end: number; replacement: string }> = [];
	const appends: string[] = [];

	for (const stub of stubs) {
		const hash = stubHash(stub.content);
		const wrapped = formatStubSection(stub.id, stub.content, hash);

		const existing = existingSections.get(stub.id);
		if (!existing) {
			// Stub doesn't exist — append to end
			appends.push(wrapped);
			continue;
		}

		// Stub exists — check if user has modified it.
		// Compare embedded hash against hash of CURRENT inner content.
		// If they match, content is untouched since generation — safe to regenerate.
		const currentContentHash = stubHash(existing.innerContent);
		if (existing.hash && existing.hash === currentContentHash) {
			replacements.push({
				start: existing.start,
				end: existing.end,
				replacement: wrapped,
			});
		}
		// Otherwise: user has modified — leave it alone (no replacement)
	}

	// Apply replacements in reverse position order to preserve offsets
	let result = existingContent;
	for (const r of replacements.sort((a, b) => b.start - a.start)) {
		result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
	}

	// Append new stubs at the end
	if (appends.length > 0) {
		const suffix = result.endsWith("\n") ? "" : "\n";
		result = `${result}${suffix}${appends.join("\n\n")}\n`;
	}

	return result;
}

/**
 * Format a FORGE:STUB section with markers and hash comment.
 *
 * Produces:
 * ```
 * <!-- FORGE:STUB-START id -->
 * <!-- FORGE:STUB-HASH abc12345 -->
 * content here
 * <!-- FORGE:STUB-END id -->
 * ```
 *
 * @internal
 */
function formatStubSection(id: string, content: string, hash: string): string {
	return [
		`<!-- FORGE:STUB-START ${id} -->`,
		`<!-- FORGE:STUB-HASH ${hash} -->`,
		content,
		`<!-- FORGE:STUB-END ${id} -->`,
	].join("\n");
}
