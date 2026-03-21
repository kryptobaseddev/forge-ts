# Feature Gap Analysis: ferrous-forge -> forge-ts

> **ferrous-forge** v1.9.0 (Rust) | **forge-ts** v0.8.0 (TypeScript)
>
> This document maps every significant ferrous-forge feature to forge-ts with a clear recommendation:
> **SHOULD port**, **SHOULD NOT port**, or **CANNOT port** (language-specific).
>
> See also: [FORGE-ARCHITECTURE-SPEC.md](./FORGE-ARCHITECTURE-SPEC.md) for the full three-layer enforcement design.

## Summary

| Category | Count | Examples |
|----------|-------|---------|
| SHOULD port | 11 | Config locking, audit trail, bypass budget, safety pipeline hooks, config drift detection, anti-pattern detection, prepublish gate, **TSDoc ecosystem integration**, **central config orchestration**, **intelligent guide generation**, **three-layer enforcement** |
| SHOULD NOT port | 5 | Template system, hierarchical config (system/user), VS Code extension (defer), auto-fix beyond stubs, metrics dashboard |
| CANNOT port | 4 | Edition management, toolchain management (rustup), cargo publish interception, Clippy/rustfmt integration |

## INTERNAL GAPS (forge-ts-specific, not from ferrous-forge)

These are gaps discovered by analyzing forge-ts's own codebase against its stated vision. They don't map to ferrous-forge features — they're unique to the TypeScript documentation ecosystem.

### 8. TSDoc Ecosystem Integration (tsdoc.json + @microsoft/tsdoc-config + eslint-plugin-tsdoc)

**Current state**: forge-ts creates `new TSDocConfiguration()` with defaults in walker.ts. No tsdoc.json. No @microsoft/tsdoc-config dependency. No eslint-plugin-tsdoc integration. The TSDoc parser reports 70+ message IDs for syntax errors — forge-ts ignores them all.

**Target state**: forge-ts owns and writes an opinionated `tsdoc.json` that:
- Enables all Core + Extended standardization groups
- Defines custom tags (`@route`, `@category`, `@since`, `@guide`, `@concept`)
- Is consumed by eslint-plugin-tsdoc, TypeDoc, and API Extractor automatically
- Loads via `TSDocConfigFile.loadForFolder()` instead of bare `new TSDocConfiguration()`

**New dependency**: `@microsoft/tsdoc-config` added to `@forge-ts/core`
**New package**: `@forge-ts/tsdoc-config` — ships the opinionated tsdoc.json preset
**New rule**: W006 — surface TSDoc parse errors from the parser message log

**Rationale**: forge-ts currently validates that TSDoc **exists** but not that it's **well-formed**. eslint-plugin-tsdoc catches malformed `{@link}` syntax, unclosed code fences, invalid `@param` formats, etc. forge-ts should either integrate these or at minimum ensure the ecosystem is configured to catch them.

**Priority**: v0.9.0 (immediate — foundational for everything else)

---

### 9. Central Config Orchestrator (forge-ts.config.ts flows DOWN)

**Current state**: `forge-ts.config.ts` only controls forge-ts's own behavior. Users must separately configure tsdoc.json, biome.json, tsconfig.json, .eslintrc. No config relationship between them.

**Target state**: `forge-ts.config.ts` is the SSoT that:
- WRITES tsdoc.json (forge-ts owns the TSDoc standard)
- VALIDATES tsconfig.json strictness (E009)
- VALIDATES biome.json drift (E011)
- VALIDATES package.json integrity (E012)
- Scaffolds eslint-plugin-tsdoc config during `forge-ts init` (if ESLint detected)

**New config sections**: `tsdoc`, `guards`, `guides` in ForgeConfig

**Key principle**: forge-ts WRITES what it owns (tsdoc.json). It GUARDS what other tools own (tsconfig, biome, package.json). It never REPLACES other tools' configs.

**Priority**: v0.9.0 (tsdoc.json), v0.10.0 (guards)

---

### 10. Three-Layer Documentation Enforcement

