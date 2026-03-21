# forge-ts — API Reference

## Table of Contents

- [Functions](#functions)
- [Types](#types)
- [Constants](#constants)

## Functions

### `defaultConfig`

Constructs a sensible default `ForgeConfig` rooted at `rootDir`.

```typescript
(rootDir: string) => ForgeConfig
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** A fully-populated default configuration.

```typescript
import { defaultConfig } from "@forge-ts/core";
const config = defaultConfig("/path/to/project");
console.log(config.enforce.enabled); // true
```

### `loadConfig`

Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found)

```typescript
(rootDir?: string | undefined) => Promise<ForgeConfig>
```

**Parameters:**

- `rootDir` — The project root to search for config.  Defaults to `process.cwd()`.

**Returns:** A fully-resolved `ForgeConfig`.

```typescript
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
// config is fully resolved with defaults
```

### `resolveVisibility`

Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  → `Visibility.Internal` 2. `@beta`      → `Visibility.Beta` 3. `@public`    → `Visibility.Public` 4. (no tag)     → `Visibility.Public` (default for exports)

```typescript
(tags: Record<string, string[]> | undefined) => Visibility
```

**Parameters:**

- `tags` — The parsed `tags` map from `ForgeSymbol.documentation`.

**Returns:** The resolved `Visibility` value.

```typescript
import { resolveVisibility } from "@forge-ts/core";
const vis = resolveVisibility({ internal: [] });
// vis === Visibility.Internal
```

### `meetsVisibility`

Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not.

```typescript
(candidate: Visibility, minVisibility: Visibility) => boolean
```

**Parameters:**

- `candidate` — The visibility of the symbol being tested.
- `minVisibility` — The minimum visibility threshold.

**Returns:** `true` if `candidate` is at least as visible as `minVisibility`.

```typescript
import { meetsVisibility, Visibility } from "@forge-ts/core";
meetsVisibility(Visibility.Public, Visibility.Public); // true
meetsVisibility(Visibility.Internal, Visibility.Public); // false
```

### `filterByVisibility`

Filters an array of `ForgeSymbol` objects to only include symbols whose visibility meets or exceeds `minVisibility`.

```typescript
(symbols: ForgeSymbol[], minVisibility: Visibility) => ForgeSymbol[]
```

**Parameters:**

- `symbols` — The full list of symbols to filter.
- `minVisibility` — The minimum visibility threshold to keep.

**Returns:** A new array containing only symbols that pass the visibility check.

```typescript
import { filterByVisibility, Visibility } from "@forge-ts/core";
const publicOnly = filterByVisibility(symbols, Visibility.Public);
```

### `createWalker`

Creates an `ASTWalker` configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each `ForgeSymbol`.

```typescript
(config: ForgeConfig) => ASTWalker
```

**Parameters:**

- `config` — The resolved `ForgeConfig` for the project.

**Returns:** An `ASTWalker` instance whose `walk()` method performs the extraction.

```typescript
import { loadConfig, createWalker } from "@forge-ts/core";
const config = await loadConfig();
const walker = createWalker(config);
const symbols = walker.walk();
console.log(`Found ${symbols.length} symbols`);
```

### `signatureToSchema`

Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse.

```typescript
(signature: string) => OpenAPISchemaObject
```

**Parameters:**

- `signature` — A TypeScript type signature string, e.g. `"string"`, `"number[]"`,   `"string | number"`, `"Record<string, boolean>"`.

**Returns:** An OpenAPI schema object.

```typescript
import { signatureToSchema } from "@forge-ts/api";
const schema = signatureToSchema("string[]");
// { type: "array", items: { type: "string" } }
```

### `extractSDKTypes`

Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of `ForgeSymbol` objects.  Only exported symbols whose visibility is not `Visibility.Internal` or `Visibility.Private` are included.

```typescript
(symbols: ForgeSymbol[]) => SDKType[]
```

**Parameters:**

- `symbols` — The symbols produced by the core AST walker.

**Returns:** An array of `SDKType` objects for public-facing type definitions.

```typescript
import { extractSDKTypes } from "@forge-ts/api";
const sdkTypes = extractSDKTypes(symbols);
console.log(sdkTypes.length); // number of public SDK types
```

### `generateOpenAPISpec`

Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release.

```typescript
(config: ForgeConfig, sdkTypes: SDKType[], symbols?: ForgeSymbol[]) => OpenAPIDocument
```

**Parameters:**

- `config` — The resolved `ForgeConfig`.
- `sdkTypes` — SDK types to include as component schemas.
- `symbols` — Raw symbols used to extract HTTP route paths from `@route` tags.

**Returns:** An `OpenAPIDocument` object.

```typescript
import { generateOpenAPISpec } from "@forge-ts/api";
import { extractSDKTypes } from "@forge-ts/api";
const spec = generateOpenAPISpec(config, extractSDKTypes(symbols), symbols);
console.log(spec.openapi); // "3.2.0"
```

### `buildReference`

Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with `Visibility.Internal` or `Visibility.Private` are excluded from the top-level results. Children with private/internal visibility are also filtered out.

```typescript
(symbols: ForgeSymbol[]) => ReferenceEntry[]
```

**Parameters:**

- `symbols` — All symbols from the AST walker.

**Returns:** An array of `ReferenceEntry` objects sorted by name.

```typescript
import { buildReference } from "@forge-ts/api";
const entries = buildReference(symbols);
console.log(entries[0].name); // first symbol name, alphabetically
```

### `generateApi`

Runs the API generation pipeline: walk → extract → generate → write.

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved `ForgeConfig` for the project.

**Returns:** A `ForgeResult` with success/failure and any diagnostics.

```typescript
import { generateApi } from "@forge-ts/api";
const result = await generateApi(config);
console.log(result.success); // true if spec was written successfully
```

### `serializeMarkdown`

Serialize an mdast tree to a well-formed markdown string.  Uses remark-stringify with GFM table support. The serializer handles all escaping (pipes in table cells, special characters in text, etc.) so callers never need manual escape functions.

```typescript
(tree: MdRoot) => string
```

**Parameters:**

- `tree` — The mdast root node to serialize.

**Returns:** The serialized markdown string.

### `textP`

Shorthand: paragraph containing a single text node.

```typescript
(value: string) => MdParagraph
```

### `boldIntroP`

Shorthand: paragraph with bold intro text followed by regular text.

```typescript
(bold: string, rest: string) => MdParagraph
```

### `textListItem`

Shorthand: list item containing a single text paragraph.

```typescript
(value: string) => MdListItem
```

### `rawBlock`

Wrap a raw markdown string as an HTML node. Use for TSDoc content that may contain markdown formatting (backticks, bold, links) which should pass through to the output verbatim rather than being escaped by the serializer.

```typescript
(markdown: string) => MdHtml
```

### `truncate`

Truncate a string to at most maxLen chars. Avoids cutting inside backtick-delimited code spans to prevent broken inline code that would cause escaping issues.

```typescript
(text: string, maxLen?: number) => string
```

### `toAnchor`

Convert a label to a GitHub-compatible anchor slug.

```typescript
(text: string) => string
```

### `slugLink`

Strip extension from a link path and normalize to a slug. Produces bare slug links compatible with Mintlify and most SSGs.

```typescript
(path: string) => string
```

### `parseFrontmatter`

Parse frontmatter from markdown/MDX content.  Uses gray-matter for robust YAML parsing — handles multi-line values, quoted strings, and edge cases that regex-based stripping misses.

```typescript
(content: string) => FrontmatterResult
```

**Parameters:**

- `content` — The full file content including frontmatter.

**Returns:** The body (without frontmatter) and the parsed data object.

### `stringifyWithFrontmatter`

Serialize content with frontmatter prepended.  Produces the standard format:

```typescript
(body: string, data: Record<string, string | number | boolean>) => string
```

**Parameters:**

- `body` — The markdown body content (without frontmatter).
- `data` — The frontmatter fields to serialize.

**Returns:** The combined frontmatter + body string.

### `stripFrontmatter`

Strip frontmatter from content, returning only the body.

```typescript
(content: string) => string
```

**Parameters:**

- `content` — The full file content including frontmatter.

**Returns:** The body content without the frontmatter block.

### `parseInline`

Parse a markdown string and extract inline (phrasing) content.  Use for TSDoc text that may contain backtick code, bold, links, etc. The returned nodes can be spread into paragraphs, table cells, or any other context that accepts inline content.  This prevents double-escaping: backticks become proper `inlineCode` nodes instead of text that gets escaped by the serializer.

```typescript
(markdown: string) => MdPhrasing[]
```

**Parameters:**

- `markdown` — The TSDoc content string (may contain markdown).

**Returns:** Array of inline mdast nodes.

### `parseBlocks`

Parse a markdown string and extract block-level content.  Use for multi-line TSDoc content that may contain headings, lists, blockquotes, code blocks, etc.

```typescript
(markdown: string) => MdBlock[]
```

**Parameters:**

- `markdown` — The markdown string to parse.

**Returns:** Array of block-level mdast nodes.

### `sanitizeForMdx`

Sanitize markdown content for MDX compatibility using AST-aware processing.  Parses the document with remark to understand its structure, then applies targeted string replacements only to text and HTML comment nodes — code blocks, inline code, and frontmatter are automatically preserved.  Transformations applied outside code: - HTML comments to MDX comments - Curly braces in text escaped (prevents MDX expression parsing) - Angle brackets around word chars escaped (prevents JSX tag parsing)

```typescript
(content: string) => string
```

**Parameters:**

- `content` — The markdown content to sanitize.

**Returns:** The sanitized content safe for MDX consumption.

### `updateAutoSections`

Updates auto-enriched sections in an existing stub file.  Uses AST-aware parsing to find FORGE:AUTO markers, ensuring markers inside code blocks are never accidentally matched. Replaces content between `<!-- FORGE:AUTO-START id -->` and `<!-- FORGE:AUTO-END id -->` markers (or their MDX comment equivalents) with fresh content from the newly generated version.  Manual content outside markers is preserved exactly — no reformatting.

```typescript
(existing: string, generated: string) => string | null
```

**Parameters:**

- `existing` — The current file content on disk.
- `generated` — The freshly generated content with updated markers.

**Returns:** The merged content, or null if no markers were found to update.

### `escapeMdx`

Escape MDX-unsafe characters in text that appears outside code fences.  MDX parses `<Word>` as JSX tags and `{expr}` as JS expressions. In documentation content (summaries, descriptions, table cells), these come from TypeScript generics (`Array<string>`) and TSDoc inline tags (`{@link Foo}`). We escape them so MDX treats them as literal text.  This is exported so SSG adapters can apply it during page transformation.

```typescript
(text: string) => string
```

### `groupSymbolsByPackage`

Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name.

```typescript
(symbols: ForgeSymbol[], rootDir: string) => Map<string, ForgeSymbol[]>
```

**Parameters:**

- `symbols` — All extracted symbols.
- `rootDir` — Absolute path to the project root.

**Returns:** A map from package name to symbol list.

```typescript
import { groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, "/path/to/project");
console.log(grouped.has("core")); // true for monorepo
```

### `generateDocSite`

Generates a full multi-page documentation site from symbols grouped by package.  Follows a 5-stage information architecture: 1. ORIENT — Landing page, Getting Started 2. LEARN — Concepts (stub) 3. BUILD — Guides (stub) 4. REFERENCE — API Reference, Types, Configuration, Changelog 5. COMMUNITY — FAQ, Contributing (stubs)

```typescript
(symbolsByPackage: Map<string, ForgeSymbol[]>, config: ForgeConfig, options: SiteGeneratorOptions) => DocPage[]
```

**Parameters:**

- `symbolsByPackage` — Symbols grouped by package name.
- `config` — The resolved `ForgeConfig`.
- `options` — Site generation options.

**Returns:** An array of `DocPage` objects ready to be written to disk.

```typescript
import { generateDocSite, groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, config.rootDir);
const pages = generateDocSite(grouped, config, { format: "markdown", projectName: "my-project" });
console.log(pages.length > 0); // true
```

### `registerAdapter`

Register an SSG adapter. Called once per provider at module load time.

```typescript
(adapter: SSGAdapter) => void
```

**Parameters:**

- `adapter` — The adapter to register.

```typescript
import { registerAdapter } from "@forge-ts/gen";
registerAdapter(mintlifyAdapter);
```

### `getAdapter`

Get a registered adapter by target name. Throws if the target is not registered.

```typescript
(target: SSGTarget) => SSGAdapter
```

**Parameters:**

- `target` — The SSG target identifier.

**Returns:** The registered `SSGAdapter` for the given target.

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
```

### `getAvailableTargets`

Get all registered adapter targets.

```typescript
() => SSGTarget[]
```

**Returns:** An array of all registered `SSGTarget` identifiers.

```typescript
import { getAvailableTargets } from "@forge-ts/gen";
const targets = getAvailableTargets(); // ["mintlify", "docusaurus", ...]
```

### `generateLlmsTxt`

Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation.

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters:**

- `symbols` — The symbols to include.
- `config` — The resolved `ForgeConfig`.

**Returns:** The generated `llms.txt` content as a string.

```typescript
import { generateLlmsTxt } from "@forge-ts/gen";
const txt = generateLlmsTxt(symbols, config);
console.log(txt.startsWith("# ")); // true
```

### `generateLlmsFullTxt`

Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context.

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters:**

- `symbols` — The symbols to include.
- `config` — The resolved `ForgeConfig`.

**Returns:** The generated `llms-full.txt` content as a string.

```typescript
import { generateLlmsFullTxt } from "@forge-ts/gen";
const fullTxt = generateLlmsFullTxt(symbols, config);
console.log(fullTxt.includes("Full Context")); // true
```

### `generateMarkdown`

Generates a Markdown (or MDX) string from a list of symbols.

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig, options?: MarkdownOptions) => string
```

**Parameters:**

- `symbols` — The symbols to document.
- `config` — The resolved `ForgeConfig`.
- `options` — Rendering options.

**Returns:** The generated Markdown string.

```typescript
import { generateMarkdown } from "@forge-ts/gen";
const md = generateMarkdown(symbols, config, { mdx: false });
console.log(md.startsWith("# API Reference")); // true
```

### `syncReadme`

Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file.

```typescript
(readmePath: string, symbols: ForgeSymbol[], options?: ReadmeSyncOptions) => Promise<boolean>
```

**Parameters:**

- `readmePath` — Absolute path to the `README.md` to update.
- `symbols` — Symbols to summarise in the README.
- `options` — Options controlling sync behaviour.

**Returns:** `true` if the file was modified, `false` otherwise.

```typescript
import { syncReadme } from "@forge-ts/gen";
const modified = await syncReadme("/path/to/README.md", symbols);
console.log(modified); // true if README was updated
```

### `generateSkillPackage`

Generates an agentskills.io-compliant skill package for ANY TypeScript project.  All content is derived from the project's exported symbols and metadata. No hardcoded project-specific content. Works for any project that forge-ts analyzes.

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => SkillPackage
```

**Parameters:**

- `symbols` — All symbols from the project.
- `config` — The resolved forge-ts config.

**Returns:** A `SkillPackage` describing the directory and its files.

```typescript
import { generateSkillPackage } from "@forge-ts/gen";
const pkg = generateSkillPackage(symbols, config);
console.log(pkg.directoryName); // "my-lib"
console.log(pkg.files.map(f => f.path));
// ["SKILL.md", "references/API-REFERENCE.md", ...]
```

### `generateSkillMd`

Generates a SKILL.md string following the Agent Skills specification. Generic for any TypeScript project — content derived from symbols.

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters:**

- `symbols` — All symbols from the project.
- `config` — The resolved forge-ts config.

**Returns:** The SKILL.md content as a string.

```typescript
import { generateSkillMd } from "@forge-ts/gen";
const skill = generateSkillMd(symbols, config);
```

### `generateSSGConfigs`

Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files).

```typescript
(pages: DocPage[], target: "docusaurus" | "mintlify" | "nextra" | "vitepress", projectName: string) => SSGConfigFile[]
```

**Parameters:**

- `pages` — The `DocPage` array produced by `generateDocSite`.
- `target` — The SSG target.
- `projectName` — The project name (used in config metadata).

**Returns:** An array of `SSGConfigFile` objects ready to be written to disk.

```typescript
import { generateSSGConfigs } from "@forge-ts/gen";
const configs = generateSSGConfigs(pages, "vitepress", "my-project");
console.log(configs[0].path); // ".vitepress/sidebar.json"
```

### `generate`

Runs the full generation pipeline: walk → render → write.  Auto-generated pages are always regenerated from source code. Stub pages (scaffolding for human/agent editing) are only created if they don't already exist, preserving manual edits across builds. Pass `{ forceStubs: true }` to overwrite stubs.

```typescript
(config: ForgeConfig, options?: GenerateOptions | undefined) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved `ForgeConfig` for the project.
- `options` — Optional generation flags (e.g., forceStubs).

**Returns:** A `ForgeResult` describing the outcome.

```typescript
import { generate } from "@forge-ts/gen";
const result = await generate(config);
console.log(result.success); // true if all files were written
```

### `createLogger`

Creates a `Logger` instance.

```typescript
(options?: { colors?: boolean | undefined; } | undefined) => Logger
```

**Parameters:**

- `options` — Optional configuration.
- `` — options.colors - Emit ANSI colour codes.  Defaults to `process.stdout.isTTY`.

**Returns:** A configured logger.

### `emitResult`

Wraps a command result in a LAFS envelope and emits it.  Output format is determined by LAFS flag resolution: - TTY terminals default to human-readable output. - Non-TTY (piped, CI, agents) defaults to JSON. - Explicit `--json` or `--human` flags always take precedence.  On failure, the full result is included alongside the error so agents get actionable data (e.g., suggestedFix) in a single response.

```typescript
<T>(output: CommandOutput<T>, flags: OutputFlags, humanFormatter: (data: T, output: CommandOutput<T>) => string) => void
```

**Parameters:**

- `output` — Typed result from the command.
- `flags` — Output format flags from citty args.
- `humanFormatter` — Produces a human-readable string for TTY consumers.

```typescript
import { emitResult } from "@forge-ts/cli/output";
emitResult(output, { human: true }, (data) => `Done: ${data.summary.duration}ms`);
```

### `resolveExitCode`

Returns the LAFS-compliant exit code for a command output.

```typescript
(output: CommandOutput<unknown>) => number
```

**Parameters:**

- `output` — Typed result from the command.

**Returns:** `0` on success, `1` on validation/check failure.

### `runBuild`

Runs the full build pipeline and returns a typed command output.

```typescript
(args: BuildArgs) => Promise<CommandOutput<BuildResult>>
```

**Parameters:**

- `args` — CLI arguments for the build command.

**Returns:** A typed `CommandOutput<BuildResult>`.

```typescript
import { runBuild } from "@forge-ts/cli/commands/build";
const output = await runBuild({ cwd: process.cwd() });
console.log(output.success); // true if all steps succeeded
```

### `findDeprecatedUsages`

Scans symbols for imports of deprecated exports from other packages.

```typescript
(symbols: ForgeSymbol[]) => DeprecatedUsage[]
```

**Parameters:**

- `symbols` — All symbols from the walker across the entire project.

**Returns:** Array of deprecated usages found.

### `enforce`

Runs the TSDoc enforcement pass against a project.  The enforcer walks all exported symbols that meet the configured minimum visibility threshold and emits diagnostics for any documentation deficiencies it finds.  ### Error codes | Code | Severity | Condition | |------|----------|-----------| | E001 | error    | Exported symbol is missing a TSDoc summary. | | E002 | error    | Function/method parameter lacks a `@param` tag. | | E003 | error    | Non-void function/method lacks a `@returns` tag. | | E004 | error    | Exported function/method is missing an `@example` block. | | E005 | error    | Package entry point (index.ts) is missing `@packageDocumentation`. | | E006 | error    | Public/protected class member is missing a TSDoc comment. | | E007 | error    | Interface/type alias property is missing a TSDoc comment. | | W001 | warning  | TSDoc comment contains parse errors. | | W002 | warning  | Function body throws but has no `@throws` tag. | | W003 | warning  | `@deprecated` tag is present without explanation. |  When `config.enforce.strict` is `true` all warnings are promoted to errors.

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved `ForgeConfig` for the project.

**Returns:** A `ForgeResult` describing which symbols passed or failed.

```typescript
import { loadConfig } from "@forge-ts/core";
import { enforce } from "@forge-ts/enforcer";
const config = await loadConfig();
const result = await enforce(config);
if (!result.success) {
  console.error(`${result.errors.length} errors found`);
}
```

### `formatResults`

Formats a `ForgeResult` into a human-readable string suitable for printing to a terminal.  Diagnostics are grouped by source file.  Each file heading shows the relative-ish path, followed by indented error and warning lines.  A summary line is appended at the end.

```typescript
(result: ForgeResult, options: FormatOptions) => string
```

**Parameters:**

- `result` — The result produced by `enforce`.
- `options` — Rendering options (colours, verbosity).

**Returns:** A formatted string ready to write to stdout or stderr.

```typescript
import { enforce } from "@forge-ts/enforcer";
import { formatResults } from "@forge-ts/enforcer";
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig();
const result = await enforce(config);
console.log(formatResults(result, { colors: true, verbose: false }));
```

### `runCheck`

Runs the TSDoc enforcement pass and returns a typed command output.

```typescript
(args: CheckArgs) => Promise<CommandOutput<CheckResult>>
```

**Parameters:**

- `args` — CLI arguments for the check command.

**Returns:** A typed `CommandOutput<CheckResult>`.

```typescript
import { runCheck } from "@forge-ts/cli/commands/check";
const output = await runCheck({ cwd: process.cwd() });
console.log(output.data.summary.errors); // number of TSDoc errors found
```

### `runDocsDev`

Starts the local dev server for the configured SSG target.  Reads `gen.ssgTarget` from the forge-ts config, resolves the adapter, and spawns the platform's dev server in the output directory.

```typescript
(args: { cwd?: string | undefined; target?: string | undefined; port?: string | undefined; }) => Promise<void>
```

**Parameters:**

- `args` — Command arguments.

**Returns:** A promise that resolves when the server exits.

```typescript
import { runDocsDev } from "@forge-ts/cli";
await runDocsDev({ cwd: "./my-project" });
```

### `runInitDocs`

Scaffolds a documentation site for the target SSG platform.  Resolves the target from args, validates it, checks for an existing scaffold, calls the adapter's `scaffold()` method, and writes all files produced by the manifest to `outDir`.

```typescript
(args: InitDocsArgs) => Promise<CommandOutput<InitDocsResult>>
```

**Parameters:**

- `args` — CLI arguments for the init docs command.

**Returns:** A typed `CommandOutput<InitDocsResult>`.

```typescript
import { runInitDocs } from "@forge-ts/cli/commands/init-docs";
const output = await runInitDocs({ target: "mintlify", cwd: process.cwd() });
console.log(output.data.files); // list of created file paths
```

### `extractExamples`

Extracts all `@example` blocks from a list of `ForgeSymbol` objects.

```typescript
(symbols: ForgeSymbol[]) => ExtractedExample[]
```

**Parameters:**

- `symbols` — The symbols produced by the core AST walker.

**Returns:** A flat array of `ExtractedExample` objects, one per code block.

```typescript
import { createWalker, loadConfig } from "@forge-ts/core";
import { extractExamples } from "@forge-ts/doctest";
const config = await loadConfig();
const symbols = createWalker(config).walk();
const examples = extractExamples(symbols);
console.log(`Found ${examples.length} examples`);
```

### `generateTestFiles`

Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map.

```typescript
(examples: ExtractedExample[], options: GeneratorOptions) => VirtualTestFile[]
```

**Parameters:**

- `examples` — Examples to include in the generated file.
- `options` — Output configuration.

**Returns:** An array of `VirtualTestFile` objects (one per source file).

```typescript
import { generateTestFiles } from "@forge-ts/doctest";
const files = generateTestFiles(examples, { cacheDir: "/tmp/doctest-cache" });
console.log(`Generated ${files.length} test file(s)`);
```

### `runTests`

Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`).

