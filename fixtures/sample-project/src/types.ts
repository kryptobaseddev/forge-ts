/**
 * Configuration for the calculator.
 *
 * @example
 * ```ts
 * const config: CalculatorConfig = {
 *   precision: 2,
 *   mode: "standard",
 * };
 * ```
 *
 * @public
 */
export interface CalculatorConfig {
	/** Number of decimal places. */
	precision: number;
	/** Calculator mode. */
	mode: "standard" | "scientific";
	/** Optional label. */
	label?: string;
}

/**
 * Supported operations.
 * @public
 */
export enum Operation {
	Add = "add",
	Subtract = "subtract",
	Multiply = "multiply",
	Divide = "divide",
}

/**
 * @deprecated Use `CalculatorConfig` instead.
 * @public
 */
export type LegacyConfig = {
	precision: number;
};
