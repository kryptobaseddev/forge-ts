# @forge-ts/cli

The universal documentation compiler for any TypeScript project.

**This is the main package most users should install.**

```bash
npm install -D @forge-ts/cli
```

## What it does

Write your TypeScript. Write your TSDoc comments. Run one command. Get everything:

- **OpenAPI 3.1 specs** from your exported types and interfaces
- **Executable doctests** from your `@example` blocks
- **AI context** (`llms.txt` / `llms-full.txt`) for LLM agents
- **Markdown/MDX docs** for Docusaurus, Mintlify, Nextra, or VitePress
- **README syncing** to keep your GitHub front page up-to-date

## Quick Start

```bash
# Check TSDoc coverage on all exported symbols
npx forge-ts check

# Run @example code blocks as tests
npx forge-ts test

# Generate OpenAPI spec, docs, and AI context
npx forge-ts build
```

## Configuration

Zero-config by default. Optionally create `forge-ts.config.ts`:

```typescript
import type { ForgeConfig } from "@forge-ts/core";

export default {
  enforce: { enabled: true, strict: true },
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

| Flag | Description |
|------|-------------|
| `--strict` | Treat warnings as errors |
| `--verbose` | Show symbol signatures |
| `--json` | Output as LAFS JSON envelope |
| `--cwd <dir>` | Project root directory |

### `forge-ts test`
Extracts `@example` blocks and runs them as tests via Node's built-in test runner.

| Flag | Description |
|------|-------------|
| `--json` | Output as LAFS JSON envelope |
| `--cwd <dir>` | Project root directory |

### `forge-ts build`
Generates OpenAPI specs, Markdown docs, and AI context files.

| Flag | Description |
|------|-------------|
| `--skip-api` | Skip OpenAPI generation |
| `--skip-gen` | Skip doc generation |
| `--json` | Output as LAFS JSON envelope |
| `--cwd <dir>` | Project root directory |

## Agent-First Design

Every command supports `--json` for structured output that LLM agents can parse:

```bash
forge-ts check --json
forge-ts build --json --mvi minimal  # token-optimized output
```

## Full Documentation

See the [forge-ts repository](https://github.com/kryptobaseddev/forge-ts) for complete docs, architecture, and contributing guide.

## License

MIT
