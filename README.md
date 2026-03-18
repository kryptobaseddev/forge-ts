# forge-ts

> The universal documentation compiler for any TypeScript project.

Write your code. Write your TSDoc. Run `npx forge-ts build`. Get everything.

## What it does

forge-ts performs a single AST traversal of your TypeScript project and produces:

- **OpenAPI specs** from your exported types and interfaces
- **Executable doctests** from your `@example` blocks
- **AI context** (`llms.txt` / `llms-full.txt`) for LLM agents
- **Markdown/MDX docs** ready for Docusaurus, Mintlify, Nextra, or VitePress
- **README syncing** keeps your GitHub front page up-to-date

## Quick Start

```bash
npx forge-ts check    # Lint TSDoc coverage
npx forge-ts test     # Run @example blocks as tests
npx forge-ts build    # Generate everything
```

## Installation

```bash
npm install -D forge-ts
# or
pnpm add -D forge-ts
```

## Configuration

Zero-config by default. Optionally create `forge-ts.config.ts`:

```typescript
import type { ForgeConfig } from "@forge-ts/core";

export default {
  enforce: {
    enabled: true,
    minVisibility: "public",
    strict: true,
  },
  gen: {
    formats: ["markdown"],
    llmsTxt: true,
    readmeSync: true,
    ssgTarget: "docusaurus",
  },
} satisfies Partial<ForgeConfig>;
```

## Commands

### `forge-ts check`
Validates that all public exports have TSDoc comments.

### `forge-ts test`
Extracts `@example` blocks and runs them as tests via Node's built-in test runner.

### `forge-ts build`
Generates OpenAPI specs, Markdown docs, and AI context files.

## Technology

- Built on the **TypeScript 6.0 Compiler API** for precise AST analysis
- Uses **@microsoft/tsdoc** for standards-compliant comment parsing
- Runs on **Node.js 24 LTS** with native TypeScript support
- Linted with **Biome 2.4**

## Packages

| Package | Description |
|---------|-------------|
| `@forge-ts/core` | Shared types, config loader, AST walker |
| `@forge-ts/enforcer` | TSDoc enforcement (build gate) |
| `@forge-ts/doctest` | @example block testing |
| `@forge-ts/api` | OpenAPI & API reference generation |
| `@forge-ts/gen` | Markdown, MDX, llms.txt generation |
| `@forge-ts/cli` | Unified CLI |

## License
MIT
