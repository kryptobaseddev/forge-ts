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
import type {
	CanonicalType,
	CkmConcept,
	CkmConfigEntry,
	CkmConstraint,
	CkmManifest,
	CkmOperation,
	CkmTypeRef,
	CkmWorkflow,
} from "ckm-sdk";
import { validateManifest } from "ckm-sdk";

// ---------------------------------------------------------------------------
// Re-export SDK types under the legacy CKM* names for backward compat
// ---------------------------------------------------------------------------

/**
 * A domain concept extracted from the codebase.
 * @public
 */
export type CKMConcept = CkmConcept;

/**
 * A single input parameter for a CKM operation.
 * @public
 */
export type { CkmInput as CKMOperationInput } from "ckm-sdk";

/**
 * A user-facing operation extracted from the codebase.
 * @public
 */
export type CKMOperation = CkmOperation;

/**
 * An enforced constraint or validation rule extracted from the codebase.
 * @public
 */
export type CKMConstraint = CkmConstraint;

/**
 * A multi-step workflow for achieving a common goal.
 * @public
 */
export type CKMWorkflow = CkmWorkflow;

/**
 * A single entry in the configuration schema.
 * @public
 */
export type CKMConfigEntry = CkmConfigEntry;

/**
 * The top-level Codebase Knowledge Manifest (v2).
 *
 * @remarks
 * Uses the canonical schema types from `ckm-sdk` for compile-time
 * contract enforcement between generator and consumer.
 *
 * @public
 */
export type CKMManifest = CkmManifest;

// ---------------------------------------------------------------------------
// Internal extraction types (pre-SDK mapping)
// ---------------------------------------------------------------------------

/** @internal */
interface RawConcept {
	id: string;
	name: string;
	what: string;
	properties?: Array<{ name: string; type: string; description: string }>;
	rules?: string[];
	relatedTo?: string[];
}

