import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadConfig } from "@forge-ts/core";
import {
	type AdapterContext,
	DEFAULT_TARGET,
	getAdapter,
	getAvailableTargets,
	type SSGTarget,
} from "@forge-ts/gen";
import { defineCommand } from "citty";
import { forgeLogger } from "../forge-logger.js";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";
import { buildTsdocContent } from "./init-project.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of the `init docs` command.
 *
 * @example
 * ```typescript
 * import { runInitDocs } from "@forge-ts/cli/commands/init-docs";
 * const output = await runInitDocs({ target: "mintlify" });
 * console.log(output.data.summary.filesCreated); // number of files written
 * ```
 * @public
 */
export interface InitDocsResult {
	/** Whether the scaffold succeeded. */
	success: boolean;
	/** The SSG target that was scaffolded. */
	target: SSGTarget;
	/** Summary of what was created. */
	summary: {
		/** Number of files written to disk. */
		filesCreated: number;
		/** Number of npm dependencies declared by the adapter. */
		dependencies: number;
		/** Number of package.json scripts declared by the adapter. */
		scripts: number;
	};
	/** Relative paths of all files created. */
	files: string[];
	/** Post-scaffold instructions for the user. */
	instructions: string[];
}

/**
 * Arguments for the `init docs` command.
 * @internal
 */
