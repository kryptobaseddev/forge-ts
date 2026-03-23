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
  (8) locking configs against agent drift (agent-proof guardrails),
  (9) generating guides from code analysis (@guide, @concept tags),
  (10) user mentions "forge-ts", "TSDoc enforcement", "doctest", "documentation
  compiler", or asks about generating docs from TypeScript source.
---

# forge-ts

The documentation compiler for TypeScript. Enforces TSDoc as a build gate,
then generates everything from your documented source code in one pass.
33 enforcement rules across 4 layers. 6 packages at v0.19.5.

## Quick Start

```bash
npm install -D @forge-ts/cli
npx forge-ts check            # Lint TSDoc coverage (33 rules)
npx forge-ts test              # Run @example blocks as tests
npx forge-ts build             # Generate all artifacts
npx forge-ts init docs         # Scaffold SSG site
npx forge-ts init hooks        # Scaffold pre-commit hooks (husky/lefthook)
npx forge-ts docs dev          # Launch dev server
npx forge-ts lock              # Snapshot config to prevent drift
npx forge-ts prepublish        # Safety gate: check + build
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

## CLI Commands

| Command | Description |
|---------|-------------|
| `forge-ts check` | Lint TSDoc coverage. Runs all 33 enabled rules. Supports `--staged`. |
| `forge-ts test` | Extract `@example` blocks and run as doctests via `node:test`. |
| `forge-ts build` | Generate API reference, doc site, llms.txt, SKILL.md, README sync. |
| `forge-ts init setup` | Initial project setup: scaffold config, tsdoc.json, and recommended scripts. |
| `forge-ts init docs` | Scaffold documentation site for configured SSG target. |
| `forge-ts init hooks` | Scaffold pre-commit hooks (Husky v9) with `forge-ts check`. Adds `prepare` script. |
| `forge-ts docs dev` | Start local dev server for configured SSG target. |
| `forge-ts lock` | Snapshot current config to `.forge-lock.json`. |
| `forge-ts unlock --reason` | Remove config lock. Requires justification string. |
| `forge-ts bypass --reason` | Create temporary rule bypass. Subject to daily budget. |
| `forge-ts audit` | Display append-only audit trail from `.forge-audit.jsonl`. |
| `forge-ts prepublish` | Safety gate: runs `check` + `build`. Non-zero exit on failure. |
| `forge-ts doctor` | Validate project setup: checks Husky hooks, prepare script, tsdoc.json, config. |

All commands support `--json` (LAFS envelope), `--human`, `--quiet`, `--mvi`.

## Enforcer Rules (33 rules, 4 layers)

### API Layer (10 rules)

| Code | Config Key | Default | Checks |
|------|-----------|---------|--------|
| E001 | `require-summary` | error | Exported symbol missing TSDoc summary |
| E002 | `require-param` | error | Function parameter missing `@param` tag |
| E003 | `require-returns` | error | Non-void function missing `@returns` tag |
| E004 | `require-example` | error | Exported function missing `@example` block |
| E005 | `require-package-doc` | error | Entry point missing `@packageDocumentation` |
| E006 | `require-class-member-doc` | error | Class member missing documentation |
| E007 | `require-interface-member-doc` | error | Interface/type member missing documentation |
| E008 | -- | error | `{@link}` references non-existent symbol |
| W003 | -- | warn | `@deprecated` tag without explanation text |
| W004 | -- | warn | Cross-package import of deprecated symbol |

### Dev Layer (8 rules)

| Code | Config Key | Default | Checks |
|------|-----------|---------|--------|
| E013 | `require-remarks` | error | Public function/class missing `@remarks` block |
| E014 | `require-default-value` | warn | Optional property missing `@defaultValue` tag |
| E015 | `require-type-param` | error | Generic symbol missing `@typeParam` |
| E017 | `require-internal-boundary` | error | `@internal` symbol re-exported via public barrel |
| E018 | `require-route-response` | warn | `@route` handler missing `@response` tag |
| W005 | `require-see` | warn | Symbol has `{@link}` but no `@see` tags |
| W006 | `require-tsdoc-syntax` | warn | TSDoc parser syntax error (70+ message types) |
| W009 | `require-inheritdoc-source` | warn | `{@inheritDoc}` target does not exist |

### Consumer Layer (5 rules)

| Code | Config Key | Default | Checks |
|------|-----------|---------|--------|
| E016 | `require-release-tag` | error | Missing `@public`/`@beta`/`@internal` release tag |
| W007 | `require-fresh-guides` | warn | FORGE:AUTO zone references symbol that no longer exists |
| W008 | `require-guide-coverage` | warn | Public symbol from index.ts not in any guide page |
| W010 | `require-migration-path` | warn | `@breaking` without `@migration` path |
| W011 | `require-since` | warn | New public export missing `@since` version |

### LLM Anti-Pattern Layer (4 rules)

| Code | Config Key | Default | Checks |
|------|-----------|---------|--------|
| E019 | `require-no-ts-ignore` | error | `@ts-ignore`/`@ts-expect-error` in non-test file |
| E020 | `require-no-any-in-api` | error | `any` type in public API signature |
| W012 | `require-fresh-link-text` | warn | `{@link}` display text stale vs target summary |
| W013 | `require-fresh-examples` | warn | `@example` call arg count mismatches signature |

### Config Guard Layer (4 rules, always error, not configurable)

| Code | Checks |
|------|--------|
| E009 | `tsconfig.json` strict flag missing or disabled |
| E010 | Rule severity weaker than `.forge-lock.json` baseline |
| E011 | Biome rule weakened below locked severity |
| E012 | `engines.node` below minimum version or required field missing |

Configurable rules accept `"error"` | `"warn"` | `"off"` in `enforce.rules`.

Fix examples: [references/enforcer-rules.md](references/enforcer-rules.md)

## Zone System (Idempotent Regeneration)

| Zone | Marker | Behavior |
|------|--------|----------|
| `FORGE:AUTO` | `<!-- FORGE:AUTO-START id -->` | Regenerated every build. User edits overwritten. |
| `FORGE:STUB` | `<!-- FORGE:STUB-START id -->` | Generated once with content hash. Preserved after user edits. |
| Unmarked | (none) | User-owned. Never read or modified by forge-ts. |

FORGE:STUB zones include a `<!-- FORGE:STUB-HASH: xxx -->` comment. If content
still matches the hash, it is eligible for regeneration. Once edited, preserved.

## Agent-Proof System

Prevents AI agents from silently weakening project standards.

- **Lock**: `forge-ts lock` snapshots rule severities to `.forge-lock.json`. E010 fires on drift.
- **Audit**: `.forge-audit.jsonl` append-only log of lock/unlock/bypass/config changes.
- **Bypass**: `forge-ts bypass --reason "..."` creates temporary exemption. Daily budget (default: 3). Auto-expires (default: 24h).
- **LLM anti-pattern detection**: Flags `@ts-ignore`, `any` casts, `strict: false`, `"off"` overrides.

## Guide Discovery

`forge-ts build` auto-discovers guide topics via 5 heuristics:

| Heuristic | Trigger | Result |
|-----------|---------|--------|
| config-interface | Types matching `/config\|options\|settings/i` | Configuration guide |
| error-types | `@throws` tags or `Error`/`Exception` classes | Error handling guide |
| guide-tag | `@guide` tag on symbol | Guide per unique value |
| category | `@category` tag on symbol | Guide per category |
| entry-point | Exports from `index.ts` | Entry point overview |

## SSoT Principle

Source code IS documentation. Change a function signature, docs update on
next build. Remove a parameter, docs remove it. Add an `@example`, it
becomes a doctest AND a doc page entry AND part of the SKILL.md.

## Configuration

```typescript
// forge-ts.config.ts
import { defineConfig } from "@forge-ts/core";

