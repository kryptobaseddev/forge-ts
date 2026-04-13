/**
 * TSDoc enforcement engine for TypeScript projects.
 *
 * Walks all exported symbols and applies up to 40 configurable rules that
 * verify documentation completeness, correctness, and freshness. Rules are
 * split into 20 error-level codes (E001–E020) and 20 warning-level codes
 * (W001–W020), covering summaries, parameters, return types, examples,
 * release tags, staleness detection, and CKM truthfulness.
 *
 * @remarks
 * The enforcer performs a single AST traversal via `@forge-ts/core`'s
 * `createWalker`, then applies each enabled rule to every exported symbol
 * that meets the configured `minVisibility` threshold. Individual rules can
 * be set to `"error"`, `"warn"`, or `"off"` in `forge-ts.config.ts`; setting
 * `enforce.strict: true` promotes all warnings to errors. A bypass system
 * (`forge-ts bypass`) allows temporary rule overrides within a daily budget.
 *
 * Key exports:
 * - `enforce` — Run the full enforcement pass; returns a `ForgeResult`.
 * - `formatResults` — Format a `ForgeResult` for human or JSON output.
 * - `findDeprecatedUsages` — Detect cross-package usage of `@deprecated` symbols.
 * - `FormatOptions` — Options for `formatResults` (color, groupBy, etc.).
 * - `DeprecatedUsage` — Record of a deprecated symbol referenced by another file.
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { enforce } from "@forge-ts/enforcer";
 *
 * const config = await loadConfig();
 * const result = await enforce(config);
 * console.log(result.errors.length);   // 0 when all rules pass
 * console.log(result.warnings.length); // non-fatal advisory count
 * ```
 *
 * @packageDocumentation
 * @public
 */

export { type DeprecatedUsage, findDeprecatedUsages } from "./deprecation-tracker.js";
export { enforce } from "./enforcer.js";
export { type FormatOptions, formatResults } from "./formatter.js";
