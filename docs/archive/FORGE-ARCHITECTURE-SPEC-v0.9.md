# forge-ts Architecture Specification: The Three-Layer Enforcement System

> Working spec for the expanded forge-ts vision.
> forge-ts sits ON TOP of best-practice tools (Biome, ESLint, TSDoc, Knip) — it does not replace them.
> It enforces, configures, and orchestrates them through a central `forge-ts.config.ts`.

## The Problem Statement

forge-ts v0.8.0 enforces that TSDoc comments **exist** on API symbols. That's necessary but insufficient.

The real problem is **documentation drift across all three layers**:

1. **API docs** drift when signatures change but TSDoc doesn't update
2. **Developer docs** drift when `@example` blocks rot, `@remarks` go stale, `@see` references break
3. **Consumer docs** drift when guides describe behavior that no longer matches code

All documentation for developers and consumers should derive from actual code. Code is the SSoT. forge-ts must enforce this across all three layers, not just API.

## Current State Assessment

### What works (v0.8.0)

- E001-E008 + W001-W004: TSDoc presence enforcement (API layer)
- Full generation pipeline: OpenAPI, MDX, llms.txt, SKILL packages
- 4 SSG adapters with FORGE:AUTO progressive enrichment
- Concepts page has FORGE:AUTO for "Key Abstractions" derived from type symbols
- mdast AST pipeline (gray-matter + unified/remark)

### What's missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No TSDoc syntax validation (70+ parser messages) | Malformed TSDoc passes silently | HIGH |
| No tsdoc.json — uses default TSDocConfiguration() | No opinionated preset, no tool interop | HIGH |
| No downstream config management | Users manually sync Biome/ESLint/tsconfig | HIGH |
| No Dev layer enforcement (@remarks, @see, @typeParam) | Developer docs incomplete | MEDIUM |
| No intelligent guide generation from code | Guides are blank stubs | HIGH |
| No Consumer layer drift detection | Docs diverge from code silently | MEDIUM |
| No @microsoft/tsdoc-config integration | Custom tags not supported via config | HIGH |
| No eslint-plugin-tsdoc integration | TSDoc syntax errors uncaught | HIGH |

---

## Architecture: Central Config Orchestrator

### The Flow

```
forge-ts.config.ts (SSoT)
        |
        v
  +-----------+     +-------------+     +-----------+     +-------------+
  | tsdoc.json|     | biome.json  |     | tsconfig  |     | .eslintrc   |
  | (written) |     | (validated) |     | (locked)  |     | (validated) |
  +-----------+     +-------------+     +-----------+     +-------------+
        |                 |                   |                  |
        v                 v                   v                  v
  eslint-plugin     Biome CLI           tsc compiler       ESLint CLI
  -tsdoc                                                   (tsdoc/syntax)
```

### How It Works

**`forge-ts init`** (one-time setup):
1. Creates `forge-ts.config.ts` with opinionated defaults
2. Writes `tsdoc.json` with forge-ts opinionated preset (all Core + Extended tags enabled, custom `@route`/`@category` tags defined)
3. Validates `biome.json` exists — warns if missing, does NOT create it (Biome owns its config)
4. Validates `tsconfig.json` has `strict: true` — warns if not
5. Optionally writes `.eslintrc` with `eslint-plugin-tsdoc` configured (only if ESLint is detected)
6. Creates `.forge-lock.json` locking the initial config state

**`forge-ts check`** (every run):
1. Loads `forge-ts.config.ts` as the SSoT
2. Loads `tsdoc.json` via `@microsoft/tsdoc-config` (instead of `new TSDocConfiguration()`)
3. Runs TSDoc parser with the loaded config — surfaces 70+ parser-level syntax errors
4. Runs forge-ts enforcement rules (E001-E008, W001-W004, new E009-E012)
5. Validates downstream configs haven't drifted (E009-E012)
6. Reports all violations in unified output

**Key principle**: forge-ts WRITES tsdoc.json (it owns the TSDoc standard). It VALIDATES but does not WRITE biome.json and tsconfig.json (those tools own their configs, forge-ts just guards them).

