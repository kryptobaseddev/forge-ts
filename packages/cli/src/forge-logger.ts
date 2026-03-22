/**
 * Forge-ts branded logger built on consola from the UnJS ecosystem.
 *
 * Provides a singleton logger instance (`forgeLogger`) and a configuration
 * function (`configureLogger`) that respects CLI flags (`--quiet`, `--json`,
 * `--verbose`) and TTY detection.
 *
 * @packageDocumentation
 * @internal
 */

import { createConsola } from "consola";

// ---------------------------------------------------------------------------
// Singleton logger
// ---------------------------------------------------------------------------

/**
 * Pre-configured consola instance branded for forge-ts.
 *
 * @example
 * ```typescript
 * import { forgeLogger } from "./forge-logger.js";
 * forgeLogger.info("Checking 42 files...");
 * forgeLogger.success("All checks passed");
 * forgeLogger.warn("Deprecated import detected");
 * forgeLogger.error("Build failed");
 * forgeLogger.debug("Resolved config from forge-ts.config.ts");
 * ```
 * @internal
 */
export const forgeLogger = createConsola({
	defaults: { tag: "forge-ts" },
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Options for configuring the forge-ts logger at CLI startup.
 *
 * @internal
 */
export interface ForgeLoggerOptions {
	/** Suppress all consola output (--quiet flag). */
	quiet?: boolean;
	/** JSON output mode (--json flag). LAFS handles JSON; suppress consola. */
	json?: boolean;
	/** Enable debug-level output (--verbose flag). */
	verbose?: boolean;
}

/**
 * Configures the global {@link forgeLogger} based on CLI flags.
 *
 * Call this once at the start of a command's `run()` handler to align
 * consola's output level with the user's intent:
 *
 * - `quiet` or `json` sets level to 0 (silent) so only LAFS output appears.
 * - `verbose` sets level to 4 (debug) for maximum detail.
 * - Default level is 3 (info) which covers info, warn, error, and success.
 *
 * @param options - Flag-driven configuration.
 *
 * @example
 * ```typescript
 * import { configureLogger, forgeLogger } from "./forge-logger.js";
 * configureLogger({ quiet: args.quiet, json: args.json, verbose: args.verbose });
 * forgeLogger.info("This respects the configured level");
 * ```
 * @internal
 */
export function configureLogger(options: ForgeLoggerOptions): void {
	if (options.quiet) {
		forgeLogger.level = 0;
		return;
	}
	if (options.json) {
		// LAFS handles JSON output — suppress consola's informal logging
		forgeLogger.level = 0;
		return;
	}
	if (options.verbose) {
		forgeLogger.level = 4; // debug
		return;
	}
	// Default: info level (covers info, warn, error, success)
	forgeLogger.level = 3;
}
