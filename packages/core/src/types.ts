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
 * 40 rules across 5 layers: API (E001-E008, W003-W004), Dev (E013-E015, E017-E018, W005-W006, W009),
 * Consumer (E016, W007-W008, W010-W011), LLM Anti-Pattern (E019-E020, W012-W013),
 * Staleness (W014-W017), CKM Truthfulness (W018-W020).
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
	/** W018: `\@operation`-tagged function missing required CKM documentation (`\@param`, `\@returns`, `\@remarks`, `\@example`). */
	"require-operation-completeness": RuleSeverity;
	/** W019: CKM tag (`\@operation`, `\@constraint`, `\@workflow`, `\@concept`) has empty or insufficient content. */
	"require-ckm-tag-content": RuleSeverity;
	/** W020: `\@constraint`-tagged symbol missing `\@throws` to document constraint violation error. */
	"require-constraint-throws": RuleSeverity;
}

/**
 * Full configuration for a forge-ts run.
 *
 * @remarks
 * This is the root configuration object consumed by every forge-ts command.
 * It is loaded from `forge-ts.config.ts` (preferred), `forge-ts.config.js`,
 * or the `"forge-ts"` key inside `package.json`, in that order.
 * Any field left unset in the user config is filled with a sensible default
 * by {@link loadConfig}. Use {@link defineConfig} to get full type checking
 * when authoring the config file.
 *
 * @example
 * ```typescript
 * // forge-ts.config.ts
 * import { defineConfig } from "@forge-ts/core";
 *
 * export default defineConfig({
 *   outDir: "docs/generated",
 *   enforce: { strict: true },
 *   gen: { formats: ["mdx"], ssgTarget: "fumadocs" },
 * });
 * ```
 * @since 0.1.0
 * @public
 */
export interface ForgeConfig {
	/**
	 * Root directory of the project.
	 *
	 * @remarks
	 * All relative paths inside the config (e.g. `tsconfig`, `outDir`) are
	 * resolved against this directory. When loaded via {@link loadConfig} this
	 * is set to `process.cwd()` automatically; override only when invoking the
	 * API programmatically from a different working directory.
	 *
	 * @defaultValue `process.cwd()` (resolved by `loadConfig`)
	 */
	rootDir: string;

	/**
	 * Path to the `tsconfig.json` used for TypeScript compilation and type resolution.
	 *
	 * @remarks
	 * forge-ts passes this file to the TypeScript compiler API for AST walking and
	 * type extraction. The path may be absolute or relative to {@link rootDir}.
	 * If the file does not exist the run fails immediately with a clear error.
	 *
	 * @defaultValue `"<rootDir>/tsconfig.json"`
	 */
	tsconfig: string;

	/**
	 * Output directory for all generated documentation artifacts.
	 *
	 * @remarks
	 * All generated files — MDX/Markdown pages, `llms.txt`, `llms-full.txt`,
	 * `meta.json` sidebar files, `openapi.json`, and `ckm.json` — are written
	 * relative to this directory. The directory is created automatically if it
	 * does not exist. Commit this directory or add it to `.gitignore` depending
	 * on your workflow.
	 *
	 * @defaultValue `"<rootDir>/docs"`
	 */
	outDir: string;

	/**
	 * Enforcement configuration — controls which TSDoc rules run and at what severity.
	 *
	 * @remarks
	 * When `enforce.enabled` is `true`, `forge check` validates every exported
	 * symbol against the active rule set. Rules produce either errors (which fail
	 * the build) or warnings (which are reported but do not fail). The
	 * `tsdoc.enforce` group severities act as coarse-grained defaults; individual
	 * entries in `enforce.rules` take precedence over group defaults.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	enforce: {
		/**
		 * Whether TSDoc enforcement runs during `forge check`.
		 *
		 * @remarks
		 * Set to `false` to completely disable the enforcer. All other
		 * `enforce.*` settings are ignored when this is `false`.
		 *
		 * @defaultValue `true`
		 */
		enabled: boolean;

