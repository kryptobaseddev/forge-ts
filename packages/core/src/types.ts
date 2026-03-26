/**
 * Visibility levels for exported symbols.
 * Derived from TSDoc release tags (`@public`, `@beta`, `@internal`).
 * @since 0.1.0
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
 * @since 0.1.0
 * @public
 */
export interface ForgeSymbol {
	/** The declared name of the symbol. */
	name: string;
	/** The syntactic kind of the symbol. */
	kind:
		| "function"
		| "class"
		| "interface"
		| "type"
		| "enum"
		| "variable"
		| "method"
		| "property"
		| "file";
	/** Resolved visibility from TSDoc release tags. */
	visibility: Visibility;
	/** Absolute path to the source file. */
	filePath: string;
	/** 1-based line number of the declaration. */
	line: number;
	/** 0-based column of the declaration. */
	column: number;
	/**
	 * Parsed TSDoc documentation, if present.
	 * @defaultValue undefined
	 */
	documentation?: {
		summary?: string;
		/** @remarks block content — implementation details, behavioral contracts, gotchas. */
		remarks?: string;
		params?: Array<{ name: string; description: string; type?: string }>;
		returns?: { description: string; type?: string };
		throws?: Array<{ type?: string; description: string }>;
		examples?: Array<{ code: string; language: string; line: number }>;
		tags?: Record<string, string[]>;
		deprecated?: string;
		/** {@link} cross-references found in this symbol's TSDoc. */
		links?: Array<{ target: string; line: number; text?: string }>;
		/** TSDoc parser messages (syntax warnings/errors) from @microsoft/tsdoc. */
		parseMessages?: Array<{ messageId: string; text: string; line: number }>;
	};
	/**
	 * Human-readable type signature of the symbol.
	 * @defaultValue undefined
	 */
	signature?: string;
	/**
	 * Child symbols (e.g., class members, enum values).
	 * @defaultValue undefined
	 */
	children?: ForgeSymbol[];
	/** Whether this symbol is part of the public module exports. */
	exported: boolean;
}

/**
 * Severity level for an individual enforcement rule.
 * - `"error"` — violation fails the build.
 * - `"warn"`  — violation is reported but does not fail the build.
 * - `"off"`   — rule is disabled entirely.
 * @since 0.1.0
 * @public
 */
export type RuleSeverity = "error" | "warn" | "off";

/**
 * Per-rule severity configuration for the TSDoc enforcer.
 * 37 rules across 4 layers: API (E001-E008, W003-W004), Dev (E013-E015, E017-E018, W005-W006, W009),
 * Consumer (E016, W007-W008, W010-W011), LLM Anti-Pattern (E019-E020, W012-W013),
 * Staleness (W014-W017).
 * @since 0.1.0
 * @public
 */
export interface EnforceRules {
	/** E001: Exported symbol missing TSDoc summary. */
	"require-summary": RuleSeverity;
	/** E002: Function parameter missing `\@param` tag. */
	"require-param": RuleSeverity;
	/** E003: Non-void function missing `\@returns` tag. */
	"require-returns": RuleSeverity;
	/** E004: Exported function missing `\@example` block. */
	"require-example": RuleSeverity;
	/** E005: Entry point missing `\@packageDocumentation`. */
	"require-package-doc": RuleSeverity;
	/** E006: Class member missing documentation. */
	"require-class-member-doc": RuleSeverity;
	/** E007: Interface/type member missing documentation. */
	"require-interface-member-doc": RuleSeverity;
	/** W006: TSDoc syntax parse error (invalid tag, malformed block, etc.). */
	"require-tsdoc-syntax": RuleSeverity;
	/** E013: Exported function/class is missing a `\@remarks` block. */
	"require-remarks": RuleSeverity;
	/** E014: Optional property with default is missing `\@defaultValue`. */
	"require-default-value": RuleSeverity;
	/** E015: Generic symbol is missing `\@typeParam` for its type parameters. */
	"require-type-param": RuleSeverity;
	/** W005: Symbol references other symbols via `\@link` but has no `\@see` tags. */
	"require-see": RuleSeverity;
	/** E016: Exported symbol is missing a release tag (`\@public`, `\@beta`, `\@internal`). */
	"require-release-tag": RuleSeverity;
	/** W007: Guide FORGE:AUTO section references a symbol that no longer exists or has changed. */
	"require-fresh-guides": RuleSeverity;
	/** W008: Exported public symbol is not mentioned in any guide page. */
	"require-guide-coverage": RuleSeverity;
	/** E017: `\@internal` symbol re-exported through public barrel (index.ts). */
	"require-internal-boundary": RuleSeverity;
	/** E018: `\@route`-tagged function missing `\@response` tag. */
	"require-route-response": RuleSeverity;
	/** W009: `\@inheritDoc` references a symbol that does not exist. */
	"require-inheritdoc-source": RuleSeverity;
	/** W010: `\@breaking` without `\@migration` path. */
	"require-migration-path": RuleSeverity;
	/** W011: New public export missing `\@since` version tag. */
	"require-since": RuleSeverity;
	/** W013: `\@example` block may be stale — function call arg count mismatches parameter count. */
	"require-fresh-examples": RuleSeverity;
	/** E019: Non-test file contains ts-ignore or ts-expect-error directive. */
	"require-no-ts-ignore": RuleSeverity;
	/** E020: Exported symbol has `any` in its public API signature. */
	"require-no-any-in-api": RuleSeverity;
	/** W012: `\@link` display text appears stale relative to target summary. */
	"require-fresh-link-text": RuleSeverity;
	/** W014: `\@param` name in TSDoc does not match actual parameter name in signature. */
	"require-fresh-params": RuleSeverity;
	/** W015: `\@param` count in TSDoc does not match actual parameter count in signature. */
	"require-param-count": RuleSeverity;
	/** W016: `\@returns` tag present on a void/Promise\<void\> function. */
	"require-fresh-returns": RuleSeverity;
	/** W017: `\@remarks` block is empty or contains only placeholder text. */
	"require-meaningful-remarks": RuleSeverity;
}

