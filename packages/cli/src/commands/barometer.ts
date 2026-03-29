/**
 * `forge-ts barometer` command — documentation effectiveness test generator.
 *
 * Analyzes the project's source code to generate a set of questions (with
 * answers and a scoring rubric) that can only be answered correctly if the
 * generated documentation faithfully reflects the codebase.
 *
 * @remarks
 * The barometer uses the same AST walker that powers `forge-ts check` to
 * extract "testable facts" from five categories: signature facts, \@remarks
 * facts, config default facts, package architecture facts, and enforcement
 * rule facts. Questions are generated from the code itself (not from
 * documentation), so the answer key is always grounded in the single source
 * of truth.
 *
 * Output is written to `.forge/barometer.json` and optionally summarized to
 * stdout in human-readable form.
 *
 * **Anti-cheating workflow for testing agents:**
 * 1. Evaluator runs `forge-ts barometer` → gets `.forge/barometer.json` with
 *    full answers (gitignored, never committed)
 * 2. Test agent receives `forge-ts barometer --questions-only --json` → gets
 *    questions with answers redacted to `"(redacted)"`
 * 3. Test agent answers questions using ONLY the generated docs (`docs/generated/`)
 * 4. Evaluator scores the agent's responses against the private answer key
 *
 * The `.forge/barometer.json` file is gitignored by default so answer keys
 * never leak into the repository.
 *
 * @packageDocumentation
 * @internal
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createWalker, type ForgeConfig, type ForgeSymbol, loadConfig } from "@forge-ts/core";
import { defineCommand } from "citty";
import { configureLogger, forgeLogger } from "../forge-logger.js";
import { type CommandOutput, emitResult, type OutputFlags, resolveExitCode } from "../output.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Source provenance for a barometer question.
 *
 * @public
 */
export interface BarometerSource {
	/** Symbol name the fact was extracted from. */
	symbol: string;
	/** Relative file path where the symbol is declared. */
	file: string;
	/** Which field on the symbol yielded the fact (e.g. "signature", "remarks"). */
	field: string;
}

/**
 * A single barometer question with its ground-truth answer.
 *
 * @public
 */
export interface BarometerQuestion {
	/** Unique question identifier (e.g. "Q001"). */
	id: string;
	/** Fact extraction category. */
	category: "signature" | "remarks" | "config" | "architecture" | "rules";
	/** Difficulty rating. */
	difficulty: "easy" | "medium" | "hard";
	/** The question text. */
	question: string;
	/** Ground-truth answer derived from source code. */
	answer: string;
	/** Provenance information linking back to the source. */
	source: BarometerSource;
}

/**
 * A single rating band in the barometer scoring rubric.
 *
 * @public
 */
export interface BarometerRatingBand {
	/** Minimum score (inclusive) for this band. */
	min: number;
	/** Maximum score (inclusive) for this band. */
	max: number;
	/** Short label for this band. */
	rating: string;
	/** Description of what this band means. */
	description: string;
}

/**
 * Agent instructions included in `--questions-only` output.
 *
 * @since 0.22.0
 * @public
 */
export interface BarometerInstructions {
	/** Task description for the agent. */
	task: string;
	/** Path to generated documentation the agent should use. */
	docsPath: string;
	/** Expected response format. */
	responseFormat: {
		/** Description of the expected format. */
		description: string;
		/** Example response structure. */
		example: { answers: Array<{ id: string; answer: string }> };
	};
}

/**
 * Full barometer output written to `.forge/barometer.json`.
 *
 * @public
 */
export interface BarometerResult {
	/** JSON schema URL. */
	$schema: string;
	/** Barometer format version. */
	version: string;
	/** Project name from package.json or config. */
	project: string;
	/** ISO 8601 timestamp of when the barometer was generated. */
	generated: string;
	/** Total number of exported symbols analyzed. */
	symbolCount: number;
	/** Generated questions with ground-truth answers. */
	questions: BarometerQuestion[];
	/** Scoring rubric for evaluating documentation effectiveness. */
	rubric: {
		/** Rating scale bands from best to worst. */
		scale: BarometerRatingBand[];
		/** Description of how scoring works. */
		scoring: string;
	};
	/** Agent instructions — present only in `--questions-only` output. */
	instructions?: BarometerInstructions;
}

/**
 * A single scored answer in the barometer score output.
 *
 * @since 0.22.0
 * @public
 */
export interface BarometerScoredAnswer {
	/** Question ID. */
	id: string;
	/** Expected answer from the answer key. */
	expected: string;
	/** Agent's submitted answer. */
	got: string;
	/** Scoring verdict. */
	verdict: "correct" | "partial" | "wrong";
	/** Question category for aggregate analysis. */
	category: string;
}

/**
 * Full barometer score output.
 *
 * @since 0.22.0
 * @public
 */
