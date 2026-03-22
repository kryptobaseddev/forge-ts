# Feature Gap Analysis: ferrous-forge -> forge-ts

> **ferrous-forge** v1.9.0 (Rust) | **forge-ts** v0.13.0 (TypeScript)
>
> This document maps every significant ferrous-forge feature to forge-ts with a clear recommendation:
> **SHOULD port**, **SHOULD NOT port**, or **CANNOT port** (language-specific).
>
> See also: [FORGE-ARCHITECTURE-SPEC.md](./FORGE-ARCHITECTURE-SPEC.md) for the full three-layer enforcement design.
> See also: [ROADMAP.md](./ROADMAP.md) for pending future features.

## Gap Status Summary

| Category | Total | Closed | Open / Partial |
|----------|-------|--------|----------------|
| SHOULD port (ferrous-forge gaps) | 7 | 6 | 1 (partial) |
| Internal gaps (forge-ts-specific) | 4 | 4 | 0 |
| **Total trackable gaps** | **11** | **10** | **1** |

| Gap | Description | Status | Closed In |
|-----|-------------|--------|-----------|
| #1 | Config Locking | CLOSED | v0.10.0 |
| #2 | Audit Trail | CLOSED | v0.10.0 |
| #3 | Bypass Budget | CLOSED | v0.10.0 |
| #4 | Safety Pipeline Hooks | CLOSED | v0.13.0 |
| #5 | Config Drift Detection | CLOSED | v0.10.0 + v0.13.0 |
| #6 | LLM Anti-Pattern Detection | PARTIAL | E016 in v0.13.0; @ts-ignore and any detection not done |
| #7 | Pre-Publish Gate | CLOSED | v0.13.0 |
| #8 | TSDoc Ecosystem Integration | CLOSED | v0.9.0 |
| #9 | Central Config Orchestrator | CLOSED | v0.9.0 + v0.10.0 |
| #10 | Three-Layer Enforcement | CLOSED | v0.11.0 + v0.12.0 + v0.13.0 |
| #11 | Intelligent Guide Generation | CLOSED | v0.12.0 |

---

## INTERNAL GAPS (forge-ts-specific, not from ferrous-forge)

These are gaps discovered by analyzing forge-ts's own codebase against its stated vision. They don't map to ferrous-forge features -- they're unique to the TypeScript documentation ecosystem.

### 8. TSDoc Ecosystem Integration (tsdoc.json + @microsoft/tsdoc-config + eslint-plugin-tsdoc) -- CLOSED in v0.9.0

**Delivered**: forge-ts owns and writes an opinionated `tsdoc.json` that enables all Core + Extended standardization groups, defines custom tags (`@route`, `@category`, `@since`, `@guide`, `@concept`), and loads via `TSDocConfigFile.loadForFolder()`. The `@forge-ts/tsdoc-config` package ships the opinionated preset. W006 surfaces TSDoc parse errors from the parser message log.

**Remaining**: eslint-plugin-tsdoc scaffolding during `forge-ts init` is tracked as a future feature in [ROADMAP.md](./ROADMAP.md).

---

### 9. Central Config Orchestrator (forge-ts.config.ts flows DOWN) -- CLOSED in v0.9.0 + v0.10.0

**Delivered**: `forge-ts.config.ts` is the SSoT that writes tsdoc.json (v0.9.0), validates tsconfig.json strictness via E009, validates forge-ts config drift via E010 (v0.10.0), validates biome.json drift via E011, and validates package.json integrity via E012 (v0.13.0). Config sections for `tsdoc`, `guards`, and `guides` are in ForgeConfig.

**Key principle**: forge-ts WRITES what it owns (tsdoc.json). It GUARDS what other tools own (tsconfig, biome, package.json). It never REPLACES other tools' configs.

---

### 10. Three-Layer Documentation Enforcement -- CLOSED in v0.11.0 + v0.12.0 + v0.13.0

**Delivered**: Enforcement across all three documentation layers:

| Layer | Rules |
|-------|-------|
| API | E001-E003, E006-E008, E016 (release tag required) |
| Dev | E004, E005, E013 (@remarks), E014 (@defaultValue), E015 (@typeParam), W005 (@see) |
| Consumer | W007 (stale guide), W008 (undocumented in guides) |
| Cross-cutting | W003, W004, W006 (TSDoc parse errors) |

Custom TSDoc tags `@guide` and `@concept` link symbols to consumer documentation.

---

