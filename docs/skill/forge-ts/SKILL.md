---
name: forge-ts
description: >
  Universal TypeScript documentation compiler. Enforces TSDoc coverage as a
  build gate, then generates all documentation artifacts from source code in
  one pass. Use when:
  (1) checking or enforcing TSDoc coverage on TypeScript exports,
  (2) running @example blocks as tests (doctests),
  (3) generating OpenAPI 3.2 specs from @route tags,
  (4) creating documentation sites (Mintlify, Docusaurus, Nextra, VitePress),
  (5) producing AI context files (llms.txt, llms-full.txt, SKILL.md),
  (6) configuring forge-ts.config.ts or per-rule enforcement,
  (7) understanding auto-generated vs stub doc pages and their idempotency,
  (8) user mentions "forge-ts", "TSDoc enforcement", "doctest", "documentation
  compiler", or asks about generating docs from TypeScript source.
---

# forge-ts

The documentation compiler for TypeScript. Enforces TSDoc as a build gate,
then generates everything from your documented source code in one pass.

## Quick Start

```bash
npm install -D @forge-ts/cli
npx forge-ts check          # Triage: every error cause + priorities
npx forge-ts test           # Run @example blocks as tests
npx forge-ts build          # Generate all artifacts
npx forge-ts docs init      # Write Mintlify adapter scaffold/config
npx forge-ts docs dev       # Launch dev server
```

## Fixing TSDoc Errors (Agent Workflow)

The check command uses progressive disclosure to fit agent context windows.
Follow `result.nextCommand` — it tells you exactly what to run next.

**Step 1: Get the battle plan** (~500-2000 tokens)
```bash
npx forge-ts check
```
Returns `summary` (total counts), `triage` (every rule with counts, top files,
quick wins), and the first 20 files without suggestedFix. Read `triage.fixOrder`
to see which rules affect the fewest files — fix those first.

**Step 2: Drill into a rule** (follows `result.nextCommand`)
```bash
npx forge-ts check --rule E005 --mvi full
```
Returns ONLY errors for that rule WITH `suggestedFix` — the exact TSDoc to paste.
Apply the fixes, then check the next `result.nextCommand`.

**Step 3: Batch large rules by page**
```bash
npx forge-ts check --rule E001 --limit 10 --mvi full
npx forge-ts check --rule E001 --limit 10 --offset 10 --mvi full
```
Paginate through files 10 at a time. Each page includes suggestedFix.

**Step 4: Verify progress**
```bash
npx forge-ts check --mvi minimal
```
Returns only counts (~50 tokens). Repeat from step 1 when ready.

### Key fields in the JSON result

| Field | What it tells you |
|-------|-------------------|
| `summary` | Total error/warning/file/symbol counts |
| `triage.byRule` | Every rule code with violation count and file count |
| `triage.topFiles` | Top 20 worst files by error count |
| `triage.fixOrder` | Rules sorted by fewest files affected (quick wins first) |
| `byFile` | Paginated file groups with per-error details |
| `page` | `{ offset, limit, hasMore, total }` — pagination state |
| `nextCommand` | Exact CLI command to run next |
| `filters` | Active `--rule` / `--file` filters |

### Check CLI flags

| Flag | Purpose |
|------|---------|
| `--rule E001` | Filter to a specific rule code |
| `--file src/types.ts` | Filter to files matching substring |
| `--limit 20` | Max file groups per page (default: 20) |
| `--offset 0` | Skip N file groups for pagination |
| `--mvi minimal` | Counts only (~50 tokens) |
| `--mvi standard` | Triage + byFile without suggestedFix (default) |
| `--mvi full` | Triage + byFile with suggestedFix |
| `--strict` | Treat warnings as errors |

## SSoT Principle

Source code IS documentation. Change a function signature, docs update on
next build. Remove a parameter, docs remove it. Add an `@example`, it
becomes a doctest AND a doc page entry AND part of the SKILL.md.

## Auto-Generated vs Stub Pages

`forge-ts build` produces two categories of output:

### Auto-generated (regenerated every build, always fresh)

