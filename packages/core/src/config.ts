import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type EnforceRules, type ForgeConfig, type RuleSeverity, Visibility } from "./types.js";

// ---------------------------------------------------------------------------
// TSDoc standardisation group → rule mapping
// ---------------------------------------------------------------------------

/**
 * Maps each rule key in {@link EnforceRules} to its TSDoc standardisation group.
 *
 * - **core**: Tags defined in the TSDoc core standard (`@param`, `@returns`, etc.).
 * - **extended**: Tags from the extended standard (`@example`, `@defaultValue`, etc.).
 * - **discretionary**: Release-tag family (`@public`, `@beta`, `@internal`).
 * - Rules not listed here are **guard rules** and are not affected by group settings.
 *
 * @see {@link EnforceRules}
 * @since 0.1.0
 * @public
 */
export const RULE_GROUP_MAP: Partial<
	Record<keyof EnforceRules, "core" | "extended" | "discretionary">
> = {
	// Core rules
	"require-param": "core",
	"require-returns": "core",
	"require-package-doc": "core",
	"require-remarks": "core",
	"require-type-param": "core",
	// E001/E006/E007 enforce summary presence — a core TSDoc requirement
	"require-summary": "core",
	"require-class-member-doc": "core",
	"require-interface-member-doc": "core",
	// Extended rules
	"require-example": "extended",
	"require-default-value": "extended",
	"require-see": "extended",
	"require-tsdoc-syntax": "extended",
	"require-inheritdoc-source": "extended",
	"require-fresh-examples": "extended",
	// Discretionary rules
	"require-release-tag": "discretionary",
};

/**
 * Type-safe helper for defining a partial forge-ts configuration.
 *
 * @remarks
 * Only include the settings you want to override — everything else
 * inherits sensible defaults via `loadConfig()`.
 *
 * @param config - Partial configuration overrides.
 * @returns The same object (identity function for type checking).
 * @example
 * ```typescript
 * import { defineConfig } from "@forge-ts/core";
 *
 * const config = { outDir: "docs", enforce: { strict: true } };
 * export default defineConfig(config);
 * ```
 * @since 0.1.0
 * @public
 */
export function defineConfig(config: Partial<ForgeConfig>): Partial<ForgeConfig> {
	return config;
}

/**
 * Constructs a sensible default {@link ForgeConfig} rooted at `rootDir`.
 *
 * @remarks
 * All configuration fields receive production-ready defaults. The returned
 * object is fully populated and can be used without any further merging.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns A fully-populated default configuration.
 * @see {@link ForgeConfig}
 * @see {@link loadConfig}
 * @example
 * ```typescript
 * import { defaultConfig } from "@forge-ts/core";
 * const config = defaultConfig("/path/to/project");
 * console.log(config.enforce.enabled); // true
 * ```
 * @since 0.1.0
 * @public
 */