---

## TSDoc Ecosystem Integration

### Standardization Groups (from tsdoc.org)

TSDoc defines three standardization groups:

| Group | Meaning | forge-ts Stance |
|-------|---------|-----------------|
| **Core** | Essential, all tools must support | REQUIRED — enforce presence and correctness |
| **Extended** | Optional, standardized semantics | RECOMMENDED — enforce on public API, warn on internal |
| **Discretionary** | Optional, tool-specific semantics | AVAILABLE — support but don't require |

### Complete TSDoc Tag Map

#### Core Tags — 9 tags (forge-ts REQUIRES these)

Essential tags with standardized meanings. All tools are expected to support them.

| Tag | Kind | forge-ts Rule | Current Status |
|-----|------|---------------|----------------|
| `@param` | Block | E002 | Enforced |
| `@returns` | Block | E003 | Enforced |
| `@remarks` | Block | **NEW E013** | NOT enforced |
| `@typeParam` | Block | **NEW E015** | NOT enforced |
| `@deprecated` | Block | W003 (no reason) | Partially enforced |
| `@packageDocumentation` | Modifier | E005 | Enforced |
| `@privateRemarks` | Block | -- | Not enforced (intentionally private) |
| `{@link}` | Inline | E008 (dead link) | Partially enforced |
| `{@label}` | Inline | -- | Parsed, not enforced |

#### Extended Tags — 11 tags (forge-ts RECOMMENDS these)

Optional tags with standardized semantics. When supported, must follow TSDoc definitions.

| Tag | Kind | forge-ts Rule | Current Status |
|-----|------|---------------|----------------|
| `@example` | Block | E004 | Enforced |
| `@throws` | Block | W002 (existing) | Warned |
| `@defaultValue` | Block | **NEW E014** | NOT enforced |
| `@see` | Block | **NEW W005** | NOT enforced |
| `@decorator` | Block | -- | Not relevant (decorator metadata) |
| `@override` | Modifier | -- | Parsed, not enforced |
| `@sealed` | Modifier | -- | Parsed, not enforced |
| `@virtual` | Modifier | -- | Parsed, not enforced |
| `@readonly` | Modifier | -- | Parsed, not enforced |
| `@eventProperty` | Modifier | -- | Parsed, not enforced |
| `{@inheritDoc}` | Inline | -- | Not enforced (validation only) |

#### Discretionary Tags — 5 tags (forge-ts uses for visibility filtering)

Optional tags with tool-specific semantics. Syntax is standardized.

| Tag | Kind | forge-ts Rule | Current Status |
|-----|------|---------------|----------------|
| `@alpha` | Modifier | Used for filtering | Parsed |
| `@beta` | Modifier | Used for filtering | Parsed |
| `@experimental` | Modifier | Used for filtering | Parsed |
| `@public` | Modifier | Used for filtering + **NEW E016** | Parsed, enforcement planned |
| `@internal` | Modifier | Used for filtering | Parsed |

#### Custom Tags (forge-ts defines these in tsdoc.json)

| Tag | Kind | Purpose |
|-----|------|---------|
| `@route` | Block | HTTP route extraction for OpenAPI (`@route GET /api/users`) |
| `@category` | Modifier | Symbol categorization for doc organization |
| `@since` | Modifier | Version tracking (currently W001) |
| `@guide` | Block | **NEW** — Links symbol to a consumer guide topic |
| `@concept` | Block | **NEW** — Links symbol to a concepts page section |

#### Complementary Enforcement (eslint-plugin-tsdoc + forge-ts)

These tools are naturally complementary, not overlapping:

