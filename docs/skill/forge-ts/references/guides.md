# forge-ts Generated Pages & Guide System (v0.19.4)

## Page Categories

forge-ts build produces two categories of documentation pages. Understanding
which are auto-generated and which are stubs determines your editing strategy.

## Auto-Generated Pages (Hands-Off)

These pages are **regenerated from source code on every build**. Do not edit
them — your changes will be overwritten. Fix the source code instead.

| Page | What it contains | Fix by |
|------|-----------------|--------|
| `index.mdx` | Project overview from `@packageDocumentation` and `package.json` | Edit `package.json` description or entry point TSDoc |
| `getting-started.mdx` | First `@example` block found in exports | Edit the `@example` tag on your primary export |
| `configuration.mdx` | Detected config types with property descriptions | Add/edit TSDoc on your config interface members |
| `packages/<name>/api/functions.mdx` | Function signatures, params, returns, examples | Edit `@param`, `@returns`, `@example` on functions |
| `packages/<name>/api/types.mdx` | Interface/type property documentation | Edit TSDoc on interface members |
| `packages/<name>/api/examples.mdx` | Aggregated `@example` blocks | Add/edit `@example` blocks on exports |
| `llms.txt` / `llms-full.txt` | Compact AI context | Improve TSDoc summaries |
| `SKILL-{project}/SKILL.md` | agentskills.io skill package | Use `config.skill.customSections` |

## Stub Pages (Human/Agent Edited)

Created once on first build. Content outside zone markers is preserved.

| Page | Purpose | What to write |
|------|---------|--------------|
| `concepts.mdx` | Architecture and mental models | Domain knowledge, design decisions |
| `guides/index.mdx` | How-to guides | Step-by-step workflows |
| Auto-discovered guides | Code-derived guide pages | Extend generated structure |
| `faq.mdx` | Common questions | Answers from issues, support |
| `contributing.mdx` | Contribution guidelines | Dev setup, PR process |
| `changelog.mdx` | Release history | Notable changes per version |

## Three-Zone Ownership Model

forge-ts uses three zone types for idempotent regeneration:

### FORGE:AUTO Zones

Delimited by `<!-- FORGE:AUTO-START id -->` and `<!-- FORGE:AUTO-END id -->`.
Content is **regenerated from code on every build**. User edits are overwritten.

```markdown
## API Overview

<!-- FORGE:AUTO-START api-summary -->
| Function | Description |
|----------|-------------|
| `add` | Adds two numbers |
<!-- FORGE:AUTO-END api-summary -->

## My Custom Content

This section is **safe** — forge-ts never touches it.
```

### FORGE:STUB Zones

Delimited by `<!-- FORGE:STUB-START id -->` and `<!-- FORGE:STUB-END id -->`.
A `<!-- FORGE:STUB-HASH: xxx -->` comment stores a DJB2 hash (8 chars) of
the originally generated content.

**Behavior:**
- On first build: generated with scaffolded content + hash
- On subsequent builds: if content still matches hash, eligible for regeneration
- After user edits: hash mismatch stops regeneration — content preserved

```markdown
<!-- FORGE:STUB-START error-handling -->
<!-- FORGE:STUB-HASH: a1b2c3d4 -->

## Error Handling Guide

This content was auto-generated. Edit freely — once modified,
forge-ts will preserve your changes.

<!-- FORGE:STUB-END error-handling -->
```

### Unmarked Zones

Any content outside FORGE:AUTO and FORGE:STUB markers. forge-ts never reads
or modifies unmarked content.

## Guide Discovery System

`forge-ts build` runs 5 heuristics on the symbol graph to auto-discover
guide topics. Results become stub pages in the `guides/` directory.

| # | Heuristic | Trigger | Guide Page |
|---|-----------|---------|------------|
| 1 | `config-interface` | Types matching `/config\|options\|settings/i` | Configuration guide |
| 2 | `error-types` | `@throws` tags or `Error`/`Exception` classes | Error handling guide |
| 3 | `guide-tag` | `@guide` tag on symbol | Guide per unique value |
| 4 | `category` | `@category` tag on symbol | Guide per category |
| 5 | `entry-point` | Exports from `index.ts` | Entry point overview |

### Explicit Annotation

Use `@guide` and `@concept` custom TSDoc tags to control guide generation:

```typescript
/**
 * Validates input against schema.
 * @guide validation
 */
export function validate(input: unknown): boolean { ... }

/**
 * The core pipeline model.
 * @concept pipeline-architecture
 */
export interface Pipeline { ... }
```

## SSG Navigation Config

When `gen.ssgTarget` is set, `forge-ts build` generates SSG-specific
navigation config (e.g. `docs.json` for Mintlify). Regenerated on each build.

`forge-ts init docs` writes additional adapter scaffolding: package.json
scripts, dependencies, and starter config files for the target platform.

4 adapters: Mintlify (default), Docusaurus, Nextra, VitePress.

## 5-Stage Information Architecture

Generated sites follow progressive disclosure:

| Stage | Section | Content |
|-------|---------|---------|
| ORIENT | Landing, Getting Started | `index`, `getting-started` |
| LEARN | Concepts | `concepts` |
| BUILD | Guides | `guides/index`, discovered guides |
| REFERENCE | API Reference | Per-package `types`, `functions`, `examples` |
| COMMUNITY | FAQ, Contributing | `faq`, `contributing` |

## Editing Strategy

1. **Auto pages**: Never edit directly. Improve source code TSDoc instead.
2. **FORGE:AUTO zones**: Don't edit — they refresh on build.
3. **FORGE:STUB zones**: Safe to edit. Once modified, preserved across builds.
4. **Unmarked content**: Always safe. forge-ts never touches it.
5. **Custom sections in SKILL.md**: Use `config.skill.customSections`.

## Stale Guide Detection

Rule W007 fires when a FORGE:AUTO zone references a symbol that no longer
exists. Rule W008 fires when a public symbol from `index.ts` is not mentioned
in any guide page. Both are warnings by default.
