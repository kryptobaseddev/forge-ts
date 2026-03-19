---
title: "gen — Examples"
outline: deep
description: "Usage examples for the gen package"
---
# gen — Examples

All usage examples from the package, aggregated for quick reference.

## `groupSymbolsByPackage()`

_Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name._

[View in API reference](./api-reference.md#groupsymbolsbypackage)

```typescript
import { groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, "/path/to/project");
console.log(grouped.has("core")); // true for monorepo
```

## `generateDocSite()`

_Generates a full multi-page documentation site from symbols grouped by package.  Produces an index page, a getting-started page, and per-package pages for the API reference, types, functions, and examples._

[View in API reference](./api-reference.md#generatedocsite)

```typescript
import { generateDocSite, groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, config.rootDir);
const pages = generateDocSite(grouped, config, { format: "markdown", projectName: "my-project" });
console.log(pages.length > 0); // true
```

## `SSGAdapter`

_The central SSG adapter interface. Every doc platform provider implements this contract. One file per provider. No shared mutable state._

[View in API reference](./api-reference.md#ssgadapter)

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
const files = adapter.transformPages(pages, context);
```

## `registerAdapter()`

_Register an SSG adapter. Called once per provider at module load time._

[View in API reference](./api-reference.md#registeradapter)

```typescript
import { registerAdapter } from "@forge-ts/gen";
registerAdapter(mintlifyAdapter);
```

## `getAdapter()`

_Get a registered adapter by target name. Throws if the target is not registered._

[View in API reference](./api-reference.md#getadapter)

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
```

## `getAvailableTargets()`

_Get all registered adapter targets._

[View in API reference](./api-reference.md#getavailabletargets)

```typescript
import { getAvailableTargets } from "@forge-ts/gen";
const targets = getAvailableTargets(); // ["mintlify", "docusaurus", ...]
```

## `mintlifyAdapter`

_Mintlify SSG adapter. Implements the  contract for the Mintlify platform._

[View in API reference](./api-reference.md#mintlifyadapter)

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "docs.json"
```

## `docusaurusAdapter`

_Docusaurus SSG adapter. Implements the  contract for the Docusaurus platform._

[View in API reference](./api-reference.md#docusaurusadapter)

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("docusaurus");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "sidebars.ts"
```

## `nextraAdapter`

_Nextra SSG adapter (v4, App Router). Implements the  contract for the Nextra platform._

[View in API reference](./api-reference.md#nextraadapter)

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("nextra");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "content/_meta.js"
```

## `vitepressAdapter`

_VitePress SSG adapter. Implements the  contract for the VitePress platform._

[View in API reference](./api-reference.md#vitepressadapter)

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("vitepress");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // ".vitepress/config.mts"
```

## `generateLlmsTxt()`

_Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation._

[View in API reference](./api-reference.md#generatellmstxt)

```typescript
import { generateLlmsTxt } from "@forge-ts/gen";
const txt = generateLlmsTxt(symbols, config);
console.log(txt.startsWith("# ")); // true
```

## `generateLlmsFullTxt()`

_Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context._

[View in API reference](./api-reference.md#generatellmsfulltxt)

```typescript
import { generateLlmsFullTxt } from "@forge-ts/gen";
const fullTxt = generateLlmsFullTxt(symbols, config);
console.log(fullTxt.includes("Full Context")); // true
```

## `generateMarkdown()`

_Generates a Markdown (or MDX) string from a list of symbols._

[View in API reference](./api-reference.md#generatemarkdown)

```typescript
import { generateMarkdown } from "@forge-ts/gen";
const md = generateMarkdown(symbols, config, { mdx: false });
console.log(md.startsWith("# API Reference")); // true
```

## `syncReadme()`

_Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file._

[View in API reference](./api-reference.md#syncreadme)

```typescript
import { syncReadme } from "@forge-ts/gen";
const modified = await syncReadme("/path/to/README.md", symbols);
console.log(modified); // true if README was updated
```

## `generateSSGConfigs()`

_Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files)._

[View in API reference](./api-reference.md#generatessgconfigs)

```typescript
import { generateSSGConfigs } from "@forge-ts/gen";
const configs = generateSSGConfigs(pages, "vitepress", "my-project");
console.log(configs[0].path); // ".vitepress/sidebar.json"
```

## `generate()`

_Runs the full generation pipeline: walk → render → write._

[View in API reference](./api-reference.md#generate)

```typescript
import { generate } from "@forge-ts/gen";
const result = await generate(config);
console.log(result.success); // true if all files were written
```
