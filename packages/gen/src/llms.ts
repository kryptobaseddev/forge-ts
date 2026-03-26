import { relative, resolve } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

/**
 * Resolves the project name from config, preferring package.json name over
 * rootDir path parsing. Falls back to "Project" if nothing is available.
 * @internal
 */
function resolveProjectName(config: ForgeConfig): string {
	if (config.project?.packageName) return config.project.packageName;
	const resolvedRoot = config.rootDir === "." ? process.cwd() : resolve(config.rootDir);
	return resolvedRoot.split("/").pop() ?? "Project";
}

/**
 * Resolves the installable package name. In monorepos, the CLI package is
 * typically scoped (e.g., @forge-ts/cli) while the root name may not be installable.
 * @internal
 */
function resolveInstallName(config: ForgeConfig): string {
	const bin = config.project?.bin;
	if (bin && Object.keys(bin).length > 0) return config.project?.packageName ?? "project";
	// Monorepo: the CLI package with a bin entry is the installable one
	return config.project?.packageName ?? "project";
}

/**
 * Groups exported symbols by their source package (monorepo-aware).
 * @internal
 */
function groupByPackage(symbols: ForgeSymbol[], rootDir: string): Map<string, ForgeSymbol[]> {
	const resolvedRoot = rootDir === "." ? process.cwd() : resolve(rootDir);
	const result = new Map<string, ForgeSymbol[]>();
	for (const s of symbols) {
		if (!s.exported) continue;
		if (s.kind === "file" || s.kind === "method" || s.kind === "property") continue;
		if (s.filePath.includes("node_modules")) continue;
		if (s.filePath.endsWith(".test.ts") || s.filePath.endsWith(".config.ts")) continue;
		const rel = relative(resolvedRoot, s.filePath);
		if (!rel.startsWith("packages") && !rel.startsWith("src")) continue;
		const match = /^packages[\\/]([^\\/]+)[\\/]/.exec(rel);
		const pkg = match ? match[1] : "main";
		const list = result.get(pkg) ?? [];
		list.push(s);
		result.set(pkg, list);
	}
	return result;
}

/**
 * Finds the @packageDocumentation summary for a list of symbols from the same package.
 * @internal
 */
function findPackageDoc(symbols: ForgeSymbol[]): string | undefined {
	for (const s of symbols) {
		if (s.kind === "file" && s.documentation?.summary && s.filePath.endsWith("index.ts")) {
			return s.documentation.summary;
		}
	}
	// Fallback: any file-level summary
	for (const s of symbols) {
		if (s.kind === "file" && s.documentation?.summary) {
			return s.documentation.summary;
		}
	}
	return undefined;
}

/**
 * Generates an `llms.txt` routing manifest from the extracted symbols.
 *
 * The file follows the llms.txt specification: a compact, structured overview
 * designed to help large language models navigate a project's documentation.
 * Symbols are grouped by package with @packageDocumentation summaries.
 *
 * @remarks
 * Filters out non-exported, test, config, and node_modules symbols.
 * Groups the remaining symbols by package, renders package-level overviews,
 * and lists key exports (functions first, then types) with one-line summaries.
 *
 * @param symbols - The symbols to include.
 * @param config - The resolved {@link ForgeConfig}.
 * @returns The generated `llms.txt` content as a string.
 * @example
 * ```typescript
 * import { generateLlmsTxt } from "@forge-ts/gen";
 * const txt = generateLlmsTxt(symbols, config);
 * console.log(txt.startsWith("# ")); // true
 * ```
 * @public
 */
