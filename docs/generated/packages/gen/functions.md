---
title: gen — Functions
outline: deep
description: Functions and classes for the gen package
---

# gen — Functions & Classes

Functions and classes exported by this package.

## generateLlmsTxt(symbols, config)

Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation.

**Signature**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | The symbols to include. |
| `config` | — | The resolved . |

**Returns** — The generated `llms.txt` content as a string.

## generateLlmsFullTxt(symbols, config)

Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context.

**Signature**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | The symbols to include. |
| `config` | — | The resolved . |

**Returns** — The generated `llms-full.txt` content as a string.

## generateMarkdown(symbols, config, options)

Generates a Markdown (or MDX) string from a list of symbols.

**Signature**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig, options?: MarkdownOptions) => string
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | The symbols to document. |
| `config` | — | The resolved . |
| `options` | — | Rendering options. |

**Returns** — The generated Markdown string.

## syncReadme(readmePath, symbols, options)

Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file.

**Signature**

```typescript
(readmePath: string, symbols: ForgeSymbol[], options?: ReadmeSyncOptions) => Promise<boolean>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `readmePath` | — | Absolute path to the `README.md` to update. |
| `symbols` | — | Symbols to summarise in the README. |
| `options` | — | Options controlling sync behaviour. |

**Returns** — `true` if the file was modified, `false` otherwise.

## groupSymbolsByPackage(symbols, rootDir)

Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name.

**Signature**

```typescript
(symbols: ForgeSymbol[], rootDir: string) => Map<string, ForgeSymbol[]>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | All extracted symbols. |
| `rootDir` | — | Absolute path to the project root. |

**Returns** — A map from package name to symbol list.

## generateDocSite(symbolsByPackage, config, options)

Generates a full multi-page documentation site from symbols grouped by package.  Produces an index page, a getting-started page, and per-package pages for the API reference, types, functions, and examples.

**Signature**

```typescript
(symbolsByPackage: Map<string, ForgeSymbol[]>, config: ForgeConfig, options: SiteGeneratorOptions) => DocPage[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbolsByPackage` | — | Symbols grouped by package name. |
| `config` | — | The resolved . |
| `options` | — | Site generation options. |

**Returns** — An array of  objects ready to be written to disk.

## generateSSGConfigs(pages, target, projectName)

Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files).

**Signature**

```typescript
(pages: DocPage[], target: "docusaurus" | "mintlify" | "nextra" | "vitepress", projectName: string) => SSGConfigFile[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `pages` | — | The  array produced by `generateDocSite`. |
| `target` | — | The SSG target. |
| `projectName` | — | The project name (used in config metadata). |

**Returns** — An array of  objects ready to be written to disk.

## generate(config)

Runs the full generation pipeline: walk → render → write.

**Signature**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `config` | — | The resolved  for the project. |

**Returns** — A  describing the outcome.
