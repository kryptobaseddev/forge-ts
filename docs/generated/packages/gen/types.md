---
title: gen — Types
outline: deep
description: Type contracts for the gen package
---

# gen — Types

Type contracts exported by this package: interfaces, type aliases, and enums.

## MarkdownOptions

Options controlling Markdown output.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mdx` | `boolean \| undefined` | No | Whether to use MDX syntax (default: Markdown). |

## ReadmeSyncOptions

Options controlling README sync behaviour.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `badge` | `boolean \| undefined` | No | Include a "Documented with forge-ts" badge above the API table. |
| `includeExamples` | `boolean \| undefined` | No | Include first |

## DocPage

A single generated documentation page.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | Yes | Relative path from outDir (e.g., "packages/core/index.md") |
| `content` | `string` | Yes | Page content (Markdown or MDX) |
| `frontmatter` | `Record<string, string \| number \| boolean>` | Yes | Frontmatter fields |

## SiteGeneratorOptions

Options controlling the doc site generator.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `format` | `"markdown" \| "mdx"` | Yes | Output format |
| `ssgTarget` | `"docusaurus" \| "mintlify" \| "nextra" \| "vitepress" \| undefined` | No | SSG target for frontmatter |
| `projectName` | `string` | Yes | Project name |
| `projectDescription` | `string \| undefined` | No | Project description |

## SSGConfigFile

A single generated SSG configuration file.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | Yes | Relative path from outDir (e.g., "mint.json", "_meta.json") |
| `content` | `string` | Yes | File content |
