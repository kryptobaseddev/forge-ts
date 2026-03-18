# @forge-ts/core

Shared types, configuration loader, and AST walker for the [forge-ts](https://github.com/kryptobaseddev/forge-ts) toolchain.

## When to use this package

**Most users should install `@forge-ts/cli` instead.** This package is for advanced users building custom tooling on top of forge-ts.

```bash
npm install @forge-ts/core
```

## What's inside

- **`ForgeSymbol`** - The central type representing an extracted TypeScript symbol with its TSDoc documentation
- **`ForgeConfig`** - Configuration contract for all forge-ts operations
- **`createWalker(config)`** - AST walker using the TypeScript Compiler API + `@microsoft/tsdoc`
- **`loadConfig(rootDir?)`** - Zero-config loader (reads `forge-ts.config.ts` or `package.json`)
- **`filterByVisibility(symbols, minVisibility)`** - Filter by `@public`, `@beta`, `@internal` tags
- **OpenAPI 3.1 types** - `OpenAPIDocument`, `OpenAPISchemaObject`, etc.

## Example

```typescript
import { loadConfig, createWalker, filterByVisibility, Visibility } from "@forge-ts/core";

const config = await loadConfig();
const walker = createWalker(config);
const symbols = walker.walk();

// Only public symbols
const publicApi = filterByVisibility(symbols, Visibility.Public);

for (const symbol of publicApi) {
  console.log(`${symbol.kind} ${symbol.name}: ${symbol.documentation?.summary}`);
}
```

## Part of forge-ts

This is one package in the [forge-ts](https://github.com/kryptobaseddev/forge-ts) monorepo. See the main repo for full documentation.

## License

MIT
