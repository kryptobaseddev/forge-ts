---
title: gen — API Reference
outline: deep
description: Full API reference for the gen package
---

# gen — API Reference

## Functions

### `generateLlmsTxt()`

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation.

**Parameters**

- `symbols` — The symbols to include.
- `config` — The resolved .

**Returns**: The generated `llms.txt` content as a string.

**Examples**

```typescript
import { generateLlmsTxt } from "@forge-ts/gen";
const txt = generateLlmsTxt(symbols, config);
console.log(txt.startsWith("# ")); // true
```


### `generateLlmsFullTxt()`

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context.

**Parameters**

- `symbols` — The symbols to include.
- `config` — The resolved .

**Returns**: The generated `llms-full.txt` content as a string.

**Examples**

```typescript
import { generateLlmsFullTxt } from "@forge-ts/gen";
const fullTxt = generateLlmsFullTxt(symbols, config);
console.log(fullTxt.includes("Full Context")); // true
```


### `generateMarkdown()`

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig, options?: MarkdownOptions) => string
```

Generates a Markdown (or MDX) string from a list of symbols.

**Parameters**

- `symbols` — The symbols to document.
- `config` — The resolved .
- `options` — Rendering options.

**Returns**: The generated Markdown string.

**Examples**

```typescript
import { generateMarkdown } from "@forge-ts/gen";
const md = generateMarkdown(symbols, config, { mdx: false });
console.log(md.startsWith("# API Reference")); // true
```


### `syncReadme()`

```typescript
(readmePath: string, symbols: ForgeSymbol[], options?: ReadmeSyncOptions) => Promise<boolean>
```

Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file.

**Parameters**

- `readmePath` — Absolute path to the `README.md` to update.
- `symbols` — Symbols to summarise in the README.
- `options` — Options controlling sync behaviour.

**Returns**: `true` if the file was modified, `false` otherwise.

**Examples**

```typescript
import { syncReadme } from "@forge-ts/gen";
const modified = await syncReadme("/path/to/README.md", symbols);
console.log(modified); // true if README was updated
```


### `groupSymbolsByPackage()`

```typescript
(symbols: ForgeSymbol[], rootDir: string) => Map<string, ForgeSymbol[]>
```

Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name.

**Parameters**

- `symbols` — All extracted symbols.
- `rootDir` — Absolute path to the project root.

**Returns**: A map from package name to symbol list.

**Examples**

```typescript
import { groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, "/path/to/project");
console.log(grouped.has("core")); // true for monorepo
```


### `generateDocSite()`

```typescript
(symbolsByPackage: Map<string, ForgeSymbol[]>, config: ForgeConfig, options: SiteGeneratorOptions) => DocPage[]
```

Generates a full multi-page documentation site from symbols grouped by package.  Produces an index page, a getting-started page, and per-package pages for the API reference, types, functions, and examples.

**Parameters**

- `symbolsByPackage` — Symbols grouped by package name.
- `config` — The resolved .
- `options` — Site generation options.

**Returns**: An array of  objects ready to be written to disk.

**Examples**

```typescript
import { generateDocSite, groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, config.rootDir);
const pages = generateDocSite(grouped, config, { format: "markdown", projectName: "my-project" });
console.log(pages.length > 0); // true
```


### `generateSSGConfigs()`

```typescript
(pages: DocPage[], target: "docusaurus" | "mintlify" | "nextra" | "vitepress", projectName: string) => SSGConfigFile[]
```

Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files).

**Parameters**

- `pages` — The  array produced by `generateDocSite`.
- `target` — The SSG target.
- `projectName` — The project name (used in config metadata).

**Returns**: An array of  objects ready to be written to disk.

**Examples**

```typescript
import { generateSSGConfigs } from "@forge-ts/gen";
const configs = generateSSGConfigs(pages, "vitepress", "my-project");
console.log(configs[0].path); // ".vitepress/sidebar.json"
```


### `generate()`

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

Runs the full generation pipeline: walk → render → write.

**Parameters**

- `config` — The resolved  for the project.

**Returns**: A  describing the outcome.

**Examples**

```typescript
import { generate } from "@forge-ts/gen";
const result = await generate(config);
console.log(result.success); // true if all files were written
```


## Interfaces

### `MarkdownOptions`

```typescript
any
```

Options controlling Markdown output.

#### `mdx`

```typescript
boolean | undefined
```

Whether to use MDX syntax (default: Markdown).


### `ReadmeSyncOptions`

```typescript
any
```

Options controlling README sync behaviour.

#### `badge`

```typescript
boolean | undefined
```

Include a "Documented with forge-ts" badge above the API table.

#### `includeExamples`

```typescript
boolean | undefined
```

Include first


### `DocPage`

```typescript
any
```

A single generated documentation page.

#### `path`

```typescript
string
```

Relative path from outDir (e.g., "packages/core/index.md")

#### `content`

```typescript
string
```

Page content (Markdown or MDX)

#### `frontmatter`

```typescript
Record<string, string | number | boolean>
```

Frontmatter fields


### `SiteGeneratorOptions`

```typescript
any
```

Options controlling the doc site generator.

#### `format`

```typescript
"markdown" | "mdx"
```

Output format

#### `ssgTarget`

```typescript
"docusaurus" | "mintlify" | "nextra" | "vitepress" | undefined
```

SSG target for frontmatter

#### `projectName`

```typescript
string
```

Project name

#### `projectDescription`

```typescript
string | undefined
```

Project description


### `SSGConfigFile`

```typescript
any
```

A single generated SSG configuration file.

#### `path`

```typescript
string
```

Relative path from outDir (e.g., "mint.json", "_meta.json")

#### `content`

```typescript
string
```

File content
