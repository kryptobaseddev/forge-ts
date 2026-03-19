import { add, multiply, subtract } from "./math.js";

/**
 * Get a calculator result.
 *
 * @route GET /calculate/{operation}
 * @param operation - The math operation to perform.
 * @param a - First operand.
 * @param b - Second operand.
 * @returns The calculation result.
 * @throws {@link Error} if the operation is not supported.
 * @public
 */
export function calculate(operation: string, a: number, b: number): number {
	switch (operation) {
		case "add":
			return add(a, b);
		case "subtract":
			return subtract(a, b);
		case "multiply":
			return multiply(a, b);
		case "divide":
			return b !== 0 ? a / b : 0;
		default:
			throw new Error(`Unsupported operation: ${operation}`);
	}
}