export function defaultConfig(rootDir: string): ForgeConfig {
	return {
		rootDir,
		tsconfig: join(rootDir, "tsconfig.json"),
		outDir: join(rootDir, "docs"),
		enforce: {
			enabled: true,
			minVisibility: Visibility.Public,
			strict: false,
			rules: {
				"require-summary": "error",
				"require-param": "error",
				"require-returns": "error",
				"require-example": "error",
				"require-package-doc": "warn",
				"require-class-member-doc": "error",
				"require-interface-member-doc": "error",
				"require-tsdoc-syntax": "warn",
				"require-remarks": "error",
				"require-default-value": "warn",
				"require-type-param": "error",
				"require-see": "warn",
				"require-release-tag": "error",
				"require-fresh-guides": "warn",
				"require-guide-coverage": "warn",
				"require-internal-boundary": "error",
				"require-route-response": "warn",
				"require-inheritdoc-source": "warn",
				"require-migration-path": "warn",
				"require-since": "warn",
				"require-fresh-examples": "warn",
				"require-no-ts-ignore": "error",
				"require-no-any-in-api": "warn",
				"require-fresh-link-text": "warn",
				"require-fresh-params": "warn",
				"require-param-count": "warn",
				"require-fresh-returns": "warn",
				"require-meaningful-remarks": "warn",
			},
		},
		doctest: {
			enabled: true,
			cacheDir: join(rootDir, ".cache", "doctest"),
		},
		api: {
			enabled: false,
			openapi: false,
			openapiPath: join(rootDir, "docs", "openapi.json"),
		},
		gen: {
			enabled: true,
			formats: ["markdown"],
			llmsTxt: true,
			readmeSync: false,
			ckm: true,
		},
		skill: {},
		bypass: {
			dailyBudget: 3,
			durationHours: 24,
		},
		tsdoc: {
			writeConfig: true,
			customTags: [],
			enforce: {
				core: "error",
				extended: "warn",
				discretionary: "off",
			},
		},
		guides: {
			enabled: true,
			autoDiscover: true,
			custom: [],
		},
		guards: {
			tsconfig: {
				enabled: true,
				requiredFlags: ["strict", "strictNullChecks", "noImplicitAny"],
			},
			biome: {
				enabled: false,
				lockedRules: [],
			},
			packageJson: {
				enabled: true,
				minNodeVersion: "22.0.0",
				requiredFields: ["type", "engines"],
			},
		},
		project: {},
	};
}

/**
 * Builds a rules object whose defaults are derived from the TSDoc group
 * severities instead of the hardcoded defaults.
 *
 * For every rule that belongs to a group, the severity is set to the
 * group's configured severity. Rules that do not belong to any group
 * keep the hardcoded defaults from {@link defaultConfig}.
 *
 * @param hardcodedRules - The hardcoded default rules from `defaultConfig`.
 * @param groupEnforce - The resolved `tsdoc.enforce` group severities.
 * @returns A new rules object with group-level defaults applied.
 * @internal
 */
function applyGroupSeverities(
	hardcodedRules: EnforceRules,
	groupEnforce: ForgeConfig["tsdoc"]["enforce"],
): EnforceRules {
	const result = { ...hardcodedRules };
	for (const [ruleKey, group] of Object.entries(RULE_GROUP_MAP)) {
		if (group) {
			result[ruleKey as keyof EnforceRules] = groupEnforce[group] as RuleSeverity;
		}
	}
	return result;
}

/**
 * Known top-level keys in {@link ForgeConfig}.
 * Used to warn about unrecognised config keys that are silently ignored.
 * @internal
 */
const KNOWN_TOP_KEYS = new Set([
	"rootDir",
	"tsconfig",
	"outDir",
	"enforce",
	"doctest",
	"api",
	"gen",
	"skill",
	"bypass",
	"tsdoc",
	"guides",
	"guards",
	"project",
]);

/**
 * Known keys within `enforce.rules`.
 * @internal
 */
const KNOWN_RULE_KEYS = new Set([
	"require-summary",
	"require-param",
	"require-returns",
	"require-example",
	"require-package-doc",
	"require-class-member-doc",
	"require-interface-member-doc",
	"require-tsdoc-syntax",
	"require-remarks",
	"require-default-value",
	"require-type-param",
	"require-see",
	"require-release-tag",
	"require-fresh-guides",
	"require-guide-coverage",
	"require-internal-boundary",
	"require-route-response",
	"require-inheritdoc-source",
	"require-migration-path",
	"require-since",
	"require-fresh-examples",
	"require-no-ts-ignore",
	"require-no-any-in-api",
	"require-fresh-link-text",
	"require-fresh-params",
	"require-param-count",
	"require-fresh-returns",
	"require-meaningful-remarks",
]);

/**
 * Known keys within `tsdoc`.
 * @internal
 */
const KNOWN_TSDOC_KEYS = new Set(["writeConfig", "customTags", "enforce"]);

/**
 * Known keys within `tsdoc.enforce`.
 * @internal
 */
const KNOWN_TSDOC_ENFORCE_KEYS = new Set(["core", "extended", "discretionary"]);