**Current state**: 9 of 12 rules are API layer enforcement. Dev and Consumer layers are barely covered:
- **API layer**: E001-E003, E006-E008, W003-W004 (covered)
- **Dev layer**: E004 (@example exists), E005 (@packageDocumentation) — minimal
- **Consumer layer**: Nothing. Guides are blank stubs.

**Target state**: Enforcement across all three documentation layers:

| Layer | Current Rules | New Rules |
|-------|--------------|-----------|
| API | E001-E003, E006-E008 | E016 (release tag required) |
| Dev | E004, E005 | E013 (@remarks), E014 (@defaultValue), E015 (@typeParam), W005 (@see) |
| Consumer | none | W007 (stale guide), W008 (undocumented in guides) |
| Cross-cutting | W003, W004 | W006 (TSDoc parse errors) |

**New custom TSDoc tags**: `@guide` (links symbol to guide topic), `@concept` (links symbol to concepts section)

**Priority**: v0.11.0 (Dev layer), v0.12.0 (Consumer layer)

---

### 11. Intelligent Guide Generation from Code

**Current state**: `renderGuidesIndexPage()` in site-generator.ts outputs:
```
"Add your guides to the `guides/` directory. Each .md or .mdx file will appear here automatically."
```
Completely blank. No code analysis. No intelligence.

The Concepts page has FORGE:AUTO for "Key Abstractions" (good!) but guides have zero equivalent.

**Target state**: forge-ts analyzes the symbol graph to discover guide topics:

1. **Entry points** (index.ts exports) → "Getting Started" guide sections
2. **Workflow chains** (functions calling functions) → "Workflow Guide" steps
3. **Config interfaces** (ForgeConfig-like types) → "Configuration Guide" with every option
4. **Error types** (`@throws` + error classes) → "Error Handling Guide" catalog
5. **Extension patterns** (adapters, strategies, factories) → "Extending" guide
6. **`@guide` tag** → explicit developer annotation for dedicated guide pages
7. **`@category` grouping** → category-organized guide pages

Each guide uses three zone types:
- **FORGE:AUTO** zones — regenerated every build (signatures, params, examples from code)
- **FORGE:STUB** zones — generated once with TODO, preserved after user edits
- **Unmarked** zones — user-owned, never touched

**Rationale**: This is the biggest differentiator. No other tool generates consumer documentation from code analysis with idempotent regeneration. The code IS the documentation source — forge-ts just needs to extract the structure intelligently.

**Priority**: v0.12.0

---

---

## SHOULD Port

### 1. Config Locking System

**ferrous-forge**: `ferrous-forge config lock <key> --reason="..."` / `config unlock`. Prevents LLM agents from loosening edition, rust-version, or lint settings. Hierarchical lock precedence (system > user > project).

**forge-ts adaptation**: `forge-ts lock` / `forge-ts unlock --reason="..."`. Locks forge-ts rule severities, tsconfig strict-mode flags, and Biome config overrides. Single project-level lock file (`.forge-lock.json`) — no hierarchy needed (see "SHOULD NOT: Hierarchical Config" below).

**Rationale**: This is the **biggest gap in the TypeScript ecosystem**. No tool prevents an LLM agent from setting `strict: false` in tsconfig, switching rules to `"off"` in Biome, or weakening forge-ts enforcement. This is the core of the agent-proof pillar.

**Priority**: Phase 4 (next)

---

### 2. Audit Trail (Append-Only Log)

**ferrous-forge**: Complete audit log of all lock/unlock operations, bypass events, and config changes. Stored in `.ferrous-forge/audit.log`. Machine-readable.

**forge-ts adaptation**: `.forge-audit.jsonl` (JSON Lines format, one event per line). Logs: rule changes, bypass events, lock/unlock operations, config drift detections. Fields: timestamp, user, event type, reason, before/after diff.

**Rationale**: Same architecture works directly. JSON Lines format is better for TypeScript tooling than plain text. Enables CI dashboard integration and compliance reporting.

**Priority**: Phase 4 (ships with config locking)

---

### 3. Bypass Budget

**ferrous-forge**: `ferrous-forge safety bypass --stage=X --reason="..."`. 24-hour bypass duration. All bypasses audited.