/** @internal */
interface RawOperationInput {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

/** @internal */
interface RawOperation {
	id: string;
	name: string;
	what: string;
	preconditions?: string[];
	inputs: RawOperationInput[];
	outputs?: { text?: string; json?: string };
	checksPerformed?: string[];
}

/** @internal */
interface RawConstraint {
	id: string;
	rule: string;
	enforcedBy: string;
	configKey?: string;
	default?: string;
	security?: boolean;
}

/** @internal */
interface RawWorkflow {
	id: string;
	goal: string;
	steps: Array<{ command?: string; manual?: string; expect?: string; note?: string }>;
}

/** @internal */
interface RawConfigEntry {
	key: string;
	type: string;
	default?: string;
	description: string;
	effect?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** CKM format version. */
const CKM_VERSION = "2.0.0";

/** CKM JSON Schema URI. */
const CKM_SCHEMA = "https://ckm.dev/schemas/v2.json";

/** Derives a topic slug from a concept name. */
function deriveSlug(name: string): string {
	return name
		.replace(/Config$/, "")
		.replace(/Result$/, "")
		.replace(/Options$/, "")
		.replace(/Settings$/, "")
		.toLowerCase();
}

/** Infers semantic tags from a concept name. Every concept gets at least one tag. */
function inferConceptTags(name: string): string[] {
	const tags: string[] = [];
	if (/Config$/i.test(name)) tags.push("config");
	if (/Result$/i.test(name)) tags.push("result");
	if (/Options$/i.test(name) || /Settings$/i.test(name)) tags.push("options");
	if (/State$/i.test(name) || /Status$/i.test(name)) tags.push("state");
	if (/Record$/i.test(name) || /Entry$/i.test(name)) tags.push("data");
	if (/Event$/i.test(name)) tags.push("event");
	// Fallback: every concept must have at least one tag for topic derivation
	if (tags.length === 0) tags.push("domain");
	return tags;
}

/** Maps a TypeScript type string to a canonical CKM type. */
function inferCanonical(tsType: string): CanonicalType {
	const lower = tsType.toLowerCase().trim();
	if (lower === "string") return "string";
	if (lower === "boolean") return "boolean";
	if (lower === "number") return "number";
	if (lower.includes("[]") || lower.startsWith("array")) return "array";
	if (lower === "object" || lower.startsWith("record")) return "object";
	if (lower === "null" || lower === "undefined" || lower === "void") return "null";
	if (lower === "unknown" || lower === "any") return "any";
	if (lower.includes("|")) return "string";
	return "object";
}

/** Converts a raw TS type string to a CkmTypeRef object. */
function toTypeRef(tsType: string): CkmTypeRef {
	const canonical = inferCanonical(tsType);
	if (canonical === tsType.toLowerCase()) return { canonical };
	return { canonical, original: tsType };
}

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
function extractConcepts(symbols: ForgeSymbol[]): RawConcept[] {
	const concepts: RawConcept[] = [];
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

		const properties: RawConcept["properties"] = [];
		for (const child of sym.children ?? []) {
			properties.push({
				name: child.name,
				type: extractType(child.signature),
				description: child.documentation?.summary ?? "",
			});
		}

		const rules = extractRulesFromRemarks(sym.documentation?.remarks);
		const relatedTo = extractSeeRefs(sym.documentation?.tags);

		const concept: RawConcept = {
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
function extractOperations(symbols: ForgeSymbol[]): RawOperation[] {
	const operations: RawOperation[] = [];
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

		const inputs: RawOperationInput[] = [];
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

		const outputs: RawOperation["outputs"] = {};
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

		const op: RawOperation = {
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
function extractConstraints(symbols: ForgeSymbol[]): RawConstraint[] {
	const constraints: RawConstraint[] = [];
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
function extractWorkflows(symbols: ForgeSymbol[]): RawWorkflow[] {
	const workflows: RawWorkflow[] = [];

	for (const sym of symbols) {
		if (!sym.exported) continue;

		const workflowTag = getTagValue(sym, "workflow");
		if (!workflowTag) continue;

		const lines = workflowTag.split("\n");
		const goal = lines[0]?.trim() ?? sym.documentation?.summary ?? "";

		const steps: RawWorkflow["steps"] = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			// Strip leading step numbers like "1." or "1)"
			const cleaned = line.replace(/^\d+[.)]\s*/, "");
			if (!cleaned) continue;

			const step: RawWorkflow["steps"][number] = {};

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
function extractConfigSchema(symbols: ForgeSymbol[], prefix = ""): RawConfigEntry[] {
	const entries: RawConfigEntry[] = [];
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
export function generateCKM(symbols: ForgeSymbol[], config: ForgeConfig): CkmManifest {
	const projectName = config.project.packageName ?? config.rootDir.split("/").pop() ?? "Project";
	const rawConcepts = extractConcepts(symbols);

	const manifest: CkmManifest = {
		$schema: CKM_SCHEMA,
		version: CKM_VERSION,
		meta: {
			project: projectName,
			language: "typescript",
			generator: `forge-ts@${config.project.version ?? "unknown"}`,
			generated: new Date().toISOString(),
		},
		concepts: rawConcepts.map((c) => ({
			id: c.id,
			name: c.name,
			slug: deriveSlug(c.name),
			what: c.what,
			tags: inferConceptTags(c.name),
			properties: c.properties?.map((p) => ({
				name: p.name,
				type: toTypeRef(p.type),
				description: p.description,
				required: true,
				default: null,
			})),
			rules: c.rules,
			relatedTo: c.relatedTo,
		})),
		operations: extractOperations(symbols).map((op) => ({
			id: op.id,
			name: op.name,
			what: op.what,
			tags: inferOperationTags(op, rawConcepts),
			preconditions: op.preconditions,
			inputs: op.inputs?.map((i) => ({
				name: i.name,
				type: toTypeRef(i.type),
				required: i.required,
				description: i.description,
			})),
			outputs: op.outputs?.text
				? { type: toTypeRef(op.outputs.text), description: op.outputs.text }
				: op.outputs?.json
					? { type: toTypeRef(op.outputs.json), description: op.outputs.json }
					: undefined,
			checksPerformed: op.checksPerformed,
		})),
		constraints: extractConstraints(symbols).map((c) => ({
			id: c.id,
			rule: c.rule,
			enforcedBy: c.enforcedBy,
			severity: "error" as const,
			configKey: c.configKey,
			default: c.default,
			security: c.security,
		})),
		workflows: extractWorkflows(symbols).map((wf) => ({
			id: wf.id,
			goal: wf.goal,
			tags: [] as string[],
			steps: wf.steps.map((s) => {
				if (s.command) return { action: "command" as const, value: s.command, note: s.note };
				if (s.manual) return { action: "manual" as const, value: s.manual, note: s.note };
				return { action: "manual" as const, value: "" as string, note: s.note };
			}),
		})),
		configSchema: extractConfigSchema(symbols).map((entry) => ({
			key: migrateConfigKey(entry.key, rawConcepts),
			type: toTypeRef(entry.type),
			description: entry.description,
			required: true,
			default: entry.default ?? null,
			effect: entry.effect,
		})),
	};

	// Validate generated manifest against the v2 schema
	const result = validateManifest(manifest);
	if (!result.valid) {
		const errorSummary = result.errors
			.slice(0, 5)
			.map((e) => `  ${e.path}: ${e.message}`)
			.join("\n");
		console.warn(
			`[forge-ts] CKM manifest has ${result.errors.length} validation error(s):\n${errorSummary}`,
		);
	}

	return manifest;
}

/** Infers operation tags by matching against concept slugs. */
function inferOperationTags(op: RawOperation, concepts: RawConcept[]): string[] {
	const tags: string[] = [];
	const haystack = `${op.name} ${op.what}`.toLowerCase();
	for (const c of concepts) {
		const slug = deriveSlug(c.name);
		if (slug && haystack.includes(slug)) tags.push(slug);
	}
	return [...new Set(tags)];
}

/** Migrates a config key from ConceptName.prop to slug.prop format. */
function migrateConfigKey(key: string, concepts: RawConcept[]): string {
	const parts = key.split(".");
	if (parts.length >= 2) {
		const conceptPart = parts[0] ?? "";
		for (const c of concepts) {
			if (c.name === conceptPart) {
				return [deriveSlug(c.name), ...parts.slice(1)].join(".");
			}
		}
		return [conceptPart.toLowerCase(), ...parts.slice(1)].join(".");
	}
	return key.toLowerCase();
}