/**
 * Known keys within `guides`.
 * @internal
 */
const KNOWN_GUIDES_KEYS = new Set(["enabled", "autoDiscover", "custom"]);

/**
 * Known keys within `guards`.
 * @internal
 */
const KNOWN_GUARDS_KEYS = new Set(["tsconfig", "biome", "packageJson"]);

/**
 * Known keys within `guards.tsconfig`.
 * @internal
 */
const KNOWN_GUARDS_TSCONFIG_KEYS = new Set(["enabled", "requiredFlags"]);

/**
 * Known keys within `guards.biome`.
 * @internal
 */
const KNOWN_GUARDS_BIOME_KEYS = new Set(["enabled", "lockedRules"]);

/**
 * Known keys within `guards.packageJson`.
 * @internal
 */
const KNOWN_GUARDS_PACKAGE_JSON_KEYS = new Set(["enabled", "minNodeVersion", "requiredFields"]);

/**
 * Validates an object against a set of known keys and collects warnings.
 * @internal
 */
function validateKnownKeys(
	obj: Record<string, unknown>,
	knownKeys: Set<string>,
	section: string,
	warnings: string[],
): void {
	for (const key of Object.keys(obj)) {
		if (!knownKeys.has(key)) {
			warnings.push(`Unknown key "${key}" in ${section} — ignored.`);
		}
	}
}

/**
 * Collects warnings about unknown keys in user config.
 * Also emits to stderr for TTY consumers.
 * Returns the warnings array so it can be attached to the config for
 * agents that only see structured JSON output.
 * @internal
 */
function collectUnknownKeyWarnings(partial: Partial<ForgeConfig>): string[] {
	const warnings: string[] = [];
	for (const key of Object.keys(partial)) {
		if (!KNOWN_TOP_KEYS.has(key)) {
			warnings.push(`Unknown config key "${key}" — ignored.`);
		}
	}
	if (partial.enforce?.rules) {
		for (const key of Object.keys(partial.enforce.rules)) {
			if (!KNOWN_RULE_KEYS.has(key)) {
				warnings.push(
					`Unknown enforce rule "${key}" — ignored. Valid rules: ${[...KNOWN_RULE_KEYS].join(", ")}`,
				);
			}
		}
	}
	if (partial.tsdoc) {
		validateKnownKeys(
			partial.tsdoc as unknown as Record<string, unknown>,
			KNOWN_TSDOC_KEYS,
			"tsdoc",
			warnings,
		);
		if (partial.tsdoc.enforce) {
			validateKnownKeys(
				partial.tsdoc.enforce as unknown as Record<string, unknown>,
				KNOWN_TSDOC_ENFORCE_KEYS,
				"tsdoc.enforce",
				warnings,
			);
		}
	}
	if (partial.guides) {
		validateKnownKeys(
			partial.guides as unknown as Record<string, unknown>,
			KNOWN_GUIDES_KEYS,
			"guides",
			warnings,
		);
	}
	if (partial.guards) {
		validateKnownKeys(
			partial.guards as unknown as Record<string, unknown>,
			KNOWN_GUARDS_KEYS,
			"guards",
			warnings,
		);
		if (partial.guards.tsconfig) {
			validateKnownKeys(
				partial.guards.tsconfig as unknown as Record<string, unknown>,
				KNOWN_GUARDS_TSCONFIG_KEYS,
				"guards.tsconfig",
				warnings,
			);
		}
		if (partial.guards.biome) {
			validateKnownKeys(
				partial.guards.biome as unknown as Record<string, unknown>,
				KNOWN_GUARDS_BIOME_KEYS,
				"guards.biome",
				warnings,
			);
		}
		if (partial.guards.packageJson) {
			validateKnownKeys(
				partial.guards.packageJson as unknown as Record<string, unknown>,
				KNOWN_GUARDS_PACKAGE_JSON_KEYS,
				"guards.packageJson",
				warnings,
			);
		}
	}
	for (const w of warnings) {
		console.error(`[forge-ts] warning: ${w}`);
	}
	return warnings;
}

