# @forge-ts/gen

Documentation output generator for the [forge-ts](https://github.com/kryptobaseddev/forge-ts) toolchain. Produces Markdown, MDX, llms.txt, and README sync.

## When to use this package

**Most users should install `@forge-ts/cli` instead** and use `npx forge-ts build`. This package is for programmatic use.

```bash
npm install @forge-ts/gen
```

## What it generates

- **Markdown/MDX** - Grouped by symbol kind, with TOC, source links, and deprecation notices
- **SSG targeting** - Frontmatter for Docusaurus, Mintlify, Nextra, or VitePress
- **llms.txt** - Routing manifest for AI agents
- **llms-full.txt** - Dense context with full params, returns, and examples
- **README sync** - Injects API summaries between `<!-- forge-ts:start/end -->` markers

## Example

```typescript
import { loadConfig, createWalker } from "@forge-ts/core";
import { generateMarkdown, generateLlmsTxt } from "@forge-ts/gen";

const config = await loadConfig();
const walker = createWalker(config);
const symbols = walker.walk();

const markdown = generateMarkdown(symbols, config, { mdx: false });
const llms = generateLlmsTxt(symbols, config);
```

## Part of forge-ts

See the [main repo](https://github.com/kryptobaseddev/forge-ts) for full documentation.

## License

MIT
