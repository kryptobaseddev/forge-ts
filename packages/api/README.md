# @forge-ts/api

OpenAPI 3.1 spec and API reference generator for the [forge-ts](https://github.com/kryptobaseddev/forge-ts) toolchain.

## When to use this package

**Most users should install `@forge-ts/cli` instead** and use `npx forge-ts build`. This package is for programmatic use.

```bash
npm install @forge-ts/api
```

## What it generates

- **OpenAPI 3.1 JSON** from your exported interfaces, types, classes, and enums
- **Typed schema mapping** - TypeScript signatures mapped to OpenAPI schemas
- **Visibility filtering** - `@internal` symbols never appear in specs
- **Structured API Reference** with full TSDoc metadata

## Example

```typescript
import { loadConfig, createWalker } from "@forge-ts/core";
import { generateOpenAPISpec, extractSDKTypes } from "@forge-ts/api";

const config = await loadConfig();
const walker = createWalker(config);
const symbols = walker.walk();
const sdkTypes = extractSDKTypes(symbols);
const spec = generateOpenAPISpec(config, sdkTypes);

// spec is a fully typed OpenAPIDocument
console.log(JSON.stringify(spec, null, 2));
```

## Part of forge-ts

See the [main repo](https://github.com/kryptobaseddev/forge-ts) for full documentation.

## License

MIT
