import {
	createWalker,
	type EnforceRules,
	type ForgeConfig,
	type ForgeError,
	type ForgeResult,
	type ForgeSymbol,
	type ForgeWarning,
	filterByVisibility,
} from "@forge-ts/core";

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
	if (!parenMatch || !parenMatch[1].trim()) return [];

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
 *
 * When `config.enforce.strict` is `true` all warnings are promoted to errors.
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
 * @public
 */
export async function enforce(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();
	const errors: ForgeError[] = [];
	const warnings: ForgeWarning[] = [];

	const walker = createWalker(config);
	const allSymbols = walker.walk();
	const symbols = filterByVisibility(allSymbols, config.enforce.minVisibility);

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

	const success = errors.length === 0;
	return { success, symbols: allSymbols, errors, warnings, duration: Date.now() - start };
}