```typescript
(files: VirtualTestFile[]) => Promise<RunResult>
```

**Parameters:**

- `files` — The virtual test files to write and run.

**Returns:** A `RunResult` summarising the test outcome.

```typescript
import { runTests } from "@forge-ts/doctest";
const result = await runTests(virtualFiles);
if (!result.success) {
  console.error(`${result.failed} doctest(s) failed`);
}
```

### `doctest`

Runs the full doctest pipeline: extract → generate → run.

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved `ForgeConfig` for the project.

**Returns:** A `ForgeResult` with success/failure and any diagnostics.

```typescript
import { loadConfig } from "@forge-ts/core";
import { doctest } from "@forge-ts/doctest";
const config = await loadConfig();
const result = await doctest(config);
if (!result.success) {
  console.error(`${result.errors.length} doctest failure(s)`);
}
```

### `runTest`

Runs the doctest pipeline and returns a typed command output.

```typescript
(args: TestArgs) => Promise<CommandOutput<TestResult>>
```

**Parameters:**

- `args` — CLI arguments for the test command.

**Returns:** A typed `CommandOutput<TestResult>`.

```typescript
import { runTest } from "@forge-ts/cli/commands/test";
const output = await runTest({ cwd: process.cwd() });
console.log(output.data.summary.passed); // number of passing doctests
```

