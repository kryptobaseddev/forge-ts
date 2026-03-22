/**
 * `forge-ts init hooks` command — scaffolds git hook integration.
 *
 * Detects husky or lefthook in the project and generates appropriate
 * pre-commit hook files that run `forge-ts check` on each commit.
 *
 * @packageDocumentation
 * @internal
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import { forgeLogger } from "../forge-logger.js";
import {
	type CommandOutput,
	emitResult,
	type ForgeCliWarning,
	type OutputFlags,
	resolveExitCode,
} from "../output.js";
import { addScripts, readPkgJson, writePkgJson } from "../pkg-json.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Detected hook manager in the project.
 * @public
 */
export type HookManager = "husky" | "lefthook" | "none";

/**
 * Result of the `init hooks` command.
 *
 * @example
 * ```typescript
 * import { runInitHooks } from "@forge-ts/cli/commands/init-hooks";
 * const output = await runInitHooks({ cwd: process.cwd() });
 * console.log(output.data.hookManager); // "husky" | "lefthook" | "none"
 * ```
 * @public
 */
export interface InitHooksResult {
	/** Whether the hook scaffolding succeeded. */
	success: boolean;
	/** The detected or chosen hook manager. */
	hookManager: HookManager;
	/** Summary of what was created. */
	summary: {
		/** Number of files written or updated. */
		filesWritten: number;
		/** Number of files skipped (already existed). */
		filesSkipped: number;
	};
	/** Relative paths of all files written. */
	files: string[];
	/** Post-scaffold instructions for the user. */
	instructions: string[];
}

/**
 * Arguments for the `init hooks` command.
 * @internal
 */
export interface InitHooksArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Force overwrite existing hook files. */
	force?: boolean;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/**
 * Detects which hook manager is present in the project.
 *
 * Checks for:
 * - husky: `.husky/` directory or `husky` in package.json devDependencies
 * - lefthook: `lefthook.yml` or `lefthook` in package.json devDependencies
 *
 * @param rootDir - Absolute path to the project root.
 * @returns The detected hook manager, or "none" if neither is found.
 * @public
 */
export function detectHookManager(rootDir: string): HookManager {
	// Check for husky
	const huskyDir = join(rootDir, ".husky");
	if (existsSync(huskyDir)) {
		return "husky";
	}

	// Check for lefthook
	const lefthookYml = join(rootDir, "lefthook.yml");
	if (existsSync(lefthookYml)) {
		return "lefthook";
	}

	// Check package.json devDependencies
	const pkgJsonPath = join(rootDir, "package.json");
	if (existsSync(pkgJsonPath)) {
		try {
			const raw = readFileSync(pkgJsonPath, "utf8");
			const pkg = JSON.parse(raw) as {
				devDependencies?: Record<string, string>;
				dependencies?: Record<string, string>;
			};
			const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
			if ("husky" in allDeps) return "husky";
			if ("lefthook" in allDeps) return "lefthook";
		} catch {
			// Ignore parse errors
		}
	}

	return "none";
}

// ---------------------------------------------------------------------------
// Hook content generators
// ---------------------------------------------------------------------------

/**
 * Modern husky v9+ pre-commit hook content.
 * No shebang or husky.sh source line needed — just the command.
 * @internal
 */
const HUSKY_PRE_COMMIT = `npx forge-ts check
`;

/**
 * Modern husky v9+ pre-push hook content.
 * @internal
 */
const HUSKY_PRE_PUSH = `npx forge-ts prepublish
`;

const LEFTHOOK_BLOCK = `pre-commit:
  commands:
    forge-ts-check:
      run: npx forge-ts check

pre-push:
  commands:
    forge-ts-prepublish:
      run: npx forge-ts prepublish
`;

/**
 * Generates the husky pre-commit hook file content (modern husky v9+).
 * @internal
 */
export function generateHuskyHook(): string {
	return HUSKY_PRE_COMMIT;
}

/**
 * Generates the husky pre-push hook file content (modern husky v9+).
 * @internal
 */
export function generateHuskyPrePushHook(): string {
	return HUSKY_PRE_PUSH;
}

/**
 * Generates the lefthook block with both pre-commit and pre-push sections.
 * @internal
 */
