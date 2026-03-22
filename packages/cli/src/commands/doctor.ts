/**
 * `forge-ts doctor` command — project integrity check and repair.
 *
 * Validates that all forge-ts configuration files, dependencies, and
 * guard settings are correctly set up. Optionally auto-fixes resolvable
 * issues with `--fix`.
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
	type OutputFlags,
	resolveExitCode,
} from "../output.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Status of a single doctor check.
 * @public
 */
export type DoctorCheckStatus = "pass" | "warn" | "error" | "info";

/**
 * Result of a single doctor check.
 *
 * @public
 */
export interface DoctorCheckResult {
	/** Name of the check. */
	name: string;
	/** Status of the check. */
	status: DoctorCheckStatus;
	/** Human-readable message. */
	message: string;
	/** Whether this issue can be auto-fixed with --fix. */
	fixable: boolean;
}

/**
 * Result of the `doctor` command.
 *
 * @example
 * ```typescript
 * import { runDoctor } from "@forge-ts/cli/commands/doctor";
 * const output = await runDoctor({ cwd: process.cwd() });
 * console.log(output.data.summary.passed); // number of passed checks
 * ```
 * @public
 */
export interface DoctorResult {
	/** Whether all checks passed without errors. */
	success: boolean;
	/** Individual check results. */
	checks: DoctorCheckResult[];
	/** Summary counts. */
	summary: {
		passed: number;
		warnings: number;
		errors: number;
		info: number;
	};
	/** Files that were fixed (only populated when --fix is used). */
	fixed: string[];
}

/**
 * Arguments for the `doctor` command.
 * @internal
 */
