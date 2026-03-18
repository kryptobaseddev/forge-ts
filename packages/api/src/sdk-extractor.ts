import type { ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";

/**
 * A single property extracted from an interface or class symbol.
 * @public
 */
export interface SDKProperty {
	/** The property name. */
	name: string;
	/** The TypeScript type string of the property. */
	type: string;
	/** TSDoc summary for this property. */
	description?: string;
	/** Whether the property is required (not optional). */
	required: boolean;
	/** Deprecation notice, if present. */
	deprecated?: string;
}

/**
 * An SDK type descriptor extracted from the symbol graph.
 * @public
 */
export interface SDKType {
	/** The symbol name. */
	name: string;
	/** Syntactic kind of the type. */
	kind: "interface" | "type" | "class" | "enum";
	/** Human-readable type signature. */
	signature?: string;
	/** TSDoc summary. */
	description?: string;
	/** Deprecation notice, if present. */
	deprecated?: string;
	/** Resolved visibility level. */
	visibility: Visibility;
	/** Extracted properties (for interfaces, classes) or values (for enums). */
	properties: SDKProperty[];
	/** Absolute path to the source file. */
	sourceFile: string;
}

/**
 * Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from
 * a list of {@link ForgeSymbol} objects.
 *
 * Only exported symbols whose visibility is not {@link Visibility.Internal} or
 * {@link Visibility.Private} are included.
 *
 * @param symbols - The symbols produced by the core AST walker.
 * @returns An array of {@link SDKType} objects for public-facing type definitions.
 * @public
 */
export function extractSDKTypes(symbols: ForgeSymbol[]): SDKType[] {
	return symbols
		.filter(
			(s) =>
				s.exported &&
				(s.kind === "interface" || s.kind === "type" || s.kind === "class" || s.kind === "enum") &&
				s.visibility !== Visibility.Internal &&
				s.visibility !== Visibility.Private,
		)
		.map((s) => ({
			name: s.name,
			kind: s.kind as SDKType["kind"],
			signature: s.signature,
			description: s.documentation?.summary,
			deprecated: s.documentation?.deprecated,
			visibility: s.visibility,
			properties: extractProperties(s),
			sourceFile: s.filePath,
		}));
}

/**
 * Extracts the property list from a symbol's children.
 *
 * For interfaces and classes, children with kind `"property"` are mapped to
 * {@link SDKProperty}. For enums, children with kind `"property"` (enum
 * members) are also included. Method children are excluded.
 *
 * @param symbol - The parent symbol whose children to extract from.
 * @returns An array of {@link SDKProperty} objects.
 * @internal
 */
function extractProperties(symbol: ForgeSymbol): SDKProperty[] {
	if (!symbol.children || symbol.children.length === 0) {
		return [];
	}

	return symbol.children
		.filter(
			(child) =>
				child.kind === "property" &&
				child.visibility !== Visibility.Private &&
				child.visibility !== Visibility.Internal,
		)
		.map((child) => {
			const isOptional = child.signature ? child.signature.includes("?") : false;
			const rawType = resolveChildType(child);
			return {
				name: child.name,
				type: rawType,
				description: child.documentation?.summary,
				required: !isOptional,
				deprecated: child.documentation?.deprecated,
			};
		});
}

/**
 * Resolves the type string for a child symbol.
 *
 * Uses the signature if present; otherwise falls back to `"unknown"`.
 *
 * @param child - A child {@link ForgeSymbol}.
 * @returns A TypeScript type string.
 * @internal
 */
function resolveChildType(child: ForgeSymbol): string {
	if (!child.signature) {
		return "unknown";
	}

	// Signatures for properties often look like `name: type` or `name?: type`.
	// Strip the leading `name:` or `name?:` prefix to get the bare type.
	const colonIndex = child.signature.indexOf(":");
	if (colonIndex !== -1) {
		return child.signature.slice(colonIndex + 1).trim();
	}

	return child.signature;
}
