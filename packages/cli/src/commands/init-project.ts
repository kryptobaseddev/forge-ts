/**
 * `forge-ts init` command — full project setup.
 *
 * Detects the project environment, writes default config files, validates
 * tsconfig/package.json, and prints a summary with next steps.
 *
 * @packageDocumentation
 * @internal
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import { createLogger } from "../logger.js";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliError,
	type ForgeCliWarning,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Detected project environment from Step 1 of the init flow.
 *
 * @public
 */
export interface InitProjectEnvironment {
	/** Whether package.json exists. */
	packageJsonExists: boolean;
	/** Whether tsconfig.json exists. */
	tsconfigExists: boolean;
	/** Whether biome.json or biome.jsonc exists. */
	biomeDetected: boolean;
	/** TypeScript version from dependencies, or null if not found. */
	typescriptVersion: string | null;
	/** Detected hook manager. */
	hookManager: "husky" | "lefthook" | "none";
	/** Whether the project is a monorepo. */
	monorepo: boolean;
	/** Monorepo type if detected. */
	monorepoType: "pnpm" | "npm/yarn" | null;
}

/**
 * Result of the `init` (project setup) command.
 *
 * @example
 * ```typescript
 * import { runInitProject } from "@forge-ts/cli/commands/init-project";
 * const output = await runInitProject({ cwd: process.cwd() });
 * console.log(output.data.created); // list of created files
 * ```
 * @public
 */
export interface InitProjectResult {
	/** Whether the init succeeded. */
	success: boolean;
	/** Files that were created. */
	created: string[];
	/** Files that already existed and were skipped. */
	skipped: string[];
	/** Warning messages collected during init. */
	warnings: string[];
	/** Detected project environment. */
	environment: InitProjectEnvironment;
	/** Next steps for the user. */
	nextSteps: string[];
}

/**
 * Arguments for the `init` (project setup) command.
 * @internal
 */
export interface InitProjectArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads and parses a package.json file.
 * @internal
 */
interface PackageJsonShape {
	type?: string;
	engines?: { node?: string };
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	workspaces?: string[] | { packages: string[] };
}

/**
 * Safely reads and parses a JSON file.
 * @internal
 */
