---
name: SKILL-forge-ts
description: >
  Append-only audit trail for forge-ts configuration and governance events.  Events are stored as JSON Lines in `.forge-audit.jsonl` at the project root. Each line is a single JSON object — the file is never truncated or overwritten. Use when: (1) calling its 96 API functions, (2) configuring forge-ts, (3) understanding its 112 type definitions, (4) user mentions "forge-ts" or asks about its API.
---

# forge-ts

Append-only audit trail for forge-ts configuration and governance events.  Events are stored as JSON Lines in `.forge-audit.jsonl` at the project root. Each line is a single JSON object — the file is never truncated or overwritten.

## Quick Start

```bash
npm install forge-ts
```

```typescript
import { getCurrentUser } from "@forge-ts/core/audit";
const user = getCurrentUser(); // e.g. "alice"
```

## API

| Function | Description |
|----------|-------------|
| `getCurrentUser()` | Returns the current OS username, or "unknown" if unavailable. |
| `appendAuditEvent()` | Appends a single audit event to the `.forge-audit.jsonl` file.  Creates the file if it does not exist. The file is strictly append-only — existing content is never modified or truncated. |
| `readAuditLog()` | Reads the `.forge-audit.jsonl` file and returns parsed audit events.  Returns newest events first. If the file does not exist, returns an empty array. |
| `formatAuditEvent()` | Formats a single audit event as a human-readable string. |
| `createBypass()` | Creates a new bypass record, writes it to `.forge-bypass.json`, and appends an audit event.  Throws an error if the daily budget is exhausted. |
| `getActiveBypasses()` | Returns all currently active (non-expired) bypass records. |
| `isRuleBypassed()` | Checks whether a specific rule has an active bypass.  A rule is considered bypassed if there is an active bypass with the exact rule code or an "all" bypass. |
| `getRemainingBudget()` | Returns the number of bypass budget slots remaining for today.  Counts bypasses created today (UTC) against the configured daily budget. |
| `expireOldBypasses()` | Removes expired bypass records from `.forge-bypass.json`.  Also appends a `bypass.expire` audit event for each expired record removed. |
| `defineConfig()` | Type-safe helper for defining a partial forge-ts configuration.  Only include the settings you want to override — everything else inherits sensible defaults via `loadConfig()`. |
| `defaultConfig()` | Constructs a sensible default `ForgeConfig` rooted at `rootDir`. |
| `loadConfig()` | Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found) |
| `readLockFile()` | Reads the `.forge-lock.json` file from the given project root. |
| `writeLockFile()` | Writes a `ForgeLockManifest` to `.forge-lock.json` in the project root. |
| `removeLockFile()` | Removes the `.forge-lock.json` file from the project root. |
| ... | 81 more — see API reference |

## Configuration

```typescript
import type { BypassConfig } from "forge-ts";

const config: Partial<BypassConfig> = {
  // Maximum number of bypasses allowed per calendar day. Default: 3
  dailyBudget: 0,
  // Duration in hours before a bypass automatically expires. Default: 24
  durationHours: 0,
};
```

See [references/CONFIGURATION.md](references/CONFIGURATION.md) for full details.

## The Flow

```
Your TypeScript code
  |  Write TSDoc comments (@param, @returns, @example, etc.)
  v
forge-ts check   -->  FAILS if docs incomplete (exact fix suggestions)
  v
forge-ts build   -->  Generates ALL artifacts from TSDoc
  v
forge-ts docs init --target mintlify  -->  Scaffolds SSG project
  v
forge-ts docs dev  -->  Preview locally
```

## CLI Commands

| Command | Purpose |
|---------|---------|
| `forge-ts check` | Enforce TSDoc on all public exports |
| `forge-ts check --json --mvi full` | Agent-friendly JSON with exact fix suggestions |
| `forge-ts test` | Extract and execute @example blocks |
| `forge-ts build` | Generate all docs, OpenAPI, llms.txt, SKILL.md |
| `forge-ts build --force-stubs` | Reset stub pages to scaffolding state |
| `forge-ts docs init --target mintlify` | Scaffold SSG doc site |
| `forge-ts docs dev` | Launch dev server (`npx @mintlify/cli dev`) |

