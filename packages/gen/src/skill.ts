import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a compact one-line type description for a symbol.
 * @internal
 */
function kindLabel(kind: ForgeSymbol["kind"]): string {
	const labels: Record<ForgeSymbol["kind"], string> = {
		function: "function",
		class: "class",
		interface: "interface",
		type: "type alias",
		enum: "enum",
		variable: "constant",
		method: "method",
		property: "property",
	};
	return labels[kind];
}

/**
 * Derives the return type from a function signature string.
 * Returns an empty string when it cannot be determined.
 * @internal
 */
function extractReturnType(signature: string | undefined): string {
	if (!signature) return "";
	const match = /\):\s*(.+)$/.exec(signature);
	return match ? match[1].trim() : "";
}

/**
 * Renders the API quick-reference table rows for a set of symbols.
 * @internal
 */
function renderApiRows(symbols: ForgeSymbol[]): string[] {
	const rows: string[] = [];
	for (const sym of symbols) {
		if (!sym.exported) continue;
		if (sym.kind === "method" || sym.kind === "property") continue;

		const name = sym.kind === "function" ? `\`${sym.name}()\`` : `\`${sym.name}\``;
		const sig = sym.signature ? `\`${sym.signature}\`` : `${kindLabel(sym.kind)} ${sym.name}`;
		const desc = sym.documentation?.summary ?? "";
		rows.push(`| ${name} | ${sig} | ${desc} |`);
	}
	return rows;
}

/**
 * Renders pattern sections for all exported functions that carry @example blocks.
 * @internal
 */
function renderPatterns(symbols: ForgeSymbol[]): string[] {
	const lines: string[] = [];
	for (const sym of symbols) {
		if (!sym.exported) continue;
		if (sym.kind !== "function" && sym.kind !== "class") continue;

		const examples = sym.documentation?.examples ?? [];
		if (examples.length === 0) continue;

		lines.push(`### Pattern: ${sym.name}`);
		lines.push("");
		if (sym.documentation?.summary) {
			lines.push(sym.documentation.summary);
			lines.push("");
		}
		for (const ex of examples) {
			const lang = ex.language || "typescript";
			lines.push(`\`\`\`${lang}`);
			lines.push(ex.code.trim());
			lines.push("```");
			lines.push("");
		}
	}
	return lines;
}

/**
 * Returns true when `kind` is a concept-level declaration (type, interface, class, enum).
 * @internal
 */
function isConceptKind(kind: ForgeSymbol["kind"]): boolean {
	return kind === "interface" || kind === "type" || kind === "class" || kind === "enum";
}

/**
 * Renders the key concepts list from exported types and interfaces.
 * @internal
 */
function renderConcepts(symbols: ForgeSymbol[]): string[] {
	const lines: string[] = [];

	for (const sym of symbols) {
		if (!sym.exported) continue;
		if (!isConceptKind(sym.kind)) continue;

		const summary = sym.documentation?.summary ?? "";
		const label = summary ? `**\`${sym.name}\`** — ${summary}` : `**\`${sym.name}\`**`;
		lines.push(`- ${label}`);
	}
	return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a `skill.md` file that teaches AI assistants about the project.
 *
 * The file contains:
 * - Project overview and purpose
 * - Installation instructions
 * - Key concepts and types
 * - Common usage patterns (from @example blocks)
 * - API quick reference
 * - Configuration reference
 *
 * @param symbols - All symbols from the project.
 * @param config - The resolved forge-ts config.
 * @returns The skill.md content as a string.
 * @example
 * ```typescript
 * import { generateSkillMd } from "@forge-ts/gen";
 * const skill = generateSkillMd(symbols, config);
 * ```
 * @public
 */
export function generateSkillMd(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);

	// Derive description from @packageDocumentation symbol, if any
	const pkgDoc = symbols.find((s) => s.documentation?.tags?.packageDocumentation);
	const description =
		pkgDoc?.documentation?.summary ??
		exported.find((s) => s.documentation?.summary)?.documentation?.summary ??
		`A TypeScript library.`;

	const lines: string[] = [];

	// ---------------------------------------------------------------------------
	// Header
	// ---------------------------------------------------------------------------
	lines.push(`# ${projectName} Skill`);
	lines.push("");
	lines.push(`> This file teaches AI assistants how to use ${projectName}.`);
	lines.push("");

	// ---------------------------------------------------------------------------
	// Overview
	// ---------------------------------------------------------------------------
	lines.push("## Overview");
	lines.push("");
	lines.push(description);
	lines.push("");

	// ---------------------------------------------------------------------------
	// Installation
	// ---------------------------------------------------------------------------
	lines.push("## Installation");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install -D ${projectName}`);
	lines.push("```");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Key Concepts
	// ---------------------------------------------------------------------------
	const conceptLines = renderConcepts(exported);
	if (conceptLines.length > 0) {
		lines.push("## Key Concepts");
		lines.push("");
		lines.push(...conceptLines);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Common Patterns
	// ---------------------------------------------------------------------------
	const patternLines = renderPatterns(exported);
	if (patternLines.length > 0) {
		lines.push("## Common Patterns");
		lines.push("");
		lines.push(...patternLines);
	}

	// ---------------------------------------------------------------------------
	// API Quick Reference
	// ---------------------------------------------------------------------------
	const apiRows = renderApiRows(exported);
	if (apiRows.length > 0) {
		lines.push("## API Quick Reference");
		lines.push("");
		lines.push("| Function | Signature | Description |");
		lines.push("|----------|-----------|-------------|");
		lines.push(...apiRows);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Configuration
	// ---------------------------------------------------------------------------
	const configSymbol = exported.find(
		(s) =>
			(s.kind === "interface" || s.kind === "type") &&
			/config/i.test(s.name) &&
			(s.children?.length ?? 0) > 0,
	);

	if (configSymbol?.children) {
		lines.push("## Configuration");
		lines.push("");
		lines.push(`\`${configSymbol.name}\` properties:`);
		lines.push("");
		for (const child of configSymbol.children) {
			const retType = extractReturnType(child.signature ?? "");
			const typeStr = retType ? ` (\`${retType}\`)` : "";
			const summary = child.documentation?.summary ?? "";
			lines.push(`- **\`${child.name}\`**${typeStr}${summary ? ` — ${summary}` : ""}`);
		}
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Rules / Constraints (enforcer rules)
	// ---------------------------------------------------------------------------
	const enforceRulesSymbol = exported.find(
		(s) => (s.kind === "interface" || s.kind === "type") && /rule/i.test(s.name),
	);

	if (enforceRulesSymbol?.children) {
		lines.push("## Rules / Constraints");
		lines.push("");
		for (const child of enforceRulesSymbol.children) {
			const summary = child.documentation?.summary ?? "";
			lines.push(`- **${child.name}**${summary ? ` — ${summary}` : ""}`);
		}
		lines.push("");
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}
