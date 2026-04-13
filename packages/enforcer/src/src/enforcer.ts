import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	createWalker,
	type EnforceRules,
	type ForgeConfig,
	type ForgeError,
	type ForgeResult,
	type ForgeSymbol,
	type ForgeWarning,
	filterByVisibility,
	isRuleBypassed,
	readLockFile,
	validateAgainstLock,
} from "@forge-ts/core";
import { findDeprecatedUsages } from "./deprecation-tracker.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a symbol has at least a summary in its documentation.
 * @internal
 */
function hasSummary(symbol: ForgeSymbol): boolean {
	return (
		symbol.documentation?.summary !== undefined && symbol.documentation.summary.trim().length > 0
	);
}

/**
 * Splits a signature parameter list on top-level commas, respecting angle
 * bracket nesting so that `Record<string, string[]>` is not split.
 * @internal
 */
function splitParams(raw: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of raw) {
		if (ch === "<" || ch === "(") {
			depth++;
			current += ch;
		} else if (ch === ">" || ch === ")") {
			depth--;
			current += ch;
		} else if (ch === "," && depth === 0) {
			parts.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	if (current.trim()) {
		parts.push(current);
	}
	return parts;
}

/**
 * Returns the names of parameters that are declared on a function/method symbol
 * but lack a corresponding `@param` tag in its documentation.
 *
 * Since the AST walker populates `documentation.params` from parsed TSDoc, we
 * compare the set of documented param names against the names that appear in
 * the symbol's type signature.  When no signature is available the check is
 * skipped (returns empty array).
 *
 * @internal
 */
function undocumentedParams(symbol: ForgeSymbol): string[] {
	const sig = symbol.signature;
	if (!sig) return [];

	// Parse parameter names out of the signature string.
	// Signatures look like: "(a: string, b: number) => void"
	// Must handle nested generics: "(tags: Record<string, string[]>) => void"
	const parenMatch = sig.match(/^\(([^)]*)\)/);
	if (!parenMatch?.[1].trim()) return [];

	const rawParams = splitParams(parenMatch[1])
		.map((p) =>
			p
				.trim()
				.split(":")[0]
				.trim()
				.replace(/^\.{3}/, "")
				.replace(/\?$/, "")
				.trim(),
		)
		.filter((p) => p.length > 0 && p !== "this");

	if (rawParams.length === 0) return [];

	const documentedNames = new Set((symbol.documentation?.params ?? []).map((p) => p.name));
	return rawParams.filter((name) => !documentedNames.has(name));
}

/**
 * Returns `true` when a function/method symbol has a non-void return type but
 * no `@returns` block in its documentation.
 * @internal
 */
function missingReturns(symbol: ForgeSymbol): boolean {
	const sig = symbol.signature;
	if (!sig) return false;

	// Extract return type: everything after the last "=>"
	const arrowIdx = sig.lastIndexOf("=>");
	if (arrowIdx === -1) return false;
	const returnType = sig.slice(arrowIdx + 2).trim();

	const isVoidLike =
		returnType === "void" ||
		returnType === "never" ||
		returnType === "undefined" ||
		returnType.startsWith("Promise<void>") ||
		returnType.startsWith("Promise<never>") ||
		returnType.startsWith("Promise<undefined>");

	if (isVoidLike) return false;
	return symbol.documentation?.returns === undefined;
}

/**
 * Returns `true` when a `@deprecated` tag is present but carries no
 * explanatory text.
 * @internal
 */
function deprecatedWithoutReason(symbol: ForgeSymbol): boolean {
	const deprecated = symbol.documentation?.deprecated;
	if (deprecated === undefined) return false;
	// The walker stores `"true"` when the tag has no content.
	return deprecated === "true" || deprecated.trim().length === 0;
}

/**
 * Extracts generic type parameter names from a symbol's signature.
 * Handles patterns like `<T>`, `<T, U>`, `<T extends Record<string, unknown>>`, etc.
 * Respects nested angle brackets so constraints are not prematurely closed.
 * @internal
 */
