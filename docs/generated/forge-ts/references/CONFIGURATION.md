# forge-ts — Configuration Reference

Full documentation for all configuration options. Create a `forge-ts.config.ts` at your project root.

## `ForgeConfig`

Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `` | Root directory of the project. |
| `tsconfig` | `` | Path to the tsconfig.json to compile against. |
| `outDir` | `` | Output directory for generated files. |
| `enforce` | `boolean; minVisibility: Visibility; strict: boolean; rules: EnforceRules; }` | Enforce TSDoc on all public exports. |
| `doctest` | `boolean; cacheDir: string; }` | DocTest configuration. |
| `api` | `boolean; openapi: boolean; openapiPath: string; }` | API generation configuration. |
| `gen` | `boolean; formats: ("markdown" | "mdx")[]; llmsTxt: boolean; readmeSync: boolean; ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress" | undefined; }` | Output generation configuration. |
| `project` | `string | undefined; homepage?: string | undefined; packageName?: string | undefined; }` | Project metadata — auto-detected from package.json if not provided. |

## `SSGConfigFile`

A single generated SSG configuration file.

| Property | Type | Description |
|----------|------|-------------|
| `path` | `` | Relative path from outDir (e.g., "mint.json", "_meta.json") |
| `content` | `` | File content |