export interface BarometerScoreResult {
	/** Score as a percentage (0-100). */
	score: number;
	/** Rating band label (e.g. "Elite SSoT"). */
	rating: string;
	/** Rating band description. */
	ratingDescription: string;
	/** Number of fully correct answers. */
	correct: number;
	/** Number of partially correct answers. */
	partial: number;
	/** Number of wrong answers. */
	wrong: number;
	/** Total questions scored. */
	total: number;
	/** Details for every non-correct answer. */
	missed: BarometerScoredAnswer[];
}

/**
 * Arguments for the `barometer` command.
 *
 * @internal
 */
export interface BarometerArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Output only questions (no answers) for test agents. */
	questionsOnly?: boolean;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * An intermediate fact extracted from the symbol graph before question
 * generation assigns IDs.
 *
 * @internal
 */
interface BarometerFact {
	category: BarometerQuestion["category"];
	difficulty: BarometerQuestion["difficulty"];
	question: string;
	answer: string;
	source: BarometerSource;
}

// ---------------------------------------------------------------------------
// Rule definitions (duplicated here to avoid importing enforcer internals)
// ---------------------------------------------------------------------------

/**
 * Maps rule codes to their human-readable names and descriptions.
 *
 * @remarks
 * This is a local copy to avoid importing from \@forge-ts/enforcer internals.
 * Only the most commonly referenced rules are included for question generation.
 *
 * @internal
 */
const RULE_DEFINITIONS: Record<
	string,
	{ name: string; description: string; defaultSeverity: string }
> = {
	E001: {
		name: "require-summary",
		description: "Exported symbol missing TSDoc summary",
		defaultSeverity: "error",
	},
	E002: {
		name: "require-param",
		description: "Function parameter missing @param tag",
		defaultSeverity: "error",
	},
	E003: {
		name: "require-returns",
		description: "Non-void function missing @returns tag",
		defaultSeverity: "error",
	},
	E004: {
		name: "require-example",
		description: "Exported function missing @example block",
		defaultSeverity: "error",
	},
	E005: {
		name: "require-package-doc",
		description: "Entry point missing @packageDocumentation",
		defaultSeverity: "warn",
	},
	E006: {
		name: "require-class-member-doc",
		description: "Class member missing documentation",
		defaultSeverity: "error",
	},
	E007: {
		name: "require-interface-member-doc",
		description: "Interface/type member missing documentation",
		defaultSeverity: "error",
	},
	E013: {
		name: "require-remarks",
		description: "Exported function/class missing @remarks block",
		defaultSeverity: "error",
	},
	E014: {
		name: "require-default-value",
		description: "Optional property missing @defaultValue",
		defaultSeverity: "warn",
	},
	E015: {
		name: "require-type-param",
		description: "Generic symbol missing @typeParam",
		defaultSeverity: "error",
	},
	E016: {
		name: "require-release-tag",
		description: "Exported symbol missing release tag (@public, @beta, @internal)",
		defaultSeverity: "error",
	},
	E017: {
		name: "require-internal-boundary",
		description: "@internal symbol re-exported through public barrel",
		defaultSeverity: "error",
	},
	E018: {
		name: "require-route-response",
		description: "@route-tagged function missing @response tag",
		defaultSeverity: "warn",
	},
	E019: {
		name: "require-no-ts-ignore",
		description: "Non-test file contains ts-ignore or ts-expect-error",
		defaultSeverity: "error",
	},
	E020: {
		name: "require-no-any-in-api",
		description: "Exported symbol has any in public API signature",
		defaultSeverity: "warn",
	},
	W005: {
		name: "require-see",
		description: "Symbol uses @link but has no @see tags",
		defaultSeverity: "warn",
	},
	W006: {
		name: "require-tsdoc-syntax",
		description: "TSDoc syntax parse error",
		defaultSeverity: "warn",
	},
	W007: {
		name: "require-fresh-guides",
		description: "Guide FORGE:AUTO section references stale symbol",
		defaultSeverity: "warn",
	},
	W008: {
		name: "require-guide-coverage",
		description: "Public symbol not mentioned in any guide",
		defaultSeverity: "warn",
	},
	W009: {
		name: "require-inheritdoc-source",
		description: "@inheritDoc references non-existent symbol",
		defaultSeverity: "warn",
	},
	W010: {
		name: "require-migration-path",
		description: "@breaking without @migration path",
		defaultSeverity: "warn",
	},
	W011: {
		name: "require-since",
		description: "New public export missing @since version tag",
		defaultSeverity: "warn",
	},
	W012: {
		name: "require-fresh-link-text",
		description: "@link display text appears stale",
		defaultSeverity: "warn",
	},
	W013: {
		name: "require-fresh-examples",
		description: "@example block may be stale (arg count mismatch)",
		defaultSeverity: "warn",
	},
	W014: {
		name: "require-fresh-params",
		description: "@param name in TSDoc doesn't match actual parameter name",
		defaultSeverity: "warn",
	},
	W015: {
		name: "require-param-count",
		description: "@param count in TSDoc doesn't match actual parameter count",
		defaultSeverity: "warn",
	},
	W016: {
		name: "require-fresh-returns",
		description: "@returns tag on a void/Promise<void> function",
		defaultSeverity: "warn",
	},
	W017: {
		name: "require-meaningful-remarks",
		description: "@remarks block is empty or contains only placeholder text",
		defaultSeverity: "warn",
	},
	W018: {
		name: "require-operation-completeness",
		description:
			"@operation-tagged function missing required CKM documentation (@param, @returns, @remarks, @example)",
		defaultSeverity: "warn",
	},
	W019: {
		name: "require-ckm-tag-content",
		description:
			"CKM tag (@operation, @constraint, @workflow, @concept) has empty or insufficient content",
		defaultSeverity: "warn",
	},
	W020: {
		name: "require-constraint-throws",
		description: "@constraint-tagged symbol missing @throws to document constraint violation error",
		defaultSeverity: "warn",
	},
};