## Types

### `Visibility`

Visibility levels for exported symbols. Derived from TSDoc release tags (public, beta, internal).

```typescript
typeof Visibility
```

**Members:**

- `Public`
- `Beta`
- `Internal`
- `Private`

### `ForgeSymbol`

A single extracted and annotated symbol from the TypeScript AST.

```typescript
any
```

**Members:**

- `name` — The declared name of the symbol.
- `kind` — The syntactic kind of the symbol.
- `visibility` — Resolved visibility from TSDoc release tags.
- `filePath` — Absolute path to the source file.
- `line` — 1-based line number of the declaration.
- `column` — 0-based column of the declaration.
- `documentation` — Parsed TSDoc documentation, if present.
- `signature` — Human-readable type signature of the symbol.
- `children` — Child symbols (e.g., class members, enum values).
- `exported` — Whether this symbol is part of the public module exports.

### `RuleSeverity`

Severity level for an individual enforcement rule. - `"error"` — violation fails the build. - `"warn"`  — violation is reported but does not fail the build. - `"off"`   — rule is disabled entirely.

```typescript
any
```

### `EnforceRules`

Per-rule severity configuration for the TSDoc enforcer. Each key corresponds to one of the E001–E007 rule codes.

```typescript
any
```

**Members:**

- `"require-summary"` — E001: Exported symbol missing TSDoc summary.
- `"require-param"` — E002: Function parameter missing
- `"require-returns"` — E003: Non-void function missing
- `"require-example"` — E004: Exported function missing
- `"require-package-doc"` — E005: Entry point missing packageDocumentation.
- `"require-class-member-doc"` — E006: Class member missing documentation.
- `"require-interface-member-doc"` — E007: Interface/type member missing documentation.

