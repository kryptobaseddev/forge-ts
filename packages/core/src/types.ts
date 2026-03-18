/**
 * Visibility levels for exported symbols.
 * Derived from TSDoc release tags (@public, @beta, @internal).
 * @public
 */
export enum Visibility {
	Public = "public",
	Beta = "beta",
	Internal = "internal",
	Private = "private",
}

/**
 * A single extracted and annotated symbol from the TypeScript AST.
 * @public
 */
export interface ForgeSymbol {
	/** The declared name of the symbol. */
	name: string;
	/** The syntactic kind of the symbol. */
	kind: "function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "property";
	/** Resolved visibility from TSDoc release tags. */
	visibility: Visibility;
	/** Absolute path to the source file. */
	filePath: string;
	/** 1-based line number of the declaration. */
	line: number;
	/** 0-based column of the declaration. */
	column: number;
	/** Parsed TSDoc documentation, if present. */
	documentation?: {
		summary?: string;
		params?: Array<{ name: string; description: string; type?: string }>;
		returns?: { description: string; type?: string };
		throws?: Array<{ type?: string; description: string }>;
		examples?: Array<{ code: string; language: string; line: number }>;
		tags?: Record<string, string[]>;
		deprecated?: string;
	};
	/** Human-readable type signature of the symbol. */
	signature?: string;
	/** Child symbols (e.g., class members, enum values). */
	children?: ForgeSymbol[];
	/** Whether this symbol is part of the public module exports. */
	exported: boolean;
}

/**
 * Full configuration for a forge-ts run.
 * Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.
 * @public
 */
export interface ForgeConfig {
	/** Root directory of the project. */
	rootDir: string;
	/** Path to the tsconfig.json to compile against. */
	tsconfig: string;
	/** Output directory for generated files. */
	outDir: string;
	/** Enforce TSDoc on all public exports. */
	enforce: {
		enabled: boolean;
		/** Minimum visibility level to enforce documentation on. */
		minVisibility: Visibility;
		/** Fail on warnings rather than only on errors. */
		strict: boolean;
	};
	/** DocTest configuration. */
	doctest: {
		enabled: boolean;
		/** Cache directory for virtual test files. */
		cacheDir: string;
	};
	/** API generation configuration. */
	api: {
		enabled: boolean;
		/** Generate an OpenAPI spec from exported HTTP handlers. */
		openapi: boolean;
		/** Output path for the OpenAPI spec file. */
		openapiPath: string;
	};
	/** Output generation configuration. */
	gen: {
		enabled: boolean;
		/** Output formats to generate. */
		formats: Array<"markdown" | "mdx">;
		/** Generate an llms.txt companion file. */
		llmsTxt: boolean;
		/** Synchronise summaries back into README.md. */
		readmeSync: boolean;
		/** Static site generator to target for output format. */
		ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress";
	};
}

/**
 * The result of a forge-ts compilation pass.
 * @public
 */
export interface ForgeResult {
	/** Whether the run succeeded without errors. */
	success: boolean;
	/** All symbols extracted during this run. */
	symbols: ForgeSymbol[];
	/** Errors that caused or would cause failure. */
	errors: ForgeError[];
	/** Non-fatal warnings. */
	warnings: ForgeWarning[];
	/** Wall-clock duration of the run in milliseconds. */
	duration: number;
}

/**
 * A diagnostic error produced during a forge-ts run.
 * @public
 */
export interface ForgeError {
	/** Machine-readable error code (e.g. "E001"). */
	code: string;
	/** Human-readable description of the error. */
	message: string;
	/** Absolute path of the file where the error occurred. */
	filePath: string;
	/** 1-based line number. */
	line: number;
	/** 0-based column. */
	column: number;
}

/**
 * A diagnostic warning produced during a forge-ts run.
 * @public
 */
export interface ForgeWarning {
	/** Machine-readable warning code (e.g. "W001"). */
	code: string;
	/** Human-readable description of the warning. */
	message: string;
	/** Absolute path of the file where the warning occurred. */
	filePath: string;
	/** 1-based line number. */
	line: number;
	/** 0-based column. */
	column: number;
}
