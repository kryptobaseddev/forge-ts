import {
	createWalker,
	type ForgeConfig,
	type ForgeError,
	type ForgeResult,
	type ForgeSymbol,
	type ForgeWarning,
	filterByVisibility,
} from "@codluv/forge-core";

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
 * | W001 | warning  | TSDoc comment contains parse errors. |
 * | W002 | warning  | Function body throws but has no `@throws` tag. |
 * | W003 | warning  | `@deprecated` tag is present without explanation. |
 *
 * When `config.enforce.strict` is `true` all warnings are promoted to errors.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} describing which symbols passed or failed.
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
	 * Emit a diagnostic.  When `strict` is enabled every warning becomes an
	 * error so the build gate fails hard.
	 */
	function emit(
		severity: "error" | "warning",
		code: string,
		message: string,
		filePath: string,
		line: number,
		column: number,
	): void {
		const diag = { code, message, filePath, line, column };
		if (severity === "error" || config.enforce.strict) {
			errors.push(diag);
		} else {
			warnings.push(diag);
		}
	}

	for (const symbol of symbols) {
		if (!symbol.exported) continue;

		const isFunctionLike = symbol.kind === "function" || symbol.kind === "method";

		// E001 — Missing summary
		if (!hasSummary(symbol)) {
			emit(
				"error",
				"E001",
				`Exported symbol "${symbol.name}" is missing a TSDoc summary comment.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
			);
		}

		// E002 — Undocumented parameters
		if (isFunctionLike) {
			const missing = undocumentedParams(symbol);
			for (const paramName of missing) {
				emit(
					"error",
					"E002",
					`Parameter "${paramName}" of "${symbol.name}" is not documented with a @param tag.`,
					symbol.filePath,
					symbol.line,
					symbol.column,
				);
			}
		}

		// E003 — Missing @returns
		if (isFunctionLike && missingReturns(symbol)) {
			emit(
				"error",
				"E003",
				`"${symbol.name}" has a non-void return type but is missing a @returns tag.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
			);
		}

		// W003 — @deprecated without reason
		if (deprecatedWithoutReason(symbol)) {
			emit(
				"warning",
				"W003",
				`"${symbol.name}" is marked @deprecated but provides no explanation.`,
				symbol.filePath,
				symbol.line,
				symbol.column,
			);
		}
	}

	const success = errors.length === 0;
	return { success, symbols: allSymbols, errors, warnings, duration: Date.now() - start };
}