**Output format**: TTY gets human-readable output by default. Piped/non-TTY (agents, CI) gets JSON (LAFS envelope). Override with `--human` or `--json`. For monorepos, use `--cwd packages/<name>` to target a specific package.

The `--mvi` flag controls JSON verbosity: `minimal` (~50 tokens), `standard` (~200), `full` (~500+).

## SSoT Principle

Source code IS documentation. Change a function signature, docs update on next build. Remove a parameter, docs remove it. Add an `@example`, it becomes a doctest AND a doc page entry AND part of the SKILL.md.

## Auto-Generated vs Stub Pages

`forge-ts build` produces two categories of output:

**Auto-generated (regenerated every build):** index.mdx, getting-started.mdx, configuration.mdx, packages/*/api/*.mdx, api/openapi.json, llms.txt, llms-full.txt, SKILL.md, docs.json

**Stubs (created once, progressively enriched):** concepts.mdx, guides/index.mdx, faq.mdx, contributing.mdx, changelog.mdx

Stubs contain `<!-- FORGE:AUTO-START id -->` / `<!-- FORGE:AUTO-END id -->` markers. On rebuild, content inside markers is updated from source while manual content outside markers is preserved.

Use `--force-stubs` to reset stubs to their scaffolding state.

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
When `strict: true`, all warnings become errors.
When `--json --mvi full`, each error includes `suggestedFix` with the exact TSDoc block to paste.

## Packages

| Package | Purpose |
|---------|---------|
| `@forge-ts/cli` | Unified CLI (install this one) |
| `@forge-ts/core` | AST walker, config loader, shared types |
| `@forge-ts/enforcer` | TSDoc enforcement (E001-E008, W004) |
| `@forge-ts/doctest` | @example extraction + node:test runner |
| `@forge-ts/api` | OpenAPI 3.2 generation from types |
| `@forge-ts/gen` | Markdown/MDX, llms.txt, SKILL.md, SSG adapters |

## Gotchas

- `createBypass()` throws: Error when the daily bypass budget is exhausted.
- `getAdapter()` throws: `Error` if the target is not registered.
- `Visibility` enum values: Public, Beta, Internal, Private
- Enforcer checks ALL files in tsconfig. Exclude test fixtures via `exclude`.
- `@example` blocks require fenced code blocks. Bare code is silently ignored.
- `// => value` in examples auto-converts to `assert.strictEqual()` during doctest.
- `@internal` symbols excluded from ALL output. `@beta` filtered at `minVisibility: "public"`.
- OpenAPI paths require `@route GET /path` tags. No `@route` = empty `paths`.
- Mintlify adapter generates `docs.json` (v4 format), not `mint.json`.
- Stub pages use FORGE:AUTO markers — manual content outside markers is safe.
- `--force-stubs` resets stubs to scaffolding; use with care on edited stubs.

## Key Types

- **`AuditEventType`** — Discriminated event types recorded in the audit trail.
- **`AuditEvent`** — A single audit event recorded in the forge-ts audit trail.
- **`ReadAuditOptions`** — Options for reading the audit log.
- **`BypassConfig`** — Configuration for the bypass budget system.
- **`BypassRecord`** — A single bypass record stored in `.forge-bypass.json`.
- **`Visibility`** — Visibility levels for exported symbols. Derived from TSDoc release tags (public, beta, internal).
- **`ForgeSymbol`** — A single extracted and annotated symbol from the TypeScript AST.
- **`RuleSeverity`** — Severity level for an individual enforcement rule. - `"error"` — violation fails the build. - `"warn"`  — violation is reported but does not fail the build. - `"off"`   — rule is disabled entirely.
- **`EnforceRules`** — Per-rule severity configuration for the TSDoc enforcer. Each key corresponds to one of the E001–E007 rule codes.
- **`ForgeConfig`** — Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

## References

- [references/CONFIGURATION.md](references/CONFIGURATION.md) — Full config options
- [references/API-REFERENCE.md](references/API-REFERENCE.md) — Signatures, parameters, examples
