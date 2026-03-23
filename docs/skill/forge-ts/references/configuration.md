# forge-ts Configuration Reference (v0.19.5)

## Config File Resolution

forge-ts looks for configuration in this order:
1. `forge-ts.config.ts` in the project root
2. `forge-ts.config.js` in the project root
3. `forge-ts.config.json` in the project root
4. Built-in defaults

Unknown keys produce a warning to stderr and in the JSON envelope
(`result._warnings`). They are not rejected — config loading is lenient.

## Full Configuration

```typescript
import { defineConfig } from "@forge-ts/core";

export default defineConfig({
  rootDir: ".",
  tsconfig: "./tsconfig.json",
  outDir: "./docs/generated",

  enforce: {
    enabled: true,
    minVisibility: "public",    // "public" | "beta" | "internal"
    strict: false,              // true promotes all warnings to errors
    ignoreFile: ".forge-ignore", // Knip integration: symbol names to skip
    rules: {
      // API Layer
      "require-summary": "error",              // E001
      "require-param": "error",                // E002
      "require-returns": "error",              // E003
      "require-example": "error",              // E004
      "require-package-doc": "error",          // E005
      "require-class-member-doc": "error",     // E006
      "require-interface-member-doc": "error", // E007
      // Dev Layer
      "require-remarks": "error",              // E013
      "require-default-value": "warn",         // E014
      "require-type-param": "error",           // E015
      "require-internal-boundary": "error",    // E017
      "require-route-response": "warn",        // E018
      "require-see": "warn",                   // W005
      "require-tsdoc-syntax": "warn",          // W006
      "require-inheritdoc-source": "warn",     // W009
      // Consumer Layer
      "require-release-tag": "error",          // E016
      "require-fresh-guides": "warn",          // W007
      "require-guide-coverage": "warn",        // W008
      "require-migration-path": "warn",        // W010
      "require-since": "warn",                 // W011
      // LLM Anti-Pattern Layer
      "require-no-ts-ignore": "error",         // E019
      "require-no-any-in-api": "error",        // E020
      "require-fresh-link-text": "warn",       // W012
      "require-fresh-examples": "warn",        // W013
    },
  },

  doctest: {
    enabled: true,
    cacheDir: ".cache/doctest",
  },

  api: {
    enabled: false,
    openapi: false,
    openapiPath: "./docs/generated/api/openapi.json",
  },

  gen: {
    enabled: true,
    formats: ["markdown"],      // "markdown" | "mdx"
    llmsTxt: true,
    readmeSync: false,
    ssgTarget: "mintlify",      // "mintlify" | "docusaurus" | "nextra" | "vitepress"
  },

  skill: {
    enabled: true,              // defaults to gen.llmsTxt value
    customSections: [],
    extraGotchas: [],
  },

  tsdoc: {
    writeConfig: false,         // true writes tsdoc.json to project root
    customTags: [],             // additional custom tag definitions (written to tsdoc.json during init)
    enforce: {                  // per-group enforcement severity
      core: "error",
      extended: "warn",
      discretionary: "off",
    },
  },

  guards: {
    tsconfig: {
      enabled: true,            // E009: detect strict mode regression
    },
    biome: {
      enabled: true,            // E011: detect rule weakening
    },
    packageJson: {
      enabled: true,            // E012: detect engine field tampering
      minNodeVersion: "24.0.0",
    },
  },

  bypass: {
    dailyBudget: 3,             // max active bypasses per day
    durationHours: 24,          // auto-expiry for each bypass
  },

  guides: {
    enabled: true,
    autoDiscover: true,         // run 5 heuristics on symbol graph
    // custom guide definitions (in addition to auto-discovered)
  },

  // Auto-detected from package.json if not set
  project: {
    repository: "https://github.com/user/repo",
    homepage: "https://example.com",
    packageName: "@scope/package-name",
    description: "Short description",
    version: "1.0.0",
  },
});
```

## Defaults

| Option | Default |
|--------|---------|
| `enforce.enabled` | `true` |
| `enforce.minVisibility` | `"public"` |
| `enforce.strict` | `false` |
| `doctest.enabled` | `true` |
| `api.enabled` | `false` |
| `gen.enabled` | `true` |
| `gen.llmsTxt` | `true` |
| `gen.ssgTarget` | `undefined` (Mintlify used as default adapter) |
| `skill.enabled` | follows `gen.llmsTxt` |
| `tsdoc.writeConfig` | `false` |
| `guards.tsconfig.enabled` | `true` |
| `guards.biome.enabled` | `true` |
| `guards.packageJson.enabled` | `true` |
| `bypass.dailyBudget` | `3` |
| `bypass.durationHours` | `24` |
| `guides.enabled` | `true` |
| `guides.autoDiscover` | `true` |

## Project Metadata

Auto-populated from `package.json`:
- `repository` from `repository.url` (git+https normalized)
- `homepage` from `homepage`
- `packageName` from `name`
- `description` from `description`
- `version` from `version`
- `bin` from `bin` (CLI detection for script generation)
- `scripts` from `scripts`
- `keywords` from `keywords`

Used in generated documentation links, install commands, SSG configs,
and skill package content.

## Config Ownership Model

forge-ts **writes** `tsdoc.json` (it owns the TSDoc standard for the project).
forge-ts **guards** (reads but does not write) `tsconfig.json`, `biome.json`,
and `package.json`. Those tools own their files; forge-ts validates against
expected thresholds via guard rules (E009, E011, E012).

## Agent-Proof Files

| File | Created By | Purpose |
|------|-----------|---------|
| `.forge-lock.json` | `forge-ts lock` | Snapshot of rule severities and guard values |
| `.forge-audit.jsonl` | Auto (append-only) | Log of lock/unlock/bypass/config changes |
| `.forge-bypass.json` | `forge-ts bypass` | Active temporary rule exemptions |

## Skill Configuration

See [skill-config.md](skill-config.md) for detailed skill package
configuration including custom sections and extra gotchas.
