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

Full configuration for a forge-ts run.

```typescript
import type { ForgeConfig } from "forge-ts";

const config: Partial<ForgeConfig> = {
  // Root directory of the project.
  rootDir: "...",
  // Path to the `tsconfig.json` used for TypeScript compilation and type resolution.
  tsconfig: "...",
  // Output directory for all generated documentation artifacts.
  outDir: "...",
  // Enforcement configuration — controls which TSDoc rules run and at what severity.
  enforce: { /* ... */ },
  // DocTest configuration — controls execution of `@example` blocks as live tests.
  doctest: { /* ... */ },
  // API generation configuration — controls OpenAPI spec output.
  api: { /* ... */ },
  // Documentation generation configuration — controls what files are written by `forge gen`.
  gen: { /* ... */ },
  // SKILL.md generation settings.
  skill: [],
  // TSDoc ecosystem configuration — tag definitions and group-level enforcement.
  tsdoc: { /* ... */ },
  // Bypass budget — controls how many temporary rule suppressions are allowed.
  bypass: { /* ... */ },
  // Guide generation configuration — controls intelligent guide page output.
  guides: [],
  // Downstream config drift guards — validate tooling config files stay in sync.
  guards: [],
  // Warnings generated during config loading (e.g., unknown keys, failed imports).
  _configWarnings: "...",
  // Project metadata — auto-detected from `package.json` when not provided.
  project: [],
};
```

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | Root directory of the project. |
| `tsconfig` | `string` | Path to the `tsconfig.json` used for TypeScript compilation and type resolution. |
| `outDir` | `string` | Output directory for all generated documentation artifacts. |
| `enforce` | `{ enabled: boolean; minVisibility: Visibility | "public" | "beta" | "internal" | "private"; strict: boolean; rules: EnforceRules; ignoreFile?: string; }` | Enforcement configuration — controls which TSDoc rules run and at what severity. |
| `doctest` | `{ enabled: boolean; cacheDir: string; }` | DocTest configuration — controls execution of `@example` blocks as live tests. |
| `api` | `{ enabled: boolean; openapi: boolean; openapiPath: string; }` | API generation configuration — controls OpenAPI spec output. |
| `gen` | `{ enabled: boolean; formats: Array<"markdown" | "mdx">; llmsTxt: boolean; readmeSync: boolean; ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress" | "fumadocs"; ckm?: boolean; }` | Documentation generation configuration — controls what files are written by `forge gen`. |
| `skill` | `{ enabled?: boolean; customSections?: Array<{ heading: string; content: string; }>; extraGotchas?: string[]; }` | SKILL.md generation settings. |
| `tsdoc` | `{ writeConfig: boolean; customTags: Array<{ tagName: string; syntaxKind: "block" | "inline" | "modifier"; }>; enforce: { core: "error" | "warn" | "off"; extended: "error" | "warn" | "off"; discretionary: "error" | "warn" | "off"; }; }` | TSDoc ecosystem configuration — tag definitions and group-level enforcement. |
| `bypass` | `{ dailyBudget: number; durationHours: number; }` | Bypass budget — controls how many temporary rule suppressions are allowed. |
| `guides` | `{ enabled: boolean; autoDiscover: boolean; custom: Array<{ slug: string; title: string; sources: string[]; }>; }` | Guide generation configuration — controls intelligent guide page output. |
| `guards` | `{ tsconfig: { enabled: boolean; requiredFlags: string[]; }; biome: { enabled: boolean; lockedRules: string[]; }; packageJson: { enabled: boolean; minNodeVersion: string; requiredFields: string[]; }; }` | Downstream config drift guards — validate tooling config files stay in sync. |
| `_configWarnings` | `string[] | undefined` | Warnings generated during config loading (e.g., unknown keys, failed imports). |
| `project` | `{ repository?: string; homepage?: string; packageName?: string; description?: string; version?: string; bin?: Record<string, string>; scripts?: Record<string, string>; keywords?: string[]; }` | Project metadata — auto-detected from `package.json` when not provided. |

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
