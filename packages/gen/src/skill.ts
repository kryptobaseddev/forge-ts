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
 * Converts a package name or project name to a lowercase-hyphenated slug
 * valid for agentskills.io directory names (max 64 chars, hyphens only).
 * @internal
 */
function toDirectoryName(name: string): string {
	return name
		.replace(/^@[^/]+\//, "") // strip npm scope
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

/**
 * Builds a description string optimized for agentskills.io discovery.
 * Derived entirely from the project's exported symbols and metadata.
 * @internal
 */
function buildDescription(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const exported = symbols.filter((s) => s.exported);
	const projectName =
		config.project.packageName ?? config.rootDir.split("/").pop() ?? "this project";

	// Detect capabilities from the actual exported symbols
	const functionCount = exported.filter((s) => s.kind === "function").length;
	const typeCount = exported.filter(
		(s) => s.kind === "interface" || s.kind === "type" || s.kind === "enum",
	).length;
	const classCount = exported.filter((s) => s.kind === "class").length;
	const hasRoutes = exported.some((s) => s.documentation?.tags?.route !== undefined);

	const capabilities: string[] = [];
	if (functionCount > 0) capabilities.push(`${functionCount} functions`);
	if (typeCount > 0) capabilities.push(`${typeCount} type definitions`);
	if (classCount > 0) capabilities.push(`${classCount} classes`);
	if (hasRoutes) capabilities.push("HTTP API routes");

	// Use @packageDocumentation summary as the lead
	const pkgDoc = symbols.find((s) => s.documentation?.tags?.packageDocumentation);
	const leadSentence =
		pkgDoc?.documentation?.summary ??
		exported.find((s) => s.documentation?.summary)?.documentation?.summary;

	const capList = capabilities.length > 0 ? capabilities.join(", ") : "TypeScript utilities";

	let description = "";
	if (leadSentence) {
		description += `${leadSentence} `;
	}
	description +=
		`Use this skill when working with ${projectName} or when a user mentions it. ` +
		`It provides ${capList}. ` +
		`Use when you need to understand how to import, configure, or call its API, ` +
		`even if the user doesn't mention the package by name.`;

	if (description.length > 1024) {
		description = `${description.slice(0, 1021)}...`;
	}
	return description;
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
 * Renders the top N pattern sections from exported functions/classes with @example blocks.
 * @internal
 */
function renderPatterns(symbols: ForgeSymbol[], maxPatterns: number = 5): string[] {
	const lines: string[] = [];
	let count = 0;

	for (const sym of symbols) {
		if (count >= maxPatterns) break;
		if (!sym.exported) continue;
		if (sym.kind !== "function" && sym.kind !== "class") continue;

		const examples = sym.documentation?.examples ?? [];
		if (examples.length === 0) continue;

		lines.push(`### ${sym.name}`);
		lines.push("");
		if (sym.documentation?.summary) {
			lines.push(sym.documentation.summary);
			lines.push("");
		}
		const ex = examples[0];
		const lang = ex.language || "typescript";
		lines.push(`\`\`\`${lang}`);
		lines.push(ex.code.trim());
		lines.push("```");
		lines.push("");
		count++;
	}
	return lines;
}

/**
 * Returns true when `kind` is a concept-level declaration.
 * @internal
 */
function isConceptKind(kind: ForgeSymbol["kind"]): boolean {
	return kind === "interface" || kind === "type" || kind === "class" || kind === "enum";
}

/**
 * Renders the key types list (top 10) from exported types and interfaces.
 * @internal
 */
function renderKeyTypes(symbols: ForgeSymbol[], max: number = 10): string[] {
	const lines: string[] = [];
	let count = 0;
	for (const sym of symbols) {
		if (count >= max) break;
		if (!sym.exported) continue;
		if (!isConceptKind(sym.kind)) continue;
		const summary = sym.documentation?.summary ?? "";
		const label = summary ? `**\`${sym.name}\`** — ${summary}` : `**\`${sym.name}\`**`;
		lines.push(`- ${label}`);
		count++;
	}
	return lines;
}

/**
 * Detects gotchas from the project's symbols — things an agent would get
 * wrong without being told. Derived from @throws, @deprecated, and
 * non-obvious type constraints.
 * @internal
 */
function renderGotchas(symbols: ForgeSymbol[]): string[] {
	const lines: string[] = [];
	const exported = symbols.filter((s) => s.exported);

	// Deprecated symbols
	const deprecated = exported.filter((s) => s.documentation?.deprecated);
	for (const sym of deprecated) {
		const reason = sym.documentation?.deprecated ?? "";
		const msg = reason && reason !== "true" ? `: ${reason}` : "";
		lines.push(`- \`${sym.name}\` is deprecated${msg}`);
	}

	// Functions that throw
	const throwers = exported.filter(
		(s) => s.kind === "function" && (s.documentation?.throws?.length ?? 0) > 0,
	);
	for (const sym of throwers) {
		for (const t of sym.documentation?.throws ?? []) {
			lines.push(
				`- \`${sym.name}()\` throws${t.type ? ` \`${t.type}\`` : ""}: ${t.description}`,
			);
		}
	}

	// Enums with non-obvious values
	const enums = exported.filter((s) => s.kind === "enum" && (s.children?.length ?? 0) > 0);
	for (const sym of enums) {
		const values = (sym.children ?? []).map((c) => c.name).join(", ");
		lines.push(`- \`${sym.name}\` enum values: ${values}`);
	}

	return lines;
}

/**
 * Generates the full SKILL.md content. Generic for ANY TypeScript project.
 * Content is derived entirely from the project's symbols and metadata.
 * @internal
 */
function buildSkillMd(symbols: ForgeSymbol[], config: ForgeConfig, directoryName: string): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);

	const description = buildDescription(symbols, config);

	const lines: string[] = [];

	// ---------------------------------------------------------------------------
	// YAML Frontmatter — required by agentskills.io spec
	// ---------------------------------------------------------------------------
	lines.push("---");
	lines.push(`name: ${directoryName}`);
	lines.push("description: >");
	for (const segment of description.split("\n")) {
		lines.push(`  ${segment}`);
	}
	lines.push("license: MIT");
	lines.push("compatibility: Requires Node.js and TypeScript");
	lines.push("metadata:");
	lines.push(`  generated-by: forge-ts`);
	lines.push("---");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Overview — from @packageDocumentation or first symbol summary
	// ---------------------------------------------------------------------------
	lines.push(`# ${projectName}`);
	lines.push("");

	const pkgDoc = symbols.find((s) => s.documentation?.tags?.packageDocumentation);
	const overview =
		pkgDoc?.documentation?.summary ??
		exported.find((s) => s.documentation?.summary)?.documentation?.summary;
	if (overview) {
		lines.push(overview);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Installation — from package name
	// ---------------------------------------------------------------------------
	lines.push("## Installation");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install ${projectName}`);
	lines.push("```");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Usage — first @example block as the quick start
	// ---------------------------------------------------------------------------
	let firstExample: { code: string; language: string; symbolName: string } | undefined;
	for (const sym of exported) {
		if (sym.kind !== "function" && sym.kind !== "class") continue;
		const ex = sym.documentation?.examples?.[0];
		if (ex) {
			firstExample = { code: ex.code, language: ex.language, symbolName: sym.name };
			break;
		}
	}

	if (firstExample) {
		lines.push("## Usage");
		lines.push("");
		lines.push(`\`\`\`${firstExample.language || "typescript"}`);
		lines.push(firstExample.code.trim());
		lines.push("```");
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Common Patterns — top 5 @example blocks with context
	// ---------------------------------------------------------------------------
	const patternLines = renderPatterns(exported, 5);
	if (patternLines.length > 0) {
		lines.push("## Common Patterns");
		lines.push("");
		lines.push(...patternLines);
	}

	// ---------------------------------------------------------------------------
	// Gotchas — from @deprecated, @throws, enums
	// ---------------------------------------------------------------------------
	const gotchaLines = renderGotchas(symbols);
	if (gotchaLines.length > 0) {
		lines.push("## Gotchas");
		lines.push("");
		lines.push(...gotchaLines);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Key Types — top 10 exported types/interfaces
	// ---------------------------------------------------------------------------
	const keyTypeLines = renderKeyTypes(exported);
	if (keyTypeLines.length > 0) {
		lines.push("## Key Types");
		lines.push("");
		lines.push(...keyTypeLines);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Configuration — only if a config-like type is detected
	// ---------------------------------------------------------------------------
	const configSymbol = exported.find(
		(s) =>
			(s.kind === "interface" || s.kind === "type") &&
			/config/i.test(s.name) &&
			(s.children?.length ?? 0) > 0,
	);

	if (configSymbol) {
		lines.push("## Configuration");
		lines.push("");
		lines.push(`The \`${configSymbol.name}\` type defines the available options:`);
		lines.push("");
		for (const child of configSymbol.children ?? []) {
			const summary = child.documentation?.summary ?? "";
			lines.push(`- **\`${child.name}\`**${summary ? ` — ${summary}` : ""}`);
		}
		lines.push("");
		lines.push("See [references/CONFIGURATION.md](references/CONFIGURATION.md) for full details.");
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// API Reference pointer — keep SKILL.md lean
	// ---------------------------------------------------------------------------
	lines.push(
		"See [references/API-REFERENCE.md](references/API-REFERENCE.md) for full API signatures, parameter tables, and all code examples.",
	);
	lines.push("");

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

/**
 * Generates the `references/API-REFERENCE.md` content.
 * Full API dump — signatures, params, returns, examples.
 * @internal
 */
function buildApiReferenceMd(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);

	const lines: string[] = [];
	lines.push(`# ${projectName} — API Reference`);
	lines.push("");
	lines.push("Full function signatures, type property tables, and all @example blocks.");
	lines.push("");

	const apiRows = renderApiRows(exported);
	if (apiRows.length > 0) {
		lines.push("## Exports");
		lines.push("");
		lines.push("| Symbol | Signature | Description |");
		lines.push("|--------|-----------|-------------|");
		lines.push(...apiRows);
		lines.push("");
	}

	for (const sym of exported) {
		if (sym.kind === "method" || sym.kind === "property") continue;

		const hasDetail =
			sym.documentation?.summary ||
			sym.signature ||
			(sym.documentation?.examples?.length ?? 0) > 0 ||
			(sym.documentation?.params?.length ?? 0) > 0;

		if (!hasDetail) continue;

		lines.push(`## \`${sym.name}\``);
		lines.push("");
		if (sym.documentation?.summary) {
			lines.push(sym.documentation.summary);
			lines.push("");
		}
		if (sym.signature) {
			lines.push("```typescript");
			lines.push(sym.signature);
			lines.push("```");
			lines.push("");
		}
		if (sym.documentation?.params && sym.documentation.params.length > 0) {
			lines.push("**Parameters:**");
			lines.push("");
			for (const p of sym.documentation.params) {
				lines.push(`- \`${p.name}\`${p.type ? ` (\`${p.type}\`)` : ""} — ${p.description}`);
			}
			lines.push("");
		}
		if (sym.documentation?.returns) {
			lines.push(`**Returns:** ${sym.documentation.returns.description}`);
			lines.push("");
		}
		// Children (class members, interface properties)
		if (sym.children && sym.children.length > 0) {
			lines.push("**Members:**");
			lines.push("");
			for (const child of sym.children) {
				const desc = child.documentation?.summary ?? "";
				lines.push(`- \`${child.name}\`${desc ? ` — ${desc}` : ""}`);
			}
			lines.push("");
		}
		for (const ex of sym.documentation?.examples ?? []) {
			const lang = ex.language || "typescript";
			lines.push(`\`\`\`${lang}`);
			lines.push(ex.code.trim());
			lines.push("```");
			lines.push("");
		}
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

/**
 * Generates the `references/CONFIGURATION.md` content.
 * Documents all config-like types with property tables.
 * @internal
 */
function buildConfigurationMd(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);

	const lines: string[] = [];
	lines.push(`# ${projectName} — Configuration Reference`);
	lines.push("");

	const configSymbols = exported.filter(
		(s) =>
			(s.kind === "interface" || s.kind === "type") &&
			/config/i.test(s.name) &&
			(s.children?.length ?? 0) > 0,
	);

	for (const configSym of configSymbols) {
		lines.push(`## \`${configSym.name}\``);
		lines.push("");
		if (configSym.documentation?.summary) {
			lines.push(configSym.documentation.summary);
			lines.push("");
		}
		lines.push("| Property | Type | Description |");
		lines.push("|----------|------|-------------|");
		for (const child of configSym.children ?? []) {
			const type = child.signature ? child.signature.split(":").slice(1).join(":").trim() : "";
			const desc = child.documentation?.summary ?? "";
			lines.push(`| \`${child.name}\` | \`${type}\` | ${desc} |`);
		}
		lines.push("");
	}

	if (configSymbols.length === 0) {
		lines.push("No configuration types detected in this project.");
		lines.push("");
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A generated skill package following the agentskills.io directory structure.
 * Contains SKILL.md plus optional references and scripts files.
 *
 * @public
 */
export interface SkillPackage {
	/** The skill directory name (lowercase, hyphens only, max 64 chars). */
	directoryName: string;
	/** Files to write inside the skill directory. */
	files: Array<{ path: string; content: string }>;
}

/**
 * Generates an agentskills.io-compliant skill package for ANY TypeScript project.
 *
 * All content is derived from the project's exported symbols and metadata.
 * No hardcoded project-specific content. Works for any project that forge-ts analyzes.
 *
 * @param symbols - All symbols from the project.
 * @param config - The resolved forge-ts config.
 * @returns A {@link SkillPackage} describing the directory and its files.
 * @example
 * ```typescript
 * import { generateSkillPackage } from "@forge-ts/gen";
 * const pkg = generateSkillPackage(symbols, config);
 * console.log(pkg.directoryName); // "my-lib"
 * console.log(pkg.files.map(f => f.path));
 * // ["SKILL.md", "references/API-REFERENCE.md", ...]
 * ```
 * @public
 */
export function generateSkillPackage(symbols: ForgeSymbol[], config: ForgeConfig): SkillPackage {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const directoryName = toDirectoryName(projectName);

	const skillMd = buildSkillMd(symbols, config, directoryName);
	const apiRefMd = buildApiReferenceMd(symbols, config);
	const configMd = buildConfigurationMd(symbols, config);

	// Generic helper script that runs the project's test suite
	const testSh = [
		"#!/usr/bin/env bash",
		"# Run the project's test suite",
		'# Usage: ./scripts/test.sh [additional args]',
		"",
		"if [ -f package.json ]; then",
		'  npm test "$@"',
		"else",
		'  echo "No package.json found"',
		"  exit 1",
		"fi",
		"",
	].join("\n");

	return {
		directoryName,
		files: [
			{ path: "SKILL.md", content: skillMd },
			{ path: "references/API-REFERENCE.md", content: apiRefMd },
			{ path: "references/CONFIGURATION.md", content: configMd },
			{ path: "scripts/test.sh", content: testSh },
		],
	};
}

/**
 * Generates a SKILL.md string following the Agent Skills specification.
 * Generic for any TypeScript project — content derived from symbols.
 *
 * @param symbols - All symbols from the project.
 * @param config - The resolved forge-ts config.
 * @returns The SKILL.md content as a string.
 * @example
 * ```typescript
 * import { generateSkillMd } from "@forge-ts/gen";
 * const skill = generateSkillMd(symbols, config);
 * ```
 * @public
 */
export function generateSkillMd(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const directoryName = toDirectoryName(projectName);
	return buildSkillMd(symbols, config, directoryName);
}
