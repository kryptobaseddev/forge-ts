import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { ForgeSymbol } from "@forge-ts/core";

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
 * Derives a compact type signature string for the table.
 * @internal
 */
function tableSignature(symbol: ForgeSymbol): string {
	if (!symbol.signature) {
		const ext = symbol.kind === "function" ? "()" : "";
		return `\`${symbol.name}${ext}\``;
	}
	// Keep it short: show at most 60 characters of the signature
	const sig =
		symbol.signature.length > 60 ? `${symbol.signature.slice(0, 57)}...` : symbol.signature;
	return `\`${sig}\``;
}

/**
 * Renders the first @example block as a fenced code snippet.
 * @internal
 */
function renderFirstExample(symbol: ForgeSymbol): string {
	const examples = symbol.documentation?.examples ?? [];
	if (examples.length === 0) return "";
	const ex = examples[0];
	return ["", `\`\`\`${ex.language}`, ex.code.trim(), "```"].join("\n");
}

/**
 * Builds the markdown table rows for the API overview.
 * @internal
 */
function buildApiTable(symbols: ForgeSymbol[], includeExamples: boolean): string[] {
	const lines: string[] = ["| Symbol | Kind | Description |", "|--------|------|-------------|"];

	for (const s of symbols) {
		const sig = tableSignature(s);
		const summary = s.documentation?.summary ?? "";
		lines.push(`| ${sig} | ${s.kind} | ${summary} |`);
	}

	if (includeExamples) {
		const withExamples = symbols.filter((s) => (s.documentation?.examples ?? []).length > 0);
		if (withExamples.length > 0) {
			lines.push("");
			lines.push("### Examples");
			for (const s of withExamples) {
				lines.push("");
				const ext = s.kind === "function" ? "()" : "";
				lines.push(`#### \`${s.name}${ext}\``);
				lines.push(renderFirstExample(s));
			}
		}
	}

	return lines;
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

	const innerLines: string[] = [];
	innerLines.push("## API Overview");
	innerLines.push("");

	if (badge) {
		innerLines.push(
			"[![Documented with forge-ts](https://img.shields.io/badge/docs-forge--ts-blue)](https://github.com/forge-ts/forge-ts)",
		);
		innerLines.push("");
	}

	innerLines.push(...buildApiTable(exported, includeExamples));

	const summaryLines = [SECTION_START, "", ...innerLines, "", SECTION_END];
	const injection = summaryLines.join("\n");

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