		/**
		 * Minimum visibility level to enforce documentation on.
		 *
		 * @remarks
		 * Accepts either a {@link Visibility} enum value or the equivalent
		 * string literal (`"public"`, `"beta"`, `"internal"`, `"private"`).
		 * String literals are resolved to enum values internally.
		 *
		 * Symbols below this visibility threshold are skipped entirely:
		 * - `"public"` — enforce only `@public` symbols (recommended for libraries).
		 * - `"beta"` — enforce `@public` and `@beta` symbols.
		 * - `"internal"` — enforce `@public`, `@beta`, and `@internal` symbols.
		 * - `"private"` — enforce all symbols including unannotated ones.
		 *
		 * @defaultValue `Visibility.Public` (`"public"`)
		 */
		minVisibility: Visibility | "public" | "beta" | "internal" | "private";

		/**
		 * Treat all warning-level rule violations as errors.
		 *
		 * @remarks
		 * When `true`, every rule with severity `"warn"` is promoted to `"error"`,
		 * causing the build to fail on any violation. Useful for release CI gates
		 * where documentation quality must meet the same bar as type errors.
		 * Individual rules overridden to `"off"` in `rules` are still respected.
		 *
		 * @defaultValue `false`
		 */
		strict: boolean;

		/**
		 * Per-rule severity overrides for the TSDoc enforcer.
		 *
		 * @remarks
		 * Each key maps to a specific rule by its slug (e.g. `"require-summary"`).
		 * Valid severity values are:
		 * - `"error"` — violation fails `forge check`.
		 * - `"warn"` — violation is reported but does not fail the build.
		 * - `"off"` — rule is disabled entirely.
		 *
		 * Rules that belong to a `tsdoc.enforce` group inherit the group's
		 * severity as their default; explicit entries here always win. See
		 * {@link EnforceRules} for the full list of rule slugs and what each checks.
		 *
		 * @example
		 * ```typescript
		 * enforce: {
		 *   rules: {
		 *     "require-example": "warn",   // downgrade from default "error"
		 *     "require-since": "error",    // upgrade from default "warn"
		 *     "require-see": "off",        // disable entirely
		 *   },
		 * }
		 * ```
		 *
		 * @defaultValue See {@link defaultConfig} for the full default severity table.
		 */
		rules: EnforceRules;

