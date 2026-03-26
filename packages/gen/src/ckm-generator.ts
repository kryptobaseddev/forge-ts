/**
 * Codebase Knowledge Manifest (CKM) generator.
 *
 * Extracts operational knowledge from the symbol graph using a hybrid
 * approach: heuristic analysis as baseline, TSDoc tags to override/enrich.
 *
 * @remarks
 * The CKM captures five categories of knowledge that llms.txt cannot:
 * 1. Concepts — domain objects with rules and relationships
 * 2. Operations — actions with preconditions, inputs, outputs, exit codes
 * 3. Constraints — enforced rules with config keys and security flags
 * 4. Workflows — multi-step sequences for common goals
 * 5. Config Schema — full config structure with types, defaults, and effects
 *
 * @packageDocumentation
 * @public
 */

import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

// ---------------------------------------------------------------------------
// CKM Schema Types
// ---------------------------------------------------------------------------

/**
 * A domain concept extracted from the codebase.
 *
 * @remarks
 * Concepts are identified either by an explicit `@concept` TSDoc tag or by
 * heuristic name-matching on exported interfaces/types whose names indicate
 * domain objects (e.g., Config, Options, State, Result).
 *
 * @example
 * ```typescript
 * const concept: CKMConcept = {
 *   id: "concept-ForgeConfig",
 *   name: "ForgeConfig",
 *   what: "Full configuration for a forge-ts run.",
 *   properties: [{ name: "rootDir", type: "string", description: "Root directory." }],
 *   rules: ["rootDir must be an absolute path"],
 *   relatedTo: ["EnforceRules"],
 * };
 * ```
 * @public
 */
export interface CKMConcept {
	/** Stable identifier for this concept (e.g., "concept-ForgeConfig"). */
	id: string;
	/** The declared name of the concept type or interface. */
	name: string;
	/** Human-readable description from `@concept` tag content or summary. */
	what: string;
	/** Properties of this concept extracted from child symbols. */
	properties?: Array<{ name: string; type: string; description: string }>;
	/** Validation rules extracted from `@constraint` tags or `@remarks` bullet points. */
	rules?: string[];
	/** Related concept names from `@see` tags or type references. */
	relatedTo?: string[];
}

/**
 * A single input parameter for a CKM operation.
 *
 * @remarks
 * Derived from `@param` TSDoc tags, with type and default information
 * extracted from the function signature and `@defaultValue` tags.
 *
 * @public
 */
export interface CKMOperationInput {
	/** Parameter name. */
	name: string;
	/** TypeScript type of the parameter. */
	type: string;
	/** Whether this parameter is required (non-optional). */
	required: boolean;
	/** Default value from `@defaultValue` tag, if present. */
	default?: string;
	/** Description from `@param` tag. */
	description: string;
}

/**
 * A user-facing operation extracted from the codebase.
 *
 * @remarks
 * Operations are identified either by an explicit `@operation` TSDoc tag
 * or by heuristic name-matching on exported functions whose names start
 * with action verbs (run, create, validate, init, generate, build, check, enforce).
 *
 * @example
 * ```typescript
 * const op: CKMOperation = {
 *   id: "op-runBuild",
 *   name: "runBuild",
 *   what: "Runs the full build pipeline.",
 *   inputs: [{ name: "args", type: "BuildArgs", required: true, description: "CLI arguments." }],
 *   outputs: { json: "CommandOutput<BuildResult>" },
 * };
 * ```
 * @public
 */
export interface CKMOperation {
	/** Stable identifier for this operation (e.g., "op-runBuild"). */
	id: string;
	/** The function or command name. */
	name: string;
	/** Human-readable description from `@operation` tag content or summary. */
	what: string;
	/** Preconditions extracted from `@remarks` or `@throws` tags. */
	preconditions?: string[];
	/** Input parameters derived from `@param` tags. */
	inputs: CKMOperationInput[];
	/** Output descriptions for text and JSON formats. */
	outputs?: { text?: string; json?: string };
	/** Exit codes and their meanings, if documented. */
	exitCodes?: Record<string, string>;
	/** Checks or validations performed by this operation, from `@remarks`. */
	checksPerformed?: string[];
}

