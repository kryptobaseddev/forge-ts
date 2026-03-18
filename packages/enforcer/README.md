# @forge-ts/enforcer

TSDoc enforcement build gate for the [forge-ts](https://github.com/kryptobaseddev/forge-ts) toolchain.

## When to use this package

**Most users should install `@forge-ts/cli` instead** and use `npx forge-ts check`. This package is for programmatic use in custom build pipelines.

```bash
npm install @forge-ts/enforcer
```

## What it checks

| Code | Severity | Rule |
|------|----------|------|
| E001 | error | Exported symbol missing TSDoc summary |
| E002 | error | Function parameter missing `@param` tag |
| E003 | error | Non-void function missing `@returns` tag |
| W001 | warning | TSDoc comment has parse errors |
| W002 | warning | Function throws but missing `@throws` tag |
| W003 | warning | `@deprecated` without explanation |

## Example

```typescript
import { loadConfig } from "@forge-ts/core";
import { enforce, formatResults } from "@forge-ts/enforcer";

const config = await loadConfig();
const result = await enforce(config);

console.log(formatResults(result, { colors: true, verbose: false }));
process.exit(result.success ? 0 : 1);
```

## Part of forge-ts

See the [main repo](https://github.com/kryptobaseddev/forge-ts) for full documentation.

## License

MIT
