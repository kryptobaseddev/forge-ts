import { type ForgeSymbol, Visibility } from "./types.js";

/**
 * Determines the visibility level of a symbol from its TSDoc release tags.
 *
 * @remarks
 * The precedence order is:
 * 1. `\@internal`  → {@link Visibility.Internal}
 * 2. `\@beta`      → {@link Visibility.Beta}
 * 3. `\@public`    → {@link Visibility.Public}
 * 4. (no tag)     → {@link Visibility.Public} (default for exports)
 *
 * @param tags - The parsed `tags` map from `ForgeSymbol.documentation`.
 * @returns The resolved {@link Visibility} value.
 * @see {@link Visibility}
 * @example
 * ```typescript
 * import { resolveVisibility } from "@forge-ts/core";
 * const vis = resolveVisibility({ internal: [] });
 * // vis === Visibility.Internal
 * ```
 * @since 0.1.0
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
 * @remarks
 * "Meets" means the symbol is at least as visible as `minVisibility`.
 * For example, `Public` meets a minimum of `Public`, but `Internal` does not.
 *
 * Both parameters accept either a {@link Visibility} enum value or the
 * equivalent string literal (`"public"`, `"beta"`, `"internal"`, `"private"`).
 *
 * @param candidate - The visibility of the symbol being tested.
 * @param minVisibility - The minimum visibility threshold.
 * @returns `true` if `candidate` is at least as visible as `minVisibility`.
 * @see {@link Visibility}
 * @example
 * ```typescript
 * import { meetsVisibility, Visibility } from "@forge-ts/core";
 * meetsVisibility(Visibility.Public, Visibility.Public); // true
 * meetsVisibility(Visibility.Internal, Visibility.Public); // false
 * meetsVisibility("public", "beta"); // true (string literals also accepted)
 * ```
 * @since 0.1.0
 * @public
 */
export function meetsVisibility(
	candidate: Visibility | "public" | "beta" | "internal" | "private",
	minVisibility: Visibility | "public" | "beta" | "internal" | "private",
): boolean {
	return VISIBILITY_RANK[candidate as Visibility] <= VISIBILITY_RANK[minVisibility as Visibility];
}

/**
 * Filters an array of {@link ForgeSymbol} objects to only include symbols
 * whose visibility meets or exceeds `minVisibility`.
 *
 * @remarks
 * Returns a new array — the original is not modified.
 *
 * @param symbols - The full list of symbols to filter.
 * @param minVisibility - The minimum visibility threshold to keep.
 * @returns A new array containing only symbols that pass the visibility check.
 * @see {@link meetsVisibility}
 * @see {@link ForgeSymbol}
 * @example
 * ```typescript
 * import { filterByVisibility, Visibility } from "@forge-ts/core";
 * const publicOnly = filterByVisibility(symbols, Visibility.Public);
 * ```
 * @since 0.1.0
 * @public
 */
export function filterByVisibility(
	symbols: ForgeSymbol[],
	minVisibility: Visibility | "public" | "beta" | "internal" | "private",
): ForgeSymbol[] {
	return symbols.filter((s) => meetsVisibility(s.visibility, minVisibility));
}