/**
 * An enforced constraint or validation rule extracted from the codebase.
 *
 * @remarks
 * Constraints are identified either by an explicit `@constraint` TSDoc tag
 * or heuristically from functions that contain `@throws` tags indicating
 * validation failures.
 *
 * @example
 * ```typescript
 * const constraint: CKMConstraint = {
 *   id: "constraint-require-summary",
 *   rule: "Exported symbol must have a TSDoc summary.",
 *   enforcedBy: "checkRequireSummary",
 *   configKey: "enforce.rules.require-summary",
 *   default: "error",
 *   security: false,
 * };
 * ```
 * @public
 */
export interface CKMConstraint {
	/** Stable identifier for this constraint (e.g., "constraint-require-summary"). */
	id: string;
	/** The rule description from `@constraint` tag content. */
	rule: string;
	/** Name of the function that enforces this constraint. */
	enforcedBy: string;
	/** Config key that controls this constraint, from `@remarks`. */
	configKey?: string;
	/** Default value for the config key. */
	default?: string;
	/** Whether this constraint has security implications (from `@constraint security` keyword). */
	security?: boolean;
}

/**
 * A multi-step workflow for achieving a common goal.
 *
 * @remarks
 * Workflows are identified by an explicit `@workflow` TSDoc tag.
 * The tag content is parsed for numbered steps, backtick-wrapped commands,
 * and expected outcomes.
 *
 * @example
 * ```typescript
 * const workflow: CKMWorkflow = {
 *   id: "workflow-first-time-setup",
 *   goal: "Set up forge-ts in a new project",
 *   steps: [
 *     { command: "npx forge-ts init", expect: "Creates forge-ts.config.ts" },
 *     { command: "npx forge-ts check", expect: "Reports documentation gaps" },
 *   ],
 * };
 * ```
 * @public
 */
export interface CKMWorkflow {
	/** Stable identifier for this workflow (e.g., "workflow-first-time-setup"). */
	id: string;
	/** The goal this workflow achieves, from `@workflow` tag content. */
	goal: string;
	/** Ordered steps to complete this workflow. */
	steps: Array<{
		/** Shell or CLI command to run (extracted from backtick-wrapped text). */
		command?: string;
		/** Manual instruction when no command is applicable. */
		manual?: string;
		/** Expected outcome of this step. */
		expect?: string;
		/** Additional note or caveat for this step. */
		note?: string;
	}>;
}

/**
 * A single entry in the configuration schema.
 *
 * @remarks
 * Extracted from interfaces whose names contain "Config" or "Options".
 * Each property of such an interface becomes a config entry with its
 * type, default value, description, and downstream effect.
 *
 * @public
 */
export interface CKMConfigEntry {
	/** Dot-path key for this config entry (e.g., "enforce.strict"). */
	key: string;
	/** TypeScript type of this config entry. */
	type: string;
	/** Default value from `@defaultValue` tag, if present. */
	default?: string;
	/** Human-readable description from the property summary. */
	description: string;
	/** Downstream effect or behaviour this config entry controls, from `@remarks`. */
	effect?: string;
}

/**
 * The top-level Codebase Knowledge Manifest.
 *
 * @remarks
 * This is the root schema for the CKM JSON output. It aggregates all five
 * categories of operational knowledge: concepts, operations, constraints,
 * workflows, and config schema entries.
 *
 * @example
 * ```typescript
 * import { generateCKM } from "@forge-ts/gen";
 * const manifest = generateCKM(symbols, config);
 * console.log(manifest.concepts.length); // number of extracted concepts
 * ```
 * @public
 */
