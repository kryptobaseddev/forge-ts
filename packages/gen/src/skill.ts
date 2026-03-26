import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a package name or project name to a lowercase-hyphenated slug
 * valid for agentskills.io directory names (max 64 chars, hyphens only).
 * @internal
 */
function toDirectoryName(name: string): string {
	const slug = name
		.replace(/^@[^/]+\//, "") // strip npm scope
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	// agentskills.io convention: SKILL-{project} prefix
	const prefixed = slug.startsWith("skill-") ? slug : `SKILL-${slug}`;
	return prefixed.slice(0, 64);
}

/**
 * Returns true when `kind` is a concept-level declaration.
 * @internal
 */
function isConceptKind(kind: ForgeSymbol["kind"]): boolean {
	return kind === "interface" || kind === "type" || kind === "class" || kind === "enum";
}

/**
 * Returns the primary CLI command name from bin config, or undefined.
 * @internal
 */
function primaryBinName(config: ForgeConfig): string | undefined {
	const bin = config.project.bin;
	if (!bin) return undefined;
	const keys = Object.keys(bin);
	if (keys.length === 0) return undefined;
	// Prefer a key matching the package name (sans scope)
	const pkgShort = config.project.packageName?.replace(/^@[^/]+\//, "");
	return keys.find((k) => k === pkgShort) ?? keys[0];
}

// ---------------------------------------------------------------------------
// Description builder
// ---------------------------------------------------------------------------

/**
 * Builds a structured description with numbered trigger scenarios.
 * Derived from the project's exported symbols, config, and package metadata.
 * @internal
 */
function buildDescription(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const exported = symbols.filter((s) => s.exported);
	const projectName =
		config.project.packageName ?? config.rootDir.split("/").pop() ?? "this project";

	// Lead sentence — prefer package.json description, then @packageDocumentation
	const pkgDoc = symbols.find((s) => s.documentation?.tags?.packageDocumentation);
	const leadSentence =
		config.project.description ??
		pkgDoc?.documentation?.summary ??
		exported.find((s) => s.documentation?.summary)?.documentation?.summary;

	// Build numbered trigger scenarios from detected capabilities
	const triggers: string[] = [];
	let n = 1;

	const cliName = primaryBinName(config);
	if (cliName) {
		triggers.push(`(${n++}) running ${cliName} CLI commands`);
	}

	const functionCount = exported.filter((s) => s.kind === "function").length;
	if (functionCount > 0) {
		triggers.push(`(${n++}) calling its ${functionCount} API functions`);
	}

	const hasRoutes = exported.some((s) => s.documentation?.tags?.route !== undefined);
	if (hasRoutes) {
		triggers.push(`(${n++}) building HTTP API routes`);
	}

	const configSym = exported.find(
		(s) =>
			(s.kind === "interface" || s.kind === "type") &&
			/config/i.test(s.name) &&
			(s.children?.length ?? 0) > 0,
	);
	if (configSym) {
		triggers.push(`(${n++}) configuring ${projectName}`);
	}

	const typeCount = exported.filter(
		(s) => s.kind === "interface" || s.kind === "type" || s.kind === "enum",
	).length;
	if (typeCount > 0) {
		triggers.push(`(${n++}) understanding its ${typeCount} type definitions`);
	}

	const classCount = exported.filter((s) => s.kind === "class").length;
	if (classCount > 0) {
		triggers.push(`(${n++}) working with its ${classCount} classes`);
	}

	// Keywords from package.json as additional trigger words
	const keywords = config.project.keywords ?? [];
	if (keywords.length > 0) {
		const kwStr = keywords.slice(0, 5).join('", "');
		triggers.push(`(${n++}) user mentions "${kwStr}"`);
	}

	triggers.push(`(${n}) user mentions "${projectName}" or asks about its API`);

	let description = "";
	if (leadSentence) {
		description += `${leadSentence} `;
	}
	description += `Use when: ${triggers.join(", ")}.`;

	if (description.length > 1024) {
		description = `${description.slice(0, 1021)}...`;
	}
	return description;
}

// ---------------------------------------------------------------------------
// Body section renderers
// ---------------------------------------------------------------------------

/**
 * Renders a Quick Start section with install command and key CLI/API usage.
 * @internal
 */
function renderQuickStart(symbols: ForgeSymbol[], config: ForgeConfig): string[] {
	const lines: string[] = [];
	const projectName = config.project.packageName ?? "project";
	const cliName = primaryBinName(config);

	lines.push("## Quick Start");
	lines.push("");
	lines.push("```bash");
	lines.push(`npm install ${cliName ? "-D " : ""}${projectName}`);
	lines.push("```");
	lines.push("");

	// If CLI exists, show key commands instead of API example
	if (cliName && config.project.scripts) {
		const scripts = config.project.scripts;
		const relevantKeys = ["check", "test", "build", "lint", "dev", "start", "generate"];
		const cliCommands: string[] = [];
		for (const key of relevantKeys) {
			const script = scripts[key];
			if (script?.includes(cliName)) {
				cliCommands.push(`npx ${cliName} ${key}`);
			}
		}
		// Fallback: show common subcommands from bin keys
		if (cliCommands.length === 0) {
			cliCommands.push(`npx ${cliName} --help`);
		}
		if (cliCommands.length > 0) {
			lines.push("```bash");
			for (const cmd of cliCommands.slice(0, 5)) {
				lines.push(cmd);
			}
			lines.push("```");
			lines.push("");
		}
	} else {
		// No CLI — show first @example as quick start
		const exported = symbols.filter((s) => s.exported);
		for (const sym of exported) {
			if (sym.kind !== "function" && sym.kind !== "class") continue;
			const ex = sym.documentation?.examples?.[0];
			if (ex) {
				lines.push(`\`\`\`${ex.language || "typescript"}`);
				lines.push(ex.code.trim());
				lines.push("```");
				lines.push("");
				break;
			}
		}
	}

	return lines;
}

/**
 * Renders a compact API summary table for the body. Full details go to the reference.
 * @internal
 */
function renderApiSummaryTable(symbols: ForgeSymbol[]): string[] {
	const exported = symbols.filter((s) => s.exported);
	const functions = exported.filter((s) => s.kind === "function");
	if (functions.length === 0) return [];

	const lines: string[] = [];
	lines.push("## API");
	lines.push("");
	lines.push("| Function | Description |");
	lines.push("|----------|-------------|");

	for (const fn of functions.slice(0, 15)) {
		const desc = fn.documentation?.summary ?? "";
		lines.push(`| \`${fn.name}()\` | ${desc} |`);
	}
	if (functions.length > 15) {
		lines.push(`| ... | ${functions.length - 15} more — see API reference |`);
	}
	lines.push("");
	return lines;
}

/**
 * Renders key types list (top 10) from exported types and interfaces.
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
 * Renders a Configuration section with a code example using inline comments.
 * @internal
 */
function renderConfigSection(symbols: ForgeSymbol[], config: ForgeConfig): string[] {
	const exported = symbols.filter((s) => s.exported);
	const configSymbol = exported.find(
		(s) =>
			(s.kind === "interface" || s.kind === "type") &&
			/config/i.test(s.name) &&
			(s.children?.length ?? 0) > 0,
	);
	if (!configSymbol) return [];

	const lines: string[] = [];
	lines.push("## Configuration");
	lines.push("");

	// Generate a code example with inline comments from child summaries
	const children = configSymbol.children ?? [];
	if (children.length > 0) {
		const projectName = config.project.packageName ?? "project";
		const importSource = projectName.includes("/")
			? `${projectName.split("/")[0]}/${projectName.split("/")[1]}`
			: projectName;

		lines.push("```typescript");
		lines.push(`import type { ${configSymbol.name} } from "${importSource}";`);
		lines.push("");
		lines.push(`const config: Partial<${configSymbol.name}> = {`);
		for (const child of children.slice(0, 10)) {
			const comment = child.documentation?.summary;
			if (comment) {
				lines.push(`  // ${comment}`);
			}
			// Infer a sensible default value from the type
			const type = extractType(child.signature);
			const defaultVal = inferDefaultValue(type, child.name);
			lines.push(`  ${child.name}: ${defaultVal},`);
		}
		if (children.length > 10) {
			lines.push(`  // ... ${children.length - 10} more options`);
		}
		lines.push("};");
		lines.push("```");
		lines.push("");
	}

	lines.push("See [references/CONFIGURATION.md](references/CONFIGURATION.md) for full details.");
	lines.push("");
	return lines;
}

/**
 * Extracts the type portion from a property signature.
 *
 * The TypeScript checker returns different formats depending on the symbol:
 * - Simple properties: just the type, e.g. `string`, `boolean`
 * - Complex objects: the full inline type, e.g. `{ enabled: boolean; strict: boolean; }`
 * - Named properties: `name: type` (rare — most children are bare types)
 *
 * This function only splits on `:` when the left side is a simple identifier
 * (no braces, parens, or pipes). Otherwise it returns the whole string as-is,
 * since it IS the type.
 *
 * @param signature - The raw signature string from the walker.
 * @returns The extracted type string, or empty string if no signature.
 * @internal
 */
function extractType(signature: string | undefined): string {
	if (!signature) return "";
	const trimmed = signature.trim();
	// If it starts with { or ( or contains |, it's already a type expression
	if (/^[{(]/.test(trimmed) || /[|]/.test(trimmed.split(":")[0])) {
		return trimmed;
	}
	const colonIdx = trimmed.indexOf(":");
	if (colonIdx === -1) return trimmed;
	// Only split if the left side looks like a simple identifier (no special chars)
	const left = trimmed.slice(0, colonIdx).trim();
	if (/^[a-zA-Z_$][a-zA-Z0-9_$?]*$/.test(left)) {
		return trimmed.slice(colonIdx + 1).trim();
	}
	return trimmed;
}

/**
 * Infers a sensible placeholder value from a TypeScript type string.
 * @internal
 */
function inferDefaultValue(type: string, name: string): string {
	const t = type.trim();
	if (t === "boolean" || t.startsWith("boolean")) return "true";
	if (t === "string" || t.startsWith("string")) return `"..."`;
	if (t === "number" || t.startsWith("number")) return "0";
	if (t.includes("[]") || t.startsWith("Array")) return "[]";
	if (t.startsWith("{") || /^[A-Z]/.test(t)) return "{ /* ... */ }";
	if (/dir|path/i.test(name)) return `"."`;
	return `undefined`;
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
			lines.push(`- \`${sym.name}()\` throws${t.type ? ` \`${t.type}\`` : ""}: ${t.description}`);
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

// ---------------------------------------------------------------------------
// SKILL.md builder
// ---------------------------------------------------------------------------

/**
 * Generates the full SKILL.md content. Generic for ANY TypeScript project.
 * Content is derived entirely from the project's symbols and metadata.
 * @internal
 */
function buildSkillMd(symbols: ForgeSymbol[], config: ForgeConfig, directoryName: string): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";

	const description = buildDescription(symbols, config);

	const lines: string[] = [];

	// ---------------------------------------------------------------------------
	// YAML Frontmatter — only name + description per skill spec
	// ---------------------------------------------------------------------------
	lines.push("---");
	lines.push(`name: ${directoryName}`);
	lines.push("description: >");
	for (const segment of description.split("\n")) {
		lines.push(`  ${segment}`);
	}
	lines.push("---");
	lines.push("");

	// ---------------------------------------------------------------------------
	// Title + Overview
	// ---------------------------------------------------------------------------
	lines.push(`# ${projectName}`);
	lines.push("");

	const pkgDoc = symbols.find((s) => s.documentation?.tags?.packageDocumentation);
	const overview =
		config.project.description ??
		pkgDoc?.documentation?.summary ??
		symbols.filter((s) => s.exported).find((s) => s.documentation?.summary)?.documentation?.summary;
	if (overview) {
		lines.push(overview);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Quick Start — install + CLI commands or first example
	// ---------------------------------------------------------------------------
	lines.push(...renderQuickStart(symbols, config));

	// ---------------------------------------------------------------------------
	// API summary table — compact, functions only
	// ---------------------------------------------------------------------------
	lines.push(...renderApiSummaryTable(symbols));

	// ---------------------------------------------------------------------------
	// Configuration — code example with inline comments
	// ---------------------------------------------------------------------------
	lines.push(...renderConfigSection(symbols, config));

	// ---------------------------------------------------------------------------
	// Custom sections — injected from config.skill.customSections
	// These allow projects to add workflow knowledge, domain context,
	// and other information that cannot be derived from symbols alone.
	// ---------------------------------------------------------------------------
	const customSections = config.skill.customSections ?? [];
	for (const section of customSections) {
		lines.push(`## ${section.heading}`);
		lines.push("");
		lines.push(section.content);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Gotchas — from @deprecated, @throws, enums + config.skill.extraGotchas
	// ---------------------------------------------------------------------------
	const gotchaLines = renderGotchas(symbols);
	const extraGotchas = config.skill.extraGotchas ?? [];
	for (const gotcha of extraGotchas) {
		gotchaLines.push(`- ${gotcha}`);
	}
	if (gotchaLines.length > 0) {
		lines.push("## Gotchas");
		lines.push("");
		lines.push(...gotchaLines);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// Key Types — top 10 exported types/interfaces
	// ---------------------------------------------------------------------------
	const keyTypeLines = renderKeyTypes(symbols);
	if (keyTypeLines.length > 0) {
		lines.push("## Key Types");
		lines.push("");
		lines.push(...keyTypeLines);
		lines.push("");
	}

	// ---------------------------------------------------------------------------
	// References section — clear pointers to bundled files
	// ---------------------------------------------------------------------------
	lines.push("## References");
	lines.push("");
	lines.push("- [references/CONFIGURATION.md](references/CONFIGURATION.md) — Full config options");
	lines.push(
		"- [references/API-REFERENCE.md](references/API-REFERENCE.md) — Signatures, parameters, examples",
	);
	lines.push("");

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// API Reference builder
// ---------------------------------------------------------------------------

/**
 * Generates the `references/API-REFERENCE.md` content.
 * Grouped by kind with a Table of Contents for efficient navigation.
 * @internal
 */
function buildApiReferenceMd(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const exported = symbols.filter((s) => s.exported);

	const lines: string[] = [];
	lines.push(`# ${projectName} — API Reference`);
	lines.push("");

	// Group by kind
	const functions = exported.filter((s) => s.kind === "function");
	const classes = exported.filter((s) => s.kind === "class");
	const types = exported.filter(
		(s) => s.kind === "interface" || s.kind === "type" || s.kind === "enum",
	);
	const variables = exported.filter((s) => s.kind === "variable");

	// Table of Contents
	const tocEntries: string[] = [];
	if (functions.length > 0) tocEntries.push("- [Functions](#functions)");
	if (types.length > 0) tocEntries.push("- [Types](#types)");
	if (classes.length > 0) tocEntries.push("- [Classes](#classes)");
	if (variables.length > 0) tocEntries.push("- [Constants](#constants)");

	if (tocEntries.length > 0) {
		lines.push("## Table of Contents");
		lines.push("");
		lines.push(...tocEntries);
		lines.push("");
	}

	// Functions section
	if (functions.length > 0) {
		lines.push("## Functions");
		lines.push("");
		for (const sym of functions) {
			lines.push(...renderSymbolDetail(sym));
		}
	}

	// Types section
	if (types.length > 0) {
		lines.push("## Types");
		lines.push("");
		for (const sym of types) {
			lines.push(...renderSymbolDetail(sym));
		}
	}

	// Classes section
	if (classes.length > 0) {
		lines.push("## Classes");
		lines.push("");
		for (const sym of classes) {
			lines.push(...renderSymbolDetail(sym));
		}
	}

	// Constants section
	if (variables.length > 0) {
		lines.push("## Constants");
		lines.push("");
		for (const sym of variables) {
			lines.push(...renderSymbolDetail(sym));
		}
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

/**
 * Renders a single symbol's full detail block for the API reference.
 * @internal
 */
function renderSymbolDetail(sym: ForgeSymbol): string[] {
	const lines: string[] = [];
	lines.push(`### \`${sym.name}\``);
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
	return lines;
}

// ---------------------------------------------------------------------------
// Configuration Reference builder
// ---------------------------------------------------------------------------

/**
 * Generates the `references/CONFIGURATION.md` content.
 * Documents all config-like types with property tables and code examples.
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

		const children = configSym.children ?? [];

		// Code example with inline comments
		if (children.length > 0) {
			const importSource = projectName.includes("/") ? projectName : projectName;

			lines.push("```typescript");
			lines.push(`import type { ${configSym.name} } from "${importSource}";`);
			lines.push("");
			lines.push(`const config: Partial<${configSym.name}> = {`);
			for (const child of children) {
				if (child.documentation?.summary) {
					lines.push(`  // ${child.documentation.summary}`);
				}
				const type = extractType(child.signature);
				const defaultVal = inferDefaultValue(type, child.name);
				lines.push(`  ${child.name}: ${defaultVal},`);
			}
			lines.push("};");
			lines.push("```");
			lines.push("");
		}

		// Property table for quick lookup
		lines.push("| Property | Type | Description |");
		lines.push("|----------|------|-------------|");
		for (const child of children) {
			const type = extractType(child.signature);
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
// Script builders
// ---------------------------------------------------------------------------

/**
 * Generates contextual shell scripts based on project metadata.
 * @internal
 */
function buildScripts(config: ForgeConfig): Array<{ path: string; content: string }> {
	const scripts: Array<{ path: string; content: string }> = [];
	const cliName = primaryBinName(config);
	const pkgScripts = config.project.scripts ?? {};

	if (cliName) {
		// Projects with a CLI get purpose-built wrappers
		// Build script
		if (pkgScripts.build) {
			scripts.push({
				path: "scripts/build.sh",
				content: [
					"#!/usr/bin/env bash",
					`# Run ${cliName} build pipeline`,
					"set -euo pipefail",
					`npx ${cliName} build "$@"`,
					"",
				].join("\n"),
			});
		}

		// Check/lint script
		const checkCmd = pkgScripts.check ?? pkgScripts.lint;
		if (checkCmd) {
			const subcommand = checkCmd.includes("check") ? "check" : "lint";
			scripts.push({
				path: "scripts/check.sh",
				content: [
					"#!/usr/bin/env bash",
					`# Run ${cliName} ${subcommand}`,
					"set -euo pipefail",
					`npx ${cliName} ${subcommand} "$@"`,
					"",
				].join("\n"),
			});
		}

		// Test script
		if (pkgScripts.test) {
			scripts.push({
				path: "scripts/test.sh",
				content: [
					"#!/usr/bin/env bash",
					`# Run ${cliName} test suite`,
					"set -euo pipefail",
					`npx ${cliName} test "$@"`,
					"",
				].join("\n"),
			});
		}
	}

	// Fallback: always include at least a test script
	if (scripts.length === 0) {
		scripts.push({
			path: "scripts/test.sh",
			content: [
				"#!/usr/bin/env bash",
				"# Run the project's test suite",
				"# Usage: ./scripts/test.sh [additional args]",
				"",
				"if [ -f package.json ]; then",
				'  npm test "$@"',
				"else",
				'  echo "No package.json found"',
				"  exit 1",
				"fi",
				"",
			].join("\n"),
		});
	}

	return scripts;
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
 * @remarks
 * Produces SKILL.md, API-REFERENCE.md, CONFIGURATION.md, and contextual shell
 * scripts. The directory name follows the `SKILL-{project}` convention.
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
	const scripts = buildScripts(config);

	return {
		directoryName,
		files: [
			{ path: "SKILL.md", content: skillMd },
			{ path: "references/API-REFERENCE.md", content: apiRefMd },
			{ path: "references/CONFIGURATION.md", content: configMd },
			...scripts,
		],
	};
}

/**
 * Generates a SKILL.md string following the Agent Skills specification.
 * Generic for any TypeScript project — content derived from symbols.
 *
 * @remarks
 * Delegates to the internal `buildSkillMd` function with an auto-generated
 * directory name derived from the project's package name.
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
