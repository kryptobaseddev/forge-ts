/**
 * @codluv/forge-enforcer — TSDoc enforcement linter.
 *
 * Walks all exported symbols and verifies that each one carries sufficient
 * TSDoc documentation at the required visibility level.
 *
 * @packageDocumentation
 * @public
 */

export { enforce } from "./enforcer.js";
export { type FormatOptions, formatResults } from "./formatter.js";