export interface CKMManifest {
	/** JSON Schema URI for the CKM format. */
	$schema: string;
	/** CKM format version. */
	version: string;
	/** Project name from config. */
	project: string;
	/** ISO 8601 timestamp of when the manifest was generated. */
	generated: string;
	/** Domain concepts extracted from the codebase. */
	concepts: CKMConcept[];
	/** User-facing operations extracted from the codebase. */
	operations: CKMOperation[];
	/** Enforced constraints and validation rules. */
	constraints: CKMConstraint[];
	/** Multi-step workflows for common goals. */
	workflows: CKMWorkflow[];
	/** Configuration schema entries. */
	configSchema: CKMConfigEntry[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** CKM format version. */
const CKM_VERSION = "1.0.0";

/** CKM JSON Schema URI. */
const CKM_SCHEMA = "https://forge-ts.dev/schemas/ckm/v1.json";

/**
 * Regex for heuristic concept detection from interface/type names.
 * @internal
 */
const CONCEPT_NAME_PATTERN = /Config|Options|Settings|State|Status|Record|Entry|Event|Result/i;

/**
 * Regex for heuristic operation detection from function names.
 * @internal
 */
const OPERATION_NAME_PATTERN = /^run|^create|^validate|^init|^generate|^build|^check|^enforce/;

/**
 * Regex for detecting constraint language in remarks text.
 * @internal
 */
const CONSTRAINT_LANGUAGE_PATTERN = /must be|cannot|required|only when/i;

/**
 * Creates a URL-safe slug from a name for use as an identifier.
 * @param prefix - The prefix category (e.g., "concept", "op").
 * @param name - The symbol name.
 * @returns A stable identifier string.
 * @internal
 */
function makeId(prefix: string, name: string): string {
	return `${prefix}-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/**
 * Extracts the type portion from a property signature string.
 *
 * @remarks
 * Handles both `name: type` and bare type forms. For complex types
 * (starting with `{` or `(` or containing `|`), returns the whole string.
 *
 * @param signature - The raw signature from the walker.
 * @returns The extracted type string.
 * @internal
 */
function extractType(signature: string | undefined): string {
	if (!signature) return "unknown";
	const trimmed = signature.trim();
	if (/^[{(]/.test(trimmed) || /[|]/.test(trimmed.split(":")[0])) {
		return trimmed;
	}
	const colonIdx = trimmed.indexOf(":");
	if (colonIdx === -1) return trimmed;
	const left = trimmed.slice(0, colonIdx).trim();
	if (/^[a-zA-Z_$][a-zA-Z0-9_$?]*$/.test(left)) {
		return trimmed.slice(colonIdx + 1).trim();
	}
	return trimmed;
}

/**
 * Extracts bullet-point rules from a remarks string.
 *
 * @remarks
 * Looks for lines starting with `- ` or `* ` that contain constraint
 * language such as "must be", "cannot", "required", "only when".
 *
 * @param remarks - The raw `@remarks` text.
 * @returns An array of rule strings, possibly empty.
 * @internal
 */
function extractRulesFromRemarks(remarks: string | undefined): string[] {
	if (!remarks) return [];
	const rules: string[] = [];
	const lines = remarks.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^[-*]\s+/.test(trimmed) && CONSTRAINT_LANGUAGE_PATTERN.test(trimmed)) {
			rules.push(trimmed.replace(/^[-*]\s+/, ""));
		}
	}
	return rules;
}

/**
 * Extracts `@see` references from a symbol's tags.
 *
 * @param tags - The parsed TSDoc tags record.
 * @returns An array of referenced symbol names.
 * @internal
 */
function extractSeeRefs(tags: Record<string, string[]> | undefined): string[] {
	if (!tags?.see) return [];
	return tags.see.map((ref) =>
		ref
			.replace(/^\{@link\s+/, "")
			.replace(/\}$/, "")
			.trim(),
	);
}

/**
 * Determines whether a symbol has a specific custom tag.
 *
 * @param sym - The symbol to check.
 * @param tagName - The tag name without the `@` prefix.
 * @returns True if the tag is present.
 * @internal
 */
function hasTag(sym: ForgeSymbol, tagName: string): boolean {
	return sym.documentation?.tags?.[tagName] !== undefined;
}

/**
 * Gets the first value of a custom tag, or undefined.
 *
 * @param sym - The symbol to check.
 * @param tagName - The tag name without the `@` prefix.
 * @returns The first tag value, or undefined.
 * @internal
 */
function getTagValue(sym: ForgeSymbol, tagName: string): string | undefined {
	const values = sym.documentation?.tags?.[tagName];
	return values?.[0];
}

/**
 * Returns true when the symbol kind represents a concept-level declaration.
 * @internal
 */
function isConceptKind(kind: ForgeSymbol["kind"]): boolean {
	return kind === "interface" || kind === "type" || kind === "enum";
}

// ---------------------------------------------------------------------------
// Extraction functions
// ---------------------------------------------------------------------------

/**
 * Extracts concepts from the symbol graph.
 *
 * @remarks
 * Uses a hybrid approach: symbols with an explicit `@concept` tag are
 * always included. Additionally, exported interfaces/types whose names
 * match common domain-object patterns are included heuristically.
 *
 * @param symbols - All symbols from the project.
 * @returns An array of {@link CKMConcept} entries.
 * @internal
 */
function extractConcepts(symbols: ForgeSymbol[]): CKMConcept[] {
	const concepts: CKMConcept[] = [];
	const seen = new Set<string>();

	for (const sym of symbols) {
		if (!sym.exported) continue;
		if (!isConceptKind(sym.kind)) continue;

		const hasConcept = hasTag(sym, "concept");
		const matchesHeuristic = CONCEPT_NAME_PATTERN.test(sym.name);

		if (!hasConcept && !matchesHeuristic) continue;
		if (seen.has(sym.name)) continue;
		seen.add(sym.name);

		const what = getTagValue(sym, "concept") ?? sym.documentation?.summary ?? "";

		const properties: CKMConcept["properties"] = [];
		for (const child of sym.children ?? []) {
			properties.push({
				name: child.name,
				type: extractType(child.signature),
				description: child.documentation?.summary ?? "",
			});
		}

		const rules = extractRulesFromRemarks(sym.documentation?.remarks);
		const relatedTo = extractSeeRefs(sym.documentation?.tags);

		const concept: CKMConcept = {
			id: makeId("concept", sym.name),
			name: sym.name,
			what,
		};
		if (properties.length > 0) concept.properties = properties;
		if (rules.length > 0) concept.rules = rules;
		if (relatedTo.length > 0) concept.relatedTo = relatedTo;

		concepts.push(concept);
	}

	return concepts;
}

/**
 * Extracts operations from the symbol graph.
 *
 * @remarks
 * Uses a hybrid approach: symbols with an explicit `@operation` tag are
 * always included. Additionally, exported functions whose names match
 * action-verb patterns or end with "Command" (citty convention) are
 * included heuristically.
 *
 * @param symbols - All symbols from the project.
 * @returns An array of {@link CKMOperation} entries.
 * @internal
 */
function extractOperations(symbols: ForgeSymbol[]): CKMOperation[] {
	const operations: CKMOperation[] = [];
	const seen = new Set<string>();

	for (const sym of symbols) {
		if (!sym.exported) continue;
		if (sym.kind !== "function" && sym.kind !== "variable") continue;

		const hasOperation = hasTag(sym, "operation");
		const matchesHeuristic = OPERATION_NAME_PATTERN.test(sym.name);
		const isCommand = sym.name.endsWith("Command");

		if (!hasOperation && !matchesHeuristic && !isCommand) continue;
		if (seen.has(sym.name)) continue;
		seen.add(sym.name);

		const what = getTagValue(sym, "operation") ?? sym.documentation?.summary ?? "";

		const inputs: CKMOperationInput[] = [];
		for (const param of sym.documentation?.params ?? []) {
			inputs.push({
				name: param.name,
				type: param.type ?? "unknown",
				required: !param.name.endsWith("?"),
				description: param.description,
			});
		}

		const preconditions: string[] = [];
		for (const t of sym.documentation?.throws ?? []) {
			preconditions.push(t.type ? `${t.type}: ${t.description}` : t.description);
		}

		const outputs: CKMOperation["outputs"] = {};
		if (sym.documentation?.returns) {
			const retType = sym.documentation.returns.type;
			if (retType?.toLowerCase().includes("json") || retType?.toLowerCase().includes("object")) {
				outputs.json = sym.documentation.returns.description;
			} else {
				outputs.text = sym.documentation.returns.description;
			}
		}

		// Extract checks performed from @remarks bullet points
		const checksPerformed: string[] = [];
		if (sym.documentation?.remarks) {
			const lines = sym.documentation.remarks.split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (/^[-*]\s+/.test(trimmed)) {
					checksPerformed.push(trimmed.replace(/^[-*]\s+/, ""));
				}
			}
		}

		const op: CKMOperation = {
			id: makeId("op", sym.name),
			name: sym.name,
			what,
			inputs,
		};
		if (preconditions.length > 0) op.preconditions = preconditions;
		if (outputs.text || outputs.json) op.outputs = outputs;
		if (checksPerformed.length > 0) op.checksPerformed = checksPerformed;

		operations.push(op);
	}

	return operations;
}

/**
 * Extracts constraints from the symbol graph.
 *
 * @remarks
 * Uses a hybrid approach: symbols with an explicit `@constraint` tag are
 * always included. Additionally, functions with `@throws` tags are
 * treated as heuristic constraints. Constraint language in `@remarks`
 * blocks (e.g., "must be", "cannot", "required") is also detected.
 *
 * @param symbols - All symbols from the project.
 * @returns An array of {@link CKMConstraint} entries.
 * @internal
 */
function extractConstraints(symbols: ForgeSymbol[]): CKMConstraint[] {
	const constraints: CKMConstraint[] = [];
	const seen = new Set<string>();

	for (const sym of symbols) {
		if (!sym.exported) continue;

		const constraintTag = getTagValue(sym, "constraint");

		if (constraintTag) {
			const id = makeId("constraint", sym.name);
			if (seen.has(id)) continue;
			seen.add(id);

			const security = constraintTag.toLowerCase().includes("security");

			// Extract config key from @remarks
			let configKey: string | undefined;
			let defaultVal: string | undefined;
			if (sym.documentation?.remarks) {
				const configMatch = /config(?:Key)?[:\s]+[`"]?([a-zA-Z0-9._-]+)[`"]?/i.exec(
					sym.documentation.remarks,
				);
				if (configMatch) configKey = configMatch[1];
				const defaultMatch = /default[:\s]+[`"]?([^`"\n]+)[`"]?/i.exec(sym.documentation.remarks);
				if (defaultMatch) defaultVal = defaultMatch[1].trim();
			}

			constraints.push({
				id,
				rule: constraintTag,
				enforcedBy: sym.name,
				configKey,
				default: defaultVal,
				security: security || undefined,
			});
			continue;
		}

		// Heuristic: functions with @throws
		if (sym.kind === "function" && sym.documentation?.throws) {
			for (const t of sym.documentation.throws) {
				const rule = t.type ? `${t.type}: ${t.description}` : t.description;
				const id = makeId(
					"constraint",
					`${sym.name}-${rule.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}`,
				);
				if (seen.has(id)) continue;
				seen.add(id);

				constraints.push({
					id,
					rule,
					enforcedBy: sym.name,
				});
			}
		}
	}