### `ForgeConfig`

Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

```typescript
any
```

**Members:**

- `rootDir` — Root directory of the project.
- `tsconfig` — Path to the tsconfig.json to compile against.
- `outDir` — Output directory for generated files.
- `enforce` — Enforce TSDoc on all public exports.
- `doctest` — DocTest configuration.
- `api` — API generation configuration.
- `gen` — Output generation configuration.
- `skill` — Skill package generation settings. Custom sections here are merged into the generated SKILL.md, allowing projects to inject workflow knowledge, domain gotchas, and other context that cannot be derived from symbols alone.
- `_configWarnings` — Warnings generated during config loading (e.g., unknown keys). Populated by loadConfig(). Agents should surface these in output.
- `project` — Project metadata — auto-detected from package.json if not provided.

### `ForgeResult`

The result of a forge-ts compilation pass.

```typescript
any
```

**Members:**

- `success` — Whether the run succeeded without errors.
- `symbols` — All symbols extracted during this run.
- `errors` — Errors that caused or would cause failure.
- `warnings` — Non-fatal warnings.
- `duration` — Wall-clock duration of the run in milliseconds.
- `writtenFiles` — Absolute paths of files written during this run (populated by gen).

### `ForgeError`

A diagnostic error produced during a forge-ts run.

```typescript
any
```

