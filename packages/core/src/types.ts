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
		/** {@link} cross-references found in this symbol's TSDoc. */
		links?: Array<{ target: string; line: number }>;
	};
	/** Human-readable type signature of the symbol. */
	signature?: string;
	/** Child symbols (e.g., class members, enum values). */
	children?: ForgeSymbol[];
	/** Whether this symbol is part of the public module exports. */
	exported: boolean;
}

/**
 * Severity level for an individual enforcement rule.
 * - `"error"` — violation fails the build.
 * - `"warn"`  — violation is reported but does not fail the build.
 * - `"off"`   — rule is disabled entirely.
 * @public
 */
export type RuleSeverity = "error" | "warn" | "off";

/**
 * Per-rule severity configuration for the TSDoc enforcer.
 * Each key corresponds to one of the E001–E007 rule codes.
 * @public
 */
export interface EnforceRules {
	/** E001: Exported symbol missing TSDoc summary. */
	"require-summary": RuleSeverity;
	/** E002: Function parameter missing @param tag. */
	"require-param": RuleSeverity;
	/** E003: Non-void function missing @returns tag. */
	"require-returns": RuleSeverity;
	/** E004: Exported function missing @example block. */
	"require-example": RuleSeverity;
	/** E005: Entry point missing @packageDocumentation. */
	"require-package-doc": RuleSeverity;
	/** E006: Class member missing documentation. */
	"require-class-member-doc": RuleSeverity;
	/** E007: Interface/type member missing documentation. */
	"require-interface-member-doc": RuleSeverity;
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
		/** Per-rule severity overrides. When strict is true, all "warn" become "error". */
		rules: EnforceRules;
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
	/**
	 * Skill package generation settings.
	 * Custom sections here are merged into the generated SKILL.md,
	 * allowing projects to inject workflow knowledge, domain gotchas,
	 * and other context that cannot be derived from symbols alone.
	 */
	skill: {
		/** When true, generate a SKILL.md package alongside llms.txt. Defaults to following `gen.llmsTxt`. */
		enabled?: boolean;
		/**
		 * Custom sections to inject into the generated SKILL.md body.
		 * Each entry becomes a `## heading` section with the provided markdown content.
		 * Sections are inserted after the auto-generated API section and before Gotchas.
		 *
		 * @example
		 * ```typescript
		 * customSections: [
		 *   { heading: "The Flow", content: "check → build → docs init → docs dev" },
		 *   { heading: "SSoT Principle", content: "Source code IS documentation." },
		 * ]
		 * ```
		 */
		customSections?: Array<{ heading: string; content: string }>;
		/**
		 * Extra gotcha lines to append to the auto-detected Gotchas section.
		 * Each string becomes a `- ` bullet point.
		 */
		extraGotchas?: string[];
	};
	/** Project metadata — auto-detected from package.json if not provided. */
	project: {
		/** Repository URL (e.g., "https://github.com/user/repo"). */
		repository?: string;
		/** Project homepage URL. */
		homepage?: string;
		/** npm package name for the main/CLI package. */
		packageName?: string;
		/** Short description from package.json. */
		description?: string;
		/** Package version string. */
		version?: string;
		/** CLI entry points from the `bin` field (e.g., `{ "my-cli": "./dist/cli.js" }`). */
		bin?: Record<string, string>;
		/** npm scripts from package.json (e.g., `{ "test": "vitest", "build": "tsup" }`). */
		scripts?: Record<string, string>;
		/** npm keywords for the package. */
		keywords?: string[];
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
	/** Suggested fix for the agent — exact TSDoc block to add. */
	suggestedFix?: string;
	/** The symbol name that needs fixing. */
	symbolName?: string;
	/** The symbol kind (function, class, interface, etc.). */
	symbolKind?: string;
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