/**
 * Merges a partial user config with the defaults so every field is present.
 *
 * @param rootDir - Absolute path to the project root.
 * @param partial - Partial config from the user's config file.
 * @returns A fully-populated {@link ForgeConfig}.
 * @internal
 */
function mergeWithDefaults(rootDir: string, partial: Partial<ForgeConfig>): ForgeConfig {
	const warnings = collectUnknownKeyWarnings(partial);
	const defaults = defaultConfig(rootDir);

	// Resolve tsdoc.enforce group severities first (user overrides on top of defaults).
	const resolvedGroupEnforce = {
		...defaults.tsdoc.enforce,
		...partial.tsdoc?.enforce,
	};

	// Apply group severities as the base for rules, then overlay user's explicit rule overrides.
	// This ensures `tsdoc.enforce.core: "warn"` sets all core rules to "warn" by default,
	// but individual `enforce.rules["require-param"]: "error"` still wins.
	const groupDefaultRules = applyGroupSeverities(defaults.enforce.rules, resolvedGroupEnforce);

	const config: ForgeConfig = {
		...defaults,
		...partial,
		enforce: {
			...defaults.enforce,
			...partial.enforce,
			rules: { ...groupDefaultRules, ...partial.enforce?.rules },
		},
		doctest: { ...defaults.doctest, ...partial.doctest },
		api: { ...defaults.api, ...partial.api },
		gen: { ...defaults.gen, ...partial.gen },
		skill: { ...defaults.skill, ...partial.skill },
		bypass: { ...defaults.bypass, ...partial.bypass },
		guides: { ...defaults.guides, ...partial.guides },
		tsdoc: {
			...defaults.tsdoc,
			...partial.tsdoc,
			enforce: resolvedGroupEnforce,
		},
		guards: {
			...defaults.guards,
			...partial.guards,
			tsconfig: { ...defaults.guards.tsconfig, ...partial.guards?.tsconfig },
			biome: { ...defaults.guards.biome, ...partial.guards?.biome },
			packageJson: { ...defaults.guards.packageJson, ...partial.guards?.packageJson },
		},
		project: { ...defaults.project, ...partial.project },
	};
	if (warnings.length > 0) {
		config._configWarnings = warnings;
	}
	return config;
}

/**
 * Extracts repository URL from a package.json repository field.
 * Handles both string and object forms.
 * @internal
 */
function extractRepoUrl(
	repo: string | { type?: string; url?: string } | undefined,
): string | undefined {
	if (!repo) return undefined;
	const raw = typeof repo === "string" ? repo : repo.url;
	if (!raw) return undefined;
	// Normalize git+https://... and .git suffix
	return raw.replace(/^git\+/, "").replace(/\.git$/, "");
}

/**
 * Attempts to load a TypeScript or JavaScript config file via dynamic import.
 *
 * @param filePath - Absolute path to the config file.
 * @returns The default export of the config module, or `null` on failure.
 * @internal
 */
async function loadModuleConfig(filePath: string): Promise<Partial<ForgeConfig> | null> {
	try {
		const fileUrl = pathToFileURL(filePath).href;
		const mod = (await import(fileUrl)) as {
			default?: Partial<ForgeConfig>;
		};
		return mod.default ?? null;
	} catch (err) {
		// File exists but failed to import — warn instead of silently falling back.
		// Common cause: .ts config in a CommonJS project without "type": "module".
		const msg = err instanceof Error ? err.message : String(err);
		console.error(
			`[forge-ts] warning: failed to load config file "${filePath}" — ${msg.split("\n")[0]}`,
		);
		return null;
	}
}

/**
 * Minimal shape of a `package.json` file relevant to forge-ts config loading.
 * @internal
 */
interface PackageJson {
	name?: string;
	version?: string;
	description?: string;
	homepage?: string;
	repository?: string | { type?: string; url?: string };
	bin?: string | Record<string, string>;
	scripts?: Record<string, string>;
	keywords?: string[];
	"forge-ts"?: Partial<ForgeConfig>;
}