export default defineConfig({
  rootDir: ".",
  outDir: "./docs/generated",
  enforce: {
    ignoreFile: ".forge-ignore",
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
  guards: {
    tsconfig: { enabled: true },
    biome: { enabled: true },
    packageJson: { enabled: true },
  },
});
```

10 config sections: `enforce`, `doctest`, `api`, `gen`, `skill`, `tsdoc`,
`guards`, `bypass`, `guides`, `project`. Full reference:
[references/configuration.md](references/configuration.md)

## Key Gotchas

- Enforcer checks ALL files in tsconfig. Exclude test fixtures via `exclude`.
- Unknown config keys warn to stderr and in `result._warnings`.
- `@example` blocks require fenced code blocks. Bare code is silently ignored.
- `// => value` in examples auto-converts to `assert.strictEqual()` during doctest.
- `@internal` symbols excluded from ALL output. `@beta` filtered at `minVisibility: "public"`.
- `forge-ts build` writes pages; `init docs` adds SSG scaffold/config.
- FORGE:STUB pages are preserved after user edits (hash-based detection).
- FORGE:AUTO zones always regenerate — do not edit content inside markers.
- Guard rules (E009-E012) check `isRuleBypassed()` before emitting.
- Lock file (`.forge-lock.json`) must exist for E010 to fire.

## Packages

| Package | Purpose |
|---------|---------|
| `@forge-ts/cli` | Unified CLI entry point (citty + consola) — install this one |
| `@forge-ts/core` | AST walker, config loader (`defineConfig()`), lock/audit/bypass, shared pkg-json.ts, bundled tsdoc-preset |
| `@forge-ts/enforcer` | 33 rules across 4 layers (API, Dev, Consumer, Config Guard) |
| `@forge-ts/doctest` | @example extraction + node:test runner |
| `@forge-ts/api` | OpenAPI 3.2.0 generation from @route tags |
| `@forge-ts/gen` | MDX generation, guide discovery, llms.txt, SKILL, SSG adapters |

## Custom TSDoc Tags (15 tags)

| Tag | Kind | Purpose |
|-----|------|---------|
| `@route` | block | HTTP route path for OpenAPI (e.g., `@route GET /api/users`) |
| `@category` | block | Symbol grouping for guide discovery |
| `@since` | block | Version when symbol was introduced |
| `@guide` | block | Associates symbol with a named guide page |
| `@concept` | block | Links symbol to a concepts page section |
| `@response` | block | HTTP response type/status |
| `@query` | block | Query parameter documentation |
| `@header` | block | HTTP header documentation |
| `@body` | block | Request body schema |
| `@quickstart` | modifier | "Start here" marker |
| `@faq` | block | FAQ entry association |
| `@breaking` | block | Breaking change documentation |
| `@migration` | block | Migration path from old API |
| `@complexity` | block | Algorithmic complexity |
| `@forgeIgnore` | modifier | Skip all enforcement on this symbol |

## References

| Need | Reference | When to load |
|------|-----------|-------------|
| Config options, all 10 sections, defaults | [references/configuration.md](references/configuration.md) | Setting up `forge-ts.config.ts` or troubleshooting |
| Fix a specific enforcer error (E001-E020, W001-W013) | [references/enforcer-rules.md](references/enforcer-rules.md) | `check` reports errors and you need fix examples |
| TSDoc tags, syntax kinds, standardization groups | [references/tsdoc-tags.md](references/tsdoc-tags.md) | Understanding which tags exist, their kinds, custom tags, tag-to-rule mapping |
| Programmatic API (functions, types, sigs) | [references/api-reference.md](references/api-reference.md) | Calling forge-ts from code instead of CLI |
| Skill package config, custom sections | [references/skill-config.md](references/skill-config.md) | Customizing generated SKILL.md |
| Zones, guide discovery, editing strategy | [references/guides.md](references/guides.md) | Understanding which pages to edit and which are hands-off |
