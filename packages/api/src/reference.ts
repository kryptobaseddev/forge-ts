import type { ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";

/**
 * A single entry in the generated API reference.
 * @public
 */
export interface ReferenceEntry {
	/** Symbol name. */
	name: string;
	/** Symbol kind. */
	kind: ForgeSymbol["kind"];
	/** TSDoc summary. */
	summary?: string;
	/** Human-readable type signature. */
	signature?: string;
	/** Resolved visibility level. */
	visibility: Visibility;
	/** Deprecation notice, if present. */
	deprecated?: string;
	/** Documented parameters. */
	params?: Array<{ name: string; description: string; type?: string }>;
	/** Documented return value. */
	returns?: { description: string; type?: string };
	/** Documented thrown exceptions. */
	throws?: Array<{ type?: string; description: string }>;
	/** Code examples from TSDoc `@example` tags. */
	examples?: Array<{ code: string; language: string }>;
	/** Nested child symbols (class methods, interface properties, enum members). */
	children?: ReferenceEntry[];
	/** Source file location. */
	location: { filePath: string; line: number };
}

/**
 * Builds a structured API reference from a list of exported symbols.
 *
 * Unlike the minimal stub, this version includes nested children (class
 * methods, interface properties) and all available TSDoc metadata.
 *
 * Symbols with {@link Visibility.Internal} or {@link Visibility.Private} are
 * excluded from the top-level results. Children with private/internal
 * visibility are also filtered out.
 *
 * @param symbols - All symbols from the AST walker.
 * @returns An array of {@link ReferenceEntry} objects sorted by name.
 * @public
 */
export function buildReference(symbols: ForgeSymbol[]): ReferenceEntry[] {
	return symbols
		.filter(
			(s) =>
				s.exported && s.visibility !== Visibility.Internal && s.visibility !== Visibility.Private,
		)
		.map(symbolToEntry)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Converts a single {@link ForgeSymbol} to a {@link ReferenceEntry}.
 *
 * @param symbol - The symbol to convert.
 * @returns A populated {@link ReferenceEntry}.
 * @internal
 */
function symbolToEntry(symbol: ForgeSymbol): ReferenceEntry {
	const entry: ReferenceEntry = {
		name: symbol.name,
		kind: symbol.kind,
		summary: symbol.documentation?.summary,
		signature: symbol.signature,
		visibility: symbol.visibility,
		deprecated: symbol.documentation?.deprecated,
		location: { filePath: symbol.filePath, line: symbol.line },
	};

	if (symbol.documentation?.params && symbol.documentation.params.length > 0) {
		entry.params = symbol.documentation.params;
	}

	if (symbol.documentation?.returns) {
		entry.returns = symbol.documentation.returns;
	}

	if (symbol.documentation?.throws && symbol.documentation.throws.length > 0) {
		entry.throws = symbol.documentation.throws;
	}

	if (symbol.documentation?.examples && symbol.documentation.examples.length > 0) {
		entry.examples = symbol.documentation.examples.map((ex) => ({
			code: ex.code,
			language: ex.language,
		}));
	}

	if (symbol.children && symbol.children.length > 0) {
		const visibleChildren = symbol.children.filter(
			(c) => c.visibility !== Visibility.Internal && c.visibility !== Visibility.Private,
		);
		if (visibleChildren.length > 0) {
			entry.children = visibleChildren.map(symbolToEntry);
		}
	}

	return entry;
}
