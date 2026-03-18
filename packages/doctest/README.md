# @forge-ts/doctest

Executable documentation testing for the [forge-ts](https://github.com/kryptobaseddev/forge-ts) toolchain. Extracts `@example` code blocks from TSDoc comments and runs them as tests.

## When to use this package

**Most users should install `@forge-ts/cli` instead** and use `npx forge-ts test`. This package is for programmatic use.

```bash
npm install @forge-ts/doctest
```

## How it works

1. Walks your TypeScript AST to find `@example` blocks in TSDoc comments
2. Generates virtual test files with auto-injected imports
3. Adds inline source maps pointing back to your original source
4. Converts `// => value` comments into assertions
5. Runs tests via Node 24's built-in `node:test` runner

## Example

```typescript
import { loadConfig } from "@forge-ts/core";
import { doctest } from "@forge-ts/doctest";

const config = await loadConfig();
const result = await doctest(config);

if (!result.success) {
  console.error(`${result.errors.length} doctest(s) failed`);
  process.exit(1);
}
```

## Part of forge-ts

See the [main repo](https://github.com/kryptobaseddev/forge-ts) for full documentation.

## License

MIT
