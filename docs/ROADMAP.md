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
| T078 | v0.17.0 | Advanced Enforcement | high | Pending |
| T079 | v0.18.0 | Guide Intelligence | medium | Pending |
| T080 | v1.0.0 | LSP Extension | medium | Pending |

---

## T077: v0.16.0 — DX Polish

Centralized logging, package simplification, spec tooling.

| Task | Title | Status |
|------|-------|--------|
| T081 | Replace custom logger.ts with consola | DONE |
| T082 | Merge @forge-ts/tsdoc-config into @forge-ts/core | DONE |
| T083 | Add TSDoc spec sync script | DONE |
| T084 | v0.16.0 integration tests and release validation | DONE |

### T081: Centralized Logging (consola)

- Replace hand-rolled `logger.ts` with [consola](https://github.com/unjs/consola) (UnJS ecosystem, same as citty)
- Migrate all 13 command files from `console.log`/`createLogger()` to `forgeLogger`
- Structured output: TTY-aware, respects `--quiet`/`--json` flags
- Coexists with LAFS `emitResult()` for command results

### T082: Merge @forge-ts/tsdoc-config into @forge-ts/core

- Move `tsdoc.json` preset into `packages/core/tsdoc-preset/tsdoc.json`
- Walker fallback loads bundled preset (custom tags recognized without user tsdoc.json)
- Remove `packages/tsdoc-config/` directory, deprecate npm package
- Eliminates: npm publish auth failures, 404 install breakage, extra package complexity

### T083: TSDoc Spec Sync Script

- `scripts/sync-tsdoc-spec.ts` reads `@microsoft/tsdoc` and writes machine-readable JSON
- `packages/core/spec/standard-tags.json` — all tag definitions
- `packages/core/spec/message-ids.json` — all parser message IDs
- Git-tracked for drift visibility, LLM-agent-friendly

---

## DX Improvements (queued, no epic yet)

### Git Hooks Hardening

Current `forge-ts init hooks` writes hook files but does not verify the hook manager is functional. Issues:

- Writes `.husky/pre-commit` but doesn't check if husky is installed or `prepare` script is wired
- Doctor reports `[PASS]` on hook file existence even if hooks aren't active
- No lint-staged integration — runs full project check, slow on large codebases
- No `--staged` flag on `forge-ts check` to only check changed files
- Only wires pre-commit, not prepublish hook
- Fallback creates husky files without husky installed — file exists but never runs

Planned fixes:
- Doctor should verify husky is actually installed (not just that the file exists)
- `forge-ts init hooks` should offer to install husky if missing (`npx husky-init`)
- Add `"prepare": "husky install"` to package.json scripts during init hooks
- Add `forge-ts check --staged` for lint-staged integration
- Wire both pre-commit (`forge-ts check`) and pre-push (`forge-ts prepublish`) hooks

### Init Script Improvements

- Detect user's package manager (npm/pnpm/yarn/bun) and use correct commands in suggestions
- Validate that `forge-ts.config.ts` is included in tsconfig `include` array (common miss)
- Offer to add `@forge-ts/cli` to devDependencies if running via npx

---

## T078: v0.17.0 — Advanced Enforcement

Knip integration, enhanced DocTest, LLM anti-pattern detection.

| Task | Title | Status |
|------|-------|--------|
| — | Knip integration: skip enforcement on dead exports | Pending |
| — | Enhanced DocTest: detect stale @example blocks | Pending |
| — | LLM anti-pattern: flag @ts-ignore in non-test files | Pending |
| — | LLM anti-pattern: flag `any` casts in public API | Pending |
| — | @inheritDoc validation: verify source exists | Pending |
| — | Orphaned {@link} description detection | Pending |
| — | Git hooks hardening (from DX improvements above) | Pending |
| — | v0.17.0 integration tests and release | Pending |

### Knip Integration

Skip enforcement on Knip-flagged dead exports. Don't enforce docs on code that should be deleted.

### Enhanced DocTest

Detect stale `@example` blocks where function signatures changed. Validate `@example` code compiles against current types.

### LLM Anti-Pattern Detection

Flag `@ts-ignore` additions in non-test files. Flag `any` type casts in public API signatures. These are the most common LLM agent shortcuts.

### @inheritDoc Validation

Validate `{@inheritDoc}` sources exist and have content to inherit. Catch broken inheritance chains.

### Orphaned {@link} Description Detection

Detect when `{@link Target | description}` text doesn't match the target's current summary.

---

## T079: v0.18.0 — Guide Intelligence

Advanced guide discovery heuristics, eslint-plugin-tsdoc scaffolding.

| Task | Title | Status |
|------|-------|--------|
| — | Workflow detection heuristic from function call chains | Pending |
| — | Extension pattern heuristic from Adapter/Strategy/Factory | Pending |
| — | eslint-plugin-tsdoc scaffolding in forge-ts init | Pending |
| — | v0.18.0 integration tests and release | Pending |

### Workflow Detection Heuristic

Discover guide topics from function call chains (functions calling functions in sequence). Generate "Workflow Guide" stubs.

### Extension Pattern Heuristic

Discover guide topics from Adapter/Strategy/Factory patterns. Generate "Extending" guide stubs with relevant interfaces.

### eslint-plugin-tsdoc Scaffolding

`forge-ts init` scaffolds `.eslintrc` with `tsdoc/syntax` rule if ESLint detected. Closes gap between forge-ts validation and real-time editor feedback.

---

## T080: v1.0.0 — LSP Extension

Real-time editor diagnostics via Language Server Protocol.

| Task | Title | Status |
|------|-------|--------|
| — | LSP server with E001-E018, W001-W011 diagnostics | Pending |
| — | VS Code extension (marketplace) | Pending |
| — | Quick fix actions (add @param, @returns, etc.) | Pending |
| — | Hover: rule description + suggested fix | Pending |
| — | v1.0.0 integration tests and release | Pending |

---

## Completed Versions

| Version | Epic | Theme | Key Deliverables |
|---------|------|-------|-----------------|
| v0.9.0 | T030 | TSDoc Ecosystem Foundation | @microsoft/tsdoc-config, W006, tsdoc.json preset |
| v0.10.0 | T040 | Agent-Proof Guardrails | lock/unlock, audit trail, bypass budget, E009-E010 |
| v0.11.0 | T050 | Dev Layer Enforcement | E013-E015, W005, @concept/@guide tags |
| v0.12.0 | T060 | Intelligent Guide Generation | Guide discovery, FORGE:STUB, W007-W008 |
| v0.13.0 | T070 | Safety Pipeline + Ecosystem | init --hooks, prepublish, E011-E012, E016 |
| v0.14.0 | — | Complete Tag System | 14 custom tags, E017-E018, W009-W011, fixed @category/@since |
| v0.15.0 | — | Init + Doctor Commands | forge-ts init setup, forge-ts doctor, 787 tests |
| v0.16.0 | T077 | DX Polish | consola logging, tsdoc-config merged into core, spec sync script |