**Members:**

- `code` — Machine-readable error code (e.g. "E001").
- `message` — Human-readable description of the error.
- `filePath` — Absolute path of the file where the error occurred.
- `line` — 1-based line number.
- `column` — 0-based column.
- `suggestedFix` — Suggested fix for the agent — exact TSDoc block to add.
- `symbolName` — The symbol name that needs fixing.
- `symbolKind` — The symbol kind (function, class, interface, etc.).

### `ForgeWarning`

A diagnostic warning produced during a forge-ts run.

```typescript
any
```

**Members:**

- `code` — Machine-readable warning code (e.g. "W001").
- `message` — Human-readable description of the warning.
- `filePath` — Absolute path of the file where the warning occurred.
- `line` — 1-based line number.
- `column` — 0-based column.

### `OpenAPISchemaObject`

OpenAPI 3.2 schema object.

```typescript
any
```

**Members:**

- `type` — The data type of the schema (e.g., "string", "number", "object", "array").
- `format` — A format hint for the data type (e.g., "int32", "date-time", "email", "uuid").
- `description` — A human-readable description of the schema's purpose or constraints.
- `properties` — Property definitions for object-type schemas. Maps each property name to its schema.
- `required` — List of property names that must be present on the object.
- `items` — Schema definition for the elements of an array-type schema. Required when `type` is "array".
- `additionalProperties` — Controls whether additional properties are allowed (`true`/`false`) or defines their schema.
- `enum` — Restricts the value to one of the listed constants.
- `oneOf` — Validates the value against exactly one of the listed sub-schemas.
- `allOf` — Validates the value against all of the listed sub-schemas (intersection).
- `anyOf` — Validates the value against at least one of the listed sub-schemas.
- `nullable` — Indicates that the value may be `null` in addition to its declared type.
- `deprecated` — Marks the schema as deprecated, signalling that it may be removed in a future version.
- `default` — The default value to use when the property is absent.
- `$ref` — A JSON Reference (`$ref`) pointing to another schema definition in the document.

### `OpenAPIInfoObject`

OpenAPI 3.2 info object.

```typescript
any
```

**Members:**

- `title` — The human-readable name of the API.
- `version` — The version string for the API (e.g., "1.0.0").
- `description` — A detailed description of the API, supporting CommonMark markdown.
- `summary` — A short summary of the API, intended for display in tooling.
- `license` — Licensing information for the exposed API, including name, URL, and SPDX identifier.

### `OpenAPITagObject`

OpenAPI 3.2 tag object.

```typescript
any
```

**Members:**

- `name` — The name of the tag, used to group operations in the document.
- `description` — An optional description of the tag, supporting CommonMark markdown.

### `OpenAPIPathItemObject`

OpenAPI 3.2 path item object.

```typescript
any
```

**Members:**

- `summary` — A short summary of the path item, intended for tooling display.
- `description` — A detailed description of the path item, supporting CommonMark markdown.
- `get` — The operation definition for HTTP GET requests to this path.
- `post` — The operation definition for HTTP POST requests to this path.
- `put` — The operation definition for HTTP PUT requests to this path.
- `delete` — The operation definition for HTTP DELETE requests to this path.
- `patch` — The operation definition for HTTP PATCH requests to this path.
- `options` — The operation definition for HTTP OPTIONS requests to this path.
- `head` — The operation definition for HTTP HEAD requests to this path.
- `trace` — The operation definition for HTTP TRACE requests to this path.
- `query` — The operation definition for HTTP QUERY requests to this path (OpenAPI 3.2 extension).
- `additionalOperations` — Additional non-standard HTTP method operations keyed by method name.

### `OpenAPIOperationObject`

OpenAPI 3.2 operation object.

```typescript
any
```

**Members:**

- `operationId` — A unique string identifier for the operation, used by tooling to reference it.
- `summary` — A short, human-readable summary of what the operation does.
- `description` — A detailed description of the operation's behaviour, supporting CommonMark markdown.
- `tags` — A list of tag names that logically group this operation in documentation and tooling.
- `parameters` — The list of parameters applicable to this operation.
- `responses` — The possible responses returned by this operation, keyed by HTTP status code or "default".

### `OpenAPIParameterObject`

OpenAPI 3.2 parameter object.

```typescript
any
```

**Members:**

- `name` — The name of the parameter, case-sensitive.
- `in` — The location of the parameter: path, query, header, cookie, or querystring.
- `description` — A human-readable description of the parameter's purpose, supporting CommonMark markdown.
- `required` — Whether the parameter is mandatory. Required for `in: "path"` parameters.
- `schema` — The schema defining the type and constraints of the parameter value.
- `deprecated` — Marks the parameter as deprecated; clients should avoid using it.

### `OpenAPIEncodingObject`

OpenAPI 3.2 encoding object.

```typescript
any
```

**Members:**

- `contentType` — The MIME type to use for encoding a specific property (e.g., "application/json").
- `headers` — Additional headers to send alongside the encoded part, keyed by header name.
- `style` — The serialization style for the encoded value (e.g., "form", "spaceDelimited").
- `explode` — Whether arrays and objects should be exploded into separate query parameters.
- `allowReserved` — Whether reserved characters in the encoded value should be allowed without percent-encoding.

### `OpenAPIMediaTypeObject`

OpenAPI 3.2 media type object.

```typescript
any
```

**Members:**

- `schema` — The schema defining the structure and type of the media type's payload.
- `encoding` — Encoding information for specific properties of a `multipart` or `application/x-www-form-urlencoded` request body.

### `OpenAPIResponseObject`

OpenAPI 3.2 response object.

```typescript
any
```

**Members:**

- `description` — A required human-readable description of the response, supporting CommonMark markdown.
- `headers` — HTTP headers returned with this response, keyed by header name.
- `content` — The response body content, keyed by media type (e.g., "application/json").

### `OpenAPIDocument`

Complete OpenAPI 3.2 document.

```typescript
any
```

**Members:**

- `openapi` — The OpenAPI specification version this document conforms to. Must be "3.2.0".
- `$self` — An optional self-referencing URL for this document, used for tooling and resolution.
- `info` — Metadata about the API including title, version, and description.
- `paths` — The available paths and their operations, keyed by path template (e.g., "/users/id").
- `components` — Reusable schema and media type definitions shared across the document.
- `tags` — A list of tags used to group operations, with optional descriptions.

### `ASTWalker`

The return type of `createWalker`.

```typescript
any
```

**Members:**

- `walk` — Walk all source files referenced by the configured tsconfig and return one `ForgeSymbol` per exported declaration.

### `SDKProperty`

A single property extracted from an interface or class symbol.

```typescript
any
```

**Members:**