| Concern | eslint-plugin-tsdoc | forge-ts enforcer |
|---------|--------------------|--------------------|
| Comment syntax (54 message types) | YES | No (surfaces via W006) |
| Undefined/unsupported tag detection | YES | No |
| `@param` syntax (hyphen, no JSDoc `{type}`) | YES | No (checks presence only) |
| `{@link}` syntax validation | YES | No (E008 checks targets) |
| Declaration reference syntax | YES | No |
| HTML element validation | YES | No |
| Code fence formatting | YES | No |
| `@inheritDoc` constraints | YES | No |
| Missing `@param` tags | No | YES (E002) |
| Missing `@returns` tag | No | YES (E003) |
| Missing `@example` | No | YES (E004) |
| Missing `@packageDocumentation` | No | YES (E005) |
| Missing summary | No | YES (E001) |
| Missing member docs | No | YES (E006, E007) |
| Dead `{@link}` references | No | YES (E008) |
| Cross-package deprecation | No | YES (W004) |

**Key insight**: eslint-plugin-tsdoc validates *syntax correctness* ("is the comment well-formed?"). forge-ts validates *documentation completeness* ("does the comment have what it should?"). Together they provide full TSDoc quality enforcement.

### tsdoc.json Preset

forge-ts writes this opinionated `tsdoc.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
  "extends": ["@forge-ts/tsdoc-config/tsdoc.json"],
  "noStandardTags": false,
  "tagDefinitions": [
    { "tagName": "@route", "syntaxKind": "block" },
    { "tagName": "@category", "syntaxKind": "modifier" },
    { "tagName": "@since", "syntaxKind": "modifier" },
    { "tagName": "@guide", "syntaxKind": "block" },
    { "tagName": "@concept", "syntaxKind": "block" }
  ],
  "supportForTags": {
    "@alpha": true,
    "@beta": true,
    "@decorator": true,
    "@defaultValue": true,
    "@deprecated": true,
    "@eventProperty": true,
    "@example": true,
    "@inheritDoc": true,
    "@internal": true,
    "@label": true,
    "@link": true,
    "@override": true,
    "@packageDocumentation": true,
    "@param": true,
    "@privateRemarks": true,
    "@public": true,
    "@readonly": true,
    "@remarks": true,
    "@returns": true,
    "@sealed": true,
    "@see": true,
    "@throws": true,
    "@typeParam": true,
    "@virtual": true,
    "@route": true,
    "@category": true,
    "@since": true,
    "@guide": true,
    "@concept": true
  }
}
```

This tsdoc.json is then consumed by:
- **eslint-plugin-tsdoc** (syntax validation via `tsdoc/syntax` rule)
- **forge-ts check** (loads via `@microsoft/tsdoc-config` instead of bare `new TSDocConfiguration()`)
- **TypeDoc** (if user runs it separately — automatic interop)
- **API Extractor** (if used — automatic interop)

### New Package: `@forge-ts/tsdoc-config`

A tiny package that ships the opinionated tsdoc.json preset. This allows:
- Other tools to `"extends": ["@forge-ts/tsdoc-config/tsdoc.json"]`
- forge-ts to keep its TSDoc opinions in one place
- Users to override via their project's tsdoc.json

**Interop**: With this preset in place:
- **eslint-plugin-tsdoc** automatically recognizes forge-ts custom tags (no `tsdoc-undefined-tag` errors)
- **TypeDoc** can extend from it for consistent tag recognition
- **API Extractor** can extend from it for consistent trimming behavior
- Users get one `tsdoc.json` that all their tools agree on

---

## Three-Layer Enforcement

### Layer 1: API Documentation (EXISTING + ENHANCED)

**What it enforces**: Every public API symbol has complete, correct TSDoc.

Current rules (keep as-is):
- E001: Missing summary
- E002: Missing @param
- E003: Missing @returns
- E004: Missing @example
- E005: Missing @packageDocumentation
- E006: Class member missing doc
- E007: Interface member missing doc
- E008: Dead {@link} reference
- W003: @deprecated without reason
- W004: Cross-package deprecated import