// ---------------------------------------------------------------------------
// Fact extraction helpers
// ---------------------------------------------------------------------------

/**
 * Parses parameter names from a function signature string.
 *
 * Handles nested generics so that `Record<string, string[]>` is treated as a
 * single parameter type rather than being split on the inner comma.
 *
 * @param signature - The function signature string (e.g. "(a: string, b: number) => void").
 * @returns Array of parameter name strings.
 * @internal
 */
function parseParamNames(signature: string): string[] {
	const parenMatch = /^\(([^)]*)\)/.exec(signature);
	if (!parenMatch?.[1]?.trim()) return [];

	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of parenMatch[1]) {
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
	if (current.trim()) parts.push(current);

	return parts
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
}

/**
 * Extracts testable facts from the symbol graph and project config.
 *
 * Generates facts across five categories:
 * - **Signature**: Return types, parameter counts, parameter types
 * - **Remarks**: Strategies, time references, and specific claims
 * - **Config**: Default values from the ForgeConfig type
 * - **Architecture**: Package count, package descriptions
 * - **Rules**: Rule descriptions and default severities
 *
 * @param symbols - All symbols extracted by the walker.
 * @param config - The resolved forge config.
 * @param rootDir - The project root for relativizing file paths.
 * @returns Array of extracted facts ready for question generation.
 * @internal
 */