- `name` — The property name.
- `type` — The TypeScript type string of the property.
- `description` — TSDoc summary for this property.
- `required` — Whether the property is required (not optional).
- `deprecated` — Deprecation notice, if present.

### `SDKType`

An SDK type descriptor extracted from the symbol graph.

```typescript
any
```

**Members:**

- `name` — The symbol name.
- `kind` — Syntactic kind of the type.
- `signature` — Human-readable type signature.
- `description` — TSDoc summary.
- `deprecated` — Deprecation notice, if present.
- `visibility` — Resolved visibility level.
- `properties` — Extracted properties (for interfaces, classes) or values (for enums).
- `sourceFile` — Absolute path to the source file.

### `ReferenceEntry`

A single entry in the generated API reference.

```typescript
any
```

**Members:**

- `name` — Symbol name.
- `kind` — Symbol kind.
- `summary` — TSDoc summary.
- `signature` — Human-readable type signature.
- `visibility` — Resolved visibility level.
- `deprecated` — Deprecation notice, if present.
- `params` — Documented parameters.
- `returns` — Documented return value.
- `throws` — Documented thrown exceptions.
- `examples` — Code examples from TSDoc `@example` tags.
- `children` — Nested child symbols (class methods, interface properties, enum members).
- `location` — Source file location.

### `MdText`

Inline leaf node: literal text.

```typescript
any
```

**Members:**

- `type`
- `value`

### `MdInlineCode`

Inline leaf node: code span.

```typescript
any
```

**Members:**

- `type`
- `value`

### `MdStrong`

Inline container: strong emphasis (bold).

```typescript
any
```

**Members:**

- `type`
- `children`

### `MdEmphasis`

Inline container: emphasis (italic).

```typescript
any
```

**Members:**

- `type`
- `children`

### `MdLink`

Inline container: hyperlink.

```typescript
any
```

**Members:**

- `type`
- `url`
- `children`

### `MdPhrasing`

Union of all inline (phrasing) content types.

```typescript
any
```

### `MdHeading`

Block node: heading (depth 1-6).

```typescript
any
```

**Members:**

- `type`
- `depth`
- `children`

### `MdParagraph`

Block node: paragraph.

```typescript
any
```

**Members:**

- `type`
- `children`

### `MdCode`

Block node: fenced code block.

```typescript
any
```

**Members:**

- `type`
- `lang`
- `value`

### `MdBlockquote`

Block node: blockquote.

```typescript
any
```

**Members:**

- `type`
- `children`

### `MdHtml`

Block node: raw HTML (including comments).

```typescript
any
```

**Members:**

- `type`
- `value`

### `MdThematicBreak`

Block node: horizontal rule.

```typescript
any
```

**Members:**

- `type`

### `MdListItem`

List item container.

```typescript
any
```

**Members:**

- `type`
- `spread`
- `children`

### `MdList`

Block node: ordered or unordered list.

```typescript
any
```

**Members:**

- `type`
- `ordered`
- `spread`
- `children`

### `MdTableCell`

GFM table cell.

```typescript
any
```

**Members:**

- `type`
- `children`

### `MdTableRow`

GFM table row.

```typescript
any
```

**Members:**

- `type`
- `children`

### `MdTable`

GFM table.

```typescript
any
```

**Members:**

- `type`
- `align`
- `children`

### `MdBlock`

Union of all block content types.

```typescript
any
```

### `MdRoot`

Document root.

```typescript
any
```

**Members:**

- `type`
- `children`

### `FrontmatterResult`

Result of parsing frontmatter from markdown/MDX content.

```typescript
any
```

**Members:**

- `body` — The body content without the frontmatter block.
- `data` — The parsed frontmatter data as a key-value map.

### `DocPage`

A single generated documentation page.

```typescript
any
```

**Members:**

- `path` — Relative path from outDir (e.g., "packages/core/index.md")
- `content` — Page content (Markdown or MDX)
- `frontmatter` — Frontmatter fields
- `stub` — When true, this page is scaffolding intended for human/agent editing. Stub pages are created only on the first build and never overwritten, preserving manual edits across subsequent `forge-ts build` runs. Auto-generated pages (stub=false) are always regenerated from source.

### `SiteGeneratorOptions`

Options controlling the doc site generator.

```typescript
any
```

**Members:**

- `format` — Output format
- `ssgTarget` — SSG target for frontmatter
- `projectName` — Project name
- `projectDescription` — Project description
- `repositoryUrl` — Repository URL (auto-detected from package.json).
- `packageName` — npm package name for install commands.

### `SSGTarget`

Supported SSG target identifiers.

```typescript
any
```

### `GeneratedFile`

A file to write to disk during scaffolding or generation.

```typescript
any
```

**Members:**

- `path` — Relative path from the docs output directory.
- `content` — File content (string for text).
- `stub` — When true, this file is scaffolding intended for human/agent editing. Stub files are created only on the first build and never overwritten, preserving manual edits across subsequent `forge-ts build` runs. Callers should check this flag and skip writing if the file exists.

### `SSGStyleGuide`

Style guide configuration for the SSG target.

```typescript
any
```

**Members:**

- `pageExtension` — File extension for doc pages.
- `supportsMdx` — Whether the target supports MDX components.
- `requiresFrontmatter` — Whether frontmatter is required on every page.
- `maxHeadingDepth` — Maximum recommended heading depth.
- `defaultImports` — Component imports to add at top of MDX files (if supportsMdx).
- `codeBlockLanguage` — Code block language for TypeScript examples.

### `ScaffoldManifest`

Scaffold manifest describing what `init docs` creates.

```typescript
any
```

**Members:**

- `target` — The SSG target this manifest is for.
- `files` — Files that will be created.
- `dependencies` — npm dependencies to install.
- `devDependencies` — npm devDependencies to install.
- `scripts` — Scripts to add to package.json.
- `instructions` — Post-scaffold instructions for the user.

### `AdapterContext`

Context passed to adapter methods.

```typescript
any
```

**Members:**

- `config` — Resolved forge-ts configuration.
- `projectName` — Project name (from package.json or directory).
- `projectDescription` — Project description.
- `pages` — The generated doc pages (from site-generator).
- `symbols` — All symbols extracted from the project.
- `outDir` — Output directory for generated docs.

### `DevServerCommand`

Command to start a local dev server for doc preview.

```typescript
any
```

**Members:**

- `bin` — The binary to execute (e.g., "npx", "node").
- `args` — Arguments to pass to the binary.
- `cwd` — Working directory to run from.
- `label` — Human-readable label for the command.
- `url` — The URL the dev server will be available at.

### `SSGAdapter`

The central SSG adapter interface. Every doc platform provider implements this contract. One file per provider. No shared mutable state.

```typescript
any
```

**Members:**

