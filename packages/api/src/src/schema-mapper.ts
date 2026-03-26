/**
 * Utility for mapping TypeScript type signatures to OpenAPI 3.2 schemas.
 * @public
 */

import type { OpenAPISchemaObject } from "@forge-ts/core";

export type { OpenAPISchemaObject };

/**
 * Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.
 *
 * Handles common primitives, arrays, unions, `Record<K, V>`, and falls back
 * to `{ type: "object" }` for anything it cannot parse.
 *
 * @remarks
 * Strips trailing `| undefined` and `| null` before parsing so callers can
 * handle optionality separately via the `required` array.
 *
 * @param signature - A TypeScript type signature string, e.g. `"string"`, `"number[]"`,
 *   `"string | number"`, `"Record<string, boolean>"`.
 * @returns An OpenAPI schema object.
 * @example
 * ```typescript
 * import { signatureToSchema } from "@forge-ts/api";
 * const schema = signatureToSchema("string[]");
 * // { type: "array", items: { type: "string" } }
 * ```
 * @since 0.15.0
 * @public
 */
export function signatureToSchema(signature: string): OpenAPISchemaObject {
	const trimmed = signature.trim();

	// Strip trailing `| undefined` or `| null` for optional detection — callers
	// handle the required array separately; here we just produce the base schema.
	const withoutUndefined = trimmed
		.replace(/\s*\|\s*undefined/g, "")
		.replace(/\s*\|\s*null/g, "")
		.trim();

	// Union type: A | B
	if (withoutUndefined.includes(" | ")) {
		const parts = splitUnion(withoutUndefined);
		if (parts.length > 1) {
			return { oneOf: parts.map((p) => signatureToSchema(p)) };
		}
	}

	// Array shorthand: T[]
	const arrayShorthand = /^(.+)\[\]$/.exec(withoutUndefined);
	if (arrayShorthand) {
		return { type: "array", items: signatureToSchema(arrayShorthand[1]) };
	}

	// Generic Array<T>
	const genericArray = /^Array<(.+)>$/.exec(withoutUndefined);
	if (genericArray) {
		return { type: "array", items: signatureToSchema(genericArray[1]) };
	}

	// Record<string, V>
	const record = /^Record<[^,]+,\s*(.+)>$/.exec(withoutUndefined);
	if (record) {
		return { type: "object", additionalProperties: signatureToSchema(record[1]) };
	}

	// Primitives
	switch (withoutUndefined) {
		case "string":
			return { type: "string" };
		case "number":
			return { type: "number" };
		case "boolean":
			return { type: "boolean" };
		case "null":
			return { type: "null" };
		case "unknown":
		case "any":
			return {};
		case "void":
			return { type: "null" };
		default:
			return { type: "object" };
	}
}

/**
 * Splits a union type string by top-level `|` separators (ignoring `|` inside
 * angle brackets or parentheses).
 *
 * @param signature - A union type string such as `"string | number | boolean"`.
 * @returns An array of trimmed member type strings.
 * @internal
 */
function splitUnion(signature: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;

	for (let i = 0; i < signature.length; i++) {
		const ch = signature[i];
		if (ch === "<" || ch === "(" || ch === "{") {
			depth++;
		} else if (ch === ">" || ch === ")" || ch === "}") {
			depth--;
		} else if (ch === "|" && depth === 0) {
			parts.push(signature.slice(start, i).trim());
			start = i + 1;
		}
	}

	parts.push(signature.slice(start).trim());
	return parts.filter(Boolean);
}
