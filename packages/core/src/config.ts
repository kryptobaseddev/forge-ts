import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type ForgeConfig, Visibility } from "./types.js";

/**
 * Constructs a sensible default {@link ForgeConfig} rooted at `rootDir`.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns A fully-populated default configuration.
 * @example
 * ```typescript
 * import { defaultConfig } from "@forge-ts/core";
 * const config = defaultConfig("/path/to/project");
 * console.log(config.enforce.enabled); // true
 * ```
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
		},
		skill: {},
		project: {},
	};
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
]);

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
	const config: ForgeConfig = {
		...defaults,
		...partial,
		enforce: {
			...defaults.enforce,
			...partial.enforce,
			rules: { ...defaults.enforce.rules, ...partial.enforce?.rules },
		},
		doctest: { ...defaults.doctest, ...partial.doctest },
		api: { ...defaults.api, ...partial.api },
		gen: { ...defaults.gen, ...partial.gen },
		skill: { ...defaults.skill, ...partial.skill },
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
	} catch {
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
 * Resolution order:
 * 1. `<rootDir>/forge-ts.config.ts`
 * 2. `<rootDir>/forge-ts.config.js`
 * 3. `"forge-ts"` key inside `<rootDir>/package.json`
 * 4. Built-in defaults (returned when none of the above is found)
 *
 * @param rootDir - The project root to search for config.  Defaults to `process.cwd()`.
 * @returns A fully-resolved {@link ForgeConfig}.
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * const config = await loadConfig("/path/to/project");
 * // config is fully resolved with defaults
 * ```
 * @public
 */
export async function loadConfig(rootDir?: string): Promise<ForgeConfig> {
	const root = resolve(rootDir ?? process.cwd());

	let config: ForgeConfig;

	const candidates = [join(root, "forge-ts.config.ts"), join(root, "forge-ts.config.js")];
	let found = false;

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			const partial = await loadModuleConfig(candidate);
			if (partial) {
				config = mergeWithDefaults(root, partial);
				found = true;
				break;
			}
		}
	}

	if (!found) {
		const pkgPath = join(root, "package.json");
		if (existsSync(pkgPath)) {
			const partial = await loadPackageJsonConfig(pkgPath);
			if (partial) {
				config = mergeWithDefaults(root, partial);
			} else {
				config = defaultConfig(root);
			}
		} else {
			config = defaultConfig(root);
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

	return config;
}
