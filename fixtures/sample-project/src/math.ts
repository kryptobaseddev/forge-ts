/**
 * Adds two numbers together.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The sum of `a` and `b`.
 *
 * @example
 * ```ts
 * import { add } from "./math.js";
 * const result = add(1, 2);
 * // => 3
 * ```
 *
 * @public
 */
export function add(a: number, b: number): number {
	return a + b;
}

/**
 * Subtracts the second number from the first.
 *
 * @param a - The number to subtract from.
 * @param b - The number to subtract.
 * @returns The difference `a - b`.
 * @public
 */
export function subtract(a: number, b: number): number {
	return a - b;
}

/**
 * Multiplies two numbers.
 * @beta
 */
export function multiply(a: number, b: number): number {
	return a * b;
}

/** @internal */
export function _internalHelper(): void {}
