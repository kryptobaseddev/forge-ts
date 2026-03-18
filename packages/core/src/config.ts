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
	};
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
	const defaults = defaultConfig(rootDir);
	return {
		...defaults,
		...partial,
		enforce: { ...defaults.enforce, ...partial.enforce },
		doctest: { ...defaults.doctest, ...partial.doctest },
		api: { ...defaults.api, ...partial.api },
		gen: { ...defaults.gen, ...partial.gen },
	};
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

	const candidates = [join(root, "forge-ts.config.ts"), join(root, "forge-ts.config.js")];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			const partial = await loadModuleConfig(candidate);
			if (partial) {
				return mergeWithDefaults(root, partial);
			}
		}
	}

	const pkgPath = join(root, "package.json");
	if (existsSync(pkgPath)) {
		const partial = await loadPackageJsonConfig(pkgPath);
		if (partial) {
			return mergeWithDefaults(root, partial);
		}
	}

	return defaultConfig(root);
}
