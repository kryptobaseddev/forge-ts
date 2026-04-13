import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import type { DocPage } from "../site-generator.js";

/**
 * Supported SSG target identifiers.
 * @public
 */
export type SSGTarget = "mintlify" | "docusaurus" | "nextra" | "vitepress" | "fumadocs";

/**
 * A file to write to disk during scaffolding or generation.
 * @public
 */
export interface GeneratedFile {
	/** Relative path from the docs output directory. */
	path: string;
	/** File content (string for text). */
	content: string;
	/**
	 * When true, this file is scaffolding intended for human/agent editing.
	 * Stub files are created only on the first build and never overwritten,
	 * preserving manual edits across subsequent `forge-ts build` runs.
	 * Callers should check this flag and skip writing if the file exists.
	 * @defaultValue false
	 */
	stub?: boolean;
}

/**
 * Style guide configuration for the SSG target.
 * @public
 */
export interface SSGStyleGuide {
	/** File extension for doc pages. */
	pageExtension: "md" | "mdx";
	/** Whether the target supports MDX components. */
	supportsMdx: boolean;
	/** Whether frontmatter is required on every page. */
	requiresFrontmatter: boolean;
	/** Maximum recommended heading depth. */
	maxHeadingDepth: number;
	/** Component imports to add at top of MDX files (if supportsMdx). */
	defaultImports: string[];
	/** Code block language for TypeScript examples. */
	codeBlockLanguage: "typescript" | "ts" | "tsx";
}

/**
 * Scaffold manifest describing what `init docs` creates.
 * @public
 */
export interface ScaffoldManifest {
	/** The SSG target this manifest is for. */
	target: SSGTarget;
	/** Files that will be created. */
	files: GeneratedFile[];
	/** npm dependencies to install. */
	dependencies: Record<string, string>;
	/** npm devDependencies to install. */
	devDependencies: Record<string, string>;
	/** Scripts to add to package.json. */
	scripts: Record<string, string>;
	/** Post-scaffold instructions for the user. */
	instructions: string[];
}

/**
 * Context passed to adapter methods.
 * @public
 */
export interface AdapterContext {
	/** Resolved forge-ts configuration. */
	config: ForgeConfig;
	/** Project name (from package.json or directory). */
	projectName: string;
	/**
	 * Project description.
	 * @defaultValue undefined
	 */
	projectDescription?: string;
	/** The generated doc pages (from site-generator). */
	pages: DocPage[];
	/** All symbols extracted from the project. */
	symbols: ForgeSymbol[];
	/** Output directory for generated docs. */
	outDir: string;
}

/**
 * Command to start a local dev server for doc preview.
 * @public
 */
export interface DevServerCommand {
	/** The binary to execute (e.g., "npx", "node"). */
	bin: string;
	/** Arguments to pass to the binary. */
	args: string[];
	/** Working directory to run from. */
	cwd: string;
	/** Human-readable label for the command. */
	label: string;
	/** The URL the dev server will be available at. */
	url: string;
}

/**
 * The central SSG adapter interface.
 * Every doc platform provider implements this contract.
 * One file per provider. No shared mutable state.
 *
 * @example
 * ```typescript
 * import { getAdapter } from "@forge-ts/gen";
 * const adapter = getAdapter("mintlify");
 * const files = adapter.transformPages(pages, context);
 * ```
 * @public
 */
export interface SSGAdapter {
	/** Unique target identifier. */
	readonly target: SSGTarget;

	/** Human-readable display name. */
	readonly displayName: string;

	/** Style guide for this platform. */
	readonly styleGuide: SSGStyleGuide;

	/**
	 * Generate the complete scaffold for a new doc site.
	 * Called by `forge-ts init docs --target <name>`.
	 * Returns all files, dependencies, and scripts needed.
	 *
	 * @param context - The adapter context for the current project.
	 * @returns A {@link ScaffoldManifest} with files, deps, and instructions.
	 * @example
	 * ```typescript
	 * import { getAdapter } from "@forge-ts/gen";
	 * const adapter = getAdapter("mintlify");
	 * const manifest = adapter.scaffold(context);
	 * console.log(manifest.files.length);
	 * ```
	 */
	scaffold(context: AdapterContext): ScaffoldManifest;

	/**
	 * Transform generic DocPages into platform-specific pages.
	 * Adds correct frontmatter, component imports, file extensions.
	 * Called during `forge-ts build`.
	 *
	 * @param pages - The generic doc pages to transform.
	 * @param context - The adapter context for the current project.
	 * @returns An array of {@link GeneratedFile} objects ready to write.
	 * @example
	 * ```typescript
	 * import { getAdapter } from "@forge-ts/gen";
	 * const adapter = getAdapter("docusaurus");
	 * const files = adapter.transformPages(pages, context);
	 * console.log(files[0].path.endsWith(".mdx")); // true
	 * ```
	 */
	transformPages(pages: DocPage[], context: AdapterContext): GeneratedFile[];

	/**
	 * Generate platform-specific configuration files.
	 * e.g., mint.json, sidebars.js, _meta.json, .vitepress/config.ts
	 * Called during `forge-ts build`.
	 *
	 * @param context - The adapter context for the current project.
	 * @returns An array of {@link GeneratedFile} objects ready to write.
	 * @example
	 * ```typescript
	 * import { getAdapter } from "@forge-ts/gen";
	 * const adapter = getAdapter("vitepress");
	 * const configs = adapter.generateConfig(context);
	 * console.log(configs[0].path); // ".vitepress/sidebar.json"
	 * ```
	 */
	generateConfig(context: AdapterContext): GeneratedFile[];

	/**
	 * Get the command to start the local dev server for this platform.
	 * Called by `forge-ts docs dev`.
	 *
	 * @param outDir - The docs output directory.
	 * @returns The shell command and args to spawn, plus a display label.
	 * @example
	 * ```typescript
	 * import { getAdapter } from "@forge-ts/gen";
	 * const adapter = getAdapter("mintlify");
	 * const cmd = adapter.getDevCommand("./docs");
	 * // { bin: "npx", args: ["@mintlify/cli", "dev"], cwd: "./docs" }
	 * ```
	 */
	getDevCommand(outDir: string): DevServerCommand;

	/**
	 * Check if a scaffold already exists in the output directory.
	 * Used for safety checks before init or target change.
	 *
	 * @param outDir - The output directory to inspect.
	 * @returns `true` if a scaffold marker file already exists.
	 * @example
	 * ```typescript
	 * import { getAdapter } from "@forge-ts/gen";
	 * const adapter = getAdapter("mintlify");
	 * const exists = await adapter.detectExisting("./docs");
	 * if (exists) console.log("Scaffold already present");
	 * ```
	 */
	detectExisting(outDir: string): Promise<boolean>;
}