- `target` — Unique target identifier.
- `displayName` — Human-readable display name.
- `styleGuide` — Style guide for this platform.
- `scaffold` — Generate the complete scaffold for a new doc site. Called by `forge-ts init docs --target <name>`. Returns all files, dependencies, and scripts needed.
- `transformPages` — Transform generic DocPages into platform-specific pages. Adds correct frontmatter, component imports, file extensions. Called during `forge-ts build`.
- `generateConfig` — Generate platform-specific configuration files. e.g., mint.json, sidebars.js, _meta.json, .vitepress/config.ts Called during `forge-ts build`.
- `getDevCommand` — Get the command to start the local dev server for this platform. Called by `forge-ts docs dev`.
- `detectExisting` — Check if a scaffold already exists in the output directory. Used for safety checks before init or target change.

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
const files = adapter.transformPages(pages, context);
```

### `MarkdownOptions`

Options controlling Markdown output.

```typescript
any
```

**Members:**

- `mdx` — Whether to use MDX syntax (default: Markdown).

### `ReadmeSyncOptions`

Options controlling README sync behaviour.

```typescript
any
```

**Members:**

- `badge` — Include a "Documented with forge-ts" badge above the API table.
- `includeExamples` — Include first

### `SkillPackage`

A generated skill package following the agentskills.io directory structure. Contains SKILL.md plus optional references and scripts files.

```typescript
any
```

**Members:**

- `directoryName` — The skill directory name (lowercase, hyphens only, max 64 chars).
- `files` — Files to write inside the skill directory.

### `SSGConfigFile`

A single generated SSG configuration file.

```typescript
any
```

**Members:**

- `path` — Relative path from outDir (e.g., "mint.json", "_meta.json")
- `content` — File content

### `GenerateOptions`

Options for the generation pipeline.

```typescript
any
```

**Members:**

- `forceStubs` — When true, overwrite stub pages even if they already exist on disk. Normally stub pages (concepts, guides, faq, contributing, changelog) are only created on the first build to preserve manual edits. Use this to reset stubs to their scaffolding state.

### `Logger`

A minimal structured logger used throughout the CLI commands.

```typescript
any
```

**Members:**

- `info` — Print an informational message.
- `success` — Print a success message (green ✓ prefix when colours are on).
- `warn` — Print a warning message (yellow prefix when colours are on).
- `error` — Print an error message (red ✗ prefix when colours are on).
- `step` — Print a build-step line.

### `CommandOutput`

Typed result from a forge-ts command.

```typescript
any
```

**Members:**

- `operation` — Name of the command that produced this output (e.g., "check", "build").
- `success` — Whether the command completed successfully.
- `data` — Strongly-typed command-specific result payload.
- `errors` — Structured errors produced by the command, if any.
- `warnings` — Structured warnings produced by the command, if any.
- `duration` — Wall-clock duration of the command in milliseconds.

### `ForgeCliError`

Structured error for CLI commands.

```typescript
any
```

**Members:**

- `code` — Machine-readable error code (e.g., "E004").
- `message` — Human-readable error description.
- `filePath` — Absolute path to the source file containing the error, if applicable.
- `line` — 1-based line number of the error, if applicable.
- `column` — 0-based column number of the error, if applicable.

### `ForgeCliWarning`

Structured warning for CLI commands.

```typescript
any
```

**Members:**

- `code` — Machine-readable warning code.
- `message` — Human-readable warning description.
- `filePath` — Absolute path to the source file containing the warning, if applicable.
- `line` — 1-based line number of the warning, if applicable.
- `column` — 0-based column number of the warning, if applicable.

### `OutputFlags`

Output format flags passed through from citty args.

```typescript
any
```

**Members:**

- `json` — Emit output as a LAFS JSON envelope instead of human-readable text.
- `human` — Emit output as formatted human-readable text.
- `quiet` — Suppress all output regardless of format.
- `mvi` — MVI verbosity level: "minimal", "standard", or "full".

### `BuildArgs`

Arguments for the `build` command.

```typescript
any
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `skipApi` — Skip API generation even if enabled in config.
- `skipGen` — Skip doc generation even if enabled in config.
- `forceStubs` — Overwrite stub pages even if they already exist on disk. Normally stub pages (concepts, guides, faq, contributing, changelog) are only created on the first build to preserve manual edits. Use this to reset stubs to their scaffolding state.
- `mvi` — MVI verbosity level for structured output.

### `BuildStep`

A single step in the build pipeline.

```typescript
any
```

**Members:**

- `name` — Internal step name, e.g. "api" or "gen".
- `status` — Outcome of this step.
- `outputPath` — Path to the primary output file produced by this step, if applicable.
- `duration` — Wall-clock duration of this step in milliseconds.
- `errors` — Errors produced by this step when status is "failed".

### `BuildResult`

Typed result for the `build` command.

```typescript
any
```

**Members:**

- `success` — Whether the build succeeded.
- `summary` — Aggregate pipeline counts — always present.
- `steps` — Per-step details.
- `generatedFiles` — Files written during the build — present at standard and full MVI levels.

### `DeprecatedUsage`

A detected usage of a deprecated symbol.

```typescript
any
```

**Members:**

- `deprecatedSymbol` — The deprecated symbol being consumed.
- `sourcePackage` — The package that exports the deprecated symbol.
- `consumingFile` — The file importing the deprecated symbol.
- `line` — Line number of the import.
- `deprecationMessage` — The deprecation message.

### `FormatOptions`

Options that control how `formatResults` renders its output.

```typescript
any
```

**Members:**

- `colors` — Emit ANSI colour escape sequences when `true`.
- `verbose` — When `true`, include the symbol's type signature alongside each diagnostic so the reader has immediate context.

### `CheckArgs`

Arguments for the `check` command.

