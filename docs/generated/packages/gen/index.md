---
title: gen
outline: deep
description: gen package overview
---

# gen

## Exported Symbols

| Symbol | Kind | Description |
|--------|------|-------------|
| [`generateLlmsTxt()`](./api-reference.md#generatellmstxt) | function | Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation. |
| [`generateLlmsFullTxt()`](./api-reference.md#generatellmsfulltxt) | function | Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context. |
| [`MarkdownOptions`](./api-reference.md#markdownoptions) | interface | Options controlling Markdown output. |
| [`generateMarkdown()`](./api-reference.md#generatemarkdown) | function | Generates a Markdown (or MDX) string from a list of symbols. |
| [`ReadmeSyncOptions`](./api-reference.md#readmesyncoptions) | interface | Options controlling README sync behaviour. |
| [`syncReadme()`](./api-reference.md#syncreadme) | function | Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file. |
| [`DocPage`](./api-reference.md#docpage) | interface | A single generated documentation page. |
| [`SiteGeneratorOptions`](./api-reference.md#sitegeneratoroptions) | interface | Options controlling the doc site generator. |
| [`groupSymbolsByPackage()`](./api-reference.md#groupsymbolsbypackage) | function | Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name. |
| [`generateDocSite()`](./api-reference.md#generatedocsite) | function | Generates a full multi-page documentation site from symbols grouped by package.  Produces an index page, a getting-started page, and per-package pages for the API reference, types, functions, and examples. |
| [`SSGConfigFile`](./api-reference.md#ssgconfigfile) | interface | A single generated SSG configuration file. |
| [`generateSSGConfigs()`](./api-reference.md#generatessgconfigs) | function | Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files). |
| [`generate()`](./api-reference.md#generate) | function | Runs the full generation pipeline: walk → render → write. |
