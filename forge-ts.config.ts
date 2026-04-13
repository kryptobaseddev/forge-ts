import type { ForgeConfig } from "@forge-ts/core";

export default {
	rootDir: ".",
	tsconfig: "./tsconfig.json",
	outDir: "./docs/generated",
	enforce: {
		enabled: true,
		minVisibility: "public",
		strict: false,
	},
	doctest: {
		enabled: true,
		cacheDir: ".cache/doctest",
	},
	api: {
		enabled: true,
		openapi: true,
		openapiPath: "./docs/generated/api/openapi.json",
	},
	gen: {
		enabled: true,
		formats: ["markdown"],
		llmsTxt: true,
		readmeSync: false,
		ssgTarget: "fumadocs",
	},
	skill: {
		customSections: [
			{
				heading: "The Flow",
				content: [
					"```",
					"Your TypeScript code",
					"  |  Write TSDoc comments (@param, @returns, @example, etc.)",
					"  v",
					"forge-ts check   -->  FAILS if docs incomplete (exact fix suggestions)",
					"  v",
					"forge-ts build   -->  Generates ALL artifacts from TSDoc",
					"  v",
					"forge-ts docs init --target fumadocs  -->  Scaffolds SSG project",
					"  v",
					"forge-ts docs dev  -->  Preview locally",
					"```",
				].join("\n"),
			},
			{
				heading: "CLI Commands",
				content: [
					"| Command | Purpose |",
					"|---------|---------|",
					"| `forge-ts check` | Enforce TSDoc on all public exports |",
					"| `forge-ts check --json --mvi full` | Agent-friendly JSON with exact fix suggestions |",
					"| `forge-ts test` | Extract and execute @example blocks |",
					"| `forge-ts build` | Generate all docs, OpenAPI, llms.txt, SKILL.md |",
					"| `forge-ts build --force-stubs` | Reset stub pages to scaffolding state |",
					"| `forge-ts docs init --target fumadocs` | Scaffold SSG doc site |",
					"| `forge-ts docs dev` | Launch dev server (`npx next dev`) |",
					"",
					"**Output format**: TTY gets human-readable output by default. " +
						"Piped/non-TTY (agents, CI) gets JSON (LAFS envelope). " +
						"Override with `--human` or `--json`. " +
						"For monorepos, use `--cwd packages/<name>` to target a specific package.",
					"",
					"The `--mvi` flag controls JSON verbosity: `minimal` (~50 tokens), `standard` (~200), `full` (~500+).",
				].join("\n"),
			},
			{
				heading: "SSoT Principle",
				content:
					"Source code IS documentation. Change a function signature, docs update on " +
					"next build. Remove a parameter, docs remove it. Add an `@example`, it " +
					"becomes a doctest AND a doc page entry AND part of the SKILL.md.",
			},
			{
				heading: "Auto-Generated vs Stub Pages",
				content: [
					"`forge-ts build` produces two categories of output:",
					"",
					"**Auto-generated (regenerated every build):** index.mdx, getting-started.mdx, " +
						"configuration.mdx, packages/*/api/*.mdx, api/openapi.json, llms.txt, " +
						"llms-full.txt, SKILL.md, docs.json",
					"",
					"**Stubs (created once, progressively enriched):** concepts.mdx, " +
						"guides/index.mdx, faq.mdx, contributing.mdx, changelog.mdx",
					"",
					"Stubs contain `<!-- FORGE:AUTO-START id -->` / `<!-- FORGE:AUTO-END id -->` " +
						"markers. On rebuild, content inside markers is updated from source while " +
						"manual content outside markers is preserved.",
					"",
					"Use `--force-stubs` to reset stubs to their scaffolding state.",
				].join("\n"),
			},
			{
				heading: "Enforcer Rules",
				content: [
					"| Code | What it checks |",
					"|------|----------------|",
					"| E001 | Exported symbol missing TSDoc summary |",
					"| E002 | Function parameter missing `@param` tag |",
					"| E003 | Non-void function missing `@returns` tag |",
					"| E004 | Exported function missing `@example` block |",
					"| E005 | Entry point missing `@packageDocumentation` |",
					"| E006 | Class member missing documentation |",
					"| E007 | Interface/type member missing documentation |",
					"| E008 | `{@link}` references non-existent symbol |",
					"| W004 | Importing `@deprecated` symbol cross-package |",
					"",
					'Rules accept `"error"` | `"warn"` | `"off"` in config `enforce.rules`.',
					"When `strict: true`, all warnings become errors.",
					"When `--json --mvi full`, each error includes `suggestedFix` with the exact TSDoc block to paste.",
				].join("\n"),
			},
			{
				heading: "Packages",
				content: [
					"| Package | Purpose |",
					"|---------|---------|",
					"| `@forge-ts/cli` | Unified CLI (install this one) |",
					"| `@forge-ts/core` | AST walker, config loader, shared types |",
					"| `@forge-ts/enforcer` | TSDoc enforcement (E001-E008, W004) |",
					"| `@forge-ts/doctest` | @example extraction + node:test runner |",
					"| `@forge-ts/api` | OpenAPI 3.2 generation from types |",
					"| `@forge-ts/gen` | Markdown/MDX, llms.txt, SKILL.md, SSG adapters |",
				].join("\n"),
			},
		],
		extraGotchas: [
			"Enforcer checks ALL files in tsconfig. Exclude test fixtures via `exclude`.",
			"`@example` blocks require fenced code blocks. Bare code is silently ignored.",
			"`// => value` in examples auto-converts to `assert.strictEqual()` during doctest.",
			'`@internal` symbols excluded from ALL output. `@beta` filtered at `minVisibility: "public"`.',
			"OpenAPI paths require `@route GET /path` tags. No `@route` = empty `paths`.",
			"Fumadocs adapter generates `meta.json` per directory for navigation.",
			"Stub pages use FORGE:AUTO markers — manual content outside markers is safe.",
			"`--force-stubs` resets stubs to scaffolding; use with care on edited stubs.",
		],
	},
} satisfies Partial<ForgeConfig>;