```typescript
any
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `strict` — Exit with non-zero code on warnings as well as errors.
- `verbose` — Include symbol signatures alongside diagnostics.
- `mvi` — MVI verbosity level for structured output.
- `rule` — Filter errors to a specific rule code (e.g., "E001").
- `file` — Filter errors to a specific file path (substring match).
- `limit` — Maximum number of file groups to return in byFile (default: 20).
- `offset` — Offset into the byFile list for pagination (default: 0).

### `CheckFileError`

A single error entry within a file group.

```typescript
any
```

**Members:**

- `code` — Machine-readable error code.
- `symbol` — Symbol name that needs fixing.
- `kind` — Symbol kind (function, class, interface, etc.).
- `line` — 1-based line number of the error.
- `message` — Human-readable description.
- `suggestedFix` — Exact TSDoc block to add (present at full MVI or with --rule/--file filters).
- `agentAction` — Recommended agent action.

### `CheckFileWarning`

A single warning entry within a file group.

```typescript
any
```

**Members:**

- `code` — Machine-readable warning code.
- `symbol` — Symbol name that generated the warning.
- `kind` — Symbol kind (function, class, interface, etc.).
- `line` — 1-based line number of the warning.
- `message` — Human-readable description.

### `CheckFileGroup`

Errors and warnings grouped by file.

```typescript
any
```

**Members:**

- `file` — Absolute path to the source file.
- `errors` — Errors in this file.
- `warnings` — Warnings in this file.

### `CheckRuleCount`

Error breakdown by rule code, sorted by count descending.

```typescript
any
```

**Members:**

- `code` — Machine-readable rule code (e.g., "E001").
- `rule` — Human-readable rule name (e.g., "require-summary").
- `count` — Number of violations.
- `files` — Number of unique files affected by this rule.

### `CheckTriage`

Triage data for prioritizing fixes. Always present when the check has errors, bounded in size (~9 rules + top 20 files).

```typescript
any
```

**Members:**

- `byRule` — Error counts by rule, sorted descending.
- `topFiles` — Top files by error count (max 20).
- `fixOrder` — Suggested fix order: rules sorted by fewest files affected first (quick wins).

### `CheckPage`

Pagination metadata for byFile results.

```typescript
any
```

**Members:**

- `offset` — Current offset.
- `limit` — Page size.
- `hasMore` — Whether more results exist beyond this page.
- `total` — Total number of file groups (after filters).

### `CheckResult`

Typed result for the `check` command.

```typescript
any
```

**Members:**

- `success` — Whether the check passed without errors.
- `summary` — Aggregate counts — always present regardless of MVI level.
- `triage` — Triage data for prioritizing fixes — present when errors  0 (except minimal).
- `byFile` — Per-file breakdown — present at standard and full MVI levels, paginated.
- `page` — Pagination metadata when byFile is paginated.
- `filters` — Active filters applied to this result.
- `nextCommand` — CLI command hint for the agent to run next.

### `InitDocsResult`

Result of the `init docs` command.

```typescript
any
```

**Members:**

- `success` — Whether the scaffold succeeded.
- `target` — The SSG target that was scaffolded.
- `summary` — Summary of what was created.
- `files` — Relative paths of all files created.
- `instructions` — Post-scaffold instructions for the user.

```typescript
import { runInitDocs } from "@forge-ts/cli/commands/init-docs";
const output = await runInitDocs({ target: "mintlify" });
console.log(output.data.summary.filesCreated); // number of files written
```

### `InitDocsArgs`

Arguments for the `init docs` command.

```typescript
any
```

**Members:**

- `target` — SSG target to scaffold. Defaults to `DEFAULT_TARGET`.
- `cwd` — Project root directory (default: cwd).
- `outDir` — Output directory for the doc site (default: outDir from config or ./docs).
- `force` — Overwrite an existing scaffold without prompting.
- `mvi` — MVI verbosity level for structured output.

### `ExtractedExample`

A single extracted `@example` block ready for test generation.

```typescript
any
```

**Members:**

- `symbolName` — The symbol this example belongs to.
- `filePath` — Absolute path to the source file.
- `line` — 1-based line number of the `@example` tag.
- `code` — The raw code inside the fenced block.
- `language` — The language identifier (e.g. `"typescript"`).
- `index` — Sequential index among examples for this symbol.

### `GeneratorOptions`

Options for virtual test file generation.

```typescript
any
```

**Members:**

- `cacheDir` — Directory where virtual test files will be written.

### `VirtualTestFile`

A generated virtual test file.

```typescript
any
```

**Members:**

- `path` — Absolute path where the file will be written.
- `content` — File contents (valid TypeScript).

### `RunResult`

Result of running the generated test files.

```typescript
any
```

**Members:**

- `success` — Whether all tests passed.
- `passed` — Number of tests that passed.
- `failed` — Number of tests that failed.
- `output` — Combined stdout + stderr output from the test runner.
- `tests` — Individual test results with name and status.

### `TestCaseResult`

The result of a single test case.

```typescript
any
```

**Members:**

- `name` — The full test name as reported by the runner.
- `passed` — Whether this test passed.
- `sourceFile` — The source file this test was generated from, if determinable.

### `TestArgs`

Arguments for the `test` command.

```typescript
any
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `mvi` — MVI verbosity level for structured output.

### `TestFailure`

A single test failure entry, included at standard and full MVI levels.

```typescript
any
```

**Members:**

- `symbol` — Symbol name where the doctest failed.
- `file` — Absolute path to the source file.
- `line` — 1-based line number of the failing example.
- `message` — Human-readable failure message.

### `TestResult`

Typed result for the `test` command.

```typescript
any
```

**Members:**

- `success` — Whether all doctests passed.
- `summary` — Aggregate counts — always present regardless of MVI level.
- `failures` — Per-failure details — present at standard and full MVI levels.

## Constants

### `md`

Concise factory functions for building mdast nodes.  Usage:

```typescript
{ text: (value: string) => MdText; inlineCode: (value: string) => MdInlineCode; strong: (...children: MdPhrasing[]) => MdStrong; emphasis: (...children: MdPhrasing[]) => MdEmphasis; ... 12 more ...; root: (...children: MdBlock[]) => MdRoot; }
```

### `DEFAULT_TARGET`

The default SSG target when none is specified.

```typescript
SSGTarget
```

### `mintlifyAdapter`

Mintlify SSG adapter. Implements the `SSGAdapter` contract for the Mintlify platform.

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "docs.json"
```

### `docusaurusAdapter`

Docusaurus SSG adapter. Implements the `SSGAdapter` contract for the Docusaurus platform.

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("docusaurus");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "sidebars.ts"
```

### `nextraAdapter`

Nextra SSG adapter (v4, App Router). Implements the `SSGAdapter` contract for the Nextra platform.

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("nextra");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "content/_meta.js"
```

### `vitepressAdapter`

VitePress SSG adapter. Implements the `SSGAdapter` contract for the VitePress platform.

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("vitepress");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // ".vitepress/config.mts"
```

### `buildCommand`

Citty command definition for `forge-ts build`.

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly "skip-api": { readonly type: "boolean"; readonly description: "Skip OpenAPI generation"; readonly default: false; }; ... 5 more ...; readonly mvi: { ...; }; }>
```

### `checkCommand`

Citty command definition for `forge-ts check`.

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly strict: { readonly type: "boolean"; readonly description: "Treat warnings as errors"; readonly default: false; }; ... 8 more ...; readonly mvi: { ...; }; }>
```

### `docsDevCommand`

Citty command definition for `forge-ts docs dev`.

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly target: { readonly type: "string"; readonly description: "SSG target override (reads from config by default)"; }; readonly port: { ...; }; }>
```

```typescript
import { docsDevCommand } from "@forge-ts/cli";
```

### `initDocsCommand`

Citty command definition for `forge-ts init docs`.  Scaffolds a complete documentation site for the target SSG platform. Use `--json` for LAFS JSON envelope output (agent/CI-friendly).

```typescript
CommandDef<{ readonly target: { readonly type: "string"; readonly description: `SSG target: ${string} (default: docusaurus)` | `SSG target: ${string} (default: mintlify)` | `SSG target: ${string} (default: nextra)` | `SSG target: ${string} (default: vitepress)`; }; readonly cwd: { readonly type: "string"; readonly d...
```

```typescript
import { initDocsCommand } from "@forge-ts/cli/commands/init-docs";
// Registered automatically as a subcommand of `forge-ts init`
```

### `initCommand`

Citty command definition for `forge-ts init`.  Exposes subcommands for scaffolding project artefacts.

```typescript
CommandDef<ArgsDef>
```

```typescript
import { initCommand } from "@forge-ts/cli/commands/init-docs";
// Registered automatically as a subcommand of `forge-ts`
```

### `testCommand`

Citty command definition for `forge-ts test`.

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { ...; }; readonly quiet: { ...; }; readonly mvi: { .....
```