**forge-ts adaptation**: Daily bypass budget (configurable, default: 3/day). Each bypass requires `--reason` and is logged to audit trail. Time-limited expiration. Budget exhaustion blocks further bypasses.

**Rationale**: Prevents agents from using unlimited escape hatches. The budget concept is more effective than duration-only limits because agents operate in rapid iteration loops — they can burn through dozens of bypasses in minutes without a budget constraint.

**Priority**: Phase 4

---

### 4. Safety Pipeline Hooks (Pre-Commit / Pre-Push)

**ferrous-forge**: Pre-commit (format + clippy + validation), pre-push (tests + audit + full validation), commit-msg (conventional commits). Automatic installation during `ferrous-forge init --project`.

**forge-ts adaptation**: `forge-ts init --hooks` scaffolds husky/lefthook config with `forge-ts check` as the pre-commit gate. forge-ts **does not own hook management** — that's husky/lefthook's job. forge-ts provides the check command and the scaffolding.

**Rationale**: Catching issues at commit time is strictly better than CI time. But the TypeScript ecosystem already has excellent hook managers (husky, lefthook, lint-staged). forge-ts should not reinvent this — just provide the gate command and the scaffolding to wire it up.

**Priority**: Phase 5

---

### 5. Config Drift Detection (New Enforcer Rules)

**ferrous-forge**: Lock validation before any config changes. Detects edition downgrades, rust-version changes, lint weakening.

**forge-ts adaptation**: Four new enforcer rules:
- **E009**: tsconfig strictness regression — detect `strict: false`, `strictNullChecks: false`, etc.
- **E010**: forge-ts config drift — detect rule severity weakening without audit trail entry
- **E011**: Biome config weakening — detect rules switched from error to warn/off
- **E012**: package.json engine field tampering — detect Node.js version downgrades

**Rationale**: This is the "guardrails on top of guardrails" concept. forge-ts doesn't replace Biome or TypeScript — it watches their configs for drift and blocks unauthorized weakening. No other tool in the ecosystem does this.

**Priority**: E009-E010 in Phase 4, E011-E012 in Phase 6

---

### 6. LLM Anti-Pattern Detection

**ferrous-forge**: Underscore bandaid detection (`_param`, `let _ =`), unwrap/expect usage, panic/todo/unimplemented detection. Flags common agent shortcuts.

**forge-ts adaptation**: Detect TypeScript-specific agent shortcuts in monitored files:
- `@ts-ignore` / `@ts-expect-error` additions in non-test files
- `any` type casts in public API signatures
- `strict: false` or strictness flag loosening in tsconfig.json
- `"off"` overrides added to forge-ts or Biome config files

**Rationale**: Different language, same anti-patterns. LLM agents in TypeScript reach for `any` and `@ts-ignore` just as Rust agents reach for `unwrap()` and `_` prefixes. The detection patterns are language-specific but the principle is identical.

**Priority**: Phase 4

---

### 7. Pre-Publish Validation Gate

**ferrous-forge**: Cargo publish interception with validation. Blocks publishing if checks fail.

**forge-ts adaptation**: `forge-ts prepublish` command that runs check + build in one pass. Integrates with npm `prepublishOnly` lifecycle script. Does NOT intercept `npm publish` directly — uses npm's built-in lifecycle hooks instead.

**Rationale**: The npm ecosystem has lifecycle hooks (`prepublishOnly`) that make interception unnecessary. forge-ts provides the gate command; npm provides the hook point. Cleaner than cargo interception because there's no PATH hijacking needed.

**Priority**: Phase 5

---

## SHOULD NOT Port

### 1. Template / Project Scaffolding System

**ferrous-forge**: 7 built-in templates (cli-app, library, WASM, embedded, web-service, plugin, workspace). Handlebars-based rendering. Template repository fetching from GitHub.

**forge-ts**: Not applicable. forge-ts is a **documentation compiler**, not a project scaffolder. The TypeScript ecosystem has mature scaffolding tools (create-next-app, create-vite, degit, projen). Adding a template system would be scope creep.

`forge-ts init docs` scaffolds **documentation site config** (SSG adapter + docs.json), not project boilerplate. This is the correct scope.