export function generateLefthookBlock(): string {
	return LEFTHOOK_BLOCK;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scaffolds git hook integration for the project.
 *
 * Detects the hook manager (husky or lefthook), generates appropriate
 * hook files, and reports what was written.
 *
 * @param args - CLI arguments for the init hooks command.
 * @returns A typed `CommandOutput<InitHooksResult>`.
 * @example
 * ```typescript
 * import { runInitHooks } from "@forge-ts/cli/commands/init-hooks";
 * const output = await runInitHooks({ cwd: "/my/project" });
 * console.log(output.data.files); // [".husky/pre-commit"]
 * ```
 * @public
 */
export async function runInitHooks(args: InitHooksArgs): Promise<CommandOutput<InitHooksResult>> {
	const start = Date.now();
	const rootDir = args.cwd ?? process.cwd();

	const hookManager = detectHookManager(rootDir);
	const writtenFiles: string[] = [];
	const skippedFiles: string[] = [];
	const warnings: ForgeCliWarning[] = [];
	const instructions: string[] = [];

	if (hookManager === "husky" || hookManager === "none") {
		// -----------------------------------------------------------------
		// Check if husky is installed
		// -----------------------------------------------------------------
		const huskyBin = join(rootDir, "node_modules", ".bin", "husky");
		const pkg = readPkgJson(rootDir);
		const huskyInDeps =
			pkg !== null &&
			("husky" in ((pkg.obj.devDependencies as Record<string, string>) ?? {}) ||
				"husky" in ((pkg.obj.dependencies as Record<string, string>) ?? {}));
		const huskyInstalled = existsSync(huskyBin) || huskyInDeps;

		if (!huskyInstalled) {
			warnings.push({
				code: "HOOKS_HUSKY_NOT_INSTALLED",
				message: "husky not installed. Run: npm install -D husky",
			});
			instructions.push("husky is not installed. Run: npm install -D husky (or pnpm add -D husky)");
		}

		// -----------------------------------------------------------------
		// Write pre-commit hook (.husky/pre-commit)
		// -----------------------------------------------------------------
		const huskyDir = join(rootDir, ".husky");
		const preCommitPath = join(huskyDir, "pre-commit");
		const preCommitRel = ".husky/pre-commit";

		if (existsSync(preCommitPath) && !args.force) {
			const existing = await readFile(preCommitPath, "utf8");
			if (existing.includes("forge-ts check")) {
				skippedFiles.push(preCommitRel);
				warnings.push({
					code: "HOOKS_ALREADY_EXISTS",
					message: `${preCommitRel} already contains forge-ts check — skipping. Use --force to overwrite.`,
				});
			} else {
				// Append to existing hook
				const appended = `${existing.trimEnd()}\n\nnpx forge-ts check\n`;
				await writeFile(preCommitPath, appended, { mode: 0o755 });
				writtenFiles.push(preCommitRel);
			}
		} else {
			await mkdir(huskyDir, { recursive: true });
			await writeFile(preCommitPath, HUSKY_PRE_COMMIT, { mode: 0o755 });
			writtenFiles.push(preCommitRel);
		}

		// -----------------------------------------------------------------
		// Write pre-push hook (.husky/pre-push)
		// -----------------------------------------------------------------
		const prePushPath = join(huskyDir, "pre-push");
		const prePushRel = ".husky/pre-push";

		if (existsSync(prePushPath) && !args.force) {
			const existing = await readFile(prePushPath, "utf8");
			if (existing.includes("forge-ts prepublish")) {
				skippedFiles.push(prePushRel);
				warnings.push({
					code: "HOOKS_ALREADY_EXISTS",
					message: `${prePushRel} already contains forge-ts prepublish — skipping. Use --force to overwrite.`,
				});
			} else {
				const appended = `${existing.trimEnd()}\n\nnpx forge-ts prepublish\n`;
				await writeFile(prePushPath, appended, { mode: 0o755 });
				writtenFiles.push(prePushRel);
			}
		} else {
			await mkdir(huskyDir, { recursive: true });
			await writeFile(prePushPath, HUSKY_PRE_PUSH, { mode: 0o755 });
			writtenFiles.push(prePushRel);
		}

		// -----------------------------------------------------------------
		// Add `prepare` script to package.json (idempotent)
		// -----------------------------------------------------------------
		const pkgData = readPkgJson(rootDir);
		if (pkgData) {
			const added = addScripts(pkgData, { prepare: "husky" });
			if (added.length > 0) {
				await writePkgJson(pkgData);
				writtenFiles.push("package.json (prepare script)");
				instructions.push('Added "prepare": "husky" script to package.json.');
			} else {
				skippedFiles.push("package.json (prepare script already exists)");
			}
		}

		if (hookManager === "none") {
			instructions.push(
				"No hook manager detected. Wrote .husky/pre-commit and .husky/pre-push as a starting point.",
				"Install husky to activate: npm install -D husky && npx husky (or pnpm add -D husky && pnpm exec husky)",
			);
		} else {
			instructions.push("Husky pre-commit hook configured to run forge-ts check.");
			instructions.push("Husky pre-push hook configured to run forge-ts prepublish.");
		}
	} else if (hookManager === "lefthook") {
		const lefthookPath = join(rootDir, "lefthook.yml");
		const relativePath = "lefthook.yml";

		if (existsSync(lefthookPath)) {
			const existing = await readFile(lefthookPath, "utf8");
			const hasCheck = existing.includes("forge-ts check");
			const hasPrepublish = existing.includes("forge-ts prepublish");

			if (hasCheck && hasPrepublish && !args.force) {
				skippedFiles.push(relativePath);
				warnings.push({
					code: "HOOKS_ALREADY_EXISTS",
					message: `${relativePath} already contains forge-ts check and prepublish — skipping. Use --force to overwrite.`,
				});
			} else if (hasCheck && !hasPrepublish && !args.force) {
				// Add pre-push block
				const prePushBlock = `\npre-push:\n  commands:\n    forge-ts-prepublish:\n      run: npx forge-ts prepublish\n`;
				const appended = `${existing.trimEnd()}\n${prePushBlock}`;
				await writeFile(lefthookPath, appended, "utf8");
				writtenFiles.push(relativePath);
			} else if (existing.includes("pre-commit:") && !args.force) {
				// Append our commands under the existing sections
				let appended = existing.trimEnd();
				if (!hasCheck) {
					appended += "\n    forge-ts-check:\n      run: npx forge-ts check";
				}
				if (!existing.includes("pre-push:")) {
					appended += `\n\npre-push:\n  commands:\n    forge-ts-prepublish:\n      run: npx forge-ts prepublish\n`;
				} else if (!hasPrepublish) {
					appended += "\n    forge-ts-prepublish:\n      run: npx forge-ts prepublish";
				}
				appended += "\n";
				await writeFile(lefthookPath, appended, "utf8");
				writtenFiles.push(relativePath);
			} else {
				// Append the full block
				const appended = `${existing.trimEnd()}\n\n${LEFTHOOK_BLOCK}`;
				await writeFile(lefthookPath, appended, "utf8");
				writtenFiles.push(relativePath);
			}
		} else {
			await writeFile(lefthookPath, LEFTHOOK_BLOCK, "utf8");
			writtenFiles.push(relativePath);
		}

		instructions.push("Lefthook pre-commit hook configured to run forge-ts check.");
		instructions.push("Lefthook pre-push hook configured to run forge-ts prepublish.");
	}

	const data: InitHooksResult = {
		success: true,
		hookManager,
		summary: {
			filesWritten: writtenFiles.length,
			filesSkipped: skippedFiles.length,
		},
		files: writtenFiles,
		instructions,
	};

	return {
		operation: "init.hooks",
		success: true,
		data,
		warnings: warnings.length > 0 ? warnings : undefined,
		duration: Date.now() - start,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Formats an InitHooksResult as human-readable text.
 * @internal
 */
function formatInitHooksHuman(result: InitHooksResult): string {
	const lines: string[] = [];

	const managerName = result.hookManager === "none" ? "husky (default)" : result.hookManager;
	lines.push(`\n  Configuring git hooks (${managerName})...\n`);

	for (const file of result.files) {
		lines.push(`  \u2713 ${file}`);
	}

	if (result.summary.filesSkipped > 0) {
		lines.push(`  (${result.summary.filesSkipped} file(s) skipped — already configured)`);
	}

	if (result.instructions.length > 0) {
		lines.push("\n  Next steps:");
		for (const [idx, inst] of result.instructions.entries()) {
			lines.push(`    ${idx + 1}. ${inst}`);
		}
	}

	lines.push(`\n  ${result.summary.filesWritten} file(s) written.`);

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command definition
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts init hooks`.
 *
 * Scaffolds git hook integration for the project by detecting the
 * hook manager (husky or lefthook) and generating pre-commit hooks.
 *
 * @example
 * ```typescript
 * import { initHooksCommand } from "@forge-ts/cli/commands/init-hooks";
 * // Registered as a subcommand of `forge-ts init`
 * ```
 * @public
 */
export const initHooksCommand = defineCommand({
	meta: {
		name: "hooks",
		description: "Scaffold git hook integration (husky/lefthook)",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		force: {
			type: "boolean",
			description: "Overwrite existing hook files",
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
		const output = await runInitHooks({
			cwd: args.cwd,
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
				const msg = cmd.errors?.[0]?.message ?? "Hook scaffolding failed";
				forgeLogger.error(msg);
				return "";
			}
			return formatInitHooksHuman(data);
		});

		process.exit(resolveExitCode(output));
	},
});
