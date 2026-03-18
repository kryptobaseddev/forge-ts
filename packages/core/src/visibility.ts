import { type ForgeSymbol, Visibility } from "./types.js";

/**
 * Determines the visibility level of a symbol from its TSDoc release tags.
 *
 * The precedence order is:
 * 1. `@internal`  → {@link Visibility.Internal}
 * 2. `@beta`      → {@link Visibility.Beta}
 * 3. `@public`    → {@link Visibility.Public}
 * 4. (no tag)     → {@link Visibility.Public} (default for exports)
 *
 * @param tags - The parsed `tags` map from `ForgeSymbol.documentation`.
 * @returns The resolved {@link Visibility} value.
 * @public
 */
export function resolveVisibility(tags: Record<string, string[]> | undefined): Visibility {
	if (!tags) return Visibility.Public;

	if ("internal" in tags) return Visibility.Internal;
	if ("beta" in tags) return Visibility.Beta;
	if ("public" in tags) return Visibility.Public;

	return Visibility.Public;
}

/**
 * Numeric rank used for visibility comparisons.
 * Lower numbers are more restrictive.
 * @internal
 */
const VISIBILITY_RANK: Record<Visibility, number> = {
	[Visibility.Public]: 0,
	[Visibility.Beta]: 1,
	[Visibility.Internal]: 2,
	[Visibility.Private]: 3,
};

/**
 * Returns whether `candidate` meets or exceeds the required minimum visibility.
 *
 * "Meets" means the symbol is at least as visible as `minVisibility`.
 * For example, `Public` meets a minimum of `Public`, but `Internal` does not.
 *
 * @param candidate - The visibility of the symbol being tested.
 * @param minVisibility - The minimum visibility threshold.
 * @returns `true` if `candidate` is at least as visible as `minVisibility`.
 * @public
 */
export function meetsVisibility(candidate: Visibility, minVisibility: Visibility): boolean {
	return VISIBILITY_RANK[candidate] <= VISIBILITY_RANK[minVisibility];
}

/**
 * Filters an array of {@link ForgeSymbol} objects to only include symbols
 * whose visibility meets or exceeds `minVisibility`.
 *
 * @param symbols - The full list of symbols to filter.
 * @param minVisibility - The minimum visibility threshold to keep.
 * @returns A new array containing only symbols that pass the visibility check.
 * @public
 */
export function filterByVisibility(
	symbols: ForgeSymbol[],
	minVisibility: Visibility,
): ForgeSymbol[] {
	return symbols.filter((s) => meetsVisibility(s.visibility, minVisibility));
}