/**
 * Attempts to read the `"forge-ts"` key from a `package.json` file.
 *
 * @param pkgPath - Absolute path to `package.json`.
 * @returns The value of the `"forge-ts"` key, or `null` if absent.
 * @internal
 */
async function loadPackageJsonConfig(pkgPath: string): Promise<Partial<ForgeConfig> | null> {
	try {
		const raw = await readFile(pkgPath, "utf8");
		const pkg = JSON.parse(raw) as PackageJson;
		const key = pkg["forge-ts"];
		if (key) {
			return key;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Loads the forge-ts configuration for a project.
 *
 * @remarks
 * Resolution order:
 * 1. `\<rootDir\>/forge-ts.config.ts`
 * 2. `\<rootDir\>/forge-ts.config.js`
 * 3. `"forge-ts"` key inside `\<rootDir\>/package.json`
 * 4. Built-in defaults (returned when none of the above is found)
 *
 * @param rootDir - The project root to search for config.  Defaults to `process.cwd()`.
 * @returns A fully-resolved {@link ForgeConfig}.
 * @see {@link ForgeConfig}
 * @see {@link defaultConfig}
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * const config = await loadConfig("/path/to/project");
 * // config is fully resolved with defaults
 * ```
 * @since 0.1.0
 * @public
 */
export async function loadConfig(rootDir?: string): Promise<ForgeConfig> {
	const root = resolve(rootDir ?? process.cwd());

	let config: ForgeConfig;

	const candidates = [join(root, "forge-ts.config.ts"), join(root, "forge-ts.config.js")];
	let found = false;
	const loadWarnings: string[] = [];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			const partial = await loadModuleConfig(candidate);
			if (partial) {
				config = mergeWithDefaults(root, partial);
				found = true;
				break;
			}
			// Config file exists but failed to load — track the warning
			loadWarnings.push(
				`Config file "${candidate}" exists but could not be loaded. Check that your project has "type": "module" in package.json or use a .js config file.`,
			);
		}
	}

	if (!found) {
		const pkgPath = join(root, "package.json");
		if (existsSync(pkgPath)) {
			const partial = await loadPackageJsonConfig(pkgPath);
			// Always merge with defaults so group severities are applied,
			// even when no explicit "forge-ts" key is found.
			config = mergeWithDefaults(root, partial ?? {});
		} else {
			config = mergeWithDefaults(root, {});
		}
	} else {
		// biome-ignore lint: config is always set when found=true
		config = config!;
	}

	// Auto-detect project metadata from package.json if not explicitly set
	const pkgPath = join(root, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const raw = await readFile(pkgPath, "utf8");
			const pkg = JSON.parse(raw) as PackageJson;
			if (!config.project.repository) {
				config.project.repository = extractRepoUrl(pkg.repository);
			}
			if (!config.project.homepage) {
				config.project.homepage = pkg.homepage;
			}
			if (!config.project.packageName) {
				config.project.packageName = pkg.name;
			}
			if (!config.project.description) {
				config.project.description = pkg.description;
			}
			if (!config.project.version) {
				config.project.version = pkg.version;
			}
			if (!config.project.bin) {
				if (typeof pkg.bin === "string") {
					const binName = pkg.name?.replace(/^@[^/]+\//, "") ?? "cli";
					config.project.bin = { [binName]: pkg.bin };
				} else if (pkg.bin) {
					config.project.bin = pkg.bin;
				}
			}
			if (!config.project.scripts) {
				config.project.scripts = pkg.scripts;
			}
			if (!config.project.keywords) {
				config.project.keywords = pkg.keywords;
			}
		} catch {
			// Ignore parse errors
		}
	}

	// Attach any config load warnings so CLI commands can surface them
	if (loadWarnings.length > 0) {
		config._configWarnings = [...(config._configWarnings ?? []), ...loadWarnings];
	}

	return config;
}
