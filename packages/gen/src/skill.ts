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
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

/**
 * Builds a description string optimized for agentskills.io discovery.
 * Uses imperative "Use this skill when..." phrasing with trigger keywords.
 * Stays under 1024 characters.
 * @internal
 */
function buildDescription(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const exported = symbols.filter((s) => s.exported);
	const projectName =
		config.project.packageName ?? config.rootDir.split("/").pop() ?? "this project";

	// Detect capabilities from exported symbols
	const hasFunctions = exported.some((s) => s.kind === "function");
	const hasTypes = exported.some((s) => s.kind === "interface" || s.kind === "type");
	const hasRoutes = exported.some((s) => s.documentation?.tags?.route !== undefined);
	const hasClasses = exported.some((s) => s.kind === "class");

	const capabilities: string[] = [];
	if (hasFunctions) capabilities.push("functions");
	if (hasTypes) capabilities.push("type contracts");
	if (hasClasses) capabilities.push("classes");
	if (hasRoutes) capabilities.push("HTTP API routes");

	// Use @packageDocumentation summary as the lead sentence if available
	const pkgDoc = symbols.find((s) => s.documentation?.tags?.packageDocumentation);
	const leadSentence =
		pkgDoc?.documentation?.summary ??
		exported.find((s) => s.documentation?.summary)?.documentation?.summary;

	const capList = capabilities.length > 0 ? capabilities.join(", ") : "utilities";

	let description = "";
	if (leadSentence) {
		description += `${leadSentence} `;
	}
	description +=
		`Use this skill when working with ${projectName}. ` +
		`It exports ${capList}. ` +
		`Use when you need to understand the API, generate documentation, ` +
		`check TSDoc coverage, or run code examples as tests.`;

	// Enforce 1024-char limit
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
		// Only include the first example to keep size down
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
 * Generates the full SKILL.md content for the skill package.
 * Stays under 500 lines per agentskills.io specification.
 * @internal
 */
function buildSkillMd(symbols: ForgeSymbol[], config: ForgeConfig, directoryName: string): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);
	const version = (config.project as Record<string, unknown>).version as string | undefined;
	const author = (config.project as Record<string, unknown>).author as string | undefined;

	const description = buildDescription(symbols, config);

	const lines: string[] = [];

	// ---------------------------------------------------------------------------
	// YAML Frontmatter — required by agentskills.io spec
	// ---------------------------------------------------------------------------
	lines.push("---");
	lines.push(`name: ${directoryName}`);
	lines.push("description: >");
	// Indent the description block under the YAML block scalar
	for (const segment of description.split("\n")) {
		lines.push(`  ${segment}`);
	}
	lines.push("license: MIT");
	lines.push("compatibility: Requires Node.js >=24 and TypeScript");
	lines.push("metadata:");
	if (author) {
		lines.push(`  author: ${author}`);
	}
	if (version) {
		lines.push(`  version: "${version}"`);
	}
	lines.push("---");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Overview
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
	// Quick Start
	// ---------------------------------------------------------------------------
	lines.push("## Quick Start");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install -D ${projectName}`);
	lines.push("```");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Core Workflow — step-by-step procedures
	// ---------------------------------------------------------------------------
	lines.push("## Core Workflow");
	lines.push("");
	lines.push("### Step 1: Check TSDoc Coverage");
	lines.push("");
	lines.push("```bash");
	lines.push(`npx ${projectName} check`);
	lines.push("```");
	lines.push("");
	lines.push("### Step 2: Run Doctests");
	lines.push("");
	lines.push("```bash");
	lines.push(`npx ${projectName} test`);
	lines.push("```");
	lines.push("");
	lines.push("### Step 3: Generate Documentation");
	lines.push("");
	lines.push("```bash");
	lines.push(`npx ${projectName} build`);
	lines.push("```");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Common Patterns (top 5 @example blocks)
	// ---------------------------------------------------------------------------
	const patternLines = renderPatterns(exported, 5);
	if (patternLines.length > 0) {
		lines.push("## Common Patterns");
		lines.push("");
		lines.push(...patternLines);
	}

	// ---------------------------------------------------------------------------
	// Gotchas
	// ---------------------------------------------------------------------------
	lines.push("## Gotchas");
	lines.push("");
	lines.push("- Every exported function MUST have a `@example` block (E004)");
	lines.push("- Every interface member MUST have a TSDoc comment (E007)");
	lines.push("- `{@link}` references must point to existing symbols (E008)");
	lines.push("- Symbols tagged `@internal` are excluded from documentation output");
	lines.push("- `@packageDocumentation` must appear in the entry-point file (E005)");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Key Types (top 10)
	// ---------------------------------------------------------------------------
	const keyTypeLines = renderKeyTypes(exported);
	if (keyTypeLines.length > 0) {
		lines.push("## Key Types");
		lines.push("");
		lines.push(...keyTypeLines);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Configuration reference pointer
	// ---------------------------------------------------------------------------
	lines.push("## Configuration");
	lines.push("");
	lines.push(`Create a \`${projectName}.config.ts\`:`);
	lines.push("");
	lines.push("```typescript");
	lines.push(`import type { ForgeConfig } from "${projectName}";`);
	lines.push("");
	lines.push("export default {");
	lines.push('  rootDir: ".",');
	lines.push('  outDir: "docs/generated",');
	lines.push("} satisfies Partial<ForgeConfig>;");
	lines.push("```");
	lines.push("");
	lines.push("See [references/CONFIGURATION.md](references/CONFIGURATION.md) for all options.");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Validation
	// ---------------------------------------------------------------------------
	lines.push("## Validation");
	lines.push("");
	lines.push(
		`Run \`npx ${projectName} check --json --mvi full\` for detailed fix suggestions with exact TSDoc blocks to add.`,
	);
	lines.push("");

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

/**
 * Generates the `references/API-REFERENCE.md` content.
 * Contains the detailed API dump that is too verbose for SKILL.md.
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

	// Full API table
	const apiRows = renderApiRows(exported);
	if (apiRows.length > 0) {
		lines.push("## Exports");
		lines.push("");
		lines.push("| Symbol | Signature | Description |");
		lines.push("|--------|-----------|-------------|");
		lines.push(...apiRows);
		lines.push("");
	}

	// Full example listings
	for (const sym of exported) {
		const examples = sym.documentation?.examples ?? [];
		if (examples.length === 0) continue;

		lines.push(`## \`${sym.name}\``);
		lines.push("");
		if (sym.documentation?.summary) {
			lines.push(sym.documentation.summary);
			lines.push("");
		}
		if (sym.signature) {
			lines.push("**Signature:**");
			lines.push("");
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
		for (const ex of examples) {
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
 * Documents the full ForgeConfig type with all properties.
 * @internal
 */
function buildConfigurationMd(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);

	const lines: string[] = [];
	lines.push(`# ${projectName} — Configuration Reference`);
	lines.push("");
	lines.push(
		`Full documentation for all configuration options. Create a \`${projectName}.config.ts\` at your project root.`,
	);
	lines.push("");

	// Find all config-like interfaces
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
		lines.push("No configuration types found in exported symbols.");
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
 * Generates a skill package directory following the agentskills.io specification
 * (https://agentskills.io/specification).
 *
 * The package includes:
 * - `SKILL.md` — metadata frontmatter + instructional content (under 500 lines)
 * - `references/API-REFERENCE.md` — full API signatures and examples
 * - `references/CONFIGURATION.md` — full config type documentation
 * - `scripts/check.sh` — helper script for TSDoc validation
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

	const checkSh = [
		"#!/usr/bin/env bash",
		`# Run TSDoc coverage check with full MVI suggestions`,
		`npx ${projectName} check --json --mvi full "$@"`,
		"",
	].join("\n");

	return {
		directoryName,
		files: [
			{ path: "SKILL.md", content: skillMd },
			{ path: "references/API-REFERENCE.md", content: apiRefMd },
			{ path: "references/CONFIGURATION.md", content: configMd },
			{ path: "scripts/check.sh", content: checkSh },
		],
	};
}

/**
 * Generates a SKILL.md string following the Agent Skills specification
 * (https://agentskills.io/specification).
 *
 * The file includes YAML frontmatter with `name` and `description` fields
 * for discovery-phase loading, followed by instructional content for
 * activation-phase loading.
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