New rules:
- **E013**: Missing `@remarks` on public function/class (require explanation beyond summary)
- **E014**: Missing `@defaultValue` on optional interface property with default
- **E015**: Missing `@typeParam` on generic function/class/interface
- **W005**: Missing `@see` on function that references other symbols in its body (detect usage patterns)
- **W006**: TSDoc parse error (surface eslint-plugin-tsdoc's 70+ parser messages as forge-ts warnings)

### Layer 2: Developer Documentation (NEW)

**What it enforces**: Developer-facing documentation is derived from code and stays synchronized.

#### DocTest Enhancement
- Current: E004 requires `@example` exists
- **NEW**: Validate `@example` code compiles against current type signatures (not just "exists")
- **NEW**: Detect stale examples where function signature changed but example wasn't updated

#### Cross-Reference Validation
- Current: E008 validates `{@link}` targets exist
- **NEW**: Validate `@see` targets exist and are relevant
- **NEW**: Validate `{@inheritDoc}` sources exist and have content to inherit
- **NEW**: Detect orphaned `{@link}` references where the description doesn't match the target's current summary

#### Developer Guide Generation
- **NEW**: `@concept` tag on symbols feeds into Concepts page FORGE:AUTO sections
- **NEW**: Symbols with `@concept Architecture` generate content in the "Architecture" section of Concepts
- **NEW**: Symbols with complex type relationships generate "How It Works" diagrams

### Layer 3: Consumer Documentation (NEW — biggest gap)

**What it enforces**: Consumer-facing guides and docs are derived from code and stay synchronized.

#### Intelligent Guide Stubbing

Instead of blank stubs, forge-ts analyzes the symbol graph to generate logical guide structures:

```
Code Analysis → Guide Structure Discovery → FORGE:AUTO Stub Generation
```

**Discovery heuristics** (what makes a guide):

1. **Entry Point Analysis**: Functions exported from index.ts → "Getting Started" guide sections
2. **Workflow Detection**: Functions that call each other in sequence → "Workflow Guide" with step-by-step
3. **Config Type Analysis**: ForgeConfig-like interfaces → "Configuration Guide" with every option explained
4. **Error/Throws Analysis**: Functions with `@throws` → "Error Handling Guide" with error catalog
5. **Pattern Detection**: Adapter/Strategy/Factory patterns → "Extending" guide with extension points
6. **`@guide` Tag**: Explicit developer annotation → dedicated guide page
7. **`@category` Tag**: Symbol grouping → category-organized guides

**Output structure**:

```
guides/
  getting-started.mdx          ← derived from entry points + @example blocks
  configuration.mdx            ← derived from config interfaces + @defaultValue
  error-handling.mdx           ← derived from @throws + error types
  extending.mdx                ← derived from adapter/plugin patterns
  {category-name}.mdx          ← derived from @category groupings
  {custom-guide}.mdx           ← derived from @guide tags
```

Each guide contains:
- **FORGE:AUTO blocks** — regenerated from code on every build (signatures, params, examples)
- **User content zones** — preserved across rebuilds (explanations, diagrams, tutorials)
- **TODO markers** — where forge-ts couldn't derive content and needs human input

Example generated guide structure:

```markdown
---
title: Configuration Guide
description: Complete configuration reference for my-project
---

Configure my-project by creating a `my-project.config.ts` file.

<!-- FORGE:AUTO-START config-interface -->
## Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| rootDir | string | "." | Root directory of the project. |
| outDir | string | "docs" | Output directory for generated files. |
| strict | boolean | true | Fail on warnings rather than only on errors. |

<!-- FORGE:AUTO-END config-interface -->

## Advanced Configuration

> TODO: Add advanced configuration examples and edge cases.

<!-- FORGE:AUTO-START config-examples -->
### Example

```typescript
import { defineConfig } from "my-project";

export default defineConfig({
  rootDir: ".",
  outDir: "docs/generated",
});
```

<!-- FORGE:AUTO-END config-examples -->
```

#### Idempotent Regeneration

Critical requirement: user-written content MUST survive regeneration.

The system uses three zone types:
1. **FORGE:AUTO zones** (`<!-- FORGE:AUTO-START id -->...<!-- FORGE:AUTO-END id -->`) — fully regenerated every build
2. **FORGE:STUB zones** (`<!-- FORGE:STUB-START id -->...<!-- FORGE:STUB-END id -->`) — generated once with TODO, never overwritten once user edits
3. **Unmarked zones** — user-owned, never touched by forge-ts

Detection: if content between FORGE:STUB markers has been modified (differs from generated stub), forge-ts treats it as user content and preserves it.

---

## Downstream Config Orchestration

### What forge-ts manages (writes/owns)

| File | Action | Rationale |
|------|--------|-----------|
| `tsdoc.json` | Writes and owns | forge-ts defines the TSDoc standard for the project |
| `.forge-lock.json` | Writes and owns | Config locking manifest |
| `.forge-audit.jsonl` | Writes and owns | Audit trail |

### What forge-ts validates (reads/guards)

| File | Rule | What It Checks |
|------|------|----------------|
| `tsconfig.json` | E009 | `strict: true`, `strictNullChecks: true`, `noImplicitAny: true`, etc. |
| `forge-ts.config.ts` | E010 | Rule severities haven't been weakened without audit trail |
| `biome.json` | E011 | Key rules haven't been switched from error to warn/off |
| `package.json` | E012 | `engines.node` hasn't been downgraded, `type: "module"` preserved |

### What forge-ts scaffolds (writes once during init)

| File | Action | Rationale |
|------|--------|-----------|
| `.eslintrc` (tsdoc section) | Adds `eslint-plugin-tsdoc` config | Only if ESLint detected |
| `biome.json` | Does NOT create | Biome owns its config — user runs `biome init` |
| `tsconfig.json` | Does NOT create | TypeScript owns its config — user creates it |

### forge-ts.config.ts Expansion

New config sections for the orchestration layer:

```typescript
import { defineConfig } from "@forge-ts/core";

export default defineConfig({
  // ... existing config ...

  // NEW: TSDoc standard configuration
  tsdoc: {
    /** Write tsdoc.json to project root on init. Default: true */
    writeConfig: true,
    /** Custom tag definitions beyond the forge-ts preset */
    customTags: [],
    /** Which standardization groups to enforce */
    enforce: {
      core: "error",      // @param, @returns, @remarks, @defaultValue, @typeParam
      extended: "warn",    // @example, @throws, @see, @deprecated
      discretionary: "off" // @sealed, @virtual, @override, etc.
    }
  },

  // NEW: Downstream config guards
  guards: {
    /** tsconfig.json strictness validation */
    tsconfig: {
      enabled: true,
      /** Required strict-mode flags */
      requiredFlags: [
        "strict",
        "strictNullChecks",
        "noImplicitAny",
        "strictFunctionTypes"
      ]
    },
    /** Biome config drift detection */
    biome: {
      enabled: true,
      /** Biome rules that must stay at error level */
      lockedRules: []  // auto-detected from current biome.json on lock
    },
    /** package.json guards */
    packageJson: {
      enabled: true,
      /** Minimum Node.js version in engines field */
      minNodeVersion: "22.0.0",
      /** Required fields */
      requiredFields: ["type", "engines"]
    }
  },

  // NEW: Guide generation configuration
  guides: {
    enabled: true,
    /** Auto-discover guide topics from code analysis */
    autoDiscover: true,
    /** Explicit guide definitions */
    custom: [
      // { slug: "authentication", title: "Authentication Guide", sources: ["src/auth/**"] }
    ]
  }
});
```

---

## New Enforcer Rules (Complete List)

### Phase 4: Agent-Proof Guardrails

| Rule | Severity | Description |
|------|----------|-------------|
| E009 | error | tsconfig.json strictness regression detected |
| E010 | error | forge-ts config rule severity weakened without audit trail |
| W006 | warn | TSDoc parse error (surfaces eslint-plugin-tsdoc parser messages) |

### Phase 5: Dev + Consumer Layer Enforcement

| Rule | Severity | Description |
|------|----------|-------------|
| E011 | error | Biome config rule weakened (key rules switched from error to off) |
| E012 | error | package.json engine field tampered (Node.js version downgraded) |
| E013 | error | Public function/class missing `@remarks` block |
| E014 | warn | Optional property with default value missing `@defaultValue` |
| E015 | error | Generic function/class/interface missing `@typeParam` |
| W005 | warn | Function body references symbols not mentioned in `@see` |
| W007 | warn | Guide FORGE:AUTO section is stale (code changed, guide not rebuilt) |

### Phase 6: Ecosystem Integration

| Rule | Severity | Description |
|------|----------|-------------|
| E016 | error | Exported symbol missing release tag (@public/@beta/@internal) |
| W008 | warn | Symbol exported from index.ts but not documented in any guide |

---

## Implementation Order

### Immediate (v0.9.0): TSDoc Ecosystem Foundation

1. Add `@microsoft/tsdoc-config` dependency to `@forge-ts/core`
2. Replace `new TSDocConfiguration()` with `TSDocConfigFile.loadForFolder()` in walker.ts
3. Create `@forge-ts/tsdoc-config` package with opinionated tsdoc.json preset
4. Update `forge-ts init` to write tsdoc.json
5. Add W006 rule: surface TSDoc parse errors from the parser's message log
6. Ship the opinionated tsdoc.json preset

**Impact**: Every existing eslint-plugin-tsdoc user gets automatic interop. forge-ts check now catches 70+ syntax errors it was silently ignoring.

### v0.10.0: Config Guards + Audit Trail

1. Add E009 (tsconfig guard), E010 (config drift guard)
2. Implement `.forge-lock.json` and `forge-ts lock/unlock` commands
3. Implement `.forge-audit.jsonl` append-only audit log
4. Add bypass budget system
5. Add `guards` section to ForgeConfig

### v0.11.0: Dev Layer Enforcement

1. Add E013 (@remarks), E014 (@defaultValue), E015 (@typeParam), W005 (@see)
2. Enhance DocTest to detect stale @example blocks
3. Add `@concept` and `@guide` custom tags to tsdoc.json preset
4. Validate `{@inheritDoc}` sources

### v0.12.0: Intelligent Guide Generation

1. Implement guide discovery heuristics (entry points, workflows, config types, errors)
2. Add FORGE:STUB zone support alongside FORGE:AUTO
3. Generate code-derived guide structures with TODO markers
4. Add W007 (stale guide detection)
5. Add `guides` section to ForgeConfig

### v0.13.0: Ecosystem Integration

1. Add E011 (Biome guard), E012 (package.json guard)
2. Add E016 (release tag requirement), W008 (undocumented in guides)
3. Knip integration (skip enforcement on dead exports)
4. `forge-ts init --hooks` for husky/lefthook scaffolding
5. `forge-ts prepublish` gate command

---

## Design Principles

### 1. Code is the Single Source of Truth

All documentation derives from code. If code changes, documentation must change. forge-ts enforces this by:
- Requiring TSDoc on all public symbols (enforcement)
- Generating docs from TSDoc (generation)
- Detecting when generated docs are stale (drift detection)
- Using FORGE:AUTO to keep code-derived sections fresh

### 2. Complement, Never Replace

forge-ts doesn't replace Biome, ESLint, TypeScript, or Knip. It:
- WRITES tsdoc.json (owns TSDoc standard)
- GUARDS tsconfig.json, biome.json, package.json (detects drift)
- ORCHESTRATES via forge-ts.config.ts (single config surface)
- ENFORCES what no other tool does (TSDoc completeness + doc pipeline + config drift)

### 3. Strict by Default, Escape Hatches are Explicit

Every default is the strictest option. Loosening requires:
- Explicit config change in forge-ts.config.ts
- Audit trail entry in .forge-audit.jsonl
- If locked: `forge-ts unlock --reason="..."` with justification

### 4. Auto-Fix Must Not Mask Issues

Auto-fix is permitted for:
- Adding TSDoc stubs with TODO markers (makes the gap visible)
- Writing tsdoc.json (setting up the ecosystem)
- Generating FORGE:AUTO content (code-derived, always fresh)

Auto-fix is NOT permitted for:
- Generating content-free TSDoc (`@returns The result`)
- Weakening config settings
- Removing enforcement rules

### 5. Idempotent Regeneration

User content in guide files MUST survive `forge-ts build`:
- FORGE:AUTO zones: regenerated every build
- FORGE:STUB zones: generated once, preserved after user edit
- Unmarked zones: never touched
