import type { SSGAdapter, SSGTarget } from "./types.js";

/** Registry of all available SSG adapters. */
const adapters = new Map<SSGTarget, SSGAdapter>();

/**
 * Register an SSG adapter.
 * Called once per provider at module load time.
 *
 * @param adapter - The adapter to register.
 * @example
 * ```typescript
 * import { registerAdapter } from "@forge-ts/gen";
 * registerAdapter(mintlifyAdapter);
 * ```
 * @public
 */
export function registerAdapter(adapter: SSGAdapter): void {
	adapters.set(adapter.target, adapter);
}

/**
 * Get a registered adapter by target name.
 * Throws if the target is not registered.
 *
 * @param target - The SSG target identifier.
 * @returns The registered {@link SSGAdapter} for the given target.
 * @throws `Error` if the target is not registered.
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("mintlify");
 * ```
 * @public
 */
export function getAdapter(target: SSGTarget): SSGAdapter {
	const adapter = adapters.get(target);
	if (!adapter) {
		const available = [...adapters.keys()].join(", ");
		throw new Error(`Unknown SSG target "${target}". Available targets: ${available}`);
	}
	return adapter;
}

/**
 * Get all registered adapter targets.
 *
 * @returns An array of all registered {@link SSGTarget} identifiers.
 * @example
 * ```typescript
 * import { getAvailableTargets } from "@forge-ts/gen";
 * const targets = getAvailableTargets(); // ["mintlify", "docusaurus", ...]
 * ```
 * @public
 */
export function getAvailableTargets(): SSGTarget[] {
	return [...adapters.keys()];
}

/**
 * The default SSG target when none is specified.
 * @public
 */
export const DEFAULT_TARGET: SSGTarget = "mintlify";
