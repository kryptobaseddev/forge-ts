import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

/**
 * Derives a compact one-line signature for routing manifest entries.
 * @internal
 */
function compactEntry(symbol: ForgeSymbol): string {
	if (symbol.signature) {
		return symbol.signature;
	}
	const ext = symbol.kind === "function" ? "()" : "";
	return `${symbol.kind} ${symbol.name}${ext}`;
}

/**
 * Generates an `llms.txt` routing manifest from the extracted symbols.
 *
 * The file follows the llms.txt specification: a compact, structured overview
 * designed to help large language models navigate a project's documentation.
 *
 * @param symbols - The symbols to include.
 * @param config - The resolved {@link ForgeConfig}.
 * @returns The generated `llms.txt` content as a string.
 * @public
 */
export function generateLlmsTxt(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const exported = symbols.filter((s) => s.exported);
	const projectName = config.rootDir.split("/").pop() ?? "Project";

	const lines: string[] = [];

	lines.push(`# ${projectName}`);
	lines.push(`> Auto-generated API documentation`);
	lines.push("");

	// Sections block — link to generated files
	lines.push("## Sections");
	lines.push("");
	if (config.gen.formats.includes("markdown")) {
		lines.push("- [API Reference](./api-reference.md): Full API documentation");
	}
	if (config.gen.formats.includes("mdx")) {
		lines.push("- [API Reference](./api-reference.mdx): Full API documentation (MDX)");
	}
	if (config.gen.llmsTxt) {
		lines.push("- [Full Context](./llms-full.txt): Dense context for LLM consumption");
	}
	lines.push("");

	// Quick Reference block
	if (exported.length > 0) {
		lines.push("## Quick Reference");
		lines.push("");
		for (const symbol of exported) {
			const summary = symbol.documentation?.summary ?? "";
			const entry = compactEntry(symbol);
			lines.push(summary ? `${entry} - ${summary}` : entry);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Renders a full parameter list section.
 * @internal
 */
function renderParams(params: NonNullable<ForgeSymbol["documentation"]>["params"]): string {
	if (!params || params.length === 0) return "";
	const lines: string[] = ["", "Parameters:"];
	for (const p of params) {
		const typeStr = p.type ? ` (${p.type})` : "";
		lines.push(`- ${p.name}${typeStr}: ${p.description}`);
	}
	return lines.join("\n");
}

/**
 * Renders a single symbol section for llms-full.txt.
 * @internal
 */
function renderFullSymbol(symbol: ForgeSymbol, depth: number): string {
	const hashes = "#".repeat(depth);
	const ext = symbol.kind === "function" || symbol.kind === "method" ? "()" : "";
	const lines: string[] = [];

	lines.push(`${hashes} ${symbol.name}${ext}`);

	if (symbol.signature) {
		lines.push("");
		lines.push(symbol.signature);
	}

	if (symbol.documentation?.deprecated) {
		lines.push("");
		lines.push(`DEPRECATED: ${symbol.documentation.deprecated}`);
	}

	if (symbol.documentation?.summary) {
		lines.push("");
		lines.push(symbol.documentation.summary);
	}

	const params = symbol.documentation?.params ?? [];
	const paramBlock = renderParams(params);
	if (paramBlock) {
		lines.push(paramBlock);
	}

	if (symbol.documentation?.returns) {
		const retType = symbol.documentation.returns.type
			? ` (${symbol.documentation.returns.type})`
			: "";
		lines.push("");
		lines.push(`Returns${retType}: ${symbol.documentation.returns.description}`);
	}

	const examples = symbol.documentation?.examples ?? [];
	if (examples.length > 0) {
		lines.push("");
		lines.push("Example:");
		for (const ex of examples) {
			const exLines = ex.code.trim().split("\n");
			for (const l of exLines) {
				lines.push(`  ${l}`);
			}
		}
	}

	// Render children inline
	const children = symbol.children ?? [];
	if (children.length > 0 && depth < 5) {
		lines.push("");
		lines.push("Members:");
		for (const child of children) {
			lines.push("");
			const childSection = renderFullSymbol(child, depth + 1);
			// indent child one level
			for (const cl of childSection.split("\n")) {
				lines.push(cl);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Generates an `llms-full.txt` dense context file from the extracted symbols.
 *
 * Unlike `llms.txt`, this file contains complete documentation for every
 * exported symbol, intended for LLM ingestion that requires full context.
 *
 * @param symbols - The symbols to include.
 * @param config - The resolved {@link ForgeConfig}.
 * @returns The generated `llms-full.txt` content as a string.
 * @public
 */
export function generateLlmsFullTxt(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const exported = symbols.filter(
		(s) => s.exported && s.kind !== "method" && s.kind !== "property",
	);
	const projectName = config.rootDir.split("/").pop() ?? "Project";

	const lines: string[] = [];

	lines.push(`# ${projectName} - Full Context`);
	lines.push("");
	lines.push(`Root: ${config.rootDir}`);
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push("");

	// Group by kind
	const kindGroups: Record<string, ForgeSymbol[]> = {};
	for (const symbol of exported) {
		const list = kindGroups[symbol.kind] ?? [];
		list.push(symbol);
		kindGroups[symbol.kind] = list;
	}

	const kindOrder: Array<ForgeSymbol["kind"]> = [
		"function",
		"class",
		"interface",
		"type",
		"enum",
		"variable",
	];

	const kindLabels: Record<string, string> = {
		function: "Functions",
		class: "Classes",
		interface: "Interfaces",
		type: "Types",
		enum: "Enums",
		variable: "Variables",
	};

	for (const kind of kindOrder) {
		const group = kindGroups[kind];
		if (!group || group.length === 0) continue;

		lines.push(`## ${kindLabels[kind]}`);
		lines.push("");

		for (const symbol of group) {
			lines.push(renderFullSymbol(symbol, 3));
			lines.push("");
		}
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}
