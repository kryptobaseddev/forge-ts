/**
 * The `forge-ts docs dev` command — starts a local doc preview server.
 *
 * Reads the ssgTarget from forge-ts config, looks up the adapter,
 * and spawns the correct dev server automatically.
 *
 * @packageDocumentation
 * @public
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { loadConfig } from "@forge-ts/core";
import { DEFAULT_TARGET, getAdapter, type SSGTarget } from "@forge-ts/gen";
import { defineCommand } from "citty";
import { createLogger } from "../logger.js";

/**
 * Starts the local dev server for the configured SSG target.
 *
 * Reads `gen.ssgTarget` from the forge-ts config, resolves the adapter,
 * and spawns the platform's dev server in the output directory.
 *
 * @param args - Command arguments.
 * @returns A promise that resolves when the server exits.
 *
 * @example
 * ```typescript
 * import { runDocsDev } from "@forge-ts/cli";
 * await runDocsDev({ cwd: "./my-project" });
 * ```
 * @public
 */
export async function runDocsDev(args: {
	/** Project root directory. */
	cwd?: string;
	/** Override the SSG target from config. */
	target?: string;
	/** Port to run the dev server on. */
	port?: string;
}): Promise<void> {
	const logger = createLogger();
	const config = await loadConfig(args.cwd);
	const target = (args.target ?? config.gen.ssgTarget ?? DEFAULT_TARGET) as SSGTarget;
	const adapter = getAdapter(target);
	const outDir = resolve(config.outDir);
	const devCmd = adapter.getDevCommand(outDir);

	logger.info(`Starting ${devCmd.label}...`);
	logger.info(`  Target: ${target}`);
	logger.info(`  Directory: ${outDir}`);
	logger.info(`  URL: ${devCmd.url}`);
	logger.info("");

	const spawnArgs = [...devCmd.args];
	if (args.port) {
		spawnArgs.push("--port", args.port);
	}

	const proc = spawn(devCmd.bin, spawnArgs, {
		cwd: devCmd.cwd,
		stdio: "inherit",
		shell: true,
	});

	return new Promise<void>((_resolve, reject) => {
		proc.on("close", (code) => {
			if (code === 0) {
				_resolve();
			} else {
				reject(new Error(`${devCmd.label} exited with code ${code}`));
			}
		});
		proc.on("error", reject);
	});
}

/**
 * Citty command definition for `forge-ts docs dev`.
 *
 * @example
 * ```typescript
 * import { docsDevCommand } from "@forge-ts/cli";
 * ```
 * @public
 */
export const docsDevCommand = defineCommand({
	meta: {
		name: "dev",
		description: "Start a local doc preview server",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		target: {
			type: "string",
			description: "SSG target override (reads from config by default)",
		},
		port: {
			type: "string",
			description: "Port for the dev server",
		},
	},
	async run({ args }) {
		await runDocsDev(args);
	},
});