### 11. Intelligent Guide Generation from Code -- CLOSED in v0.12.0

**Delivered**: forge-ts analyzes the symbol graph to discover guide topics from entry points, config interfaces, error types, `@guide` tags, and `@category` groupings. Each guide uses three zone types for idempotent regeneration: FORGE:AUTO (always fresh), FORGE:STUB (generated once, preserved after user edits), and unmarked (user-owned, never touched).

**Remaining**: Workflow detection heuristic (function call chains) and extension pattern heuristic (Adapter/Strategy/Factory) are tracked as future features in [ROADMAP.md](./ROADMAP.md).

---

---

## SHOULD Port

### 1. Config Locking System -- CLOSED in v0.10.0

**ferrous-forge**: `ferrous-forge config lock <key> --reason="..."` / `config unlock`. Prevents LLM agents from loosening edition, rust-version, or lint settings. Hierarchical lock precedence (system > user > project).

**forge-ts delivered**: `forge-ts lock` / `forge-ts unlock --reason="..."`. Locks forge-ts rule severities, tsconfig strict-mode flags, and Biome config overrides. Single project-level lock file (`.forge-lock.json`).

---

### 2. Audit Trail (Append-Only Log) -- CLOSED in v0.10.0

**ferrous-forge**: Complete audit log of all lock/unlock operations, bypass events, and config changes. Stored in `.ferrous-forge/audit.log`. Machine-readable.

**forge-ts delivered**: `.forge-audit.jsonl` (JSON Lines format, one event per line). Logs rule changes, bypass events, lock/unlock operations, and config drift detections. Fields: timestamp, user, event type, reason, before/after diff.

---

### 3. Bypass Budget -- CLOSED in v0.10.0

**ferrous-forge**: `ferrous-forge safety bypass --stage=X --reason="..."`. 24-hour bypass duration. All bypasses audited.

**forge-ts delivered**: Daily bypass budget (configurable, default: 3/day). Each bypass requires `--reason` and is logged to audit trail. Time-limited expiration. Budget exhaustion blocks further bypasses.

---

### 4. Safety Pipeline Hooks (Pre-Commit / Pre-Push) -- CLOSED in v0.13.0

**ferrous-forge**: Pre-commit (format + clippy + validation), pre-push (tests + audit + full validation), commit-msg (conventional commits). Automatic installation during `ferrous-forge init --project`.

**forge-ts delivered**: `forge-ts init --hooks` scaffolds husky/lefthook config with `forge-ts check` as the pre-commit gate. forge-ts does not own hook management -- that's husky/lefthook's job. forge-ts provides the check command and the scaffolding.

---

### 5. Config Drift Detection (New Enforcer Rules) -- CLOSED in v0.10.0 + v0.13.0

**ferrous-forge**: Lock validation before any config changes. Detects edition downgrades, rust-version changes, lint weakening.

**forge-ts delivered**: Four enforcer rules:
- **E009**: tsconfig strictness regression (v0.10.0)
- **E010**: forge-ts config drift (v0.10.0)
- **E011**: Biome config weakening (v0.13.0)
- **E012**: package.json engine field tampering (v0.13.0)

---

### 6. LLM Anti-Pattern Detection -- PARTIAL

**ferrous-forge**: Underscore bandaid detection (`_param`, `let _ =`), unwrap/expect usage, panic/todo/unimplemented detection. Flags common agent shortcuts.

**forge-ts delivered (partial)**:
- E016 release tag required on public symbols (v0.13.0)

**forge-ts remaining**:
- `@ts-ignore` / `@ts-expect-error` additions in non-test files -- not started
- `any` type casts in public API signatures -- not started

Design is complete in [FORGE-ARCHITECTURE-SPEC.md](./FORGE-ARCHITECTURE-SPEC.md). Remaining items are tracked in [ROADMAP.md](./ROADMAP.md).

---

### 7. Pre-Publish Validation Gate -- CLOSED in v0.13.0

**ferrous-forge**: Cargo publish interception with validation. Blocks publishing if checks fail.

**forge-ts delivered**: `forge-ts prepublish` command runs check + build in one pass. Integrates with npm `prepublishOnly` lifecycle script. Uses npm's built-in lifecycle hooks instead of PATH interception.

---

## SHOULD NOT Port

### 1. Template / Project Scaffolding System

**ferrous-forge**: 7 built-in templates (cli-app, library, WASM, embedded, web-service, plugin, workspace). Handlebars-based rendering. Template repository fetching from GitHub.

