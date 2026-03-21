import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { ForgeSymbol } from "@forge-ts/core";
import {
	type MdBlock,
	type MdTableRow,
	md,
	rawBlock,
	serializeMarkdown,
} from "./mdast-builders.js";

const SECTION_START = "<!-- forge-ts:start -->";
const SECTION_END = "<!-- forge-ts:end -->";

/** Options controlling README sync behaviour. */
export interface ReadmeSyncOptions {
	/** Include a "Documented with forge-ts" badge above the API table. */
	badge?: boolean;
	/** Include first @example from each top-level symbol. */
	includeExamples?: boolean;
}

/**
 * Builds the API overview content as mdast blocks.
 * @internal
 */
function buildApiBlocks(symbols: ForgeSymbol[], includeExamples: boolean): MdBlock[] {
	const nodes: MdBlock[] = [];

	// API table
	const headerRow = md.tableRow(
		md.tableCell(md.text("Symbol")),
		md.tableCell(md.text("Kind")),
		md.tableCell(md.text("Description")),
	);
	const dataRows: MdTableRow[] = [];

	for (const s of symbols) {
		// Derive compact signature for display
		let sigText: string;
		if (!s.signature) {
			const ext = s.kind === "function" ? "()" : "";
			sigText = `${s.name}${ext}`;
		} else {
			sigText = s.signature.length > 60 ? `${s.signature.slice(0, 57)}...` : s.signature;
		}

		const summary = s.documentation?.summary ?? "";
		dataRows.push(
			md.tableRow(
				md.tableCell(md.inlineCode(sigText)),
				md.tableCell(md.text(s.kind)),
				md.tableCell(md.text(summary)),
			),
		);
	}

	nodes.push(md.table(null, headerRow, ...dataRows));

	// Optional examples section
	if (includeExamples) {
		const withExamples = symbols.filter((s) => (s.documentation?.examples ?? []).length > 0);
		if (withExamples.length > 0) {
			nodes.push(md.heading(3, md.text("Examples")));

			for (const s of withExamples) {
				const ext = s.kind === "function" ? "()" : "";
				nodes.push(md.heading(4, md.inlineCode(`${s.name}${ext}`)));
				const examples = s.documentation?.examples ?? [];
				const ex = examples[0];
				nodes.push(md.code(ex.language, ex.code.trim()));
			}
		}
	}

	return nodes;
}

/**
 * Injects a summary of exported symbols into a `README.md` file.
 *
 * The content is placed between `<!-- forge-ts:start -->` and
 * `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the
 * summary is appended to the end of the file.
 *
 * @param readmePath - Absolute path to the `README.md` to update.
 * @param symbols - Symbols to summarise in the README.
 * @param options - Options controlling sync behaviour.
 * @returns `true` if the file was modified, `false` otherwise.
 * @example
 * ```typescript
 * import { syncReadme } from "@forge-ts/gen";
 * const modified = await syncReadme("/path/to/README.md", symbols);
 * console.log(modified); // true if README was updated
 * ```
 * @public
 */
export async function syncReadme(
	readmePath: string,
	symbols: ForgeSymbol[],
	options: ReadmeSyncOptions = {},
): Promise<boolean> {
	const exported = symbols.filter((s) => s.exported);
	if (exported.length === 0) return false;

	const badge = options.badge ?? false;
	const includeExamples = options.includeExamples ?? false;

	// Build inner content as mdast
	const innerNodes: MdBlock[] = [];

	innerNodes.push(md.heading(2, md.text("API Overview")));

	if (badge) {
		// Badge uses shields.io image markdown — pass through as raw
		innerNodes.push(
			rawBlock(
				"[![Documented with forge-ts](https://img.shields.io/badge/docs-forge--ts-blue)](https://github.com/forge-ts/forge-ts)",
			),
		);
	}

	innerNodes.push(...buildApiBlocks(exported, includeExamples));

	// Serialize to markdown string
	const innerMd = serializeMarkdown(md.root(...innerNodes));

	// Wrap with markers
	const injection = `${SECTION_START}\n\n${innerMd}\n${SECTION_END}`;

	let existing = existsSync(readmePath) ? await readFile(readmePath, "utf8") : "";

	const startIdx = existing.indexOf(SECTION_START);
	const endIdx = existing.indexOf(SECTION_END);

	if (startIdx !== -1 && endIdx !== -1) {
		existing =
			existing.slice(0, startIdx) + injection + existing.slice(endIdx + SECTION_END.length);
	} else {
		existing = `${existing.trimEnd()}\n\n${injection}\n`;
	}

	await writeFile(readmePath, existing, "utf8");
	return true;
}