---

### 2. Hierarchical Configuration (System / User / Project)

**ferrous-forge**: Three-level config: `/etc/ferrous-forge/config.toml` (system), `~/.config/ferrous-forge/config.toml` (user), `./.ferrous-forge/config.toml` (project). Merge precedence with lock inheritance.

**forge-ts**: Single project-level config (`forge-ts.config.ts`). TypeScript projects are self-contained — there's no organizational standard for "system-wide TypeScript linting config" the way Rust teams share clippy/rustfmt settings. The complexity of hierarchical config merging is not justified.

If cross-project standards are needed, teams can publish a shared config package (like `@company/forge-config`) and import it in `forge-ts.config.ts`. This is the TypeScript-native pattern.

---

### 3. VS Code Extension (Defer to Long-Term)

**ferrous-forge**: Full VS Code extension with real-time validation, inline diagnostics, and quick fixes.

**forge-ts**: Deferred to Phase 6+ (long-term). The correct approach for TypeScript is an **LSP extension** that integrates with the existing TypeScript language server, not a standalone extension. This is a significant engineering effort that should wait until the enforcer rules are stable and battle-tested.

In the meantime, `forge-ts check` in a pre-commit hook provides the same feedback loop with lower implementation cost.

---

### 4. Auto-Fix Beyond TSDoc Stubs

**ferrous-forge**: Pattern-based auto-fixes for simple violations. Safe transformations only.

**forge-ts**: Auto-fix is acceptable **only for adding TSDoc stubs with TODO markers**. It must NOT generate generic documentation that passes checks — that defeats the purpose. If a function is missing `@returns`, forge-ts can add `@returns TODO: describe return value` but must NOT generate `@returns The result` or similar content-free stubs.

The principle: auto-fix should make the violation visible and easy to address, not mask it.

---

### 5. Metrics Dashboard / Web Dashboard

**ferrous-forge**: Historical trend analysis, team analytics, multi-project overview (planned/future).

**forge-ts**: Not in scope. The audit trail (`.forge-audit.jsonl`) is machine-readable and can feed into any dashboard tool (Grafana, Datadog, custom). forge-ts should not build its own dashboard — that's a separate product concern.

---

## CANNOT Port (Language-Specific)

### 1. Edition Management

**ferrous-forge**: `ferrous-forge edition check/migrate/analyze`. Rust editions (2015, 2018, 2021, 2024) are a language-level concept with migration tooling.

TypeScript has no equivalent concept. TypeScript versions are managed by `package.json` and the `target`/`module` fields in tsconfig. The closest analog (tsconfig strictness flags) is covered by E009 (config drift detection).

### 2. Toolchain Management (rustup Integration)

**ferrous-forge**: `ferrous-forge rust update/install-toolchain/switch`. Deep integration with rustup for managing Rust toolchain versions.

TypeScript toolchain management is handled by nvm, volta, fnm (for Node.js) and `package.json` `engines` field (for version constraints). forge-ts should not duplicate this — E012 (engine field tampering) watches for unauthorized changes instead.

### 3. Cargo Publish Interception

**ferrous-forge**: Wrapper script that intercepts `cargo publish` via PATH. Runs validation before allowing publish.

npm has built-in lifecycle hooks (`prepublishOnly`) that accomplish the same goal without PATH hijacking. forge-ts uses `forge-ts prepublish` as a lifecycle script, which is cleaner and more reliable.

### 4. Clippy / rustfmt Integration

**ferrous-forge**: Direct integration with Rust's built-in linting (clippy) and formatting (rustfmt) tools. Injects `[lints]` blocks into Cargo.toml.

The TypeScript equivalent is Biome (or ESLint + Prettier). forge-ts does not manage Biome configuration — it **watches Biome config for drift** (E011). Biome owns code quality; forge-ts owns documentation quality and config integrity.

---

## Key Principle

> forge-ts should be a highly strict tool sitting **on top of** the best-practice tools like Biome, LSP, and linting tools. It MUST have the agent-proof pillar — every bypass is explicit, justified, and audited. It does not want to take over what other great tools do, only enhance and put strict opinionated guardrails around them.