| Output | Source |
|--------|--------|
| `index.mdx` | package.json + @packageDocumentation |
| `getting-started.mdx` | First @example block |
| `configuration.mdx` | Detected Config types |
| `packages/<name>/api/functions.mdx` | @param, @returns, @example |
| `packages/<name>/api/types.mdx` | Interface properties |
| `packages/<name>/api/examples.mdx` | Aggregated @example blocks |
| `api/openapi.json` | Types + @route tags |
| `llms.txt` / `llms-full.txt` | Compact/dense AI context |
| `SKILL-{project}/SKILL.md` | agentskills.io package |
| `docs.json` | SSG navigation config (when ssgTarget set) |

### Stubs (created once, never overwritten)

| Output | Purpose |
|--------|---------|
| `concepts.mdx` | Architecture, mental model (domain knowledge) |
| `guides/index.mdx` | How-to guides for specific tasks |
| `faq.mdx` | Common questions |
| `contributing.mdx` | Contribution guidelines |
| `changelog.mdx` | Release history |

Stubs use `<!-- FORGE:AUTO-START -->` / `<!-- FORGE:AUTO-END -->` markers.
Content inside markers refreshes on build; content outside is preserved.

## build vs docs init

`forge-ts build` writes all doc pages, llms.txt, SKILL.md, and SSG config
into `outDir`. `forge-ts docs init` adds SSG-specific adapter scaffold
(e.g. `docs.json` for Mintlify). Run `build` first, then `docs init`.

## Enforcer Rules

| Code | What it checks |
|------|----------------|
| E001 | Exported symbol missing TSDoc summary |
| E002 | Function parameter missing `@param` tag |
| E003 | Non-void function missing `@returns` tag |
| E004 | Exported function missing `@example` block |
| E005 | Entry point missing `@packageDocumentation` |
| E006 | Class member missing documentation |
| E007 | Interface/type member missing documentation |
| E008 | `{@link}` references non-existent symbol |
| W004 | Importing `@deprecated` symbol cross-package |

Rules accept `"error"` | `"warn"` | `"off"` in config `enforce.rules`.

Fix examples: [references/enforcer-rules.md](references/enforcer-rules.md)

## Configuration

```typescript
// forge-ts.config.ts
import type { ForgeConfig } from "@forge-ts/core";

export default {
  rootDir: ".",
  outDir: "./docs/generated",
  enforce: {
    rules: {
      "require-example": "warn",
      "require-package-doc": "off",
    },
  },
  gen: {
    formats: ["markdown"],
    llmsTxt: true,
    ssgTarget: "mintlify",
  },
} satisfies Partial<ForgeConfig>;
```

Zero-config works out of the box. Unknown keys warn in `result._warnings`.

## Key Gotchas

- Enforcer checks ALL files in tsconfig. Exclude test fixtures via `exclude`.
- Unknown config keys warn to stderr and in `result._warnings`.
- If the config file fails to load (`.ts` without `"type": "module"`), that is warned too.
- `@example` blocks require fenced code blocks. Bare code is silently ignored.
- `// => value` in examples auto-converts to `assert.strictEqual()` during doctest.
- `@internal` symbols excluded from ALL output. `@beta` filtered at `minVisibility: "public"`.
- `forge-ts build` writes pages; `docs init` adds SSG scaffold/config.
- Stub pages are NEVER overwritten — safe to edit after first build.

## Packages

| Package | Purpose |
|---------|---------|
| `@forge-ts/cli` | Unified CLI (install this one) |
| `@forge-ts/core` | AST walker, config loader, shared types |
| `@forge-ts/enforcer` | TSDoc enforcement (E001-E008, W004) |
| `@forge-ts/doctest` | @example extraction + node:test runner |
| `@forge-ts/api` | OpenAPI 3.2 generation from types |
| `@forge-ts/gen` | Markdown/MDX, llms.txt, SKILL.md, SSG adapters |

## References

| Need | Reference | When to load |
|------|-----------|-------------|
| Config options, defaults, project metadata | [references/configuration.md](references/configuration.md) | Setting up `forge-ts.config.ts` or troubleshooting unknown keys |
| Fix a specific enforcer error (E001-E008) | [references/enforcer-rules.md](references/enforcer-rules.md) | `check` reports errors and you need fix examples |
| Programmatic API (functions, types, sigs) | [references/api-reference.md](references/api-reference.md) | Calling forge-ts from code instead of CLI |
| Skill package config, custom sections, naming | [references/skill-config.md](references/skill-config.md) | Customizing generated SKILL.md or understanding `SKILL-{project}` |
| Auto vs stub pages, editing strategy, markers | [references/guides.md](references/guides.md) | Understanding which pages to edit and which are hands-off |
