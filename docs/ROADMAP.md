# forge-ts Roadmap

> Tracks all work — completed epics and pending features — with CLEO task IDs as the SSoT.
> Every item links to a tracked epic in the CLEO task system.

## Epic Tracker

| Epic | Version | Theme | Priority | Status |
|------|---------|-------|----------|--------|
| T030 | v0.9.0 | TSDoc Ecosystem Foundation | critical | DONE |
| T040 | v0.10.0 | Agent-Proof Guardrails | critical | DONE |
| T050 | v0.11.0 | Dev Layer Enforcement | critical | DONE |
| T060 | v0.12.0 | Intelligent Guide Generation | critical | DONE |
| T070 | v0.13.0 | Safety Pipeline + Ecosystem | critical | DONE |
| — | v0.14.0 | Complete Tag System (hotfix) | — | DONE |
| — | v0.15.0 | Init + Doctor Commands (hotfix) | — | DONE |
| T077 | v0.16.0 | DX Polish | high | DONE |
| — | v0.17.0 | defineConfig + Init DX Fixes (hotfix) | — | DONE |
| — | v0.18.0 | Husky Integration + check --staged (hotfix) | — | DONE |
| T078 | v0.19.0 | Advanced Enforcement | high | DONE |
| T079 | v0.20.0 | Guide Intelligence | medium | Pending |
| T080 | v1.0.0 | LSP Extension | medium | Pending |
| — | v1.0.x | SSG Platform Adapters (Mintlify, VitePress, etc.) | low | Pending |

---

## T078: v0.19.0 — Advanced Enforcement (DONE)

Knip integration, enhanced DocTest, LLM anti-pattern detection, orphaned link detection.

Note: W009 (@inheritDoc validation) and git hooks hardening were completed in earlier releases.

| Task | Title | Status |
|------|-------|--------|
| — | Knip integration: skip enforcement on dead exports (ignoreFile + @forgeIgnore) | DONE |
| — | Enhanced DocTest: detect stale @example blocks (W013) | DONE |
| — | LLM anti-pattern: flag @ts-ignore in non-test files (E019) | DONE |
| — | LLM anti-pattern: flag `any` casts in public API (E020) | DONE |
| — | Orphaned {@link} description detection (W012) | DONE |
| — | v0.19.0 integration tests and release | DONE |

### Knip Integration

Skip enforcement on Knip-flagged dead exports. Don't enforce docs on code that should be deleted.

### Enhanced DocTest

Detect stale `@example` blocks where function signatures changed. Validate `@example` code compiles against current types.

### LLM Anti-Pattern Detection

Flag `@ts-ignore` additions in non-test files. Flag `any` type casts in public API signatures. These are the most common LLM agent shortcuts.

### Orphaned {@link} Description Detection

Detect when `{@link Target | description}` text doesn't match the target's current summary.

---

## T079: v0.20.0 — Guide Intelligence

Advanced guide discovery heuristics, eslint-plugin-tsdoc scaffolding.

| Task | Title | Status |
|------|-------|--------|
| — | Workflow detection heuristic from function call chains | Pending |
| — | Extension pattern heuristic from Adapter/Strategy/Factory | Pending |
| — | eslint-plugin-tsdoc scaffolding in forge-ts init | Pending |
| — | v0.20.0 integration tests and release | Pending |

---

## T080: v1.0.0 — LSP Extension

Real-time editor diagnostics via Language Server Protocol.

| Task | Title | Status |
|------|-------|--------|
| — | LSP server with E001-E020, W001-W013 diagnostics | Pending |
| — | VS Code extension (marketplace) | Pending |
| — | Quick fix actions (add @param, @returns, etc.) | Pending |
| — | Hover: rule description + suggested fix | Pending |
| — | v1.0.0 integration tests and release | Pending |

---

## SSG Platform Adapters (Backlog - Post v1.0)

We need to add official plugin/adapters for static site generators that deeply integrate `forge-ts` rather than just dumping Markdown.

| Task | Title | Status |
|------|-------|--------|
| — | Define generic SSG Provider Adapter interface within `@forge-ts/gen` | Pending |
| — | Mintlify adapter (injects `openapi.json` into Mintlify API playground) | Pending |
| — | Docusaurus adapter (integrates with native Docusaurus OpenAPI plugins) | Pending |
| — | VitePress adapter (generates VitePress-specific deeply nested sidebars) | Pending |
| — | Nextra adapter (handles specialized meta/page config generation) | Pending |

---

## DX Improvements (Backlog)

- Detect user's package manager (npm/pnpm/yarn/bun) and use correct commands in suggestions
- Validate that `forge-ts.config.ts` is included in tsconfig `include` array (common miss)
- lint-staged integration for `forge-ts check --staged`

---

## Completed Versions

| Version | Epic | Theme | Key Deliverables |
|---------|------|-------|-----------------|
| v0.9.0 | T030 | TSDoc Ecosystem Foundation | @microsoft/tsdoc-config, W006, tsdoc.json preset |
| v0.10.0 | T040 | Agent-Proof Guardrails | lock/unlock, audit trail, bypass budget, E009-E010 |
| v0.11.0 | T050 | Dev Layer Enforcement | E013-E015, W005, @concept/@guide tags |
| v0.12.0 | T060 | Intelligent Guide Generation | Guide discovery, FORGE:STUB, W007-W008 |
| v0.13.0 | T070 | Safety Pipeline + Ecosystem | init --hooks, prepublish, E011-E012, E016 |
| v0.14.0 | — | Complete Tag System | 14 custom tags, E017-E018, W009-W011 |
| v0.15.0 | — | Init + Doctor Commands | forge-ts init setup, forge-ts doctor |
| v0.16.0 | T077 | DX Polish | consola, tsdoc-config merged into core, spec sync |
| v0.17.0 | — | defineConfig + Init DX Fixes | defineConfig(), string minVisibility, script wiring |
| v0.18.0 | — | Husky + Staged | Husky v9 full integration, check --staged, shared pkg-json.ts |
| v0.19.0 | T078 | Advanced Enforcement | Knip ignore, stale DocTest (W013), @ts-ignore (E019), any-cast (E020), orphaned links (W012) |
| v0.19.2 | — | Per-Group Enforcement | tsdoc.enforce (core/extended/discretionary), customTags written to tsdoc.json |
| v0.19.3 | — | @forgeIgnore Fix | @forgeIgnore tag enforcement suppression fix |
| v0.19.4 | — | E020 Fix | getDeclaredTypeOfSymbol for interfaces/types, fixes E020 false positives |