export interface InitDocsArgs {
	/** SSG target to scaffold. Defaults to {@link DEFAULT_TARGET}. */
	target?: string;
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Output directory for the doc site (default: outDir from config or ./docs). */
	outDir?: string;
	/** Overwrite an existing scaffold without prompting. */
	force?: boolean;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scaffolds a documentation site for the target SSG platform.
 *
 * Resolves the target from args, validates it, checks for an existing
 * scaffold, calls the adapter's `scaffold()` method, and writes all files
 * produced by the manifest to `outDir`.
 *
 * @param args - CLI arguments for the init docs command.
 * @returns A typed `CommandOutput<InitDocsResult>`.
 * @example
 * ```typescript
 * import { runInitDocs } from "@forge-ts/cli/commands/init-docs";
 * const output = await runInitDocs({ target: "mintlify", cwd: process.cwd() });
 * console.log(output.data.files); // list of created file paths
 * ```
 * @public
 */
export async function runInitDocs(args: InitDocsArgs): Promise<CommandOutput<InitDocsResult>> {
	const start = Date.now();

	// 1. Resolve target
	const rawTarget = args.target ?? DEFAULT_TARGET;
	const available = getAvailableTargets();
	if (!available.includes(rawTarget as SSGTarget)) {
		const err: ForgeCliError = {
			code: "INIT_UNKNOWN_TARGET",
			message: `Unknown SSG target "${rawTarget}". Available targets: ${available.join(", ")}`,
		};
		return {
			operation: "init.docs",
			success: false,
			data: {
				success: false,
				target: DEFAULT_TARGET,
				summary: { filesCreated: 0, dependencies: 0, scripts: 0 },
				files: [],
				instructions: [],
			},
			errors: [err],
			duration: Date.now() - start,
		};
	}

	const target = rawTarget as SSGTarget;
	const adapter = getAdapter(target);

	// 2. Load config to resolve outDir
	const config = await loadConfig(args.cwd);
	const outDir = args.outDir ? resolve(args.outDir) : config.outDir;

	// 3. Safety check: detect existing scaffold
	const alreadyExists = await adapter.detectExisting(outDir);
	if (alreadyExists && !args.force) {
		const err: ForgeCliError = {
			code: "INIT_ALREADY_EXISTS",
			message: `Docs already scaffolded for ${target}. Use --force to overwrite.`,
		};
		return {
			operation: "init.docs",
			success: false,
			data: {
				success: false,
				target,
				summary: { filesCreated: 0, dependencies: 0, scripts: 0 },
				files: [],
				instructions: [],
			},
			errors: [err],
			duration: Date.now() - start,
		};
	}

	// 4. Check for cross-target collision (any other adapter already scaffolded)
	const warnings: Array<{ code: string; message: string }> = [];
	for (const otherTarget of available) {
		if (otherTarget === target) continue;
		const otherAdapter = getAdapter(otherTarget as SSGTarget);
		const otherExists = await otherAdapter.detectExisting(outDir);
		if (otherExists) {
			warnings.push({
				code: "INIT_TARGET_MISMATCH",
				message: `Existing scaffold detected for ${otherTarget} but scaffolding for ${target}. Remove conflicting files to avoid issues.`,
			});
		}
	}

	// 5. Build AdapterContext — use an empty pages/symbols array for init
	const projectName = config.rootDir.split("/").pop() ?? "Project";
	const context: AdapterContext = {
		config,
		projectName,
		pages: [],
		symbols: [],
		outDir,
	};

	// 6. Call adapter.scaffold() to get the ScaffoldManifest
	const manifest = adapter.scaffold(context);

	// 7. Write all files from the manifest
	const writtenFiles: string[] = [];
	for (const file of manifest.files) {
		const filePath = join(outDir, file.path);
		const fileDir = filePath.substring(0, filePath.lastIndexOf("/"));
		await mkdir(fileDir, { recursive: true });
		await writeFile(filePath, file.content, "utf8");
		writtenFiles.push(file.path);
	}

	// 8. Write tsdoc.json to project root (extends @forge-ts/core/tsdoc-preset)
	if (config.tsdoc.writeConfig) {
		const tsdocPath = join(config.rootDir, "tsdoc.json");
		if (existsSync(tsdocPath)) {
			warnings.push({
				code: "INIT_TSDOC_EXISTS",
				message: "tsdoc.json already exists — skipping. Remove it and re-run to regenerate.",
			});
		} else {
			const tsdocContent = buildTsdocContent(config.tsdoc.customTags);
			await mkdir(config.rootDir, { recursive: true });
			await writeFile(tsdocPath, `${tsdocContent}\n`, "utf8");
			writtenFiles.push("tsdoc.json");
		}
	}

	const depCount =
		Object.keys(manifest.dependencies).length + Object.keys(manifest.devDependencies).length;
	const scriptCount = Object.keys(manifest.scripts).length;

	const data: InitDocsResult = {
		success: true,
		target,
		summary: {
			filesCreated: writtenFiles.length,
			dependencies: depCount,
			scripts: scriptCount,
		},
		files: writtenFiles,
		instructions: manifest.instructions,
	};

	return {
		operation: "init.docs",
		success: true,
		data,
		warnings:
			warnings.length > 0
				? warnings.map((w) => ({
						code: w.code,
						message: w.message,
						filePath: "",
						line: 0,
						column: 0,
					}))
				: undefined,
		duration: Date.now() - start,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats an InitDocsResult as human-readable text.
 * @internal
 */
function formatInitDocsHuman(result: InitDocsResult): string {
	const lines: string[] = [];

	if (!result.success) {
		return "";
	}

	const targetName = result.target.charAt(0).toUpperCase() + result.target.slice(1);
	lines.push(`\n  Scaffolding ${targetName} documentation site...\n`);

	const MAX_INLINE = 5;
	const shown = result.files.slice(0, MAX_INLINE);
	const remaining = result.files.length - shown.length;

	for (const file of shown) {
		lines.push(`  \u2713 Created ${file}`);
	}

	if (remaining > 0) {
		lines.push(`  ... (${remaining} more file${remaining !== 1 ? "s" : ""})`);
	}

	if (result.instructions.length > 0) {
		lines.push("\n  Next steps:");
		result.instructions.forEach((inst, idx) => {
			lines.push(`    ${idx + 1}. ${inst}`);
		});
	}

	lines.push(
		`\n  ${result.summary.filesCreated} file${result.summary.filesCreated !== 1 ? "s" : ""} created for ${targetName} doc site.`,
	);

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command definition
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts init docs`.
 *
 * Scaffolds a complete documentation site for the target SSG platform.
 * Use `--json` for LAFS JSON envelope output (agent/CI-friendly).
 *
 * @example
 * ```typescript
 * import { initDocsCommand } from "@forge-ts/cli/commands/init-docs";
 * // Registered automatically as a subcommand of `forge-ts init`
 * ```
 * @public
 */
export const initDocsCommand = defineCommand({
	meta: {
		name: "init",
		description: "Scaffold a documentation site",
	},
	args: {
		target: {
			type: "string",
			description: `SSG target: ${getAvailableTargets().join(", ")} (default: ${DEFAULT_TARGET})`,
		},
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		"out-dir": {
			type: "string",
			description: "Output directory for doc site (default: ./docs)",
		},
		force: {
			type: "boolean",
			description: "Overwrite existing scaffold",
			default: false,
		},
		json: {
			type: "boolean",
			description: "Output as LAFS JSON envelope",
			default: false,
		},
		human: {
			type: "boolean",
			description: "Output as formatted text",
			default: false,
		},
		quiet: {
			type: "boolean",
			description: "Suppress non-essential output",
			default: false,
		},
		mvi: {
			type: "string",
			description: "MVI verbosity level: minimal, standard, full",
		},
	},
	async run({ args }) {
		const output = await runInitDocs({
			target: args.target,
			cwd: args.cwd,
			outDir: args["out-dir"],
			force: args.force,
			mvi: args.mvi,
		});

		const flags: OutputFlags = {
			json: args.json,
			human: args.human,
			quiet: args.quiet,
			mvi: args.mvi,
		};

		emitResult(output, flags, (data, cmd) => {
			if (!cmd.success) {
				const msg = cmd.errors?.[0]?.message ?? "Scaffold failed";
				forgeLogger.error(msg);
				return "";
			}
			return formatInitDocsHuman(data);
		});

		process.exit(resolveExitCode(output));
	},
});

// ---------------------------------------------------------------------------
// Parent "init" command that exposes `forge-ts init docs`
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts init`.
 *
 * Exposes subcommands for scaffolding project artefacts.
 *
 * @example
 * ```typescript
 * import { initCommand } from "@forge-ts/cli/commands/init-docs";
 * // Registered automatically as a subcommand of `forge-ts`
 * ```
 * @public
 */
export const initCommand = defineCommand({
	meta: {
		name: "init",
		description: "Scaffold project artefacts",
	},
	subCommands: {
		docs: initDocsCommand,
	},
});
