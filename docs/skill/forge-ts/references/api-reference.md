# forge-ts Programmatic API (v0.19.5)

## Table of Contents

- [Core Functions](#core-functions)
- [Visibility](#visibility)
- [Key Types](#key-types)
- [Enforcer](#enforcer)
- [DocTest](#doctest)
- [API Generator](#api-generator)
- [Site Generator](#site-generator)
- [SSG Adapters](#ssg-adapters)
- [Lock / Audit / Bypass](#lock--audit--bypass)
- [Guide Discovery](#guide-discovery)
- [TSDoc Config](#tsdoc-config)

## Core Functions

### defaultConfig

```typescript
import { defaultConfig } from "@forge-ts/core";
const config = defaultConfig("/path/to/project");
// Returns ForgeConfig with sensible defaults
```

### loadConfig

```typescript
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
// Resolves: config.ts → config.js → config.json → defaults
```

### walkProject

```typescript
import { walkProject } from "@forge-ts/core";
const symbols: ForgeSymbol[] = walkProject(config);
// Single-pass AST traversal via ts.createProgram
// TSDoc parsed via TSDocConfigFile.loadForFolder() (cached per directory)
```

### clearTSDocConfigCache

```typescript
import { clearTSDocConfigCache } from "@forge-ts/core";
clearTSDocConfigCache();
// Resets cached TSDoc configurations (useful for test isolation)
```

## Visibility

```typescript
import { Visibility, resolveVisibility, meetsVisibility, filterByVisibility } from "@forge-ts/core";

// Enum: Public > Beta > Internal > Private
resolveVisibility({ internal: [] });  // Visibility.Internal
meetsVisibility(Visibility.Public, Visibility.Public);  // true
meetsVisibility(Visibility.Internal, Visibility.Public); // false

const publicOnly = filterByVisibility(symbols, Visibility.Public);
```

## Key Types

| Type | Description |
|------|-------------|
| `ForgeConfig` | Full configuration (10 sections, loaded from config file or defaults) |
| `ForgeSymbol` | Extracted symbol with TSDoc, visibility, parameters, examples, children |
| `ForgeResult` | Compilation pass result |
| `ForgeError` | Diagnostic error with file, line, rule code, suggestedFix |
| `ForgeWarning` | Diagnostic warning |
| `RuleSeverity` | `"error"` \| `"warn"` \| `"off"` |
| `EnforceRules` | Per-rule severity map (15 configurable rules) |
| `ForgeLockManifest` | Snapshot of rule severities and guard values |
| `BypassRecord` | Rule ID, reason, expiration timestamp |
| `AuditEntry` | Timestamped log entry for lock/unlock/bypass/config events |
| `DocPage` | Generated documentation page (path, content, stage) |
| `GuideDiscoveryResult` | Auto-discovered guide topic with heuristic source |
| `SSGAdapter` | Interface for SSG-specific transformations |
| `OpenAPISchemaObject` | OpenAPI 3.2 schema object |

## Enforcer

```typescript
import { enforce } from "@forge-ts/enforcer";
const result = enforce(symbols, config.enforce);
// result.errors: ForgeError[] with suggestedFix (33 rules across 4 layers)
// result.warnings: ForgeWarning[]
// Guard rules check isRuleBypassed() before emitting
```

## DocTest

```typescript
import { extractTests, runTests } from "@forge-ts/doctest";
const tests = extractTests(symbols);  // Extract @example blocks
const results = await runTests(tests); // Execute via node:test
```

## API Generator

```typescript
import { generateOpenAPI } from "@forge-ts/api";
const spec = generateOpenAPI(symbols, config);
// OpenAPI 3.2.0 spec — paths from @route tags
// Visibility filtering via @public/@beta/@internal
```

## Site Generator

```typescript
import { generateSite } from "@forge-ts/gen";
const files = await generateSite(symbols, config);
// Returns: { path: string; content: string }[]
// Includes: MDX pages, llms.txt, SKILL.md, SSG nav config
// Runs guide discovery, zone processing, README sync
```

## SSG Adapters

```typescript
import { getAdapter, registerAdapter, type SSGAdapter } from "@forge-ts/gen";

const adapter: SSGAdapter = getAdapter("mintlify");
// Also: "docusaurus", "nextra", "vitepress"

// SSGAdapter interface:
// - transformPages(pages, config): SSG-specific file format
// - generateConfig(symbols, config): SSG configuration file
// - scaffold(config): initial project structure
// - getDevCommand(): local dev server command
// - detectExisting(rootDir): check if SSG already configured

// Register custom adapter at runtime:
registerAdapter("custom", myAdapter);
```

## Lock / Audit / Bypass

```typescript
import {
  createLockManifest,
  loadLockManifest,
  validateAgainstLock,
  appendAuditEntry,
  loadAuditTrail,
  createBypass,
  isRuleBypassed,
} from "@forge-ts/core";

// Lock: snapshot current config
const manifest = createLockManifest(config);
// Saved to .forge-lock.json by forge-ts lock

// Validate: detect drift
const driftErrors = validateAgainstLock(config, manifest);
// Returns ForgeError[] for E010 violations

// Audit: append-only log
appendAuditEntry({ type: "lock", timestamp: Date.now(), ... });
const trail = loadAuditTrail(".forge-audit.jsonl");

// Bypass: temporary rule exemption
const bypass = createBypass("E009", "migrating tsconfig", config.bypass);
const bypassed = isRuleBypassed("E009", bypasses);
```

## Guide Discovery

```typescript
import { discoverGuides } from "@forge-ts/gen";
const guides = discoverGuides(symbols, config.guides);
// Returns GuideDiscoveryResult[] — one per discovered topic
// Each has: slug, title, heuristic source, related symbols
// 5 heuristics: config-interface, error-types, guide-tag, category, entry-point
```

## TSDoc Config

```typescript
import { loadTSDocConfig } from "@forge-ts/core";
// Uses TSDocConfigFile.loadForFolder() from @microsoft/tsdoc-config
// Cached per directory in a Map<string, TSDocConfiguration>
// Falls back to bare TSDocConfiguration if no tsdoc.json found
```

The bundled tsdoc-preset in `@forge-ts/core` exports an opinionated `tsdoc.json`
with 24 standard tags and 15 custom tags (including `@route`, `@category`,
`@since`, `@guide`, `@concept`, `@forgeIgnore`, and more).