function extractFacts(
	symbols: ForgeSymbol[],
	config: ForgeConfig,
	rootDir: string,
): BarometerFact[] {
	const facts: BarometerFact[] = [];

	// Helper to make file paths relative
	const rel = (filePath: string): string => relative(rootDir, filePath);

	// -----------------------------------------------------------------------
	// A. Signature facts
	// -----------------------------------------------------------------------
	const exportedFunctions = symbols.filter(
		(s) => s.exported && (s.kind === "function" || s.kind === "method") && s.signature,
	);

	for (const sym of exportedFunctions) {
		const sig = sym.signature;
		if (!sig) continue;

		// Return type question
		const arrowIdx = sig.lastIndexOf("=>");
		if (arrowIdx !== -1) {
			const returnType = sig.slice(arrowIdx + 2).trim();
			if (returnType && returnType !== "void") {
				facts.push({
					category: "signature",
					difficulty: "easy",
					question: `What type does the ${sym.name}() function return?`,
					answer: returnType,
					source: { symbol: sym.name, file: rel(sym.filePath), field: "signature" },
				});
			}
		}

		// Param count question
		const params = parseParamNames(sig);
		if (params.length > 0) {
			facts.push({
				category: "signature",
				difficulty: "easy",
				question: `How many parameters does ${sym.name}() accept?`,
				answer: String(params.length),
				source: { symbol: sym.name, file: rel(sym.filePath), field: "signature" },
			});
		}

		// Individual param type question (first param only, to avoid flooding)
		if (params.length > 0) {
			const firstParamRaw = sig.match(/^\(([^,)]+)/)?.[1]?.trim();
			if (firstParamRaw) {
				const colonIdx = firstParamRaw.indexOf(":");
				if (colonIdx !== -1) {
					const paramName = firstParamRaw
						.slice(0, colonIdx)
						.trim()
						.replace(/^\.{3}/, "")
						.replace(/\?$/, "");
					const paramType = firstParamRaw.slice(colonIdx + 1).trim();
					if (paramName && paramType) {
						facts.push({
							category: "signature",
							difficulty: "easy",
							question: `What is the type of the '${paramName}' parameter in ${sym.name}()?`,
							answer: paramType,
							source: { symbol: sym.name, file: rel(sym.filePath), field: "signature" },
						});
					}
				}
			}
		}
	}

	// -----------------------------------------------------------------------
	// B. @remarks facts
	// -----------------------------------------------------------------------
	for (const sym of symbols) {
		if (!sym.exported || sym.kind === "file") continue;
		if (!sym.documentation?.remarks) continue;

		const remarks = sym.documentation.remarks;

		// Time/timezone patterns
		const timeMatch = /(\d{1,2}:\d{2}\s*UTC|\bmidnight\s*UTC\b)/i.exec(remarks);
		if (timeMatch) {
			facts.push({
				category: "remarks",
				difficulty: "hard",
				question: `At what time does the ${sym.name} operation reset or trigger?`,
				answer: timeMatch[1],
				source: { symbol: sym.name, file: rel(sym.filePath), field: "remarks" },
			});
		}

		// Strategy/approach patterns
		const strategyMatch = /(?:uses?|applies?|employs?)\s+(.{10,80}?)(?:\.|$)/i.exec(remarks);
		if (strategyMatch) {
			facts.push({
				category: "remarks",
				difficulty: "medium",
				question: `What strategy or approach does ${sym.name} use?`,
				answer: strategyMatch[1].trim(),
				source: { symbol: sym.name, file: rel(sym.filePath), field: "remarks" },
			});
		}

		// Specific numeric claims (e.g. "max 20 files", "9 rules")
		const numericMatch = /(?:max(?:imum)?|up to|at most|bounded to)\s+(\d+)\s+(\w+)/i.exec(remarks);
		if (numericMatch) {
			facts.push({
				category: "remarks",
				difficulty: "hard",
				question: `What is the maximum number of ${numericMatch[2]} for ${sym.name}?`,
				answer: numericMatch[1],
				source: { symbol: sym.name, file: rel(sym.filePath), field: "remarks" },
			});
		}
	}

	// -----------------------------------------------------------------------
	// C. Config default facts
	// -----------------------------------------------------------------------

	facts.push({
		category: "config",
		difficulty: "medium",
		question: "What is the default value of the bypass dailyBudget config option?",
		answer: String(config.bypass.dailyBudget),
		source: {
			symbol: "ForgeConfig",
			file: "packages/core/src/types.ts",
			field: "bypass.dailyBudget",
		},
	});

	facts.push({
		category: "config",
		difficulty: "medium",
		question: "What is the default bypass duration in hours before automatic expiry?",
		answer: String(config.bypass.durationHours),
		source: {
			symbol: "ForgeConfig",
			file: "packages/core/src/types.ts",
			field: "bypass.durationHours",
		},
	});

	facts.push({
		category: "config",
		difficulty: "easy",
		question: "What is the default minimum Node.js version required by the packageJson guard?",
		answer: config.guards.packageJson.minNodeVersion,
		source: {
			symbol: "ForgeConfig",
			file: "packages/core/src/types.ts",
			field: "guards.packageJson.minNodeVersion",
		},
	});

	// -----------------------------------------------------------------------
	// D. Package architecture facts
	// -----------------------------------------------------------------------

	const packages = new Set(
		symbols
			.filter((s) => s.kind === "file" && s.filePath.includes("packages/"))
			.map((s) => {
				const match = /packages\/([^/]+)\//.exec(s.filePath);
				return match?.[1];
			})
			.filter((p): p is string => p !== undefined),
	);

	if (packages.size > 0) {
		facts.push({
			category: "architecture",
			difficulty: "easy",
			question: "How many packages are in this project?",
			answer: String(packages.size),
			source: { symbol: "project", file: "package.json", field: "packages" },
		});

		facts.push({
			category: "architecture",
			difficulty: "easy",
			question: "What packages does this project contain?",
			answer: Array.from(packages).sort().join(", "),
			source: { symbol: "project", file: "package.json", field: "packages" },
		});
	}

	// Count exported symbols
	const exportedCount = symbols.filter((s) => s.exported && s.kind !== "file").length;
	facts.push({
		category: "architecture",
		difficulty: "easy",
		question: "How many exported symbols does this project have?",
		answer: String(exportedCount),
		source: { symbol: "project", file: "all source files", field: "exported" },
	});

	// @packageDocumentation facts
	const packageDocSymbols = symbols.filter((s) => s.kind === "file" && s.documentation?.summary);
	for (const sym of packageDocSymbols) {
		const pkgMatch = /packages\/([^/]+)\//.exec(sym.filePath);
		if (pkgMatch) {
			const summary = sym.documentation?.summary;
			if (summary && summary.trim().length > 10) {
				facts.push({
					category: "architecture",
					difficulty: "medium",
					question: `What does the ${pkgMatch[1]} package do?`,
					answer: summary.trim(),
					source: { symbol: sym.name, file: rel(sym.filePath), field: "packageDocumentation" },
				});
			}
		}
	}

	// -----------------------------------------------------------------------
	// E. Rule facts
	// -----------------------------------------------------------------------

	// Pick a selection of rules for question generation
	const ruleEntries = Object.entries(RULE_DEFINITIONS);
	for (const [code, rule] of ruleEntries) {
		facts.push({
			category: "rules",
			difficulty: "medium",
			question: `What does rule ${code} (${rule.name}) check for?`,
			answer: rule.description,
			source: {
				symbol: code,
				file: "packages/enforcer/src/enforcer.ts",
				field: "rule-description",
			},
		});

		facts.push({
			category: "rules",
			difficulty: "medium",
			question: `What is the default severity of rule ${code} (${rule.name})?`,
			answer: rule.defaultSeverity,
			source: { symbol: code, file: "packages/core/src/config.ts", field: "rule-severity" },
		});
	}

	return facts;
}