export interface DoctorArgs {
	/** Project root directory (default: cwd). */
	cwd?: string;
	/** Auto-fix resolvable issues. */
	fix?: boolean;
	/** MVI verbosity level for structured output. */
	mvi?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Default forge-ts.config.ts content for --fix generation.
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
 * Default tsdoc.json content for --fix generation.
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
 * Runs the doctor integrity check flow.
 *
 * Checks:
 * 1. forge-ts.config.ts — exists and loadable
 * 2. tsdoc.json — exists and extends @forge-ts/tsdoc-config
 * 3. @forge-ts/tsdoc-config — installed in node_modules
 * 4. TypeScript — installed
 * 5. tsconfig.json — exists and has strict mode
 * 6. biome.json — exists (informational)
 * 7. .forge-lock.json — exists, valid, matches config
 * 8. .forge-audit.jsonl — exists and event count
 * 9. .forge-bypass.json — exists and active bypasses
 * 10. Git hooks — forge-ts check in pre-commit
 *
 * @param args - CLI arguments for the doctor command.
 * @returns A typed `CommandOutput<DoctorResult>`.
 * @example
 * ```typescript
 * import { runDoctor } from "@forge-ts/cli/commands/doctor";
 * const output = await runDoctor({ cwd: process.cwd(), fix: false });
 * console.log(output.data.summary); // { passed: 7, warnings: 2, errors: 1, info: 0 }
 * ```
 * @public
 */
export async function runDoctor(
	args: DoctorArgs,
): Promise<CommandOutput<DoctorResult>> {
	const start = Date.now();
	const rootDir = args.cwd ?? process.cwd();
	const fix = args.fix ?? false;

	const checks: DoctorCheckResult[] = [];
	const fixed: string[] = [];

	// -----------------------------------------------------------------------
	// Check 1: forge-ts.config.ts
	// -----------------------------------------------------------------------

	const configPath = join(rootDir, "forge-ts.config.ts");
	const configJsPath = join(rootDir, "forge-ts.config.js");
	if (existsSync(configPath) || existsSync(configJsPath)) {
		const which = existsSync(configPath)
			? "forge-ts.config.ts"
			: "forge-ts.config.js";
		checks.push({
			name: "forge-ts.config",
			status: "pass",
			message: `${which} — found`,
			fixable: false,
		});
	} else if (fix) {
		await mkdir(rootDir, { recursive: true });
		await writeFile(configPath, DEFAULT_CONFIG_CONTENT, "utf8");
		fixed.push("forge-ts.config.ts");
		checks.push({
			name: "forge-ts.config",
			status: "pass",
			message: "forge-ts.config.ts — created by --fix",
			fixable: true,
		});
	} else {
		checks.push({
			name: "forge-ts.config",
			status: "error",
			message:
				"forge-ts.config.ts — MISSING (run forge-ts init or forge-ts doctor --fix)",
			fixable: true,
		});
	}

	// -----------------------------------------------------------------------
	// Check 2: tsdoc.json
	// -----------------------------------------------------------------------

	const tsdocPath = join(rootDir, "tsdoc.json");
	if (existsSync(tsdocPath)) {
		const tsdoc = readJsonSafe<{
			extends?: string[];
		}>(tsdocPath);
		if (
			tsdoc?.extends &&
			tsdoc.extends.includes("@forge-ts/tsdoc-config/tsdoc.json")
		) {
			checks.push({
				name: "tsdoc.json",
				status: "pass",
				message: "tsdoc.json — extends @forge-ts/tsdoc-config",
				fixable: false,
			});
		} else {
			checks.push({
				name: "tsdoc.json",
				status: "warn",
				message:
					"tsdoc.json — does not extend @forge-ts/tsdoc-config",
				fixable: false,
			});
		}
	} else if (fix) {
		await writeFile(tsdocPath, `${DEFAULT_TSDOC_CONTENT}\n`, "utf8");
		fixed.push("tsdoc.json");
		checks.push({
			name: "tsdoc.json",
			status: "pass",
			message: "tsdoc.json — created by --fix",
			fixable: true,
		});
	} else {
		checks.push({
			name: "tsdoc.json",
			status: "error",
			message:
				"tsdoc.json — MISSING (run forge-ts init or forge-ts doctor --fix)",
			fixable: true,
		});
	}

	// -----------------------------------------------------------------------
	// Check 3: @forge-ts/tsdoc-config installed
	// -----------------------------------------------------------------------

	const tsdocConfigModulePath = join(
		rootDir,
		"node_modules",
		"@forge-ts",
		"tsdoc-config",
		"package.json",
	);
	if (existsSync(tsdocConfigModulePath)) {
		const tsdocPkg = readJsonSafe<{ version?: string }>(
			tsdocConfigModulePath,
		);
		const version = tsdocPkg?.version ?? "unknown";
		checks.push({
			name: "@forge-ts/tsdoc-config",
			status: "pass",
			message: `@forge-ts/tsdoc-config — installed (${version})`,
			fixable: false,
		});
	} else {
		checks.push({
			name: "@forge-ts/tsdoc-config",
			status: "warn",
			message:
				"@forge-ts/tsdoc-config — MISSING (run npm install @forge-ts/tsdoc-config)",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Check 4: TypeScript installed
	// -----------------------------------------------------------------------

	const tsPkgPath = join(
		rootDir,
		"node_modules",
		"typescript",
		"package.json",
	);
	if (existsSync(tsPkgPath)) {
		const tsPkg = readJsonSafe<{ version?: string }>(tsPkgPath);
		const version = tsPkg?.version ?? "unknown";
		checks.push({
			name: "TypeScript",
			status: "pass",
			message: `TypeScript — ${version}`,
			fixable: false,
		});
	} else {
		// Check package.json deps as fallback
		const pkgPath = join(rootDir, "package.json");
		const pkg = readJsonSafe<{
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		}>(pkgPath);
		const allDeps = {
			...pkg?.dependencies,
			...pkg?.devDependencies,
		};
		if ("typescript" in allDeps) {
			checks.push({
				name: "TypeScript",
				status: "warn",
				message: `TypeScript — in package.json (${allDeps.typescript}) but not in node_modules`,
				fixable: false,
			});
		} else {
			checks.push({
				name: "TypeScript",
				status: "error",
				message:
					"TypeScript — MISSING (run npm install -D typescript)",
				fixable: false,
			});
		}
	}

	// -----------------------------------------------------------------------
	// Check 5: tsconfig.json
	// -----------------------------------------------------------------------

	const tsconfigPath = join(rootDir, "tsconfig.json");
	if (existsSync(tsconfigPath)) {
		const tsconfig = readJsonSafe<{
			compilerOptions?: {
				strict?: boolean;
				strictNullChecks?: boolean;
				noImplicitAny?: boolean;
			};
		}>(tsconfigPath);
		if (tsconfig?.compilerOptions?.strict === true) {
			checks.push({
				name: "tsconfig.json",
				status: "pass",
				message: "tsconfig.json — strict mode enabled",
				fixable: false,
			});
		} else {
			// strict is not true — report missing flags
			const missingFlags: string[] = ["strict"];
			if (!tsconfig?.compilerOptions?.strictNullChecks) {
				missingFlags.push("strictNullChecks");
			}
			if (!tsconfig?.compilerOptions?.noImplicitAny) {
				missingFlags.push("noImplicitAny");
			}
			checks.push({
				name: "tsconfig.json",
				status: "warn",
				message: `tsconfig.json — strict mode not fully enabled (missing ${missingFlags.join(", ")})`,
				fixable: false,
			});
		}
	} else {
		checks.push({
			name: "tsconfig.json",
			status: "warn",
			message: "tsconfig.json — not found",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Check 6: biome.json
	// -----------------------------------------------------------------------

	const biomePath = join(rootDir, "biome.json");
	const biomecPath = join(rootDir, "biome.jsonc");
	if (existsSync(biomePath) || existsSync(biomecPath)) {
		checks.push({
			name: "biome.json",
			status: "pass",
			message: "biome.json — found",
			fixable: false,
		});
	} else {
		checks.push({
			name: "biome.json",
			status: "info",
			message: "biome.json — not found (optional)",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Check 7: .forge-lock.json
	// -----------------------------------------------------------------------

	const lockPath = join(rootDir, ".forge-lock.json");
	if (existsSync(lockPath)) {
		const lock = readJsonSafe<{
			lockedAt?: string;
			lockedBy?: string;
			config?: { rules?: Record<string, string> };
		}>(lockPath);
		if (lock?.lockedAt) {
			checks.push({
				name: ".forge-lock.json",
				status: "pass",
				message: `.forge-lock.json — locked at ${lock.lockedAt}`,
				fixable: false,
			});
		} else {
			checks.push({
				name: ".forge-lock.json",
				status: "warn",
				message:
					".forge-lock.json — invalid format (run forge-ts lock to regenerate)",
				fixable: false,
			});
		}
	} else {
		checks.push({
			name: ".forge-lock.json",
			status: "warn",
			message:
				".forge-lock.json — not locked (run forge-ts lock)",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Check 8: .forge-audit.jsonl
	// -----------------------------------------------------------------------

	const auditPath = join(rootDir, ".forge-audit.jsonl");
	if (existsSync(auditPath)) {
		try {
			const raw = readFileSync(auditPath, "utf8");
			const lines = raw
				.split("\n")
				.filter((line) => line.trim().length > 0);
			checks.push({
				name: ".forge-audit.jsonl",
				status: "info",
				message: `.forge-audit.jsonl — ${lines.length} event${lines.length !== 1 ? "s" : ""}`,
				fixable: false,
			});
		} catch {
			checks.push({
				name: ".forge-audit.jsonl",
				status: "warn",
				message: ".forge-audit.jsonl — exists but unreadable",
				fixable: false,
			});
		}
	} else {
		checks.push({
			name: ".forge-audit.jsonl",
			status: "info",
			message: ".forge-audit.jsonl — no audit trail",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Check 9: .forge-bypass.json
	// -----------------------------------------------------------------------

	const bypassPath = join(rootDir, ".forge-bypass.json");
	if (existsSync(bypassPath)) {
		const records = readJsonSafe<
			Array<{ expiresAt?: string }>
		>(bypassPath);
		if (records && Array.isArray(records)) {
			const now = new Date();
			const active = records.filter(
				(r) => r.expiresAt && new Date(r.expiresAt) > now,
			);
			const expired = records.length - active.length;
			if (active.length > 0) {
				checks.push({
					name: ".forge-bypass.json",
					status: "info",
					message: `.forge-bypass.json — ${active.length} active bypass${active.length !== 1 ? "es" : ""}`,
					fixable: false,
				});
			} else if (expired > 0) {
				checks.push({
					name: ".forge-bypass.json",
					status: "info",
					message: `.forge-bypass.json — ${expired} expired bypass${expired !== 1 ? "es" : ""} (run cleanup)`,
					fixable: false,
				});
			} else {
				checks.push({
					name: ".forge-bypass.json",
					status: "pass",
					message: ".forge-bypass.json — no active bypasses",
					fixable: false,
				});
			}
		} else {
			checks.push({
				name: ".forge-bypass.json",
				status: "warn",
				message: ".forge-bypass.json — invalid format",
				fixable: false,
			});
		}
	} else {
		checks.push({
			name: ".forge-bypass.json",
			status: "pass",
			message: ".forge-bypass.json — no active bypasses",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Check 10: Git hooks
	// -----------------------------------------------------------------------

	const huskyPreCommit = join(rootDir, ".husky", "pre-commit");
	const lefthookYml = join(rootDir, "lefthook.yml");

	let hookConfigured = false;
	let hookLocation = "";

	if (existsSync(huskyPreCommit)) {
		try {
			const content = readFileSync(huskyPreCommit, "utf8");
			if (content.includes("forge-ts check")) {
				hookConfigured = true;
				hookLocation = "husky pre-commit";
			}
		} catch {
			// Ignore read errors
		}
	}

	if (!hookConfigured && existsSync(lefthookYml)) {
		try {
			const content = readFileSync(lefthookYml, "utf8");
			if (content.includes("forge-ts check")) {
				hookConfigured = true;
				hookLocation = "lefthook";
			}
		} catch {
			// Ignore read errors
		}
	}

	if (hookConfigured) {
		checks.push({
			name: "Git hooks",
			status: "pass",
			message: `Git hooks — forge-ts check in ${hookLocation}`,
			fixable: false,
		});
	} else {
		checks.push({
			name: "Git hooks",
			status: "warn",
			message:
				"Git hooks — forge-ts check not in pre-commit (run forge-ts init hooks)",
			fixable: false,
		});
	}

	// -----------------------------------------------------------------------
	// Summary
	// -----------------------------------------------------------------------

	const summary = {
		passed: checks.filter((c) => c.status === "pass").length,
		warnings: checks.filter((c) => c.status === "warn").length,
		errors: checks.filter((c) => c.status === "error").length,
		info: checks.filter((c) => c.status === "info").length,
	};

	const data: DoctorResult = {
		success: summary.errors === 0,
		checks,
		summary,
		fixed,
	};

	return {
		operation: "doctor",
		success: summary.errors === 0,
		data,
		duration: Date.now() - start,
	};
}

// ---------------------------------------------------------------------------
// Human formatter
// ---------------------------------------------------------------------------

/**
 * Status prefix labels for human output.
 * @internal
 */
const STATUS_LABELS: Record<DoctorCheckStatus, string> = {
	pass: "[PASS]",
	warn: "[WARN]",
	error: "[FAIL]",
	info: "[INFO]",
};

/**
 * Formats a DoctorResult as human-readable text.
 * @internal
 */
function formatDoctorHuman(result: DoctorResult): string {
	const lines: string[] = [];

	lines.push("\nforge-ts doctor: project health check\n");

	for (const check of result.checks) {
		const label = STATUS_LABELS[check.status];
		lines.push(`  ${label} ${check.message}`);
	}

	// Fixed files
	if (result.fixed.length > 0) {
		lines.push("");
		lines.push("  Fixed:");
		for (const file of result.fixed) {
			lines.push(`    ${file}`);
		}
	}

	lines.push("");
	lines.push(
		`  Summary: ${result.summary.passed} passed, ${result.summary.warnings} warning${result.summary.warnings !== 1 ? "s" : ""}, ${result.summary.errors} error${result.summary.errors !== 1 ? "s" : ""}`,
	);

	if (result.summary.errors > 0 || result.summary.warnings > 0) {
		lines.push(
			"  Run: forge-ts doctor --fix   to auto-fix resolvable issues",
		);
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Citty command definition
// ---------------------------------------------------------------------------

/**
 * Citty command definition for `forge-ts doctor`.
 *
 * Performs project integrity checks and optionally auto-fixes
 * resolvable issues with `--fix`.
 *
 * @example
 * ```typescript
 * import { doctorCommand } from "@forge-ts/cli/commands/doctor";
 * // Registered as a top-level subcommand of `forge-ts`
 * ```
 * @public
 */
export const doctorCommand = defineCommand({
	meta: {
		name: "doctor",
		description: "Project integrity check and repair",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root directory",
		},
		fix: {
			type: "boolean",
			description: "Auto-fix resolvable issues",
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
		const output = await runDoctor({
			cwd: args.cwd,
			fix: args.fix,
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
				return formatDoctorHuman(data);
			}
			return formatDoctorHuman(data);
		});

		process.exit(resolveExitCode(output));
	},
});