function extractGenericTypeParams(signature: string | undefined): string[] {
	if (!signature?.startsWith("<")) return [];
	// Find the matching closing '>' respecting nesting
	let depth = 0;
	let endIdx = -1;
	for (let i = 0; i < signature.length; i++) {
		if (signature[i] === "<") depth++;
		else if (signature[i] === ">") {
			depth--;
			if (depth === 0) {
				endIdx = i;
				break;
			}
		}
	}
	if (endIdx === -1) return [];
	const inner = signature.slice(1, endIdx);
	// Split on top-level commas (depth 0)
	const params: string[] = [];
	let paramDepth = 0;
	let current = "";
	for (const ch of inner) {
		if (ch === "<" || ch === "(") {
			paramDepth++;
			current += ch;
		} else if (ch === ">" || ch === ")") {
			paramDepth--;
			current += ch;
		} else if (ch === "," && paramDepth === 0) {
			params.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	if (current.trim()) params.push(current);
	return params.map((p) => p.trim().split(/\s+/)[0].trim()).filter((p) => p.length > 0);
}

/**
 * Returns `true` when a property signature looks optional —
 * i.e. includes `| undefined` in the type.
 * @internal
 */
function isOptionalProperty(child: ForgeSymbol): boolean {
	const sig = child.signature;
	if (!sig) return false;
	if (sig.includes("| undefined") || sig.includes("undefined |")) return true;
	return false;
}

/**
 * Extracts a flat map of biome rule names to their configured level
 * from a parsed biome.json structure.
 * Walks `linter.rules.<group>.<ruleName>` and normalises both string
 * and object (`{ level: "error" }`) forms.
 * @internal
 */
function extractBiomeRules(biome: Record<string, unknown>): Record<string, string> {
	const result: Record<string, string> = {};
	const linter = biome.linter as Record<string, unknown> | undefined;
	if (!linter) return result;
	const rules = linter.rules as Record<string, unknown> | undefined;
	if (!rules) return result;
	for (const [group, groupRules] of Object.entries(rules)) {
		if (
			group === "recommended" ||
			group === "all" ||
			typeof groupRules !== "object" ||
			groupRules === null
		)
			continue;
		for (const [ruleName, ruleValue] of Object.entries(groupRules as Record<string, unknown>)) {
			const fullName = `${group}/${ruleName}`;
			if (typeof ruleValue === "string") {
				result[fullName] = ruleValue;
			} else if (typeof ruleValue === "object" && ruleValue !== null && "level" in ruleValue) {
				result[fullName] = String((ruleValue as Record<string, unknown>).level);
			}
		}
	}
	return result;
}

/**
 * Returns `true` when `current` is a weaker biome level than `locked`.
 * Ranking: error > warn > off.
 * @internal
 */
function isWeakerBiomeLevel(current: string, locked: string): boolean {
	const rank: Record<string, number> = { off: 0, warn: 1, error: 2 };
	const currentRank = rank[current] ?? 0;
	const lockedRank = rank[locked] ?? 0;
	return currentRank < lockedRank;
}

/**
 * Extracts major.minor from a semver-like string.
 * Handles patterns like ">=22.0.0", "^22.0.0", "~22.0.0", "22.0.0", "22.0".
 * @internal
 */
function parseSemverMajorMinor(version: string): [number, number] | null {
	const match = version.match(/(\d+)\.(\d+)/);
	if (!match) return null;
	return [Number(match[1]), Number(match[2])];
}

/**
 * Compares two [major, minor] tuples.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * @internal
 */
function compareMajorMinor(a: [number, number], b: [number, number]): number {
	if (a[0] !== b[0]) return a[0] - b[0];
	return a[1] - b[1];
}

// ---------------------------------------------------------------------------
// Rule map
// ---------------------------------------------------------------------------

/**
 * Maps E-code strings to their corresponding {@link EnforceRules} key.
 * @internal
 */
const RULE_MAP: Record<string, keyof EnforceRules> = {
	E001: "require-summary",
	E002: "require-param",
	E003: "require-returns",
	E004: "require-example",
	E005: "require-package-doc",
	E006: "require-class-member-doc",
	E007: "require-interface-member-doc",
	W006: "require-tsdoc-syntax",
	E013: "require-remarks",
	E014: "require-default-value",
	E015: "require-type-param",
	W005: "require-see",
	E016: "require-release-tag",
	W007: "require-fresh-guides",
	W008: "require-guide-coverage",
	E017: "require-internal-boundary",
	E018: "require-route-response",
	W009: "require-inheritdoc-source",
	W010: "require-migration-path",
	W011: "require-since",
	E019: "require-no-ts-ignore",
	E020: "require-no-any-in-api",
	W012: "require-fresh-link-text",
	W013: "require-fresh-examples",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the TSDoc enforcement pass against a project.
 *
 * The enforcer walks all exported symbols that meet the configured minimum
 * visibility threshold and emits diagnostics for any documentation deficiencies
 * it finds.
 *
 * ### Error codes
 * | Code | Severity | Condition |
 * |------|----------|-----------|
 * | E001 | error    | Exported symbol is missing a TSDoc summary. |
 * | E002 | error    | Function/method parameter lacks a `@param` tag. |
 * | E003 | error    | Non-void function/method lacks a `@returns` tag. |
 * | E004 | error    | Exported function/method is missing an `@example` block. |
 * | E005 | error    | Package entry point (index.ts) is missing `@packageDocumentation`. |
 * | E006 | error    | Public/protected class member is missing a TSDoc comment. |
 * | E007 | error    | Interface/type alias property is missing a TSDoc comment. |
 * | W001 | warning  | TSDoc comment contains parse errors. |
 * | W002 | warning  | Function body throws but has no `@throws` tag. |
 * | W003 | warning  | `@deprecated` tag is present without explanation. |
 * | W006 | warning  | TSDoc parser-level syntax error (invalid tag, malformed block, etc.). |
 * | E009 | error    | tsconfig.json required strict-mode flag is missing or disabled (guard). |
 * | E010 | error    | Config drift: a rule severity is weaker than the locked value. |
 * | E013 | error    | Exported function/class is missing a `@remarks` block. |
 * | E014 | warn     | Optional property of interface/type is missing `@defaultValue`. |
 * | E015 | error    | Generic symbol is missing `@typeParam` for a type parameter. |
 * | W005 | warn     | Symbol references other symbols via `{@link}` but has no `@see` tags. |
 * | W007 | warn     | Guide FORGE:AUTO section references a symbol that no longer exists. |
 * | W008 | warn     | Exported public symbol is not mentioned in any guide page. |
 * | E017 | error    | `@internal` symbol re-exported through public barrel (index.ts). |
 * | E018 | warn     | `@route`-tagged function missing `@response` tag. |
 * | W009 | warn     | `{@inheritDoc}` references a symbol that does not exist. |
 * | W010 | warn     | `@breaking` tag present without `@migration` path. |
 * | W011 | warn     | New public export missing `@since` version tag. |
 * | E019 | error    | Non-test file contains `@ts-expect-error` / `@ts-expect-error`. |
 * | E020 | error    | Exported symbol has `any` in its public API signature. |
 * | W012 | warn     | `{@link}` display text appears stale relative to target summary. |
 * | W013 | warn     | `@example` block may be stale (arg count mismatch). |
 *
 * When `config.enforce.strict` is `true` all warnings are promoted to errors.
 *
 * @remarks
 * E020 (`require-no-any-in-api`) uses the symbol's `signature` string — which
 * the walker populates via `getDeclaredTypeOfSymbol` for interfaces, types, and
 * enums — to inspect the declared API surface rather than runtime types. Only
 * the signature type string is tested for the word `any` (via `\bany\b`);
 * function bodies are never inspected. This avoids false positives from
 * internal `any` usage inside implementation code that does not surface in the
 * public API.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} describing which symbols passed or failed.
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { enforce } from "@forge-ts/enforcer";
 * const config = await loadConfig();
 * const result = await enforce(config);
 * if (!result.success) {
 *   console.error(`${result.errors.length} errors found`);
 * }
 * ```
 * @see ForgeConfig
 * @see ForgeResult
 * @since 0.9.0
 * @public
 */
export async function enforce(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();
	const errors: ForgeError[] = [];
	const warnings: ForgeWarning[] = [];

	const walker = createWalker(config);
	const allSymbols = walker.walk();
	const symbols = filterByVisibility(allSymbols, config.enforce.minVisibility);

	// ---------------------------------------------------------------------------
	// Ignore file: read symbol names to skip enforcement on (Knip integration)
	// ---------------------------------------------------------------------------
	const ignoreSet = new Set<string>();
	if (config.enforce.ignoreFile) {
		const ignoreFilePath = resolve(config.rootDir, config.enforce.ignoreFile);
		if (existsSync(ignoreFilePath)) {
			try {
				const content = readFileSync(ignoreFilePath, "utf-8");
				for (const rawLine of content.split("\n")) {
					const trimmed = rawLine.trim();
					if (trimmed.length > 0 && !trimmed.startsWith("#")) {
						ignoreSet.add(trimmed);
					}
				}
			} catch {
				// Ignore read errors gracefully
			}
		}
	}

	/**
	 * Emit a diagnostic.  The configured per-rule severity determines whether
	 * the diagnostic is an error or warning; "off" suppresses it entirely.
	 * When `strict` is enabled every warning is promoted to an error.
	 */
	function emit(
		code: string,
		message: string,
		filePath: string,
		line: number,
		column: number,
		guidance?: { suggestedFix?: string; symbolName?: string; symbolKind?: string },
	): void {
		const ruleKey = RULE_MAP[code];

		// For rule codes tracked in the map, honour the per-rule severity.
		if (ruleKey !== undefined) {
			const configuredSeverity = config.enforce.rules[ruleKey];
			if (configuredSeverity === "off") return;
			const effectiveSeverity = config.enforce.strict ? "error" : configuredSeverity;
			const diag = { code, message, filePath, line, column, ...guidance };
			if (effectiveSeverity === "error") {
				errors.push(diag);
			} else {
				warnings.push(diag);
			}
			return;
		}

		// For codes not in the map (W003, E008, etc.) fall back to the old
		// behaviour: always emit, respect strict mode for warnings.
		const diag = { code, message, filePath, line, column, ...guidance };
		// Codes starting with "W" are warnings by default.
		if (code.startsWith("W") && !config.enforce.strict) {
			warnings.push(diag);
		} else {
			errors.push(diag);
		}
	}

	for (const symbol of symbols) {
		if (!symbol.exported) continue;

		// Skip enforcement for symbols in the ignore file (Knip dead-export integration)
		if (ignoreSet.has(symbol.name)) continue;

		// Skip enforcement for symbols with @forgeIgnore tag
		if (symbol.documentation?.tags?.forgeIgnore !== undefined) continue;

		// Skip specific rules for the "file" symbol (which just carries @packageDocumentation)
		if (symbol.kind === "file") continue;

		const isFunctionLike = symbol.kind === "function" || symbol.kind === "method";

		// E001 — Missing summary
		if (!hasSummary(symbol)) {
			emit(
				"E001",
				`Exported symbol "${symbol.name}" is missing a TSDoc summary comment.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
				{
					suggestedFix: `/**\n * [Description of ${symbol.name}]\n */`,
					symbolName: symbol.name,
					symbolKind: symbol.kind,
				},
			);
		}

		// E002 — Undocumented parameters
		if (isFunctionLike) {
			const missing = undocumentedParams(symbol);
			for (const paramName of missing) {
				emit(
					"E002",
					`Parameter "${paramName}" of "${symbol.name}" is not documented with a @param tag.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						suggestedFix: `@param ${paramName} - [Description of ${paramName}]`,
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// E003 — Missing @returns
		if (isFunctionLike && missingReturns(symbol)) {
			emit(
				"E003",
				`"${symbol.name}" has a non-void return type but is missing a @returns tag.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
				{
					suggestedFix: `@returns [Description of the return value]`,
					symbolName: symbol.name,
					symbolKind: symbol.kind,
				},
			);
		}

		// E004 — Missing @example
		if (isFunctionLike && symbol.documentation) {
			const hasExample = (symbol.documentation.examples ?? []).length > 0;
			if (!hasExample) {
				emit(
					"E004",
					`Exported function "${symbol.name}" is missing an @example block. Add a fenced code block showing usage.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						suggestedFix: `@example\n * \`\`\`typescript\n * // Usage of ${symbol.name}\n * ${symbol.name}();\n * \`\`\``,
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// E006 — Class member missing documentation
		// E007 — Interface/type member missing documentation
		if (symbol.kind === "class" || symbol.kind === "interface") {
			const errorCode = symbol.kind === "class" ? "E006" : "E007";
			for (const child of symbol.children ?? []) {
				if (child.kind === "property" || child.kind === "method") {
					if (!hasSummary(child)) {
						emit(
							errorCode,
							`Member "${child.name}" of ${symbol.kind} "${symbol.name}" is missing a TSDoc comment.`,
							child.filePath,
							child.line,
							child.column,
							{
								suggestedFix: `/**\n * [Description of ${child.name}]\n */`,
								symbolName: child.name,
								symbolKind: child.kind,
							},
						);
					}
				}
			}
		}

		// E013 — Missing @remarks on exported functions/classes
		if (symbol.kind === "function" || symbol.kind === "class") {
			const hasRemarks = symbol.documentation?.tags?.remarks !== undefined;
			if (!hasRemarks) {
				emit(
					"E013",
					`Exported ${symbol.kind} "${symbol.name}" is missing a @remarks block.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						suggestedFix: `@remarks [Detailed description of ${symbol.name}]`,
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// E014 — Missing @defaultValue on optional properties of interfaces/types
		if (symbol.kind === "interface" || symbol.kind === "type") {
			for (const child of symbol.children ?? []) {
				if (child.kind !== "property") continue;
				if (!isOptionalProperty(child)) continue;
				const hasDefaultValue = child.documentation?.tags?.defaultValue !== undefined;
				if (!hasDefaultValue) {
					emit(
						"E014",
						`Optional property "${child.name}" of ${symbol.kind} "${symbol.name}" is missing @defaultValue.`,
						child.filePath,
						child.line,
						child.column,
						{
							suggestedFix: `@defaultValue [Default value of ${child.name}]`,
							symbolName: child.name,
							symbolKind: child.kind,
						},
					);
				}
			}
		}

		// E015 — Missing @typeParam on generic symbols
		if (symbol.kind === "function" || symbol.kind === "class" || symbol.kind === "interface") {
			const typeParamNames = extractGenericTypeParams(symbol.signature);
			if (typeParamNames.length > 0) {
				const documentedTypeParams = new Set(
					(symbol.documentation?.tags?.typeParam ?? []).map((tp) =>
						tp.split(/\s/)[0].replace(/-$/, "").trim(),
					),
				);
				for (const typeParamName of typeParamNames) {
					if (!documentedTypeParams.has(typeParamName)) {
						emit(
							"E015",
							`Type parameter "${typeParamName}" of "${symbol.name}" is not documented with @typeParam.`,
							symbol.filePath,
							symbol.line,
							symbol.column,
							{
								suggestedFix: `@typeParam ${typeParamName} - [Description of ${typeParamName}]`,
								symbolName: symbol.name,
								symbolKind: symbol.kind,
							},
						);
					}
				}
			}
		}

		// W005 — {@link} references present but no @see tags
		if (symbol.documentation?.links && symbol.documentation.links.length > 0) {
			const hasSee =
				symbol.documentation.tags?.see !== undefined && symbol.documentation.tags.see.length > 0;
			if (!hasSee) {
				emit(
					"W005",
					`"${symbol.name}" references other symbols via {@link} but has no @see tags.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						suggestedFix: "@see [Related symbol name]",
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// E016 — Missing release tag on exported symbols
		{
			const releaseTags = ["public", "beta", "internal", "alpha"];
			const hasReleaseTag = releaseTags.some(
				(tag) => symbol.documentation?.tags?.[tag] !== undefined,
			);
			if (!hasReleaseTag) {
				emit(
					"E016",
					`Exported symbol "${symbol.name}" is missing a release tag (@public, @beta, or @internal).`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						suggestedFix: "@public",
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// E017 — @internal symbol re-exported through public barrel (index.ts)
		if (
			symbol.documentation?.tags?.internal !== undefined &&
			/[/\\]index\.ts$/.test(symbol.filePath)
		) {
			emit(
				"E017",
				`@internal symbol "${symbol.name}" is re-exported through public barrel "${symbol.filePath}".`,
				symbol.filePath,
				symbol.line,
				symbol.column,
				{
					suggestedFix: `Remove "${symbol.name}" from the public barrel file (index.ts) or remove the @internal tag.`,
					symbolName: symbol.name,
					symbolKind: symbol.kind,
				},
			);
		}

		// E018 — @route-tagged function missing @response
		if (symbol.documentation?.tags?.route && !symbol.documentation?.tags?.response) {
			emit(
				"E018",
				`Route handler "${symbol.name}" is missing a @response tag. Document expected HTTP responses.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
				{
					suggestedFix: "@response 200 - Success response",
					symbolName: symbol.name,
					symbolKind: symbol.kind,
				},
			);
		}

		// W010 — @breaking without @migration
		if (symbol.documentation?.tags?.breaking && !symbol.documentation?.tags?.migration) {
			emit(
				"W010",
				`"${symbol.name}" has a @breaking tag but no @migration path. Provide migration guidance.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
				{
					suggestedFix: "@migration [Describe how to migrate from the old API]",
					symbolName: symbol.name,
					symbolKind: symbol.kind,
				},
			);
		}

		// W011 — New public export missing @since
		{
			const releaseTags = ["public", "beta", "alpha"];
			const hasReleaseTag = releaseTags.some(
				(tag) => symbol.documentation?.tags?.[tag] !== undefined,
			);
			if (hasReleaseTag && !symbol.documentation?.tags?.since) {
				emit(
					"W011",
					`Exported symbol "${symbol.name}" has a release tag but is missing @since version.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						suggestedFix: "@since 1.0.0",
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// E020 — `any` type in public API signature
		// E020 uses the symbol's `signature` string (populated by the walker via
		// `getDeclaredTypeOfSymbol` for interfaces/types/enums) to check the
		// declared API surface, not runtime types. Only the signature type string
		// is tested for the word "any" — function bodies are never inspected.
		// This avoids false positives from internal `any` usage inside
		// implementation code that doesn't surface in the public API.
		if (symbol.documentation?.tags?.internal === undefined && symbol.signature) {
			const anyRegex = /\bany\b/g;
			if (anyRegex.test(symbol.signature)) {
				emit(
					"E020",
					`Exported symbol "${symbol.name}" has \`any\` in its signature. Use a specific type or generic.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
					{
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// W003 — @deprecated without reason
		if (deprecatedWithoutReason(symbol)) {
			emit(
				"W003",
				`"${symbol.name}" is marked @deprecated but provides no explanation.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
				{
					symbolName: symbol.name,
					symbolKind: symbol.kind,
				},
			);
		}

		// W006 — TSDoc parser syntax messages
		if (symbol.documentation?.parseMessages) {
			for (const msg of symbol.documentation.parseMessages) {
				emit(
					"W006",
					`TSDoc syntax: ${msg.text} [${msg.messageId}]`,
					symbol.filePath,
					msg.line,
					symbol.column,
					{
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}

		// W006 — TSDoc parser syntax messages on child symbols
		if (symbol.children) {
			for (const child of symbol.children) {
				if (child.documentation?.parseMessages) {
					for (const msg of child.documentation.parseMessages) {
						emit(
							"W006",
							`TSDoc syntax: ${msg.text} [${msg.messageId}]`,
							child.filePath,
							msg.line,
							child.column,
							{
								symbolName: child.name,
								symbolKind: child.kind,
							},
						);
					}
				}
			}
		}
	}

	// W013 — Stale @example blocks (arg count mismatch with function signature)
	for (const symbol of symbols) {
		if (!symbol.exported) continue;
		if (ignoreSet.has(symbol.name)) continue;
		if (symbol.documentation?.tags?.forgeIgnore !== undefined) continue;

		const isFn = symbol.kind === "function" || symbol.kind === "method";
		if (!isFn) continue;

		const examples = symbol.documentation?.examples ?? [];
		if (examples.length === 0) continue;

		// Extract parameter count from signature
		const sig = symbol.signature;
		if (!sig) continue;

		const parenMatch = sig.match(/^\(([^)]*)\)/);
		if (!parenMatch) continue;

		const rawParamStr = parenMatch[1].trim();
		let paramCount = 0;
		if (rawParamStr.length > 0) {
			const params = splitParams(rawParamStr)
				.map((p) =>
					p
						.trim()
						.split(":")[0]
						.trim()
						.replace(/^\.{3}/, "")
						.replace(/\?$/, "")
						.trim(),
				)
				.filter((p) => p.length > 0 && p !== "this");
			paramCount = params.length;
		}

		// Build a regex to find calls to this function in example code
		const funcCallRegex = new RegExp(`\\b${symbol.name}\\s*\\(`, "g");

		for (const example of examples) {
			funcCallRegex.lastIndex = 0;
			let callMatch = funcCallRegex.exec(example.code);
			while (callMatch) {
				// Count arguments by finding the matching closing paren
				const startIdx = callMatch.index + callMatch[0].length;
				let depth = 1;
				let idx = startIdx;
				while (idx < example.code.length && depth > 0) {
					const ch = example.code[idx];
					if (ch === "(" || ch === "<" || ch === "[" || ch === "{") depth++;
					else if (ch === ")" || ch === ">" || ch === "]" || ch === "}") depth--;
					idx++;
				}
				// Extract the arguments substring
				const argsStr = example.code.slice(startIdx, idx - 1).trim();
				let argCount = 0;
				if (argsStr.length > 0) {
					// Split on top-level commas
					argCount = splitParams(argsStr).length;
				}

				if (argCount !== paramCount) {
					emit(
						"W013",
						`@example in "${symbol.name}" may be stale — function signature has ${paramCount} parameter(s) but example call has ${argCount} argument(s).`,
						symbol.filePath,
						example.line,
						symbol.column,
						{
							symbolName: symbol.name,
							symbolKind: symbol.kind,
						},
					);
				}
				callMatch = funcCallRegex.exec(example.code);
			}
		}
	}

	// E019 — ts-ignore / ts-expect-error in non-test files
	// Scan each unique non-test source file that contains symbols for suppression directives.
	{
		const tsIgnoreRegex = /\/\/\s*@ts-(ignore|expect-error)/g;
		const testPathRegex = /(\.(test|spec)\.ts$|__tests__[/\\])/;
		const scannedFiles = new Set<string>();
		for (const symbol of allSymbols) {
			if (scannedFiles.has(symbol.filePath)) continue;
			scannedFiles.add(symbol.filePath);
			if (testPathRegex.test(symbol.filePath)) continue;
			try {
				const fileContent = readFileSync(symbol.filePath, "utf-8");
				const lines = fileContent.split("\n");
				for (let i = 0; i < lines.length; i++) {
					tsIgnoreRegex.lastIndex = 0;
					if (tsIgnoreRegex.test(lines[i])) {
						emit(
							"E019",
							`Non-test file "${symbol.filePath}" contains @ts-ignore at line ${i + 1}. Remove the suppression or move the code to a test file.`,
							symbol.filePath,
							i + 1,
							0,
						);
					}
				}
			} catch {
				// Skip unreadable files
			}
		}
	}

	// E005 — Missing @packageDocumentation on index.ts entry points
	// Group symbols by file to check if any index.ts file lacks @packageDocumentation.
	const indexFiles = new Map<string, ForgeSymbol[]>();
	for (const symbol of allSymbols) {
		if (symbol.filePath.endsWith("index.ts")) {
			const bucket = indexFiles.get(symbol.filePath) ?? [];
			bucket.push(symbol);
			indexFiles.set(symbol.filePath, bucket);
		}
	}
	for (const [filePath, fileSymbols] of indexFiles) {
		const hasPackageDoc = fileSymbols.some(
			(s) => s.documentation?.tags?.packageDocumentation !== undefined,
		);
		if (!hasPackageDoc) {
			emit(
				"E005",
				`Package entry point "${filePath}" is missing a @packageDocumentation TSDoc comment.`,
				filePath,
				1,
				0,
				{
					suggestedFix: `/**\n * @packageDocumentation\n * [Package overview description]\n */`,
				},
			);
		}
	}

	// E008 — Dead {@link} references
	// Build a set of all known symbol names (simple and qualified).
	const knownSymbols = new Set<string>();
	for (const s of allSymbols) {
		knownSymbols.add(s.name);
		if (s.children) {
			for (const child of s.children) {
				knownSymbols.add(`${s.name}.${child.name}`);
				knownSymbols.add(child.name);
			}
		}
	}

	// Check all {@link} references across every symbol (not just filtered ones).
	for (const symbol of allSymbols) {
		const docLinks = symbol.documentation?.links ?? [];
		for (const link of docLinks) {
			if (!knownSymbols.has(link.target)) {
				emit(
					"E008",
					`{@link ${link.target}} in "${symbol.name}" references a symbol that does not exist in this project.`,
					symbol.filePath,
					link.line,
					symbol.column,
					{
						suggestedFix: `Remove or update the {@link ${link.target}} reference to point to an existing symbol.`,
						symbolName: symbol.name,
						symbolKind: symbol.kind,
					},
				);
			}
		}
	}

	// W012 — Orphaned {@link} display text detection
	// Build a map of symbol name → summary for comparison with link display text.
	{
		const COMMON_WORDS = new Set([
			"the",
			"a",
			"an",
			"is",
			"are",
			"was",
			"were",
			"be",
			"been",
			"being",
			"have",
			"has",
			"had",
			"do",
			"does",
			"did",
			"will",
			"would",
			"could",
			"should",
			"may",
			"might",
			"shall",
			"can",
			"need",
			"must",
			"to",
			"of",
			"in",
			"for",
			"on",
			"with",
			"at",
			"by",
			"from",
			"as",
			"into",
			"through",
			"during",
			"before",
			"after",
			"above",
			"below",
			"between",
			"out",
			"off",
			"over",
			"under",
			"and",
			"but",
			"or",
			"nor",
			"not",
			"so",
			"yet",
			"both",
			"either",
			"neither",
			"each",
			"every",
			"all",
			"any",
			"few",
			"more",
			"most",
			"other",
			"some",
			"such",
			"no",
			"only",
			"own",
			"same",
			"than",
			"too",
			"very",
			"this",
			"that",
			"these",
			"those",
			"it",
			"its",
		]);

		const symbolSummaryMap = new Map<string, string>();
		for (const s of allSymbols) {
			if (s.documentation?.summary) {
				symbolSummaryMap.set(s.name, s.documentation.summary);
			}
			if (s.children) {
				for (const child of s.children) {
					if (child.documentation?.summary) {
						symbolSummaryMap.set(child.name, child.documentation.summary);
						symbolSummaryMap.set(`${s.name}.${child.name}`, child.documentation.summary);
					}
				}
			}
		}

		function extractSignificantWords(text: string): Set<string> {
			return new Set(
				text
					.toLowerCase()
					.split(/\W+/)
					.filter((w) => w.length > 0 && !COMMON_WORDS.has(w)),
			);
		}

		for (const symbol of allSymbols) {
			const docLinks = symbol.documentation?.links ?? [];
			for (const link of docLinks) {
				if (!link.text) continue;
				if (!knownSymbols.has(link.target)) continue;
				const targetSummary = symbolSummaryMap.get(link.target);
				if (!targetSummary) continue;
				const linkWords = extractSignificantWords(link.text);
				const summaryWords = extractSignificantWords(targetSummary);
				if (linkWords.size === 0 || summaryWords.size === 0) continue;
				let overlap = 0;
				for (const word of linkWords) {
					if (summaryWords.has(word)) overlap++;
				}
				if (overlap === 0) {
					emit(
						"W012",
						`{@link ${link.target} | ${link.text}} in "${symbol.name}" has display text that appears stale relative to target summary "${targetSummary}".`,
						symbol.filePath,
						link.line,
						symbol.column,
						{
							symbolName: symbol.name,
							symbolKind: symbol.kind,
						},
					);
				}
			}
		}
	}

	// W009 — {@inheritDoc} source doesn't exist
	for (const symbol of allSymbols) {
		const inheritDocTargets = symbol.documentation?.tags?.inheritDoc;
		if (inheritDocTargets && inheritDocTargets.length > 0) {
			for (const target of inheritDocTargets) {
				if (!knownSymbols.has(target)) {
					emit(
						"W009",
						`{@inheritDoc ${target}} in "${symbol.name}" references a symbol that does not exist in this project.`,
						symbol.filePath,
						symbol.line,
						symbol.column,
						{
							suggestedFix: `Remove or update the {@inheritDoc ${target}} reference to point to an existing symbol.`,
							symbolName: symbol.name,
							symbolKind: symbol.kind,
						},
					);
				}
			}
		}
	}

	// W004 — Cross-package deprecated symbol usage
	const deprecatedUsages = findDeprecatedUsages(allSymbols);
	for (const usage of deprecatedUsages) {
		emit(
			"W004",
			`Import of deprecated symbol "${usage.deprecatedSymbol}" from package "${usage.sourcePackage}": ${usage.deprecationMessage}`,
			usage.consumingFile,
			usage.line,
			0,
			{
				suggestedFix: `Replace usage of "${usage.deprecatedSymbol}" with its recommended replacement.`,
				symbolName: usage.deprecatedSymbol,
				symbolKind: "variable",
			},
		);
	}

	// E009 — tsconfig strictness regression
	const e009Bypassed = isRuleBypassed(config.rootDir, "E009");
	if (config.guards.tsconfig.enabled) {
		const tsconfigPath = join(config.rootDir, "tsconfig.json");
		try {
			const raw = readFileSync(tsconfigPath, "utf-8");
			let parsed: { compilerOptions?: Record<string, unknown> } | undefined;
			try {
				parsed = JSON.parse(raw) as { compilerOptions?: Record<string, unknown> };
			} catch (parseErr) {
				if (e009Bypassed) {
					warnings.push({
						code: "E009",
						message: `[BYPASSED] tsconfig.json: failed to parse — ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
						filePath: tsconfigPath,
						line: 1,
						column: 0,
					});
				} else {
					errors.push({
						code: "E009",
						message: `tsconfig.json: failed to parse — ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
						filePath: tsconfigPath,
						line: 1,
						column: 0,
					});
				}
			}
			if (parsed) {
				const compilerOptions = parsed.compilerOptions ?? {};
				const requiredFlags = config.guards.tsconfig.requiredFlags;
				for (const flag of requiredFlags) {
					const value = compilerOptions[flag];
					if (value !== true) {
						if (e009Bypassed) {
							warnings.push({
								code: "E009",
								message: `[BYPASSED] tsconfig.json: required flag "${flag}" is ${value === false ? "disabled" : "missing"} — expected true`,
								filePath: tsconfigPath,
								line: 1,
								column: 0,
							});
						} else {
							errors.push({
								code: "E009",
								message: `tsconfig.json: required flag "${flag}" is ${value === false ? "disabled" : "missing"} — expected true`,
								filePath: tsconfigPath,
								line: 1,
								column: 0,
							});
						}
					}
				}
			}
		} catch (readErr) {
			// tsconfig.json not found — skip E009 gracefully
			if (
				readErr instanceof Error &&
				"code" in readErr &&
				(readErr as NodeJS.ErrnoException).code === "ENOENT"
			) {
				// Intentionally ignored: missing tsconfig.json is not an E009 error
			} else {
				throw readErr;
			}
		}
	}

	// E010 — forge-ts config drift detection via lock file
	const e010Bypassed = isRuleBypassed(config.rootDir, "E010");
	const lockManifest = readLockFile(config.rootDir);
	if (lockManifest) {
		const lockViolations = validateAgainstLock(config, lockManifest);
		const lockFilePath = join(config.rootDir, ".forge-lock.json");
		for (const violation of lockViolations) {
			if (e010Bypassed) {
				warnings.push({
					code: "E010",
					message: `[BYPASSED] Config drift: ${violation.message}`,
					filePath: lockFilePath,
					line: 1,
					column: 0,
				});
			} else {
				errors.push({
					code: "E010",
					message: `Config drift: ${violation.message}`,
					filePath: lockFilePath,
					line: 1,
					column: 0,
				});
			}
		}
	}

	// E011 — Biome config weakening detection
	const e011Bypassed = isRuleBypassed(config.rootDir, "E011");
	if (config.guards.biome.enabled && lockManifest?.config.biome) {
		const biomePath = join(config.rootDir, "biome.json");
		const biomePathC = join(config.rootDir, "biome.jsonc");
		const actualBiomePath = existsSync(biomePath)
			? biomePath
			: existsSync(biomePathC)
				? biomePathC
				: null;
		if (actualBiomePath) {
			try {
				const biomeRaw = readFileSync(actualBiomePath, "utf-8");
				let biomeParsed: Record<string, unknown>;
				try {
					biomeParsed = JSON.parse(biomeRaw) as Record<string, unknown>;
				} catch {
					// Biome file exists but is invalid JSON/JSONC — emit one E011
					const diag = {
						code: "E011",
						message: `Biome config "${actualBiomePath}": failed to parse — file may contain invalid JSON.`,
						filePath: actualBiomePath,
						line: 1,
						column: 0,
					};
					if (e011Bypassed) {
						warnings.push({ ...diag, message: `[BYPASSED] ${diag.message}` });
					} else {
						errors.push(diag);
					}
					biomeParsed = undefined as unknown as Record<string, unknown>;
				}
				if (biomeParsed) {
					// Extract current biome rules from linter.rules
					const currentBiomeRules = extractBiomeRules(biomeParsed);
					// Compare against locked biome rules snapshot
					const lockedBiomeRules =
						(lockManifest.config.biome as { rules?: Record<string, string> }).rules ?? {};
					for (const [ruleName, lockedLevel] of Object.entries(lockedBiomeRules)) {
						const currentLevel = currentBiomeRules[ruleName] ?? "off";
						if (isWeakerBiomeLevel(currentLevel, lockedLevel)) {
							const diag = {
								code: "E011",
								message: `Biome rule "${ruleName}" was weakened from "${lockedLevel}" to "${currentLevel}".`,
								filePath: actualBiomePath,
								line: 1,
								column: 0,
							};
							if (e011Bypassed) {
								warnings.push({ ...diag, message: `[BYPASSED] ${diag.message}` });
							} else {
								errors.push(diag);
							}
						}
					}
				}
			} catch (readErr) {
				// biome.json not found after existsSync — skip
				if (
					readErr instanceof Error &&
					"code" in readErr &&
					(readErr as NodeJS.ErrnoException).code === "ENOENT"
				) {
					// Intentionally ignored
				} else {
					throw readErr;
				}
			}
		}
	}

	// E012 — package.json engine field tampering
	const e012Bypassed = isRuleBypassed(config.rootDir, "E012");
	if (config.guards.packageJson.enabled) {
		const pkgJsonPath = join(config.rootDir, "package.json");
		try {
			const pkgRaw = readFileSync(pkgJsonPath, "utf-8");
			const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;

			// Check required fields
			for (const field of config.guards.packageJson.requiredFields) {
				if (pkg[field] === undefined) {
					const diag = {
						code: "E012",
						message: `package.json: required field "${field}" is missing.`,
						filePath: pkgJsonPath,
						line: 1,
						column: 0,
					};
					if (e012Bypassed) {
						warnings.push({ ...diag, message: `[BYPASSED] ${diag.message}` });
					} else {
						errors.push(diag);
					}
				}
			}

			// Check engines.node against minNodeVersion
			const engines = pkg.engines as Record<string, string> | undefined;
			const nodeEngine = engines?.node;
			if (!nodeEngine) {
				// Only emit if "engines" is in requiredFields (missing engines already caught above)
				// But also check specifically for missing engines.node
				if (engines !== undefined) {
					const diag = {
						code: "E012",
						message: `package.json: "engines.node" field is missing.`,
						filePath: pkgJsonPath,
						line: 1,
						column: 0,
					};
					if (e012Bypassed) {
						warnings.push({ ...diag, message: `[BYPASSED] ${diag.message}` });
					} else {
						errors.push(diag);
					}
				}
			} else {
				// Simple semver comparison: extract major.minor from the engines string
				const minVersion = parseSemverMajorMinor(config.guards.packageJson.minNodeVersion);
				const engineVersion = parseSemverMajorMinor(nodeEngine);
				if (minVersion && engineVersion && compareMajorMinor(engineVersion, minVersion) < 0) {
					const diag = {
						code: "E012",
						message: `package.json: "engines.node" specifies "${nodeEngine}" which is lower than the minimum required "${config.guards.packageJson.minNodeVersion}".`,
						filePath: pkgJsonPath,
						line: 1,
						column: 0,
					};
					if (e012Bypassed) {
						warnings.push({ ...diag, message: `[BYPASSED] ${diag.message}` });
					} else {
						errors.push(diag);
					}
				}
			}
		} catch (readErr) {
			// package.json not found — skip
			if (
				readErr instanceof Error &&
				"code" in readErr &&
				(readErr as NodeJS.ErrnoException).code === "ENOENT"
			) {
				// Intentionally ignored
			} else if (readErr instanceof SyntaxError) {
				// Invalid JSON — skip gracefully
			} else {
				throw readErr;
			}
		}
	}

	// W007 — Stale guide FORGE:AUTO sections (references to removed/renamed symbols)
	// W008 — Undocumented public symbol in guides (exported but not mentioned)
	const guidesDir = join(config.outDir, "guides");
	let guideFiles: string[] = [];
	let guideContents: Map<string, string> | undefined;

	// Only attempt guide checks if the guides directory exists
	if (existsSync(guidesDir)) {
		try {
			const entries = readdirSync(guidesDir);
			guideFiles = entries.filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
		} catch {
			// If we cannot read the directory, skip guide rules
		}
	}

	if (guideFiles.length > 0) {
		guideContents = new Map<string, string>();
		for (const file of guideFiles) {
			try {
				const content = readFileSync(join(guidesDir, file), "utf-8");
				guideContents.set(file, content);
			} catch {
				// Skip unreadable files
			}
		}

		// W007 — Check FORGE:AUTO sections for references to symbols that no longer exist
		const autoStartRe = /<!--\s*FORGE:AUTO-START\s+(\S+)\s*-->/g;
		const autoEndRe = /<!--\s*FORGE:AUTO-END\s+(\S+)\s*-->/;
		// Match symbol references inside auto sections: `symbolName` in backticks or bare names
		// after typical markdown patterns (links, bold, code).
		// Simplified heuristic: extract all backtick-quoted identifiers inside FORGE:AUTO blocks.
		const symbolRefRe = /`([A-Za-z_$][A-Za-z0-9_$]*)`/g;

		for (const [file, content] of guideContents) {
			const filePath = join(guidesDir, file);
			// Find each FORGE:AUTO block
			autoStartRe.lastIndex = 0;
			for (
				let match = autoStartRe.exec(content);
				match !== null;
				match = autoStartRe.exec(content)
			) {
				const startIdx = match.index + match[0].length;
				// Find the matching end marker
				const restContent = content.slice(startIdx);
				const endMatch = autoEndRe.exec(restContent);
				if (!endMatch) continue;
				const autoBlock = restContent.slice(0, endMatch.index);

				// Extract all backtick-quoted identifiers from the auto block
				symbolRefRe.lastIndex = 0;
				for (
					let refMatch = symbolRefRe.exec(autoBlock);
					refMatch !== null;
					refMatch = symbolRefRe.exec(autoBlock)
				) {
					const refName = refMatch[1];
					// Check if this name exists in the known symbols set
					if (!knownSymbols.has(refName)) {
						emit(
							"W007",
							`Guide "${file}" FORGE:AUTO section references symbol "${refName}" which no longer exists in the symbol graph.`,
							filePath,
							1,
							0,
							{
								symbolName: refName,
							},
						);
					}
				}
			}
		}

		// W008 — Check that all exported symbols from index.ts are mentioned in at least one guide
		const allGuideText = [...guideContents.values()].join("\n");
		const indexExportedSymbols = allSymbols.filter(
			(s) => s.exported && /[/\\]index\.ts$/.test(s.filePath),
		);
		for (const sym of indexExportedSymbols) {
			if (!allGuideText.includes(sym.name)) {
				emit(
					"W008",
					`Exported symbol "${sym.name}" from "${sym.filePath}" is not mentioned in any guide page.`,
					sym.filePath,
					sym.line,
					sym.column,
					{
						symbolName: sym.name,
						symbolKind: sym.kind,
					},
				);
			}
		}
	}

	const success = errors.length === 0;
	return { success, symbols: allSymbols, errors, warnings, duration: Date.now() - start };
}