**forge-ts**: Not applicable. forge-ts is a **documentation compiler**, not a project scaffolder. The TypeScript ecosystem has mature scaffolding tools (create-next-app, create-vite, degit, projen). Adding a template system would be scope creep.

`forge-ts init docs` scaffolds **documentation site config** (SSG adapter + docs.json), not project boilerplate. This is the correct scope.

---

### 2. Hierarchical Configuration (System / User / Project)

**ferrous-forge**: Three-level config: `/etc/ferrous-forge/config.toml` (system), `~/.config/ferrous-forge/config.toml` (user), `./.ferrous-forge/config.toml` (project). Merge precedence with lock inheritance.

**forge-ts**: Single project-level config (`forge-ts.config.ts`). TypeScript projects are self-contained -- there's no organizational standard for "system-wide TypeScript linting config" the way Rust teams share clippy/rustfmt settings. The complexity of hierarchical config merging is not justified.

If cross-project standards are needed, teams can publish a shared config package (like `@company/forge-config`) and import it in `forge-ts.config.ts`. This is the TypeScript-native pattern.

---

### 3. VS Code Extension (Defer to Long-Term)

**ferrous-forge**: Full VS Code extension with real-time validation, inline diagnostics, and quick fixes.

**forge-ts**: Deferred to long-term. The correct approach for TypeScript is an **LSP extension** that integrates with the existing TypeScript language server, not a standalone extension. This is a significant engineering effort that should wait until the enforcer rules are stable and battle-tested. Tracked in [ROADMAP.md](./ROADMAP.md) as "LSP Extension."

---

### 4. Auto-Fix Beyond TSDoc Stubs

**ferrous-forge**: Pattern-based auto-fixes for simple violations. Safe transformations only.

**forge-ts**: Auto-fix is acceptable **only for adding TSDoc stubs with TODO markers**. It must NOT generate generic documentation that passes checks -- that defeats the purpose. If a function is missing `@returns`, forge-ts can add `@returns TODO: describe return value` but must NOT generate `@returns The result` or similar content-free stubs.

The principle: auto-fix should make the violation visible and easy to address, not mask it.

---

### 5. Metrics Dashboard / Web Dashboard

**ferrous-forge**: Historical trend analysis, team analytics, multi-project overview (planned/future).

**forge-ts**: Not in scope. The audit trail (`.forge-audit.jsonl`) is machine-readable and can feed into any dashboard tool (Grafana, Datadog, custom). forge-ts should not build its own dashboard -- that's a separate product concern.

---

## CANNOT Port (Language-Specific)

### 1. Edition Management

**ferrous-forge**: `ferrous-forge edition check/migrate/analyze`. Rust editions (2015, 2018, 2021, 2024) are a language-level concept with migration tooling.

TypeScript has no equivalent concept. TypeScript versions are managed by `package.json` and the `target`/`module` fields in tsconfig. The closest analog (tsconfig strictness flags) is covered by E009 (config drift detection).

### 2. Toolchain Management (rustup Integration)

**ferrous-forge**: `ferrous-forge rust update/install-toolchain/switch`. Deep integration with rustup for managing Rust toolchain versions.

TypeScript toolchain management is handled by nvm, volta, fnm (for Node.js) and `package.json` `engines` field (for version constraints). forge-ts should not duplicate this -- E012 (engine field tampering) watches for unauthorized changes instead.

### 3. Cargo Publish Interception

**ferrous-forge**: Wrapper script that intercepts `cargo publish` via PATH. Runs validation before allowing publish.

npm has built-in lifecycle hooks (`prepublishOnly`) that accomplish the same goal without PATH hijacking. forge-ts uses `forge-ts prepublish` as a lifecycle script, which is cleaner and more reliable.

### 4. Clippy / rustfmt Integration

**ferrous-forge**: Direct integration with Rust's built-in linting (clippy) and formatting (rustfmt) tools. Injects `[lints]` blocks into Cargo.toml.

The TypeScript equivalent is Biome (or ESLint + Prettier). forge-ts does not manage Biome configuration -- it **watches Biome config for drift** (E011). Biome owns code quality; forge-ts owns documentation quality and config integrity.

---

## Key Principle

> forge-ts should be a highly strict tool sitting **on top of** the best-practice tools like Biome, LSP, and linting tools. It MUST have the agent-proof pillar -- every bypass is explicit, justified, and audited. It does not want to take over what other great tools do, only enhance and put strict opinionated guardrails around them.
