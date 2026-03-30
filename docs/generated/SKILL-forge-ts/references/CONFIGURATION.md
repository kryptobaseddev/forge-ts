# forge-ts — Configuration Reference

## `BypassConfig`

Configuration for the bypass budget system.

```typescript
import type { BypassConfig } from "forge-ts";

const config: Partial<BypassConfig> = {
  // Maximum number of bypasses allowed per calendar day. Default: 3
  dailyBudget: 0,
  // Duration in hours before a bypass automatically expires. Default: 24
  durationHours: 0,
};
```

| Property | Type | Description |
|----------|------|-------------|
| `dailyBudget` | `number` | Maximum number of bypasses allowed per calendar day. Default: 3 |
| `durationHours` | `number` | Duration in hours before a bypass automatically expires. Default: 24 |

## `ForgeConfig`

Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

```typescript
import type { ForgeConfig } from "forge-ts";

const config: Partial<ForgeConfig> = {
  // Root directory of the project.
  rootDir: "...",
  // Path to the tsconfig.json to compile against.
  tsconfig: "...",
  // Output directory for generated files.
  outDir: "...",
  // Enforce TSDoc on all public exports.
  enforce: { /* ... */ },
  // DocTest configuration.
  doctest: { /* ... */ },
  // API generation configuration.
  api: { /* ... */ },
  // Output generation configuration.
  gen: { /* ... */ },
  // Skill package generation settings. Custom sections here are merged into the generated SKILL.md, allowing projects to inject workflow knowledge, domain gotchas, and other context that cannot be derived from symbols alone.
  skill: [],
  // TSDoc ecosystem configuration.
  tsdoc: { /* ... */ },
  // Bypass budget configuration for temporary rule overrides.
  bypass: { /* ... */ },
  // Guide generation configuration.
  guides: [],
  // Downstream config drift guards.
  guards: [],
  // Warnings generated during config loading (e.g., unknown keys). Populated by loadConfig(). Agents should surface these in output.
  _configWarnings: "...",
  // Project metadata — auto-detected from package.json if not provided.
  project: [],
};
```

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | Root directory of the project. |
| `tsconfig` | `string` | Path to the tsconfig.json to compile against. |
| `outDir` | `string` | Output directory for generated files. |
| `enforce` | `{ enabled: boolean; minVisibility: Visibility | "public" | "beta" | "internal" | "private"; strict: boolean; rules: EnforceRules; ignoreFile?: string; }` | Enforce TSDoc on all public exports. |
| `doctest` | `{ enabled: boolean; cacheDir: string; }` | DocTest configuration. |
| `api` | `{ enabled: boolean; openapi: boolean; openapiPath: string; }` | API generation configuration. |
| `gen` | `{ enabled: boolean; formats: Array<"markdown" | "mdx">; llmsTxt: boolean; readmeSync: boolean; ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress"; ckm?: boolean; }` | Output generation configuration. |
| `skill` | `{ enabled?: boolean; customSections?: Array<{ heading: string; content: string; }>; extraGotchas?: string[]; }` | Skill package generation settings. Custom sections here are merged into the generated SKILL.md, allowing projects to inject workflow knowledge, domain gotchas, and other context that cannot be derived from symbols alone. |
| `tsdoc` | `{ writeConfig: boolean; customTags: Array<{ tagName: string; syntaxKind: "block" | "inline" | "modifier"; }>; enforce: { core: "error" | "warn" | "off"; extended: "error" | "warn" | "off"; discretionary: "error" | "warn" | "off"; }; }` | TSDoc ecosystem configuration. |
| `bypass` | `{ dailyBudget: number; durationHours: number; }` | Bypass budget configuration for temporary rule overrides. |
| `guides` | `{ enabled: boolean; autoDiscover: boolean; custom: Array<{ slug: string; title: string; sources: string[]; }>; }` | Guide generation configuration. |
| `guards` | `{ tsconfig: { enabled: boolean; requiredFlags: string[]; }; biome: { enabled: boolean; lockedRules: string[]; }; packageJson: { enabled: boolean; minNodeVersion: string; requiredFields: string[]; }; }` | Downstream config drift guards. |
| `_configWarnings` | `string[] | undefined` | Warnings generated during config loading (e.g., unknown keys). Populated by loadConfig(). Agents should surface these in output. |
| `project` | `{ repository?: string; homepage?: string; packageName?: string; description?: string; version?: string; bin?: Record<string, string>; scripts?: Record<string, string>; keywords?: string[]; }` | Project metadata — auto-detected from package.json if not provided. |

## `SSGConfigFile`

A single generated SSG configuration file.

```typescript
import type { SSGConfigFile } from "forge-ts";

const config: Partial<SSGConfigFile> = {
  // Relative path from outDir (e.g., "mint.json", "_meta.json")
  path: "...",
  // File content
  content: "...",
};
```

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Relative path from outDir (e.g., "mint.json", "_meta.json") |
| `content` | `string` | File content |