/**
 * Deduplicates facts so no two questions have the same question text.
 *
 * @param facts - Raw extracted facts, possibly with duplicates.
 * @returns Deduplicated facts.
 * @internal
 */
function deduplicateFacts(facts: BarometerFact[]): BarometerFact[] {
	const seen = new Set<string>();
	const result: BarometerFact[] = [];
	for (const fact of facts) {
		if (!seen.has(fact.question)) {
			seen.add(fact.question);
			result.push(fact);
		}
	}
	return result;
}

/**
 * Converts extracted facts into numbered barometer questions.
 *
 * @param facts - Deduplicated extracted facts.
 * @returns Numbered barometer questions.
 * @internal
 */
function factsToQuestions(facts: BarometerFact[]): BarometerQuestion[] {
	return facts.map((fact, idx) => ({
		id: `Q${String(idx + 1).padStart(3, "0")}`,
		category: fact.category,
		difficulty: fact.difficulty,
		question: fact.question,
		answer: fact.answer,
		source: fact.source,
	}));
}

/**
 * Builds the static scoring rubric for the barometer.
 *
 * @returns The rubric definition with rating bands and scoring rules.
 * @internal
 */
function buildRubric(): BarometerResult["rubric"] {
	return {
		scale: [
			{
				min: 90,
				max: 100,
				rating: "Elite SSoT",
				description:
					"Documentation is a perfect reflection of the codebase. Agents can operate with zero source code access.",
			},
			{
				min: 70,
				max: 89,
				rating: "High Fidelity",
				description:
					"Documentation is excellent but might miss implementation details found in @remarks.",
			},
			{
				min: 50,
				max: 69,
				rating: "Standard",
				description: "Useful for API usage, but internal architecture requires source code access.",
			},
			{
				min: 0,
				max: 49,
				rating: "Stale/Shallow",
				description:
					"Documentation is too high-level. Needs deeper @remarks and @example coverage.",
			},
		],
		scoring:
			"Each correct answer scores points equal to 100/totalQuestions. Partial credit: 50% for correct concept but wrong specific value.",
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the barometer generation pass.
 *
 * Loads the project config, walks the symbol graph, extracts testable facts
 * from five categories, generates questions with ground-truth answers, and
 * writes the result to `.forge/barometer.json`.
 *
 * @remarks
 * The barometer uses the same {@link createWalker} that powers `forge-ts check`
 * to ensure complete parity between the symbols analyzed and those enforced.
 * Facts are extracted from: function signatures, \@remarks blocks, config
 * default values, package architecture metadata, and enforcer rule definitions.
 *
 * @param args - CLI arguments for the barometer command.
 * @returns A typed `CommandOutput<BarometerResult>`.
 * @example
 * ```typescript
 * import { runBarometer } from "@forge-ts/cli/commands/barometer";
 * const output = await runBarometer({ cwd: process.cwd() });
 * console.log(`Generated ${output.data.questions.length} questions`);
 * ```
 * @public
 */
export async function runBarometer(args: BarometerArgs): Promise<CommandOutput<BarometerResult>> {
	const start = Date.now();
	const rootDir = args.cwd ?? process.cwd();

	// Step 1: Load config
	const config = await loadConfig(rootDir);

	// Step 2: Walk the symbol graph
	const walker = createWalker(config);
	const allSymbols = walker.walk();

	// Step 3: Extract testable facts
	const rawFacts = extractFacts(allSymbols, config, rootDir);
	const facts = deduplicateFacts(rawFacts);

	// Step 4: Generate questions
	const questions = factsToQuestions(facts);

	// Step 5: Strip answers if --questions-only
	const outputQuestions = args.questionsOnly
		? questions.map((q) => ({ ...q, answer: "(redacted)" }))
		: questions;

	// Count exported symbols (non-file)
	const symbolCount = allSymbols.filter((s) => s.exported && s.kind !== "file").length;

	// Step 6: Build the result
	const projectName = config.project?.packageName ?? "forge-ts";
	const result: BarometerResult = {
		$schema: "https://forge-ts.dev/schemas/v1/barometer.schema.json",
		version: "1.0.0",
		project: projectName,
		generated: new Date().toISOString(),
		symbolCount,
		questions: outputQuestions,
		rubric: buildRubric(),
	};

	// Add agent instructions when questions-only mode
	if (args.questionsOnly) {
		result.instructions = {
			task: "Answer each question using ONLY the documentation files in the docsPath below. Do NOT read source code.",
			docsPath: "docs/generated/",
			responseFormat: {
				description:
					"Return a JSON object with an 'answers' array containing your answers keyed by question ID.",
				example: { answers: [{ id: "Q001", answer: "your answer" }] },
			},
		};
	}

	// Step 7: Write to .forge/barometer.json (always full answers — the answer key)
	const forgeDirPath = join(rootDir, ".forge");
	if (!existsSync(forgeDirPath)) {
		await mkdir(forgeDirPath, { recursive: true });
	}
	const outputPath = join(forgeDirPath, "barometer.json");
	// When --questions-only, still write the FULL answer key to disk
	const fileResult: BarometerResult = args.questionsOnly
		? { ...result, questions, instructions: undefined }
		: result;
	await writeFile(outputPath, `${JSON.stringify(fileResult, null, 2)}\n`, "utf8");

	const duration = Date.now() - start;

	return {
		operation: "barometer",
		success: true,
		data: result,
		duration,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats a BarometerResult as human-readable text.
 *
 * @param result - The barometer result to format.
 * @param questionsOnly - If true, answers are hidden in the output.
 * @returns A human-readable string summary.
 * @internal
 */
function formatBarometerHuman(result: BarometerResult, questionsOnly: boolean): string {
	const lines: string[] = [];

	lines.push(`\nforge-ts barometer: documentation effectiveness test\n`);
	lines.push(`  Project:     ${result.project}`);
	lines.push(`  Symbols:     ${result.symbolCount}`);
	lines.push(`  Questions:   ${result.questions.length}`);
	lines.push(`  Generated:   ${result.generated}`);

	// Category breakdown
	const categories = new Map<string, number>();
	const difficulties = new Map<string, number>();
	for (const q of result.questions) {
		categories.set(q.category, (categories.get(q.category) ?? 0) + 1);
		difficulties.set(q.difficulty, (difficulties.get(q.difficulty) ?? 0) + 1);
	}

	lines.push("");
	lines.push("  Categories:");
	for (const [cat, count] of Array.from(categories.entries()).sort((a, b) => b[1] - a[1])) {
		lines.push(`    ${cat}: ${count} question${count !== 1 ? "s" : ""}`);
	}

	lines.push("");
	lines.push("  Difficulty:");
	for (const level of ["easy", "medium", "hard"]) {
		const count = difficulties.get(level) ?? 0;
		if (count > 0) {
			lines.push(`    ${level}: ${count} question${count !== 1 ? "s" : ""}`);
		}
	}

	// Sample questions
	const sampleCount = Math.min(5, result.questions.length);
	if (sampleCount > 0) {
		lines.push("");
		lines.push(`  Sample questions (showing ${sampleCount} of ${result.questions.length}):`);
		for (let i = 0; i < sampleCount; i++) {
			const q = result.questions[i];
			lines.push(`    ${q.id} [${q.category}/${q.difficulty}]`);
			lines.push(`      Q: ${q.question}`);
			if (!questionsOnly && q.answer !== "(redacted)") {
				lines.push(`      A: ${q.answer}`);
			}
		}
	}

	// Rubric summary
	lines.push("");
	lines.push("  Rubric:");
	for (const band of result.rubric.scale) {
		lines.push(`    ${band.min}-${band.max}%: ${band.rating} — ${band.description}`);
	}

	lines.push("");
	lines.push(`  Output: .forge/barometer.json`);

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Scoring logic
// ---------------------------------------------------------------------------

/**
 * Compares an agent answer against the expected answer.
 *
 * @param expected - Ground-truth answer from the answer key.
 * @param got - Agent's submitted answer.
 * @returns "correct" for exact match, "partial" for substring containment, "wrong" otherwise.
 * @internal
 */
function scoreAnswer(expected: string, got: string): "correct" | "partial" | "wrong" {
	const e = expected.trim().toLowerCase();
	const g = got.trim().toLowerCase();
	if (!g) return "wrong";
	if (e === g) return "correct";
	if (g.includes(e) || e.includes(g)) return "partial";
	return "wrong";
}

/**
 * Scores agent answers against the barometer answer key.
 *
 * @remarks
 * Reads the answer key from `.forge/barometer.json` (generated by `runBarometer`)
 * and compares each agent answer against the ground truth. Exact case-insensitive
 * matches score full credit, substring containment scores half credit, and
 * everything else (including unanswered questions) scores zero.
 *
 * @param args - CLI arguments including project root and path to agent answers file.
 * @returns A typed `CommandOutput<BarometerScoreResult>`.
 * @example
 * ```typescript
 * import { runBarometerScore } from "@forge-ts/cli/commands/barometer";
 * const output = await runBarometerScore({ answersPath: "answers.json" });
 * console.log(`Score: ${output.data.score}%`);
 * ```
 * @since 0.22.0
 * @public
 */
export async function runBarometerScore(args: {
	cwd?: string;
	answersPath: string;
}): Promise<CommandOutput<BarometerScoreResult>> {
	const start = Date.now();
	const rootDir = args.cwd ?? process.cwd();

	// Load the answer key
	const keyPath = join(rootDir, ".forge", "barometer.json");
	if (!existsSync(keyPath)) {
		return {
			operation: "barometer.score",
			success: false,
			data: {
				score: 0,
				rating: "N/A",
				ratingDescription: "No answer key found",
				correct: 0,
				partial: 0,
				wrong: 0,
				total: 0,
				missed: [],
			},
			errors: [
				{
					code: "BAROMETER_NO_KEY",
					message: `Answer key not found at ${keyPath}. Run "forge-ts barometer" first to generate it.`,
				},
			],
			duration: Date.now() - start,
		};
	}

	const keyRaw = await readFile(keyPath, "utf8");
	const answerKey = JSON.parse(keyRaw) as BarometerResult;

	// Load agent answers
	const answersRaw = await readFile(args.answersPath, "utf8");
	const agentData = JSON.parse(answersRaw) as { answers: Array<{ id: string; answer: string }> };

	if (!agentData.answers || !Array.isArray(agentData.answers)) {
		return {
			operation: "barometer.score",
			success: false,
			data: {
				score: 0,
				rating: "N/A",
				ratingDescription: "Invalid answer file",
				correct: 0,
				partial: 0,
				wrong: 0,
				total: 0,
				missed: [],
			},
			errors: [
				{
					code: "BAROMETER_INVALID_ANSWERS",
					message: `Answers file must contain { "answers": [{ "id": "Q001", "answer": "..." }] }`,
				},
			],
			duration: Date.now() - start,
		};
	}

	// Index agent answers by ID
	const agentMap = new Map<string, string>();
	for (const a of agentData.answers) {
		agentMap.set(a.id, a.answer);
	}

	// Score each question
	let correct = 0;
	let partial = 0;
	let wrong = 0;
	const missed: BarometerScoredAnswer[] = [];
	const totalQuestions = answerKey.questions.length;

	for (const q of answerKey.questions) {
		if (q.answer === "(redacted)") continue; // Skip redacted entries
		const agentAnswer = agentMap.get(q.id) ?? "";
		const verdict = scoreAnswer(q.answer, agentAnswer);

		if (verdict === "correct") {
			correct++;
		} else if (verdict === "partial") {
			partial++;
			missed.push({
				id: q.id,
				expected: q.answer,
				got: agentAnswer,
				verdict,
				category: q.category,
			});
		} else {
			wrong++;
			missed.push({
				id: q.id,
				expected: q.answer,
				got: agentAnswer,
				verdict,
				category: q.category,
			});
		}
	}

	// Calculate score: full credit for correct, half for partial
	const rawScore = totalQuestions > 0 ? ((correct + partial * 0.5) / totalQuestions) * 100 : 0;
	const score = Math.round(rawScore * 10) / 10;

	// Determine rating band
	const rubric = buildRubric();
	const band =
		rubric.scale.find((b) => score >= b.min && score <= b.max) ??
		rubric.scale[rubric.scale.length - 1];

	const duration = Date.now() - start;

	return {
		operation: "barometer.score",
		success: true,
		data: {
			score,
			rating: band.rating,
			ratingDescription: band.description,
			correct,
			partial,
			wrong,
			total: totalQuestions,
			missed,
		},
		duration,
	};
}

/**
 * Formats a BarometerScoreResult as human-readable text.
 *
 * @internal
 */
function formatScoreHuman(result: BarometerScoreResult): string {
	const lines: string[] = [];
	lines.push(`\nforge-ts barometer score\n`);
	lines.push(`  Questions: ${result.total}`);
	lines.push(
		`  Correct:   ${result.correct} (${result.total > 0 ? ((result.correct / result.total) * 100).toFixed(1) : 0}%)`,
	);
	lines.push(
		`  Partial:   ${result.partial} (${result.total > 0 ? ((result.partial / result.total) * 100).toFixed(1) : 0}%)`,
	);
	lines.push(
		`  Wrong:     ${result.wrong} (${result.total > 0 ? ((result.wrong / result.total) * 100).toFixed(1) : 0}%)`,
	);
	lines.push("");
	lines.push(`  Score:  ${result.score}%`);
	lines.push(`  Rating: ${result.rating}`);
	lines.push(`    ${result.ratingDescription}`);

	// Top missed categories
	if (result.missed.length > 0) {
		const catCounts = new Map<string, number>();
		for (const m of result.missed) {
			catCounts.set(m.category, (catCounts.get(m.category) ?? 0) + 1);
		}
		const sorted = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]);
		lines.push("");
		lines.push("  Top missed categories:");
		for (const [cat, count] of sorted.slice(0, 5)) {
			const pct = ((count / result.missed.length) * 100).toFixed(0);
			lines.push(`    ${cat}: ${count} missed (${pct}% of misses)`);
		}
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Score subcommand
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts barometer score`.
 *
 * @public
 */
const barometerScoreCommand = defineCommand({
	meta: {
		name: "score",
		description: `Score agent answers against the barometer answer key.

Reads .forge/barometer.json as the answer key and compares against agent answers.

USAGE
  forge-ts barometer score --answers agent-answers.json

ANSWER FORMAT (agent-answers.json)
  {
    "answers": [
      { "id": "Q001", "answer": "SemVerConfig" },
      { "id": "Q002", "answer": "1" }
    ]
  }`,
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		answers: {
			type: "string",
			description: "Path to agent answers JSON file",
			required: true,
		},
		json: {
			type: "boolean",
			description: "Output as LAFS JSON envelope",
			default: false,
		},
		human: {
			type: "boolean",
			description: "Output as formatted text",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Suppress non-essential output",
			default: false,
		},
		mvi: {
			type: "string",
			description: "MVI verbosity level: minimal, standard, full",
		},
	},
	async run({ args }) {
		configureLogger({ json: args.json, quiet: args.quiet });

		const output = await runBarometerScore({
			cwd: args.cwd,
			answersPath: args.answers,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data) => formatScoreHuman(data));

		const exitCode = resolveExitCode(output);
		if (output.success) {
			forgeLogger.success(`Score: ${output.data.score}% — ${output.data.rating}`);
		}
		process.exit(exitCode);
	},
});

// ---------------------------------------------------------------------------
// Citty command definition
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts barometer`.
 *
 * Generates a documentation effectiveness test (questions + answers + rubric)
 * from the project's source code. Includes a `score` subcommand for evaluating
 * agent answers.
 *
 * @example
 * ```typescript
 * import { barometerCommand } from "@forge-ts/cli/commands/barometer";
 * // Registered as a top-level subcommand of `forge-ts`
 * ```
 * @public
 */
export const barometerCommand = defineCommand({
	meta: {
		name: "barometer",
		description: `Documentation effectiveness test — measures whether generated docs
faithfully reflect source code by generating questions only answerable from docs.

WORKFLOW (run these steps in order)

  Step 1: Generate answer key
    $ forge-ts barometer
    Output: .forge/barometer.json (questions + answers + rubric)

  Step 2: Generate agent test
    $ forge-ts barometer --questions-only --json > test.json
    Output: Same questions with answers set to "(redacted)"
            Includes agent instructions and expected response format

  Step 3: Run the test
    Give an LLM agent ONLY these inputs:
      - test.json (the redacted questions)
      - docs/generated/ directory (generated documentation)
    Prohibit access to: src/, packages/, any source code
    Agent writes answers to: answers.json (format shown below)

  Step 4: Score
    $ forge-ts barometer score --answers answers.json
    Output: Score percentage + rating band + missed categories

ANSWER FORMAT (answers.json)
  { "answers": [{ "id": "Q001", "answer": "your answer" }] }

RUBRIC
  90-100%  Elite SSoT      Agents can operate with zero source code access
  70-89%   High Fidelity   Excellent, may miss @remarks details
  50-69%   Standard        API usage OK, architecture needs source access
  0-49%    Stale/Shallow   Needs deeper @remarks and @example coverage

OUTPUT FILES
  .forge/barometer.json   Full answer key (gitignored, never committed)
  stdout (--human)        Summary with sample questions
  stdout (--json)         LAFS envelope for programmatic use`,
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		"questions-only": {
			type: "boolean",
			description: "Redact answers and include agent instructions for testing",
			default: false,
		},
		json: {
			type: "boolean",
			description: "Output as LAFS JSON envelope",
			default: false,
		},
		human: {
			type: "boolean",
			description: "Output as formatted text",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Suppress non-essential output",
			default: false,
		},
		mvi: {
			type: "string",
			description: "MVI verbosity level: minimal, standard, full",
		},
	},
	subCommands: {
		score: barometerScoreCommand,
	},
	async run({ rawArgs, args }) {
		// If score subcommand was dispatched, citty already ran it
		if (rawArgs.some((arg) => arg === "score")) return;

		configureLogger({ json: args.json, quiet: args.quiet });

		const questionsOnly = args["questions-only"] ?? false;
		const output = await runBarometer({
			cwd: args.cwd,
			questionsOnly,
			mvi: args.mvi,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data) => formatBarometerHuman(data, questionsOnly));

		const exitCode = resolveExitCode(output);
		forgeLogger.success(
			`Barometer generated: ${output.data.questions.length} questions across ${output.data.symbolCount} symbols`,
		);
		process.exit(exitCode);
	},
});