		/**
		 * Path to a file listing symbol names to skip during enforcement (one per line).
		 *
		 * @remarks
		 * Lines beginning with `#` are treated as comments and ignored.
		 * Any symbol whose name appears in this file is silently excluded from all
		 * enforcement rules. This is especially useful for suppressing violations on
		 * dead exports detected by tools such as Knip:
		 *
		 * ```sh
		 * npx knip --reporter json | jq -r '.exports[].name' > .forge-ignore
		 * ```
		 *
		 * When omitted no symbols are excluded from enforcement.
		 *
		 * @defaultValue `undefined` (no ignore file)
		 */
		ignoreFile?: string;
	};

	/**
	 * DocTest configuration — controls execution of `@example` blocks as live tests.
	 *
	 * @remarks
	 * When `doctest.enabled` is `true`, `forge doctest` extracts every `@example`
	 * code block from the TSDoc of exported symbols, wraps each block in a Vitest
	 * test file, and executes it. Failures are reported as test errors. This
	 * ensures examples in documentation stay runnable as the codebase evolves.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	doctest: {
		/**
		 * Whether `@example` blocks are extracted and run as tests.
		 *
		 * @remarks
		 * Set to `false` to skip doctest execution entirely. The `cacheDir` is
		 * still respected for cleanup even when disabled.
		 *
		 * @defaultValue `true`
		 */
		enabled: boolean;

		/**
		 * Directory where virtual Vitest test files are written during a doctest run.
		 *
		 * @remarks
		 * forge-ts generates one `.test.ts` file per source file that contains
		 * `@example` blocks and places them in this directory. The directory is
		 * cleaned before each run. Add it to `.gitignore` — its contents are
		 * ephemeral build artifacts.
		 *
		 * @defaultValue `"<rootDir>/.cache/doctest"`
		 */
		cacheDir: string;
	};

	/**
	 * API generation configuration — controls OpenAPI spec output.
	 *
	 * @remarks
	 * When `api.enabled` is `true`, forge-ts scans exported functions annotated
	 * with `@route` tags and assembles an OpenAPI 3.1 specification. This
	 * requires `api.openapi` to be `true` as well. The feature is disabled by
	 * default because most projects do not expose HTTP routes through exported
	 * TypeScript functions.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	api: {
		/**
		 * Whether the API generation pipeline runs.
		 *
		 * @remarks
		 * Must be `true` for any `api.*` sub-setting to take effect. When `false`,
		 * no OpenAPI spec is generated regardless of other settings.
		 *
		 * @defaultValue `false`
		 */
		enabled: boolean;

		/**
		 * Whether to generate an OpenAPI 3.1 specification from `@route`-tagged exports.
		 *
		 * @remarks
		 * Requires `api.enabled` to be `true`. When enabled, forge-ts reads
		 * `@route`, `@param`, `@returns`, and `@response` TSDoc tags on exported
		 * functions to construct path items and operation objects.
		 *
		 * @defaultValue `false`
		 */
		openapi: boolean;

		/**
		 * File path where the generated `openapi.json` is written.
		 *
		 * @remarks
		 * The path may be absolute or relative to {@link rootDir}. The parent
		 * directory is created automatically. Ignored unless both `api.enabled`
		 * and `api.openapi` are `true`.
		 *
		 * @defaultValue `"<rootDir>/docs/openapi.json"`
		 */
		openapiPath: string;
	};

	/**
	 * Documentation generation configuration — controls what files are written by `forge gen`.
	 *
	 * @remarks
	 * `forge gen` extracts symbols, enriches them with TSDoc metadata, and writes
	 * human- and machine-readable documentation artifacts to {@link outDir}.
	 * The output format and target SSG platform are controlled here.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	gen: {
		/**
		 * Whether the documentation generation pipeline runs.
		 *
		 * @remarks
		 * Set to `false` to disable all file output from `forge gen`. Enforcement
		 * and doctests are not affected.
		 *
		 * @defaultValue `true`
		 */
		enabled: boolean;

		/**
		 * Output formats to generate.
		 *
		 * @remarks
		 * Supported values:
		 * - `"markdown"` — plain `.md` files compatible with any Markdown renderer.
		 * - `"mdx"` — MDX files with front matter; required for React-based SSGs
		 *   (Fumadocs, Nextra, Docusaurus with MDX plugin).
		 *
		 * Multiple formats may be listed; forge-ts writes each in a separate
		 * sub-directory under {@link outDir}.
		 *
		 * @defaultValue `["markdown"]`
		 */
		formats: Array<"markdown" | "mdx">;

		/**
		 * Whether to generate `llms.txt` and `llms-full.txt` alongside the main docs.
		 *
		 * @remarks
		 * `llms.txt` contains a condensed, token-efficient summary of the public API
		 * following the llms.txt convention. `llms-full.txt` contains the complete
		 * symbol set with full TSDoc. Both files are written to {@link outDir}.
		 * These files are consumed by AI coding assistants and context7-style
		 * documentation indexers.
		 *
		 * @defaultValue `true`
		 */
		llmsTxt: boolean;

		/**
		 * Whether to synchronise generated symbol summaries back into `README.md`.
		 *
		 * @remarks
		 * When `true`, forge-ts looks for `<!-- FORGE:AUTO -->` comment markers in
		 * `README.md` and replaces the content between them with an up-to-date API
		 * summary table. The rest of the README is left untouched. Useful for keeping
		 * a hand-authored README aligned with the actual exported API.
		 *
		 * @defaultValue `false`
		 */
		readmeSync: boolean;

		/**
		 * Static site generator to target when writing documentation output.
		 *
		 * @remarks
		 * Controls front matter schema, sidebar metadata file format, and any
		 * SSG-specific component wrapping in MDX output. Supported values:
		 * - `"fumadocs"` — Fumadocs-compatible MDX with `meta.json` sidebar files.
		 * - `"mintlify"` — Mintlify front matter schema.
		 * - `"docusaurus"` — Docusaurus MDX conventions.
		 * - `"nextra"` — Nextra `_meta.json` sidebar format.
		 * - `"vitepress"` — VitePress Markdown with frontmatter.
		 *
		 * When omitted, generic Markdown/MDX with minimal front matter is written.
		 *
		 * @defaultValue `undefined` (no SSG-specific targeting)
		 */
		ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress" | "fumadocs";

		/**
		 * Whether to generate a Codebase Knowledge Manifest (`ckm.json`).
		 *
		 * @remarks
		 * The CKM is a structured JSON file that maps every exported symbol to its
		 * CKM tags (`@operation`, `@constraint`, `@workflow`, `@concept`), summaries,
		 * and cross-references. It is written to `<outDir>/ckm.json` and is
		 * consumed by agents and tooling that need a machine-readable view of the
		 * codebase's knowledge graph. When omitted the manifest is still generated
		 * (default `true`); set explicitly to `false` to suppress it.
		 *
		 * @defaultValue `true`
		 */
		ckm?: boolean;
	};

	/**
	 * SKILL.md generation settings.
	 *
	 * @remarks
	 * `forge gen` can produce a `SKILL.md` package alongside `llms.txt`. This file
	 * is a structured knowledge document intended for AI coding assistants that need
	 * deep project-specific context: workflow steps, domain gotchas, and architectural
	 * invariants that cannot be inferred from symbol signatures alone. Custom sections
	 * defined here are merged into the auto-generated body.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	skill: {
		/**
		 * Whether to generate a `SKILL.md` package alongside `llms.txt`.
		 *
		 * @remarks
		 * When `true`, a `SKILL.md` file is written to {@link outDir}. When omitted
		 * this inherits the value of `gen.llmsTxt` — i.e. SKILL.md is generated
		 * whenever llms.txt is generated, unless explicitly disabled.
		 *
		 * @defaultValue Follows `gen.llmsTxt`
		 */
		enabled?: boolean;

		/**
		 * Custom sections to inject into the generated `SKILL.md` body.
		 *
		 * @remarks
		 * Each entry becomes a `## heading` section containing the provided
		 * Markdown content. Sections are inserted after the auto-generated API
		 * reference section and before the Gotchas section.
		 *
		 * @defaultValue `undefined` (no custom sections)
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
		 * Extra gotcha bullet points to append to the auto-detected Gotchas section.
		 *
		 * @remarks
		 * Each string is rendered as a `- ` bullet in the Gotchas section of
		 * `SKILL.md`. Use this to surface project-specific pitfalls that static
		 * analysis cannot detect automatically.
		 *
		 * @defaultValue `undefined` (no extra gotchas)
		 */
		extraGotchas?: string[];
	};

	/**
	 * TSDoc ecosystem configuration — tag definitions and group-level enforcement.
	 *
	 * @remarks
	 * Controls two concerns: (1) which custom TSDoc tags are registered in the
	 * generated `tsdoc.json` preset, and (2) how the three TSDoc standardisation
	 * groups map to default severities for enforcement rules. Individual rule
	 * overrides in `enforce.rules` always take precedence over group severities.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	tsdoc: {
		/**
		 * Whether `forge init` writes a `tsdoc.json` preset to the project root.
		 *
		 * @remarks
		 * The written preset extends the forge-ts built-in tag definitions and any
		 * entries in `tsdoc.customTags`. IDEs and other TSDoc-aware tools (e.g.
		 * API Extractor) pick this file up automatically. Set to `false` if you
		 * manage your own `tsdoc.json`.
		 *
		 * @defaultValue `true`
		 */
		writeConfig: boolean;

		/**
		 * Additional TSDoc tag definitions to register beyond the forge-ts preset.
		 *
		 * @remarks
		 * Each entry declares a custom tag that the TSDoc parser should recognise
		 * rather than report as an unknown tag. The `tagName` must begin with `@`.
		 * Valid `syntaxKind` values:
		 * - `"block"` — freestanding block (e.g. `@remarks`, `@example`).
		 * - `"inline"` — used inline within text (e.g. `{@link}`).
		 * - `"modifier"` — presence-only tag with no content (e.g. `@public`).
		 *
		 * @defaultValue `[]`
		 * @example
		 * ```typescript
		 * customTags: [
		 *   { tagName: "@route", syntaxKind: "block" },
		 *   { tagName: "@operation", syntaxKind: "block" },
		 * ]
		 * ```
		 */
		customTags: Array<{
			tagName: string;
			syntaxKind: "block" | "inline" | "modifier";
		}>;

		/**
		 * Default severity for each TSDoc standardisation group.
		 *
		 * @remarks
		 * forge-ts assigns every enforcement rule to one of three groups (see
		 * {@link RULE_GROUP_MAP}). The severity set here becomes the default for all
		 * rules in that group, unless the rule is overridden individually in
		 * `enforce.rules`. This allows coarse-grained control — for example,
		 * setting `core: "error"` enforces all core-standard tags (`@param`,
		 * `@returns`, `@remarks`, etc.) as errors without listing them individually.
		 *
		 * @defaultValue `{ core: "error", extended: "warn", discretionary: "off" }`
		 */
		enforce: {
			/**
			 * Default severity for core TSDoc tags (`@param`, `@returns`, `@remarks`, etc.).
			 *
			 * @remarks
			 * Affects: `require-param`, `require-returns`, `require-remarks`,
			 * `require-summary`, `require-class-member-doc`, `require-interface-member-doc`,
			 * `require-type-param`, `require-package-doc`.
			 *
			 * @defaultValue `"error"`
			 */
			core: "error" | "warn" | "off";

			/**
			 * Default severity for extended TSDoc tags (`@example`, `@defaultValue`, `@see`, etc.).
			 *
			 * @remarks
			 * Affects: `require-example`, `require-default-value`, `require-see`,
			 * `require-tsdoc-syntax`, `require-inheritdoc-source`, `require-fresh-examples`.
			 *
			 * @defaultValue `"warn"`
			 */
			extended: "error" | "warn" | "off";

			/**
			 * Default severity for discretionary release tags (`@public`, `@beta`, `@internal`).
			 *
			 * @remarks
			 * Affects: `require-release-tag`.
			 * Set to `"error"` to require every exported symbol to carry an explicit
			 * release tag. The `"off"` default is intentional — many projects adopt
			 * `require-release-tag` via `enforce.rules` rather than this group knob.
			 *
			 * @defaultValue `"off"`
			 */
			discretionary: "error" | "warn" | "off";
		};
	};

	/**
	 * Bypass budget — controls how many temporary rule suppressions are allowed.
	 *
	 * @remarks
	 * The bypass system lets developers temporarily suppress a failing rule on a
	 * specific symbol using a `@forgeBypass` tag without disabling the rule
	 * project-wide. Each bypass is time-limited and counted against a daily budget
	 * to prevent bypass sprawl. Bypasses that exceed the budget or have expired
	 * are reported by `forge check`.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	bypass: {
		/**
		 * Maximum number of active bypasses allowed per calendar day.
		 *
		 * @remarks
		 * Once this limit is reached, `forge check` reports an error rather than
		 * silently allowing additional bypasses. This cap prevents teams from
		 * accumulating bypass debt. Reset at midnight (UTC).
		 *
		 * @defaultValue `3`
		 */
		dailyBudget: number;

		/**
		 * Duration in hours before a bypass automatically expires.
		 *
		 * @remarks
		 * After this many hours the bypass is treated as if it were never present,
		 * and the original rule violation is reported again. This ensures bypasses
		 * are short-lived workarounds rather than permanent suppressions.
		 *
		 * @defaultValue `24`
		 */
		durationHours: number;
	};

	/**
	 * Guide generation configuration — controls intelligent guide page output.
	 *
	 * @remarks
	 * `forge gen` can auto-discover logical guide topics from code patterns and
	 * write narrative guide pages alongside the API reference. Guides are written
	 * to `<outDir>/guides/` and are intended for human readers learning the API,
	 * as opposed to the symbol-level API reference pages.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	guides: {
		/**
		 * Whether guide generation is active.
		 *
		 * @remarks
		 * Set to `false` to skip all guide output. Both auto-discovered and
		 * explicitly defined guides are suppressed.
		 *
		 * @defaultValue `true`
		 */
		enabled: boolean;

		/**
		 * Whether to auto-discover guide topics from static code analysis.
		 *
		 * @remarks
		 * When `true`, forge-ts analyses exported symbols, their TSDoc tags, and
		 * module structure to infer logical groupings and generate guide outlines
		 * automatically. Disable if you want to control all guide topics explicitly
		 * via `guides.custom`.
		 *
		 * @defaultValue `true`
		 */
		autoDiscover: boolean;

		/**
		 * Explicit guide definitions that supplement (or replace) auto-discovered guides.
		 *
		 * @remarks
		 * Each entry defines a single guide page. The `slug` becomes the URL path
		 * segment and the output filename. The `sources` globs are resolved relative
		 * to {@link rootDir} and determine which source files are analysed to
		 * populate the guide's content.
		 *
		 * @defaultValue `[]`
		 * @example
		 * ```typescript
		 * guides: {
		 *   custom: [
		 *     {
		 *       slug: "authentication",
		 *       title: "Authentication Guide",
		 *       sources: ["src/auth/**\/*.ts"],
		 *     },
		 *   ],
		 * }
		 * ```
		 */
		custom: Array<{
			/** URL slug for the guide page (e.g., `"authentication"`). */
			slug: string;
			/** Human-readable title rendered as the page heading. */
			title: string;
			/** Glob patterns for source files to analyse when building this guide. */
			sources: string[];
		}>;
	};

	/**
	 * Downstream config drift guards — validate tooling config files stay in sync.
	 *
	 * @remarks
	 * Guards run during `forge check` and validate that key configuration files
	 * (`tsconfig.json`, `biome.json`, `package.json`) meet minimum quality
	 * requirements. They catch configuration drift that could silently weaken
	 * type safety or code quality enforcement.
	 *
	 * @defaultValue See individual sub-properties.
	 */
	guards: {
		/**
		 * `tsconfig.json` strictness validation.
		 *
		 * @remarks
		 * Checks that the project's `tsconfig.json` has all required strict-mode
		 * compiler flags enabled. This prevents teams from silently downgrading
		 * TypeScript's type safety after the project was initially set up.
		 *
		 * @defaultValue See individual sub-properties.
		 */
		tsconfig: {
			/**
			 * Whether the tsconfig guard runs.
			 *
			 * @remarks
			 * Set to `false` to skip tsconfig strictness validation entirely.
			 *
			 * @defaultValue `true`
			 */
			enabled: boolean;

			/**
			 * TypeScript compiler flags that must be present and set to `true`.
			 *
			 * @remarks
			 * If any listed flag is absent or `false` in the project's
			 * `tsconfig.json`, `forge check` reports an error. Add or remove
			 * flags to match your team's strictness requirements.
			 *
			 * @defaultValue `["strict", "strictNullChecks", "noImplicitAny"]`
			 */
			requiredFlags: string[];
		};

		/**
		 * Biome config drift detection.
		 *
		 * @remarks
		 * When enabled, forge-ts reads `biome.json` and verifies that any rules
		 * that were locked at `"error"` severity during project setup have not been
		 * downgraded. The `lockedRules` list is typically populated automatically
		 * on first run and then committed to version control.
		 *
		 * @defaultValue See individual sub-properties.
		 */
		biome: {
			/**
			 * Whether the Biome guard runs.
			 *
			 * @remarks
			 * Disabled by default because many projects do not use Biome. Enable
			 * alongside `lockedRules` population to catch config drift.
			 *
			 * @defaultValue `false`
			 */
			enabled: boolean;

			/**
			 * Biome rule IDs that must remain at `"error"` level.
			 *
			 * @remarks
			 * Typically auto-detected by forge-ts on the first lock run and then
			 * stored in the config. Any rule in this list that is found at a lower
			 * severity in `biome.json` causes `forge check` to report an error.
			 *
			 * @defaultValue `[]`
			 */
			lockedRules: string[];
		};

		/**
		 * `package.json` field validation.
		 *
		 * @remarks
		 * Validates that `package.json` contains required fields and meets minimum
		 * version constraints. Catches common publishing mistakes such as missing
		 * `"type": "module"` or an absent `"engines"` field.
		 *
		 * @defaultValue See individual sub-properties.
		 */
		packageJson: {
			/**
			 * Whether the package.json guard runs.
			 *
			 * @remarks
			 * Set to `false` to skip all package.json validation.
			 *
			 * @defaultValue `true`
			 */
			enabled: boolean;

			/**
			 * Minimum Node.js version that must appear in the `"engines"` field.
			 *
			 * @remarks
			 * If the `engines.node` range in `package.json` permits a Node.js
			 * version lower than this value, `forge check` reports an error.
			 * Use a semver version string such as `"22.0.0"`.
			 *
			 * @defaultValue `"22.0.0"`
			 */
			minNodeVersion: string;

			/**
			 * Top-level fields that must be present in `package.json`.
			 *
			 * @remarks
			 * Each string is a key that must exist (and be non-empty) in
			 * `package.json`. Missing fields cause `forge check` to report an error.
			 *
			 * @defaultValue `["type", "engines"]`
			 */
			requiredFields: string[];
		};
	};

	/**
	 * Warnings generated during config loading (e.g., unknown keys, failed imports).
	 *
	 * @remarks
	 * Populated by {@link loadConfig} when the user's config contains keys that
	 * forge-ts does not recognise, or when the config file exists but cannot be
	 * imported (e.g. missing `"type": "module"`). Agents and CI scripts should
	 * surface these warnings in their output so problems are caught early.
	 * This field is never set in user-authored config files.
	 *
	 * @defaultValue `undefined`
	 * @internal
	 */
	_configWarnings?: string[];

	/**
	 * Project metadata — auto-detected from `package.json` when not provided.
	 *
	 * @remarks
	 * forge-ts reads `package.json` after loading the user config and fills in
	 * any `project.*` fields that were not explicitly set. Explicit values always
	 * win over auto-detected ones. This data is embedded in generated docs,
	 * `llms.txt`, and the CKM manifest.
	 *
	 * @defaultValue `{}` (all fields auto-detected from `package.json`)
	 */
	project: {
		/**
		 * Repository URL for the project.
		 *
		 * @remarks
		 * Auto-detected from the `"repository"` field in `package.json`. Both
		 * string form (`"https://github.com/user/repo"`) and object form
		 * (`{ type: "git", url: "..." }`) are normalised to a plain HTTPS URL.
		 * `git+` prefixes and `.git` suffixes are stripped automatically.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 */
		repository?: string;

		/**
		 * Project homepage URL.
		 *
		 * @remarks
		 * Auto-detected from the `"homepage"` field in `package.json`. Used as the
		 * canonical project URL in generated documentation.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 */
		homepage?: string;

		/**
		 * npm package name for the primary package.
		 *
		 * @remarks
		 * Auto-detected from the `"name"` field in `package.json`. Used in
		 * generated `llms.txt` headers and install instructions. In a monorepo
		 * this should be the name of the main/CLI package.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 */
		packageName?: string;

		/**
		 * Short description of the project.
		 *
		 * @remarks
		 * Auto-detected from the `"description"` field in `package.json`.
		 * Appears in generated documentation page headings and the CKM manifest.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 */
		description?: string;

		/**
		 * Current version of the package.
		 *
		 * @remarks
		 * Auto-detected from the `"version"` field in `package.json`. Embedded in
		 * generated documentation and `llms.txt` headers so readers know which
		 * version the docs describe.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 */
		version?: string;

		/**
		 * CLI entry points from the `"bin"` field in `package.json`.
		 *
		 * @remarks
		 * Auto-detected and normalised: a string `"bin"` value is converted to
		 * `{ "<package-name>": "<path>" }`. Used in generated SKILL.md to document
		 * available CLI commands.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 * @example
		 * ```typescript
		 * bin: { "forge": "./dist/cli.js" }
		 * ```
		 */
		bin?: Record<string, string>;

		/**
		 * npm scripts from `package.json`.
		 *
		 * @remarks
		 * Auto-detected from the `"scripts"` field in `package.json`. Surfaced in
		 * generated SKILL.md so AI assistants know the project's development workflow.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 * @example
		 * ```typescript
		 * scripts: { "test": "vitest", "build": "tsup", "check": "forge check" }
		 * ```
		 */
		scripts?: Record<string, string>;

		/**
		 * npm keywords for the package.
		 *
		 * @remarks
		 * Auto-detected from the `"keywords"` field in `package.json`. Used to
		 * improve discoverability in generated documentation and the CKM manifest.
		 *
		 * @defaultValue Auto-detected from `package.json`
		 */
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
