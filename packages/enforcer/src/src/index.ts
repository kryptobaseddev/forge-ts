/**
 * @forge-ts/enforcer — TSDoc enforcement linter.
 *
 * Walks all exported symbols and verifies that each one carries sufficient
 * TSDoc documentation at the required visibility level.
 *
 * @packageDocumentation
 * @public
 */

export { type DeprecatedUsage, findDeprecatedUsages } from "./deprecation-tracker.js";
export { enforce } from "./enforcer.js";
export { type FormatOptions, formatResults } from "./formatter.js";
