# forge-ts Configuration Reference

## Config File Resolution

forge-ts looks for configuration in this order:
1. `forge-ts.config.ts` in the project root
2. `forge-ts.config.js` in the project root
3. `"forge-ts"` key in `package.json`
4. Built-in defaults

## Full Configuration

```typescript
import type { ForgeConfig } from "@forge-ts/core";

export default {
  // Project root directory
  rootDir: ".",

  // Path to tsconfig.json
  tsconfig: "./tsconfig.json",

  // Output directory for generated files
  outDir: "./docs/generated",

  // TSDoc enforcement settings
  enforce: {
    enabled: true,
    // Minimum visibility to enforce: "public" | "beta" | "internal"
    minVisibility: "public",
    // When true, all warnings become errors
    strict: false,
    // Per-rule severity: "error" | "warn" | "off"
    rules: {
      "require-summary": "error",
      "require-param": "error",
      "require-returns": "error",
      "require-example": "error",
      "require-package-doc": "warn",
      "require-class-member-doc": "error",
      "require-interface-member-doc": "error",
    },
  },

  // DocTest settings
  doctest: {
    enabled: true,
    // Cache directory for virtual test files
    cacheDir: ".cache/doctest",
  },

  // OpenAPI generation settings
  api: {
    enabled: true,
    openapi: true,
    openapiPath: "./docs/generated/api/openapi.json",
  },

  // Documentation generation settings
  gen: {
    enabled: true,
    // Output formats: "markdown" | "mdx"
    formats: ["markdown"],
    // Generate llms.txt and llms-full.txt
    llmsTxt: true,
    // Sync API summary into README.md
    readmeSync: false,
    // SSG target: "mintlify" | "docusaurus" | "nextra" | "vitepress"
    ssgTarget: "mintlify",
  },

  // Project metadata (auto-detected from package.json if not set)
  project: {
    repository: "https://github.com/user/repo",
    homepage: "https://example.com",
    packageName: "@scope/package-name",
  },
} satisfies Partial<ForgeConfig>;
```

## Defaults

When no config file is found, forge-ts uses these defaults:
- `enforce.enabled`: `true`
- `enforce.minVisibility`: `"public"`
- `enforce.strict`: `false`
- `doctest.enabled`: `true`
- `api.enabled`: `false`
- `gen.enabled`: `true`
- `gen.llmsTxt`: `true`
- `gen.ssgTarget`: not set (uses Mintlify as default adapter)

## Project Metadata

The `project` field is auto-populated from `package.json`:
- `repository` — from `package.json` `repository.url` field
- `homepage` — from `package.json` `homepage` field
- `packageName` — from `package.json` `name` field

These values are used in generated documentation links,
install commands, and SSG footer configs.