function readJsonSafe<T>(filePath: string): T | null {
	if (!existsSync(filePath)) {
		return null;
	}
	try {
		const raw = readFileSync(filePath, "utf8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/**
 * Detects the project environment by checking for files and dependencies.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns The detected environment.
 * @internal
 */
export function detectEnvironment(rootDir: string): InitProjectEnvironment {
	const packageJsonPath = join(rootDir, "package.json");
	const tsconfigPath = join(rootDir, "tsconfig.json");
	const biomePath = join(rootDir, "biome.json");
	const biomecPath = join(rootDir, "biome.jsonc");
	const pnpmWorkspacePath = join(rootDir, "pnpm-workspace.yaml");
	const huskyDir = join(rootDir, ".husky");
	const lefthookYml = join(rootDir, "lefthook.yml");

	const packageJsonExists = existsSync(packageJsonPath);
	const tsconfigExists = existsSync(tsconfigPath);
	const biomeDetected = existsSync(biomePath) || existsSync(biomecPath);

	// TypeScript version detection
	let typescriptVersion: string | null = null;
	if (packageJsonExists) {
		const pkg = readJsonSafe<PackageJsonShape>(packageJsonPath);
		if (pkg) {
			const tsVersion =
				pkg.devDependencies?.typescript ?? pkg.dependencies?.typescript ?? null;
			typescriptVersion = tsVersion;
		}
	}

	// Hook manager detection
	let hookManager: "husky" | "lefthook" | "none" = "none";
	if (existsSync(huskyDir)) {
		hookManager = "husky";
	} else if (existsSync(lefthookYml)) {
		hookManager = "lefthook";
	} else if (packageJsonExists) {
		const pkg = readJsonSafe<PackageJsonShape>(packageJsonPath);
		if (pkg) {
			const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
			if ("husky" in allDeps) {
				hookManager = "husky";
			} else if ("lefthook" in allDeps) {
				hookManager = "lefthook";
			}
		}
	}

	// Monorepo detection
	let monorepo = false;
	let monorepoType: "pnpm" | "npm/yarn" | null = null;
	if (existsSync(pnpmWorkspacePath)) {
		monorepo = true;
		monorepoType = "pnpm";
	} else if (packageJsonExists) {
		const pkg = readJsonSafe<PackageJsonShape>(packageJsonPath);
		if (pkg?.workspaces) {
			monorepo = true;
			monorepoType = "npm/yarn";
		}
	}

	return {
		packageJsonExists,
		tsconfigExists,
		biomeDetected,
		typescriptVersion,
		hookManager,
		monorepo,
		monorepoType,
	};
}

// ---------------------------------------------------------------------------
// Config file content
// ---------------------------------------------------------------------------

/**
 * Default forge-ts.config.ts content for new projects.
 * @internal
 */
const DEFAULT_CONFIG_CONTENT = `import { defineConfig } from "@forge-ts/core";

export default defineConfig({
  rootDir: ".",
  tsconfig: "tsconfig.json",
  outDir: "docs/generated",
  enforce: {
    enabled: true,
    minVisibility: "public",
    strict: false,
  },
  gen: {
    enabled: true,
    formats: ["mdx"],
    llmsTxt: true,
    readmeSync: false,
    ssgTarget: "mintlify",
  },
});
`;

/**
 * Default tsdoc.json content.
 * @internal
 */
const DEFAULT_TSDOC_CONTENT = JSON.stringify(
	{
		$schema:
			"https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
		extends: ["@forge-ts/tsdoc-config/tsdoc.json"],
	},
	null,
	"\t",
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full project init flow.
 *
 * Steps:
 * 1. Detect project environment
 * 2. Write forge-ts.config.ts (if not exists)
 * 3. Write tsdoc.json (if not exists)
 * 4. Validate tsconfig.json strictness
 * 5. Validate package.json
 * 6. Report summary
 *
 * @param args - CLI arguments for the init command.
 * @returns A typed `CommandOutput<InitProjectResult>`.
 * @example
 * ```typescript
 * import { runInitProject } from "@forge-ts/cli/commands/init-project";
 * const output = await runInitProject({ cwd: process.cwd() });
 * console.log(output.data.created); // ["forge-ts.config.ts", "tsdoc.json"]
 * ```
 * @public
 */
export async function runInitProject(
	args: InitProjectArgs,
): Promise<CommandOutput<InitProjectResult>> {
	const start = Date.now();
	const rootDir = args.cwd ?? process.cwd();

	const created: string[] = [];
	const skipped: string[] = [];
	const warnings: string[] = [];
	const cliWarnings: ForgeCliWarning[] = [];

	// -----------------------------------------------------------------------
	// Step 1: Detect project environment
	// -----------------------------------------------------------------------

	const environment = detectEnvironment(rootDir);

	if (!environment.packageJsonExists) {
		const err: ForgeCliError = {
			code: "INIT_NO_PACKAGE_JSON",
			message:
				"package.json not found. Run `npm init` or `pnpm init` first.",
		};
		return {
			operation: "init",
			success: false,
			data: {
				success: false,
				created: [],
				skipped: [],
				warnings: [],
				environment,
				nextSteps: [],
			},
			errors: [err],
			duration: Date.now() - start,
		};
	}

	if (!environment.tsconfigExists) {
		warnings.push("tsconfig.json not found. forge-ts requires TypeScript.");
		cliWarnings.push({
			code: "INIT_NO_TSCONFIG",
			message:
				"tsconfig.json not found. forge-ts requires TypeScript.",
		});
	}

	if (!environment.biomeDetected) {
		// Informational — not a warning
	}

	// -----------------------------------------------------------------------
	// Step 2: Write forge-ts.config.ts
	// -----------------------------------------------------------------------

	const configPath = join(rootDir, "forge-ts.config.ts");
	if (existsSync(configPath)) {
		skipped.push("forge-ts.config.ts");
	} else {
		await mkdir(rootDir, { recursive: true });
		await writeFile(configPath, DEFAULT_CONFIG_CONTENT, "utf8");
		created.push("forge-ts.config.ts");
	}

	// -----------------------------------------------------------------------
	// Step 3: Write tsdoc.json
	// -----------------------------------------------------------------------

	const tsdocPath = join(rootDir, "tsdoc.json");
	if (existsSync(tsdocPath)) {
		skipped.push("tsdoc.json");
	} else {
		await writeFile(tsdocPath, `${DEFAULT_TSDOC_CONTENT}\n`, "utf8");
		created.push("tsdoc.json");
	}

	// -----------------------------------------------------------------------
	// Step 4: Validate tsconfig.json strictness
	// -----------------------------------------------------------------------

	if (environment.tsconfigExists) {
		const tsconfigPath = join(rootDir, "tsconfig.json");
		const tsconfig = readJsonSafe<{
			compilerOptions?: { strict?: boolean };
		}>(tsconfigPath);

		if (tsconfig) {
			if (
				!tsconfig.compilerOptions ||
				tsconfig.compilerOptions.strict !== true
			) {
				warnings.push(
					"tsconfig.json: 'strict' is not enabled. forge-ts recommends strict mode.",
				);
				cliWarnings.push({
					code: "INIT_TSCONFIG_NOT_STRICT",
					message:
						"tsconfig.json: 'strict' is not enabled. forge-ts recommends strict mode.",
				});
			}
		}
	}

	// -----------------------------------------------------------------------
	// Step 5: Validate package.json
	// -----------------------------------------------------------------------

	const pkgPath = join(rootDir, "package.json");
	const pkg = readJsonSafe<PackageJsonShape>(pkgPath);

	if (pkg) {
		if (pkg.type !== "module") {
			warnings.push(
				'package.json: missing "type": "module". forge-ts uses ESM.',
			);
			cliWarnings.push({
				code: "INIT_NO_ESM",
				message:
					'package.json: missing "type": "module". forge-ts uses ESM.',
			});
		}

		if (!pkg.engines?.node) {
			warnings.push("package.json: missing engines.node field.");
			cliWarnings.push({
				code: "INIT_NO_ENGINES",
				message: "package.json: missing engines.node field.",
			});
		}

		const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
		if (!("@forge-ts/cli" in allDeps)) {
			warnings.push(
				"package.json: @forge-ts/cli not in devDependencies (running via npx?).",
			);
			cliWarnings.push({
				code: "INIT_CLI_NOT_INSTALLED",
				message:
					"package.json: @forge-ts/cli not in devDependencies (running via npx?).",
			});
		}
	}

	// -----------------------------------------------------------------------
	// Step 6: Build result
	// -----------------------------------------------------------------------

	const nextSteps: string[] = [
		"Run: forge-ts check      (lint TSDoc coverage)",
		"Run: forge-ts init docs   (scaffold documentation site)",
		"Run: forge-ts init hooks  (scaffold pre-commit hooks)",
		"Run: forge-ts lock        (lock config to prevent drift)",
	];

	const data: InitProjectResult = {
		success: true,
		created,
		skipped,
		warnings,
		environment,
		nextSteps,
	};

	return {
		operation: "init",
		success: true,
		data,
		warnings: cliWarnings.length > 0 ? cliWarnings : undefined,
		duration: Date.now() - start,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats an InitProjectResult as human-readable text.
 * @internal
 */
function formatInitProjectHuman(result: InitProjectResult): string {
	const lines: string[] = [];

	lines.push("\nforge-ts init: project setup complete\n");

	// Created files
	if (result.created.length > 0) {
		lines.push("  Created:");
		for (const file of result.created) {
			lines.push(`    ${file}`);
		}
	}

	// Skipped files
	if (result.skipped.length > 0) {
		lines.push("");
		lines.push("  Already exists (skipped):");
		for (const file of result.skipped) {
			lines.push(`    ${file}`);
		}
	} else if (result.created.length > 0) {
		lines.push("");
		lines.push("  Already exists (skipped):");
		lines.push("    (none)");
	}

	// Warnings
	if (result.warnings.length > 0) {
		lines.push("");
		lines.push("  Warnings:");
		for (const warning of result.warnings) {
			lines.push(`    ${warning}`);
		}
	}

	// Environment
	const env = result.environment;
	lines.push("");
	lines.push("  Environment:");
	lines.push(
		`    TypeScript: ${env.typescriptVersion ?? "not detected"}`,
	);
	lines.push(
		`    Biome: ${env.biomeDetected ? "detected" : "not detected"}`,
	);

	const hookLabel =
		env.hookManager === "none" ? "not detected" : `${env.hookManager} detected`;
	lines.push(`    Git hooks: ${hookLabel}`);

	if (env.monorepo) {
		lines.push(
			`    Monorepo: ${env.monorepoType === "pnpm" ? "pnpm workspaces" : "npm/yarn workspaces"}`,
		);
	} else {
		lines.push("    Monorepo: no");
	}

	// Next steps
	if (result.nextSteps.length > 0) {
		lines.push("");
		lines.push("  Next steps:");
		for (const [idx, step] of result.nextSteps.entries()) {
			lines.push(`    ${idx + 1}. ${step}`);
		}
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command definition
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts init` (bare — full project setup).
 *
 * Detects the project environment, writes default configuration files,
 * validates tsconfig/package.json, and reports a summary.
 *
 * @example
 * ```typescript
 * import { initProjectCommand } from "@forge-ts/cli/commands/init-project";
 * // Registered as the default handler for `forge-ts init`
 * ```
 * @public
 */
export const initProjectCommand = defineCommand({
	meta: {
		name: "init",
		description: "Full project setup for forge-ts",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
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
		const output = await runInitProject({
			cwd: args.cwd,
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
				const logger = createLogger();
				const msg = cmd.errors?.[0]?.message ?? "Init failed";
				logger.error(msg);
				return "";
			}
			return formatInitProjectHuman(data);
		});

		process.exit(resolveExitCode(output));
	},
});
