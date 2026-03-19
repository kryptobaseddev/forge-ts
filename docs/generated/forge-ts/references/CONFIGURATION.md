# forge-ts — Configuration Reference

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
  enforce: true,
  // DocTest configuration.
  doctest: true,
  // API generation configuration.
  api: true,
  // Output generation configuration.
  gen: true,
  // Skill package generation settings. Custom sections here are merged into the generated SKILL.md, allowing projects to inject workflow knowledge, domain gotchas, and other context that cannot be derived from symbols alone.
  skill: true,
  // Project metadata — auto-detected from package.json if not provided.
  project: "...",
};
```

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | Root directory of the project. |
| `tsconfig` | `string` | Path to the tsconfig.json to compile against. |
| `outDir` | `string` | Output directory for generated files. |
| `enforce` | `boolean; minVisibility: Visibility; strict: boolean; rules: EnforceRules; }` | Enforce TSDoc on all public exports. |
| `doctest` | `boolean; cacheDir: string; }` | DocTest configuration. |
| `api` | `boolean; openapi: boolean; openapiPath: string; }` | API generation configuration. |
| `gen` | `boolean; formats: ("markdown" | "mdx")[]; llmsTxt: boolean; readmeSync: boolean; ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress" | undefined; }` | Output generation configuration. |
| `skill` | `boolean | undefined; customSections?: { heading: string; content: string; }[] | undefined; extraGotchas?: string[] | undefined; }` | Skill package generation settings. Custom sections here are merged into the generated SKILL.md, allowing projects to inject workflow knowledge, domain gotchas, and other context that cannot be derived from symbols alone. |
| `project` | `string | undefined; homepage?: string | undefined; packageName?: string | undefined; description?: string | undefined; version?: string | undefined; bin?: Record<string, string> | undefined; scripts?: Record<...> | undefined; keywords?: string[] | undefined; }` | Project metadata — auto-detected from package.json if not provided. |

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
