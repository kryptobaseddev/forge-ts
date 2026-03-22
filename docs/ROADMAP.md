# forge-ts Roadmap

> This file tracks **future work only** -- features, ideas, and enhancements not yet implemented.
> For completed version history, see the [Completed Versions](#completed-versions) table at the bottom.

## Pending Features

### Knip Integration

- Skip enforcement on Knip-flagged dead exports
- **Status**: Not started
- **Rationale**: Don't enforce docs on code that should be deleted. If Knip identifies an export as unused/dead, forge-ts should not require documentation for it. This avoids wasting developer effort documenting symbols that are candidates for removal.

---

### LSP Extension

- Real-time E001-E016 diagnostics in editor
- **Status**: Not started (long-term)
- **Rationale**: Faster feedback than pre-commit hooks. An LSP-based extension would surface rule violations inline as the developer types, reducing the feedback loop from "commit time" to "edit time." This is a significant engineering effort and should wait until enforcer rules are stable and battle-tested.

---

### Enhanced DocTest

- Detect stale `@example` blocks where function signatures changed
- Validate `@example` code compiles against current types
- **Status**: Not started
- **Rationale**: Currently, `@example` blocks can silently drift out of sync with the code they document. Signature changes (renamed parameters, changed types, added required arguments) should flag the corresponding examples as potentially stale.

---

### @inheritDoc Validation

- Validate `{@inheritDoc}` sources exist and have content to inherit
- **Status**: Not started
- **Rationale**: `{@inheritDoc}` silently produces empty documentation if the source symbol is missing or itself undocumented. Validation would catch broken inheritance chains before they reach consumers.

---

### Orphaned {@link} Description Detection

- Detect when `{@link}` description text does not match the target's current summary
- **Status**: Not started
- **Rationale**: Developers sometimes provide custom description text in `{@link Target | description}` syntax. When the target symbol's purpose changes, the description becomes misleading. Detection would flag these for review.

---

### Workflow Detection Heuristic

- Discover guide topics from function call chains (functions calling functions in sequence)
- **Status**: Not started
- **Rationale**: Sequential function calls often represent a workflow that consumers need documented as a step-by-step guide. Automatic discovery from call graph analysis would generate guide stubs for common usage patterns.

---

### Extension Pattern Heuristic

- Discover guide topics from Adapter/Strategy/Factory patterns
- **Status**: Not started
- **Rationale**: Extension points (adapter interfaces, strategy patterns, factory functions) are prime candidates for "Extending the Library" guide content. Pattern detection would generate guide stubs with the relevant interfaces and examples.

---

### eslint-plugin-tsdoc Scaffolding

- `forge-ts init` scaffolds `.eslintrc` with `tsdoc/syntax` rule if ESLint is detected
- **Status**: Not started
- **Rationale**: eslint-plugin-tsdoc catches malformed `{@link}` syntax, unclosed code fences, and invalid `@param` formats. Automatic scaffolding during `forge-ts init` would close the gap between forge-ts's TSDoc validation and real-time editor feedback via ESLint.

---

### LLM Anti-Pattern Detection (Remaining Items)

- Flag `@ts-ignore` additions in non-test files
- Flag `any` type casts in public API signatures
- **Status**: Not started (design complete in archived FORGE-ARCHITECTURE-SPEC)
- **Rationale**: E016 (release tag required) is shipped in v0.13.0, but the broader anti-pattern detection for `@ts-ignore` and `any` casts is not yet implemented. These are the most common LLM agent shortcuts in TypeScript codebases.

---

### Centralized Logging (consola/pino)

- Replace custom `createLogger()` in CLI with a standard structured logger (consola or pino)
- Centralize all CLI output through the logger — no direct `console.log` in command files
- Structured JSON log output for agent consumption (aligns with LAFS protocol)
- Log levels (debug, info, warn, error) configurable via `--log-level` flag or `FORGE_LOG_LEVEL` env
- **Status**: Not started
- **Rationale**: The current CLI has a hand-rolled ANSI logger in `logger.ts` that some commands use and others bypass with direct `console.log`. This violates DRY/SOLID — logging behavior is inconsistent across commands. consola (from the UnJS ecosystem, same as citty) is the natural fit. This epic should: (1) add consola as a dependency, (2) create a centralized `createForgeLogger()` that respects TTY/JSON modes, (3) migrate all 13 command files to use it, (4) remove the custom `logger.ts`.

---

### Merge @forge-ts/tsdoc-config into @forge-ts/core

- Move `tsdoc.json` preset from separate package into `@forge-ts/core`
- Update walker.ts fallback to load bundled preset directly
- Deprecate `@forge-ts/tsdoc-config` on npm
- **Status**: Not started
- **Rationale**: The separate package causes npm publish failures (CI auth issues), 404 install breakage on first publish, and adds complexity for zero user benefit. Since `@forge-ts/cli` depends on it and npm installs all dependencies transitively, every forge-ts user already gets it. The JSON file belongs in core where the walker lives.

---

### TSDoc Spec Sync Script

- Vendor TSDoc spec data from `@microsoft/tsdoc` as machine-readable JSON
- Script: `scripts/sync-tsdoc-spec.ts` reads StandardTags + message IDs, writes to `packages/core/spec/`
- `forge-ts spec check` validates forge-ts preset against installed `@microsoft/tsdoc` version
- **Status**: Not started
- **Rationale**: Keeps the forge-ts tag system in sync with upstream TSDoc spec without hitting tsdoc.org. Machine-readable JSON is LLM-agent-friendly. Version-pinned to the installed `@microsoft/tsdoc` version so drift is visible in git.

---

## Completed Versions

| Version | Theme | Key Deliverables |
|---------|-------|-----------------|
| v0.9.0 | TSDoc Ecosystem Foundation | @microsoft/tsdoc-config, W006, tsdoc.json preset |
| v0.10.0 | Agent-Proof Guardrails | lock/unlock, audit trail, bypass budget, E009-E010 |
| v0.11.0 | Dev Layer Enforcement | E013-E015, W005, @concept/@guide tags |
| v0.12.0 | Intelligent Guide Generation | Guide discovery, FORGE:STUB, W007-W008 |
| v0.13.0 | Safety Pipeline + Ecosystem | init --hooks, prepublish, E011-E012, E016 |