/**
 * Full configuration for a forge-ts run.
 * Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.
 * @since 0.1.0
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
		/**
		 * Minimum visibility level to enforce documentation on.
		 *
		 * Accepts either a {@link Visibility} enum value or the equivalent
		 * string literal (`"public"`, `"beta"`, `"internal"`, `"private"`).
		 * String literals are resolved to enum values internally.
		 */
		minVisibility: Visibility | "public" | "beta" | "internal" | "private";
		/** Fail on warnings rather than only on errors. */
		strict: boolean;
		/** Per-rule severity overrides. When strict is true, all "warn" become "error". */
		rules: EnforceRules;
		/**
		 * Path to a file listing symbol names to skip enforcement on (one per line).
		 * Lines starting with `#` are treated as comments.
		 * Typically generated by Knip: `npx knip --reporter json | jq -r '.exports[].name' > .forge-ignore`
		 */
		ignoreFile?: string;
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
		/** Generate a Codebase Knowledge Manifest (ckm.json) alongside other outputs. */
		ckm?: boolean;
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
	/** TSDoc ecosystem configuration. */
	tsdoc: {
		/** Write tsdoc.json to project root during init. Default: true */
		writeConfig: boolean;
		/** Custom tag definitions beyond the forge-ts preset. */
		customTags: Array<{
			tagName: string;
			syntaxKind: "block" | "inline" | "modifier";
		}>;
		/** Enforcement level per standardization group. */
		enforce: {
			/** Core tags (e.g. @param, @returns, @remarks). Default: "error" */
			core: "error" | "warn" | "off";
			/** Extended tags (e.g. @example, @throws, @see). Default: "warn" */
			extended: "error" | "warn" | "off";
			/** Discretionary tags (@alpha, @beta, @public, @internal). Default: "off" */
			discretionary: "error" | "warn" | "off";
		};
	};
	/** Bypass budget configuration for temporary rule overrides. */
	bypass: {
		/** Maximum number of bypasses allowed per calendar day. Default: 3 */
		dailyBudget: number;
		/** Duration in hours before a bypass automatically expires. Default: 24 */
		durationHours: number;
	};
	/** Guide generation configuration. */
	guides: {
		/** Enable intelligent guide generation. Default: true */
		enabled: boolean;
		/** Auto-discover guide topics from code analysis. Default: true */
		autoDiscover: boolean;
		/** Explicit guide definitions (supplement auto-discovered guides). */
		custom: Array<{
			/** URL slug for the guide (e.g., "authentication") */
			slug: string;
			/** Human-readable title */
			title: string;
			/** Glob patterns for source files to analyze */
			sources: string[];
		}>;
	};
	/** Downstream config drift guards. */
	guards: {
		/** tsconfig.json strictness validation. */
		tsconfig: {
			enabled: boolean;
			/** Required strict-mode flags. Default: ["strict", "strictNullChecks", "noImplicitAny"] */
			requiredFlags: string[];
		};
		/** Biome config drift detection. */
		biome: {
			enabled: boolean;
			/** Biome rules that must stay at error level. Auto-detected on lock. */
			lockedRules: string[];
		};
		/** package.json guards. */
		packageJson: {
			enabled: boolean;
			/** Minimum Node.js version in engines field. */
			minNodeVersion: string;
			/** Required fields in package.json. */
			requiredFields: string[];
		};
	};
	/**
	 * Warnings generated during config loading (e.g., unknown keys).
	 * Populated by loadConfig(). Agents should surface these in output.
	 * @defaultValue undefined
	 * @internal
	 */
	_configWarnings?: string[];
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
 * @since 0.1.0
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
	/**
	 * Absolute paths of files written during this run (populated by gen).
	 * @defaultValue undefined
	 */
	writtenFiles?: string[];
}

/**
 * A diagnostic error produced during a forge-ts run.
 * @since 0.1.0
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
	/**
	 * Suggested fix for the agent — exact TSDoc block to add.
	 * @defaultValue undefined
	 */
	suggestedFix?: string;
	/**
	 * The symbol name that needs fixing.
	 * @defaultValue undefined
	 */
	symbolName?: string;
	/**
	 * The symbol kind (function, class, interface, etc.).
	 * @defaultValue undefined
	 */
	symbolKind?: string;
}

/**
 * A diagnostic warning produced during a forge-ts run.
 * @since 0.1.0
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