export function generateLlmsTxt(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = resolveProjectName(config);
	const installName = resolveInstallName(config);
	const byPackage = groupByPackage(symbols, config.rootDir);

	const lines: string[] = [];

	// Header
	lines.push(`# ${projectName}`);
	const desc = config.project?.description;
	lines.push(`> ${desc ?? `API documentation for ${projectName}`}`);
	if (config.project?.version) {
		lines.push(`> Version: ${config.project.version}`);
	}
	lines.push("");

	// Install
	lines.push("## Install");
	lines.push("");
	lines.push(`\`\`\`bash`);
	lines.push(`npm install -D ${installName}`);
	lines.push(`\`\`\``);
	lines.push("");

	// Sections block
	lines.push("## Documentation");
	lines.push("");
	if (config.gen.formats.includes("markdown")) {
		lines.push(
			"- [API Reference](./api-reference.md): Full API documentation with signatures and examples",
		);
	}
	if (config.gen.formats.includes("mdx")) {
		lines.push("- [API Reference](./api-reference.mdx): Full API documentation (MDX)");
	}
	if (config.gen.llmsTxt) {
		lines.push(
			"- [Full Context](./llms-full.txt): Complete symbol documentation for deep LLM consumption",
		);
	}
	lines.push("");

	// Packages with grouped symbols
	if (byPackage.size > 0) {
		lines.push("## Packages");
		lines.push("");
	}
	for (const [pkgName, pkgSymbols] of byPackage) {
		const pkgDoc = findPackageDoc(pkgSymbols);
		const exported = pkgSymbols.filter((s) => s.kind !== "file");
		const fns = exported.filter((s) => s.kind === "function");
		const types = exported.filter((s) => ["interface", "type", "enum"].includes(s.kind));

		lines.push(`### ${pkgName}`);
		if (pkgDoc) {
			lines.push(pkgDoc);
		}
		lines.push(`${fns.length} functions, ${types.length} types`);
		lines.push("");

		// Functions — compact one-liners
		if (fns.length > 0) {
			for (const fn of fns) {
				const summary = fn.documentation?.summary ?? "";
				lines.push(`- ${fn.name}() — ${summary}`);
			}
			lines.push("");
		}

		// Types — compact one-liners
		if (types.length > 0) {
			for (const t of types) {
				const summary = t.documentation?.summary ?? "";
				lines.push(`- ${t.name} — ${summary}`);
			}
			lines.push("");
		}
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
 * Symbols are grouped by package with @packageDocumentation summaries.
 *
 * @remarks
 * Emits full signatures, descriptions, parameters, and return types for each
 * exported symbol. Grouped by package first, then by kind within each package.
 *
 * @param symbols - The symbols to include.
 * @param config - The resolved {@link ForgeConfig}.
 * @returns The generated `llms-full.txt` content as a string.
 * @example
 * ```typescript
 * import { generateLlmsFullTxt } from "@forge-ts/gen";
 * const fullTxt = generateLlmsFullTxt(symbols, config);
 * console.log(fullTxt.includes("Full Context")); // true
 * ```
 * @public
 */
export function generateLlmsFullTxt(symbols: ForgeSymbol[], config: ForgeConfig): string {
	const projectName = resolveProjectName(config);
	const byPackage = groupByPackage(symbols, config.rootDir);

	const lines: string[] = [];

	lines.push(`# ${projectName} — Full Context`);
	if (config.project?.description) {
		lines.push("");
		lines.push(`> ${config.project.description}`);
	}
	lines.push("");
	lines.push(`Version: ${config.project?.version ?? "unknown"}`);
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push("");

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

	for (const [pkgName, pkgSymbols] of byPackage) {
		const exported = pkgSymbols.filter((s) => s.kind !== "file");
		if (exported.length === 0) continue;

		const pkgDoc = findPackageDoc(pkgSymbols);
		lines.push(`## Package: ${pkgName}`);
		if (pkgDoc) {
			lines.push("");
			lines.push(pkgDoc);
		}
		lines.push("");

		// Group by kind within this package
		const kindGroups: Record<string, ForgeSymbol[]> = {};
		for (const symbol of exported) {
			const list = kindGroups[symbol.kind] ?? [];
			list.push(symbol);
			kindGroups[symbol.kind] = list;
		}

		for (const kind of kindOrder) {
			const group = kindGroups[kind];
			if (!group || group.length === 0) continue;

			lines.push(`### ${kindLabels[kind]}`);
			lines.push("");

			for (const symbol of group) {
				lines.push(renderFullSymbol(symbol, 4));
				lines.push("");
			}
		}
	}

	return `${lines
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}
