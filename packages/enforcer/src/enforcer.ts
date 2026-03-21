import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * Extracts generic type parameter names from a symbol's signature.
 * Handles patterns like `<T>`, `<T, U>`, `<T extends Record<string, unknown>>`, etc.
 * Respects nested angle brackets so constraints are not prematurely closed.
 * @internal
 */
function extractGenericTypeParams(signature: string | undefined): string[] {
	if (!signature || !signature.startsWith("<")) return [];
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

	const success = errors.length === 0;
	return { success, symbols: allSymbols, errors, warnings, duration: Date.now() - start };
}