	return constraints;
}

/**
 * Extracts workflows from the symbol graph.
 *
 * @remarks
 * Only symbols with an explicit `@workflow` TSDoc tag are extracted.
 * The tag content is parsed for numbered steps. Each step may contain
 * a backtick-wrapped command, manual instructions, and expected outcomes.
 *
 * @param symbols - All symbols from the project.
 * @returns An array of {@link CKMWorkflow} entries.
 * @internal
 */
function extractWorkflows(symbols: ForgeSymbol[]): CKMWorkflow[] {
	const workflows: CKMWorkflow[] = [];

	for (const sym of symbols) {
		if (!sym.exported) continue;

		const workflowTag = getTagValue(sym, "workflow");
		if (!workflowTag) continue;

		const lines = workflowTag.split("\n");
		const goal = lines[0]?.trim() ?? sym.documentation?.summary ?? "";

		const steps: CKMWorkflow["steps"] = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			// Strip leading step numbers like "1." or "1)"
			const cleaned = line.replace(/^\d+[.)]\s*/, "");
			if (!cleaned) continue;

			const step: CKMWorkflow["steps"][number] = {};

			// Look for backtick-wrapped commands
			const cmdMatch = /`([^`]+)`/.exec(cleaned);
			if (cmdMatch) {
				step.command = cmdMatch[1];
				// Text after the command is the expected outcome
				const afterCmd = cleaned.slice((cmdMatch.index ?? 0) + cmdMatch[0].length).trim();
				if (afterCmd.startsWith("—") || afterCmd.startsWith("-")) {
					step.expect = afterCmd.replace(/^[—-]\s*/, "").trim();
				} else if (afterCmd) {
					step.expect = afterCmd;
				}
			} else {
				step.manual = cleaned;
			}

			steps.push(step);
		}

		// If no numbered steps were parsed, treat the entire content as a single manual step
		if (steps.length === 0 && goal) {
			steps.push({ manual: goal });
		}

		workflows.push({
			id: makeId("workflow", sym.name),
			goal,
			steps,
		});
	}

	return workflows;
}

/**
 * Extracts the configuration schema from Config-like interfaces.
 *
 * @remarks
 * Finds exported interfaces/types whose names contain "Config" or "Options"
 * and extracts each property as a config entry. Property types come from
 * the signature, defaults from `@defaultValue`, descriptions from the summary,
 * and downstream effects from `@remarks`.
 *
 * @param symbols - All symbols from the project.
 * @param prefix - Dot-path prefix for nested config entries.
 * @returns An array of {@link CKMConfigEntry} entries.
 * @internal
 */
function extractConfigSchema(symbols: ForgeSymbol[], prefix = ""): CKMConfigEntry[] {
	const entries: CKMConfigEntry[] = [];
	const seen = new Set<string>();

	for (const sym of symbols) {
		if (!sym.exported) continue;
		if (sym.kind !== "interface" && sym.kind !== "type") continue;
		if (!/Config|Options/i.test(sym.name)) continue;
		if (seen.has(sym.name)) continue;
		seen.add(sym.name);

		const keyPrefix = prefix ? `${prefix}.` : "";

		for (const child of sym.children ?? []) {
			const key = `${keyPrefix}${sym.name}.${child.name}`;
			const type = extractType(child.signature);
			const description = child.documentation?.summary ?? "";
			const defaultVal = child.documentation?.tags?.defaultValue?.[0];
			const effect = child.documentation?.remarks;

			entries.push({
				key,
				type,
				description,
				...(defaultVal ? { default: defaultVal } : {}),
				...(effect ? { effect } : {}),
			});
		}
	}

	return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a Codebase Knowledge Manifest from the symbol graph.
 *
 * @remarks
 * Orchestrates the five extraction passes (concepts, operations, constraints,
 * workflows, config schema) and assembles them into a {@link CKMManifest}.
 * Uses a hybrid approach where explicit TSDoc tags (`@concept`, `@operation`,
 * `@constraint`, `@workflow`) take precedence, with heuristic analysis as
 * a baseline for projects that lack custom tags.
 *
 * @param symbols - All symbols extracted from the project.
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A complete {@link CKMManifest} ready for JSON serialization.
 * @example
 * ```typescript
 * import { generateCKM } from "@forge-ts/gen";
 * const manifest = generateCKM(symbols, config);
 * console.log(JSON.stringify(manifest, null, 2));
 * ```
 * @public
 */
export function generateCKM(symbols: ForgeSymbol[], config: ForgeConfig): CKMManifest {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";

	return {
		$schema: CKM_SCHEMA,
		version: CKM_VERSION,
		project: projectName,
		generated: new Date().toISOString(),
		concepts: extractConcepts(symbols),
		operations: extractOperations(symbols),
		constraints: extractConstraints(symbols),
		workflows: extractWorkflows(symbols),
		configSchema: extractConfigSchema(symbols),
	};
}
