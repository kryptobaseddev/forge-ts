import type { ForgeSymbol } from "@forge-ts/core";

/** A detected usage of a deprecated symbol. */
export interface DeprecatedUsage {
	/** The deprecated symbol being consumed. */
	deprecatedSymbol: string;
	/** The package that exports the deprecated symbol. */
	sourcePackage: string;
	/** The file importing the deprecated symbol. */
	consumingFile: string;
	/** Line number of the import. */
	line: number;
	/** The deprecation message. */
	deprecationMessage: string;
}

/**
 * Scans symbols for imports of deprecated exports from other packages.
 *
 * @remarks
 * Builds a map of deprecated exported symbols, then checks `{@link}` references across package boundaries to detect cross-package consumption of deprecated APIs.
 *
 * @param symbols - All symbols from the walker across the entire project.
 * @returns Array of deprecated usages found.
 * @example
 * ```typescript
 * import { findDeprecatedUsages } from "@forge-ts/enforcer";
 * const usages = findDeprecatedUsages(symbols);
 * console.log(usages.length); // number of deprecated cross-package imports
 * ```
 */
export function findDeprecatedUsages(symbols: ForgeSymbol[]): DeprecatedUsage[] {
	// Build a set of deprecated symbol names with their source info
	const deprecatedExports = new Map<string, { sourceFile: string; message: string }>();

	for (const symbol of symbols) {
		if (symbol.exported && symbol.documentation?.deprecated) {
			deprecatedExports.set(symbol.name, {
				sourceFile: symbol.filePath,
				message: symbol.documentation.deprecated,
			});
		}
	}

	if (deprecatedExports.size === 0) return [];

	// For each symbol that has a {@link} or references a deprecated name,
	// check if it's from a different package
	const usages: DeprecatedUsage[] = [];

	// Check links
	for (const symbol of symbols) {
		const links = symbol.documentation?.links ?? [];
		for (const link of links) {
			const deprecated = deprecatedExports.get(link.target);
			if (deprecated && deprecated.sourceFile !== symbol.filePath) {
				// Different file references a deprecated symbol
				const sourcePackage = extractPackageName(deprecated.sourceFile);
				const consumingPackage = extractPackageName(symbol.filePath);

				if (sourcePackage !== consumingPackage) {
					usages.push({
						deprecatedSymbol: link.target,
						sourcePackage,
						consumingFile: symbol.filePath,
						line: link.line,
						deprecationMessage: deprecated.message,
					});
				}
			}
		}
	}

	return usages;
}

/** Extract package name from file path (e.g., "packages/core/src/..." -> "core"). */
function extractPackageName(filePath: string): string {
	const match = filePath.match(/packages\/([^/]+)\//);
	return match?.[1] ?? "root";
}
