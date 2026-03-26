# forge-ts — API Reference

## Table of Contents

- [Functions](#functions)
- [Types](#types)
- [Constants](#constants)

## Functions

### `getCurrentUser`

Returns the current OS username, or "unknown" if unavailable.

```typescript
() => string
```

**Returns:** The OS username string.

```typescript
import { getCurrentUser } from "@forge-ts/core/audit";
const user = getCurrentUser(); // e.g. "alice"
```

### `appendAuditEvent`

Appends a single audit event to the `.forge-audit.jsonl` file.

```typescript
(rootDir: string, event: AuditEvent) => void
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.
- `event` — The audit event to record.

```typescript
import { appendAuditEvent } from "@forge-ts/core";
const event = { timestamp: new Date().toISOString(), event: "config.lock" as const, user: "alice", reason: "Stabilize", details: {} };
appendAuditEvent("/path/to/project", event);
```

### `readAuditLog`

Reads the `.forge-audit.jsonl` file and returns parsed audit events.

```typescript
(rootDir: string, options?: ReadAuditOptions) => AuditEvent[]
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.
- `options` — Optional limit and event type filter.

**Returns:** Array of audit events, newest first.

```typescript
import { readAuditLog } from "@forge-ts/core";
const events = readAuditLog("/path/to/project", { limit: 10 });
console.log(events.length); // up to 10
```

### `formatAuditEvent`

Formats a single audit event as a human-readable string.

```typescript
(event: AuditEvent) => string
```

**Parameters:**

- `event` — The audit event to format.

**Returns:** A single-line human-readable representation.

```typescript
import { formatAuditEvent } from "@forge-ts/core";
const event = { timestamp: "2026-03-21T12:00:00.000Z", event: "config.lock" as const, user: "alice", reason: "Stabilize", details: {} };
const line = formatAuditEvent(event);
console.log(line);
```

### `createBypass`

Creates a new bypass record, writes it to `.forge-bypass.json`, and appends an audit event.

```typescript
(rootDir: string, reason: string, rule?: string, config?: Partial<BypassConfig>) => BypassRecord
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.
- `reason` — Mandatory justification for the bypass.
- `rule` — Specific rule code to bypass (e.g., "E009"), or "all". Defaults to "all".
- `config` — Optional bypass budget configuration overrides.

**Returns:** The created bypass record.

```typescript
import { createBypass } from "@forge-ts/core";
const bypass = createBypass("/path/to/project", "hotfix for release", "E009", { dailyBudget: 5, durationHours: 12 });
console.log(bypass.id);
```

### `getActiveBypasses`

Returns all currently active (non-expired) bypass records.

```typescript
(rootDir: string) => BypassRecord[]
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.

**Returns:** Array of active bypass records.

```typescript
import { getActiveBypasses } from "@forge-ts/core";
const active = getActiveBypasses("/path/to/project");
console.log(`${active.length} active bypass(es)`);
```

### `isRuleBypassed`

Checks whether a specific rule has an active bypass.

```typescript
(rootDir: string, ruleCode: string) => boolean
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.
- `ruleCode` — The rule code to check (e.g., "E009", "E010").

**Returns:** `true` if the rule is currently bypassed.

```typescript
import { isRuleBypassed } from "@forge-ts/core";
if (isRuleBypassed("/path/to/project", "E009")) {
  console.log("E009 is currently bypassed");
}
```

### `getRemainingBudget`

Returns the number of bypass budget slots remaining for today.

```typescript
(rootDir: string, config?: Partial<BypassConfig>) => number
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.
- `config` — Optional bypass budget configuration overrides.

**Returns:** Number of remaining bypass slots for today.

```typescript
import { getRemainingBudget } from "@forge-ts/core";
const remaining = getRemainingBudget("/path/to/project", { dailyBudget: 5, durationHours: 24 });
console.log(`${remaining} bypass(es) remaining today`);
```

### `expireOldBypasses`

Removes expired bypass records from `.forge-bypass.json`.

```typescript
(rootDir: string) => number
```

**Parameters:**

- `rootDir` — Absolute path to the project root directory.

**Returns:** The number of expired records removed.

```typescript
import { expireOldBypasses } from "@forge-ts/core";
const removed = expireOldBypasses("/path/to/project");
console.log(`${removed} expired bypass(es) removed`);
```

### `defineConfig`

Type-safe helper for defining a partial forge-ts configuration.

```typescript
(config: Partial<ForgeConfig>) => Partial<ForgeConfig>
```

**Parameters:**

- `config` — Partial configuration overrides.

**Returns:** The same object (identity function for type checking).

```typescript
import { defineConfig } from "@forge-ts/core";

const config = { outDir: "docs", enforce: { strict: true } };
export default defineConfig(config);
```

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

Loads the forge-ts configuration for a project.

```typescript
(rootDir?: string) => Promise<ForgeConfig>
```

**Parameters:**

- `rootDir` — The project root to search for config.  Defaults to `process.cwd()`.

**Returns:** A fully-resolved `ForgeConfig`.

```typescript
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
// config is fully resolved with defaults
```

### `readLockFile`

Reads the `.forge-lock.json` file from the given project root.

```typescript
(rootDir: string) => ForgeLockManifest | null
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** The parsed lock manifest, or `null` if no lock file exists or is invalid.

```typescript
import { readLockFile } from "@forge-ts/core";
const lock = readLockFile("/path/to/project");
if (lock) {
  console.log(`Locked at ${lock.lockedAt} by ${lock.lockedBy}`);
}
```

### `writeLockFile`

Writes a `ForgeLockManifest` to `.forge-lock.json` in the project root.

```typescript
(rootDir: string, manifest: ForgeLockManifest) => void
```

**Parameters:**

- `rootDir` — Absolute path to the project root.
- `manifest` — The lock manifest to write.

```typescript
import { writeLockFile, createLockManifest, loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
const manifest = createLockManifest(config, "alice");
writeLockFile("/path/to/project", manifest);
```

### `removeLockFile`

Removes the `.forge-lock.json` file from the project root.

```typescript
(rootDir: string) => boolean
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** `true` if the file existed and was removed, `false` otherwise.

```typescript
import { removeLockFile } from "@forge-ts/core";
const removed = removeLockFile("/path/to/project");
console.log(removed ? "Lock removed" : "No lock file found");
```

### `createLockManifest`

Creates a `ForgeLockManifest` from the current project config.

```typescript
(config: ForgeConfig, lockedBy?: string) => ForgeLockManifest
```

**Parameters:**

- `config` — The fully-resolved `ForgeConfig` to snapshot.
- `lockedBy` — Identifier of the user or agent creating the lock. Defaults to `"forge-ts lock"`.

**Returns:** A new lock manifest ready to be written with `writeLockFile`.

```typescript
import { createLockManifest, loadConfig } from "@forge-ts/core";
const config = await loadConfig();
const manifest = createLockManifest(config, "alice");
console.log(manifest.config.rules);
```

### `validateAgainstLock`

Validates the current config against a locked manifest.

```typescript
(config: ForgeConfig, lock: ForgeLockManifest) => LockViolation[]
```

**Parameters:**

- `config` — The current fully-resolved `ForgeConfig`.
- `lock` — The lock manifest to validate against.

**Returns:** An array of `LockViolation` entries. Empty means no weakening detected.

```typescript
import { validateAgainstLock, readLockFile, loadConfig } from "@forge-ts/core";
const config = await loadConfig();
const lock = readLockFile(config.rootDir);
if (lock) {
  const violations = validateAgainstLock(config, lock);
  for (const v of violations) {
    console.error(`LOCK VIOLATION: ${v.message}`);
  }
}
```

### `resolveVisibility`

Determines the visibility level of a symbol from its TSDoc release tags.

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

Returns whether `candidate` meets or exceeds the required minimum visibility.

```typescript
(candidate: Visibility | "public" | "beta" | "internal" | "private", minVisibility: Visibility | "public" | "beta" | "internal" | "private") => boolean
```

**Parameters:**

- `candidate` — The visibility of the symbol being tested.
- `minVisibility` — The minimum visibility threshold.

**Returns:** `true` if `candidate` is at least as visible as `minVisibility`.

```typescript
import { meetsVisibility, Visibility } from "@forge-ts/core";
meetsVisibility(Visibility.Public, Visibility.Public); // true
meetsVisibility(Visibility.Internal, Visibility.Public); // false
meetsVisibility("public", "beta"); // true (string literals also accepted)
```

### `filterByVisibility`

Filters an array of `ForgeSymbol` objects to only include symbols whose visibility meets or exceeds `minVisibility`.

```typescript
(symbols: ForgeSymbol[], minVisibility: Visibility | "public" | "beta" | "internal" | "private") => ForgeSymbol[]
```

**Parameters:**

- `symbols` — The full list of symbols to filter.
- `minVisibility` — The minimum visibility threshold to keep.

**Returns:** A new array containing only symbols that pass the visibility check.

```typescript
import { filterByVisibility, Visibility } from "@forge-ts/core";
const publicOnly = filterByVisibility(symbols, Visibility.Public);
```

### `clearTSDocConfigCache`

Clears the TSDoc configuration cache. Intended for use in tests only.

```typescript
() => void
```

### `loadTSDocConfiguration`

Resolve the TSDoc configuration to use when parsing comments in files under `folderPath`.  If a `tsdoc.json` file exists in or above the folder and can be loaded without errors, its settings are applied to a fresh `TSDocConfiguration` via `TSDocConfigFile.configureParser()`. Otherwise the default `TSDocConfiguration` is returned (backward-compatible behaviour).  Results are cached per folder path so the file system is only consulted once per unique directory.

```typescript
(folderPath: string) => TSDocConfiguration
```

**Parameters:**

- `folderPath` — Absolute directory path of the source file being parsed.

**Returns:** A configured `TSDocConfiguration` instance.

### `createWalker`

Creates an `ASTWalker` configured for the given forge config.

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

Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted. - HTTP paths are extracted from `@route` tags and appropriately mapped.

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

### `configureLogger`

Configures the global `forgeLogger` based on CLI flags.  Call this once at the start of a command's `run()` handler to align consola's output level with the user's intent:  - `quiet` or `json` sets level to 0 (silent) so only LAFS output appears. - `verbose` sets level to 4 (debug) for maximum detail. - Default level is 3 (info) which covers info, warn, error, and success.

```typescript
(options: ForgeLoggerOptions) => void
```

**Parameters:**

- `options` — Flag-driven configuration.

```typescript
import { configureLogger, forgeLogger } from "./forge-logger.js";
configureLogger({ quiet: args.quiet, json: args.json, verbose: args.verbose });
forgeLogger.info("This respects the configured level");
```

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

### `runAudit`

Reads the audit log and returns a typed command output.

```typescript
(args: AuditArgs) => CommandOutput<AuditResult>
```

**Parameters:**

- `args` — CLI arguments for the audit command.

**Returns:** A typed `CommandOutput<AuditResult>`.

```typescript
import { runAudit } from "@forge-ts/cli/commands/audit";
const output = await runAudit({ cwd: process.cwd(), limit: 10 });
console.log(output.data.count); // number of events returned
```

### `discoverGuides`

Analyze the symbol graph and discover guides using multiple heuristics.  Each heuristic produces zero or more `DiscoveredGuide` entries. When multiple heuristics produce a guide with the same slug, the first one wins (priority order: guide-tag, config-interface, error-types, category, entry-point).

```typescript
(symbolsByPackage: Map<string, ForgeSymbol[]>, config: ForgeConfig) => DiscoveredGuide[]
```

**Parameters:**

- `symbolsByPackage` — Symbols grouped by package name.
- `config` — The resolved forge-ts configuration.

**Returns:** An array of discovered guides, deduplicated by slug.

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

```ts
const { body, data } = parseFrontmatter("---\ntitle: Hello\n---\n# Body");
// data.title === "Hello", body === "# Body"
```

### `stringifyWithFrontmatter`

Serialize content with frontmatter prepended.  Produces the standard format:

```typescript
(body: string, data: Record<string, string | number | boolean>) => string
```

**Parameters:**

- `body` — The markdown body content (without frontmatter).
- `data` — The frontmatter fields to serialize.

**Returns:** The combined frontmatter + body string.

```ts
const output = stringifyWithFrontmatter("# Hello", { title: "Greeting" });
// "---\ntitle: Greeting\n---\n\n# Hello\n"
```

### `stripFrontmatter`

Strip frontmatter from content, returning only the body.

```typescript
(content: string) => string
```

**Parameters:**

- `content` — The full file content including frontmatter.

**Returns:** The body content without the frontmatter block.

```ts
const body = stripFrontmatter("---\ntitle: Hello\n---\n# Content");
// body === "# Content"
```

### `parseInline`

Parse a markdown string and extract inline (phrasing) content.  Use for TSDoc text that may contain backtick code, bold, links, etc. The returned nodes can be spread into paragraphs, table cells, or any other context that accepts inline content.  This prevents double-escaping: backticks become proper `inlineCode` nodes instead of text that gets escaped by the serializer.

```typescript
(markdown: string) => MdPhrasing[]
```

**Parameters:**

- `markdown` — The TSDoc content string (may contain markdown).

**Returns:** Array of inline mdast nodes.

```ts
const nodes = parseInline("Use `forEach` for iteration");
// Returns [text("Use "), inlineCode("forEach"), text(" for iteration")]
```

### `parseBlocks`

Parse a markdown string and extract block-level content.  Use for multi-line TSDoc content that may contain headings, lists, blockquotes, code blocks, etc.

```typescript
(markdown: string) => MdBlock[]
```

**Parameters:**

- `markdown` — The markdown string to parse.

**Returns:** Array of block-level mdast nodes.

```ts
const blocks = parseBlocks("# Title\n\nSome paragraph text.");
// Returns [heading(1, "Title"), paragraph("Some paragraph text.")]
```

### `sanitizeForMdx`

Sanitize markdown content for MDX compatibility using AST-aware processing.  Parses the document with remark to understand its structure, then applies targeted string replacements only to text and HTML comment nodes — code blocks, inline code, and frontmatter are automatically preserved.  Transformations applied outside code: - HTML comments to MDX comments - Curly braces in text escaped (prevents MDX expression parsing) - Angle brackets around word chars escaped (prevents JSX tag parsing)

```typescript
(content: string) => string
```

**Parameters:**

- `content` — The markdown content to sanitize.

**Returns:** The sanitized content safe for MDX consumption.

```ts
const safe = sanitizeForMdx("Value is <T> and {x}");
// "Value is &lt;T&gt; and \\{x\\}"
```

### `updateAutoSections`

Updates auto-enriched sections in an existing stub file.  Uses AST-aware parsing to find FORGE:AUTO markers, ensuring markers inside code blocks are never accidentally matched. Replaces content between `<!-- FORGE:AUTO-START id -->` and `<!-- FORGE:AUTO-END id -->` markers (or their MDX comment equivalents) with fresh content from the newly generated version.  Manual content outside markers is preserved exactly — no reformatting.

```typescript
(existing: string, generated: string) => string | null
```

**Parameters:**

- `existing` — The current file content on disk.
- `generated` — The freshly generated content with updated markers.

**Returns:** The merged content, or null if no markers were found to update.

### `stubHash`

Compute a short fingerprint hash for content change detection.  Uses a simple DJB2-style hash converted to base-36 and truncated to 8 characters. This is NOT cryptographic — just a quick fingerprint to detect whether generated content has been manually edited.

```typescript
(content: string) => string
```

**Parameters:**

- `content` — The content to hash.

**Returns:** An 8-character alphanumeric hash string.

### `isStubModified`

Checks if a FORGE:STUB section has been modified by the user.  Compares the embedded hash (from the FORGE:STUB-HASH comment) against a freshly computed hash of the current inner content (with the hash comment itself stripped out). If the hashes diverge — meaning the user edited the content — or the hash comment was removed, the section is considered modified and should be preserved.

```typescript
(existingContent: string, stubId: string, _generatedContent: string) => boolean
```

**Parameters:**

- `existingContent` — The full document content on disk.
- `stubId` — The identifier of the FORGE:STUB section.
- `_generatedContent` — Unused; kept for API symmetry. Detection is purely hash-based.

**Returns:** `true` if the user has modified the stub (preserve it), `false` if unmodified (safe to regenerate).

```ts
const doc = "<!-- FORGE:STUB-START api -->\n<!-- FORGE:STUB-HASH abc -->\noriginal\n<!-- FORGE:STUB-END api -->";
isStubModified(doc, "api", ""); // false — hash still matches
```

### `updateStubSections`

Updates FORGE:STUB sections in existing content.  Behavior for each stub: - If the stub doesn't exist yet, appends it at the end of the content. - If the stub exists but is unmodified (hash matches generated content), regenerates it. - If the stub exists and was modified by user (hash mismatch), PRESERVES user content.  Each generated stub includes a `FORGE:STUB-HASH` comment containing a fingerprint of the generated content. On subsequent builds, this hash is compared to determine whether the user has made edits.

```typescript
(existingContent: string, stubs: Array<{ id: string; content: string; }>) => string
```

**Parameters:**

- `existingContent` — The current file content on disk.
- `stubs` — Array of stub definitions with their IDs and generated content.

**Returns:** The updated content with stubs inserted or refreshed as needed.

```ts
const updated = updateStubSections(existingMdx, [
  { id: "api-table", content: "| Method | Description |\n|---|---|" },
]);
```

### `escapeMdx`

Escape MDX-unsafe characters in text that appears outside code fences.  MDX parses `<Word>` as JSX tags and `{expr}` as JS expressions. In documentation content (summaries, descriptions, table cells), these come from TypeScript generics (`Array<string>`) and TSDoc inline tags (`{@link Foo}`). We escape them so MDX treats them as literal text.  This is exported so SSG adapters can apply it during page transformation.

```typescript
(text: string) => string
```

**Parameters:**

- `text` — Raw text that may contain MDX-unsafe characters.

**Returns:** The input string with `{`, `}`, `<`, and `>` escaped for safe MDX rendering.

```typescript
const safe = escapeMdx("Array<string>");
console.log(safe); // "Array&lt;string&gt;"
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

Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation. Symbols are grouped by package with  summaries.

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

Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context. Symbols are grouped by package with  summaries.

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
(config: ForgeConfig, options?: GenerateOptions) => Promise<ForgeResult>
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

### `runBypassCreate`

Runs the bypass creation: creates a new bypass record with budget enforcement.

```typescript
(args: { cwd?: string; reason: string; rule?: string; }) => Promise<CommandOutput<BypassCreateResult>>
```

**Parameters:**

- `args` — CLI arguments for the bypass command.

**Returns:** A typed `CommandOutput<BypassCreateResult>`.

```typescript
import { runBypassCreate } from "@forge-ts/cli/commands/bypass";
const output = await runBypassCreate({
  cwd: process.cwd(),
  reason: "hotfix for release",
  rule: "E009",
});
console.log(output.data.remainingBudget);
```

### `runBypassStatus`

Runs the bypass status query: shows active bypasses and remaining budget.

```typescript
(args: { cwd?: string; }) => Promise<CommandOutput<BypassStatusResult>>
```

**Parameters:**

- `args` — CLI arguments for the bypass status command.

**Returns:** A typed `CommandOutput<BypassStatusResult>`.

```typescript
import { runBypassStatus } from "@forge-ts/cli/commands/bypass";
const output = await runBypassStatus({ cwd: process.cwd() });
console.log(output.data.activeBypasses.length);
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

Runs the TSDoc enforcement pass against a project.  The enforcer walks all exported symbols that meet the configured minimum visibility threshold and emits diagnostics for any documentation deficiencies it finds.  ### Error codes | Code | Severity | Condition | |------|----------|-----------| | E001 | error    | Exported symbol is missing a TSDoc summary. | | E002 | error    | Function/method parameter lacks a `@param` tag. | | E003 | error    | Non-void function/method lacks a `@returns` tag. | | E004 | error    | Exported function/method is missing an `@example` block. | | E005 | error    | Package entry point (index.ts) is missing `@packageDocumentation`. | | E006 | error    | Public/protected class member is missing a TSDoc comment. | | E007 | error    | Interface/type alias property is missing a TSDoc comment. | | W001 | warning  | TSDoc comment contains parse errors. | | W002 | warning  | Function body throws but has no `@throws` tag. | | W003 | warning  | `@deprecated` tag is present without explanation. | | W006 | warning  | TSDoc parser-level syntax error (invalid tag, malformed block, etc.). | | E009 | error    | tsconfig.json required strict-mode flag is missing or disabled (guard). | | E010 | error    | Config drift: a rule severity is weaker than the locked value. | | E013 | error    | Exported function/class is missing a `@remarks` block. | | E014 | warn     | Optional property of interface/type is missing `@defaultValue`. | | E015 | error    | Generic symbol is missing `@typeParam` for a type parameter. | | W005 | warn     | Symbol references other symbols via `{@link}` but has no `@see` tags. | | W007 | warn     | Guide FORGE:AUTO section references a symbol that no longer exists. | | W008 | warn     | Exported public symbol is not mentioned in any guide page. | | E017 | error    | `@internal` symbol re-exported through public barrel (index.ts). | | E018 | warn     | `@route`-tagged function missing `@response` tag. | | W009 | warn     | `{@inheritDoc}` references a symbol that does not exist. | | W010 | warn     | `@breaking` tag present without `@migration` path. | | W011 | warn     | New public export missing `@since` version tag. | | E019 | error    | Non-test file contains `@ts-expect-error` / `@ts-expect-error`. | | E020 | error    | Exported symbol has `any` in its public API signature. | | W012 | warn     | `{@link}` display text appears stale relative to target summary. | | W013 | warn     | `@example` block may be stale (arg count mismatch). |  When `config.enforce.strict` is `true` all warnings are promoted to errors.

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

### `getStagedFiles`

Returns the list of staged .ts/.tsx files (relative paths) by querying git. Returns `null` when git is unavailable or the working directory is not a git repository. Deleted files are excluded.  The command is a fixed string with no interpolated user input, so shell injection is not a concern here.

```typescript
(cwd: string) => string[] | null
```

**Parameters:**

- `cwd` — Working directory for the git command.

**Returns:** Array of relative file paths, or `null` on failure.

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
(args: { cwd?: string; target?: string; port?: string; }) => Promise<void>
```

**Parameters:**

- `args` — Command arguments.

**Returns:** A promise that resolves when the server exits.

```typescript
import { runDocsDev } from "@forge-ts/cli";
await runDocsDev({ cwd: "./my-project" });
```

### `readPkgJson`

Read and parse package.json from a project root.  Detects indent style and trailing newline for lossless round-tripping. Returns `null` if the file doesn't exist or can't be parsed.

```typescript
(rootDir: string) => PkgJson | null
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** Parsed package.json with formatting metadata, or null.

### `serializePkgJson`

Serialize a package.json object preserving original formatting.

```typescript
(pkg: PkgJson) => string
```

**Parameters:**

- `pkg` — The parsed package.json with formatting metadata.

**Returns:** Formatted JSON string ready to write to disk.

### `writePkgJson`

Write a modified package.json back to disk, preserving formatting.

```typescript
(pkg: PkgJson) => Promise<void>
```

**Parameters:**

- `pkg` — The parsed and modified package.json.

### `addScripts`

Add scripts to package.json idempotently.  Only adds scripts where the key doesn't already exist. Never overwrites existing script values. Returns the list of keys added.

```typescript
(pkg: PkgJson, scripts: Record<string, string>) => string[]
```

**Parameters:**

- `pkg` — The parsed package.json to modify (mutated in place).
- `scripts` — Map of script key to command value.

**Returns:** Array of script keys that were added (empty if all already existed).

### `detectHookManager`

Detects which hook manager is present in the project.  Checks for: - husky: `.husky/` directory or `husky` in package.json devDependencies - lefthook: `lefthook.yml` or `lefthook` in package.json devDependencies

```typescript
(rootDir: string) => HookManager
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** The detected hook manager, or "none" if neither is found.

```typescript
import { detectHookManager } from "@forge-ts/cli/commands/init-hooks";
const manager = detectHookManager("/path/to/project");
console.log(manager); // "husky" | "lefthook" | "none"
```

### `generateHuskyHook`

Generates the husky pre-commit hook file content (modern husky v9+).

```typescript
() => string
```

### `generateHuskyPrePushHook`

Generates the husky pre-push hook file content (modern husky v9+).

```typescript
() => string
```

### `generateLefthookBlock`

Generates the lefthook block with both pre-commit and pre-push sections.

```typescript
() => string
```

### `detectVersionGuard`

Checks whether a versionguard config file exists in the project root.  When detected, forge-ts appends versionguard's hook lines to the generated hook files so both tools run cooperatively.

```typescript
(rootDir: string) => boolean
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** True when a versionguard config file is found.

```typescript
import { detectVersionGuard } from "@forge-ts/cli/commands/init-hooks";
if (detectVersionGuard("/path/to/project")) {
  console.log("VersionGuard detected — adding cooperative hooks");
}
```

### `runInitHooks`

Scaffolds git hook integration for the project.  Detects the hook manager (husky or lefthook), generates appropriate hook files, and reports what was written.

```typescript
(args: InitHooksArgs) => Promise<CommandOutput<InitHooksResult>>
```

**Parameters:**

- `args` — CLI arguments for the init hooks command.

**Returns:** A typed `CommandOutput<InitHooksResult>`.

```typescript
import { runInitHooks } from "@forge-ts/cli/commands/init-hooks";
const output = await runInitHooks({ cwd: "/my/project" });
console.log(output.data.files); // [".husky/pre-commit"]
```

### `detectEnvironment`

Detects the project environment by checking for files and dependencies.

```typescript
(rootDir: string) => InitProjectEnvironment
```

**Parameters:**

- `rootDir` — Absolute path to the project root.

**Returns:** The detected environment.

### `buildTsdocContent`

Builds tsdoc.json content, merging in customTags from the forge config.  When `customTags` is non-empty, the written tsdoc.json includes both `tagDefinitions` and `supportForTags` entries so that the TSDoc parser (and any editor extensions) recognise the custom tags.

```typescript
(customTags?: Array<{ tagName: string; syntaxKind: "block" | "inline" | "modifier"; }>) => string
```

**Parameters:**

- `customTags` — Custom tag definitions from `ForgeConfig.tsdoc.customTags`.

**Returns:** A JSON string for tsdoc.json.

### `runInitProject`

Runs the full project init flow.  Steps: 1. Detect project environment 2. Write forge-ts.config.ts (if not exists) 3. Write tsdoc.json (if not exists) 4. Wire package.json scripts (idempotent) 5. Validate tsconfig.json strictness 6. Validate package.json 7. Report summary

```typescript
(args: InitProjectArgs) => Promise<CommandOutput<InitProjectResult>>
```

**Parameters:**

- `args` — CLI arguments for the init command.

**Returns:** A typed `CommandOutput<InitProjectResult>`.

```typescript
import { runInitProject } from "@forge-ts/cli/commands/init-project";
const output = await runInitProject({ cwd: process.cwd() });
console.log(output.data.created); // ["forge-ts.config.ts", "tsdoc.json"]
```

### `runDoctor`

Runs the doctor integrity check flow.  Checks: 1. forge-ts.config.ts — exists and loadable 2. tsdoc.json — exists and extends forge-ts/core/tsdoc-preset 3. forge-ts/core — installed in node_modules 4. TypeScript — installed 5. tsconfig.json — exists and has strict mode 6. biome.json — exists (informational) 7. .forge-lock.json — exists, valid, matches config 8. .forge-audit.jsonl — exists and event count 9. .forge-bypass.json — exists and active bypasses 10. Git hooks — forge-ts check in pre-commit

```typescript
(args: DoctorArgs) => Promise<CommandOutput<DoctorResult>>
```

**Parameters:**

- `args` — CLI arguments for the doctor command.

**Returns:** A typed `CommandOutput<DoctorResult>`.

```typescript
import { runDoctor } from "@forge-ts/cli/commands/doctor";
const output = await runDoctor({ cwd: process.cwd(), fix: false });
console.log(output.data.summary); // { passed: 7, warnings: 2, errors: 1, info: 0 }
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

### `runLock`

Runs the lock command: reads current config and creates `.forge-lock.json`.

```typescript
(args: { cwd?: string; }) => Promise<CommandOutput<LockResult>>
```

**Parameters:**

- `args` — CLI arguments for the lock command.

**Returns:** A typed `CommandOutput<LockResult>`.

```typescript
import { runLock } from "@forge-ts/cli/commands/lock";
const output = await runLock({ cwd: process.cwd() });
console.log(output.data.locked.rules); // number of rules locked
```

### `runPrepublish`

Runs the prepublish safety gate: check then build.  If the check step fails, the build step is skipped entirely. Both steps use the same project root (cwd).

```typescript
(args: PrepublishArgs) => Promise<CommandOutput<PrepublishResult>>
```

**Parameters:**

- `args` — CLI arguments for the prepublish command.

**Returns:** A typed `CommandOutput<PrepublishResult>`.

```typescript
import { runPrepublish } from "@forge-ts/cli/commands/prepublish";
const output = await runPrepublish({ cwd: process.cwd() });
if (!output.success) process.exit(1);
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

### `runUnlock`

Runs the unlock command: removes `.forge-lock.json` with a mandatory reason.

```typescript
(args: { cwd?: string; reason: string; }) => Promise<CommandOutput<UnlockResult>>
```

**Parameters:**

- `args` — CLI arguments for the unlock command.

**Returns:** A typed `CommandOutput<UnlockResult>`.

```typescript
import { runUnlock } from "@forge-ts/cli/commands/unlock";
const output = await runUnlock({ cwd: process.cwd(), reason: "Relaxing rules for migration" });
console.log(output.data.success); // true
```

## Types

### `AuditEventType`

Discriminated event types recorded in the audit trail.

```typescript
AuditEventType
```

### `AuditEvent`

A single audit event recorded in the forge-ts audit trail.

```typescript
AuditEvent
```

**Members:**

- `timestamp` — ISO 8601 timestamp of when the event occurred.
- `event` — Discriminated event type.
- `user` — OS username of the actor (falls back to "unknown").
- `reason` — Mandatory for lock/unlock/bypass events; optional otherwise.
- `details` — Event-specific payload.

### `ReadAuditOptions`

Options for reading the audit log.

```typescript
ReadAuditOptions
```

**Members:**

- `limit` — Maximum number of events to return.
- `eventType` — Filter to a single event type.

### `BypassConfig`

Configuration for the bypass budget system.

```typescript
BypassConfig
```

**Members:**

- `dailyBudget` — Maximum number of bypasses allowed per calendar day. Default: 3
- `durationHours` — Duration in hours before a bypass automatically expires. Default: 24

### `BypassRecord`

A single bypass record stored in `.forge-bypass.json`.

```typescript
BypassRecord
```

**Members:**

- `id` — Unique identifier for this bypass.
- `createdAt` — ISO 8601 timestamp when the bypass was created.
- `expiresAt` — ISO 8601 timestamp when the bypass expires.
- `reason` — Mandatory justification for why the bypass was created.
- `rule` — Specific rule code bypassed (e.g., "E009"), or "all" for a blanket bypass.
- `user` — OS username of the actor who created the bypass.

### `Visibility`

Visibility levels for exported symbols. Derived from TSDoc release tags (`@public`, `@beta`, `@internal`).

```typescript
Visibility
```

**Members:**

- `Public`
- `Beta`
- `Internal`
- `Private`

### `ForgeSymbol`

A single extracted and annotated symbol from the TypeScript AST.

```typescript
ForgeSymbol
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
RuleSeverity
```

### `EnforceRules`

Per-rule severity configuration for the TSDoc enforcer. 33 rules across 4 layers: API (E001-E008, W003-W004), Dev (E013-E015, E017-E018, W005-W006, W009), Consumer (E016, W007-W008, W010-W011), LLM Anti-Pattern (E019-E020, W012-W013).

```typescript
EnforceRules
```

**Members:**

- `"require-summary"` — E001: Exported symbol missing TSDoc summary.
- `"require-param"` — E002: Function parameter missing `\@param` tag.
- `"require-returns"` — E003: Non-void function missing `\@returns` tag.
- `"require-example"` — E004: Exported function missing `\@example` block.
- `"require-package-doc"` — E005: Entry point missing `\@packageDocumentation`.
- `"require-class-member-doc"` — E006: Class member missing documentation.
- `"require-interface-member-doc"` — E007: Interface/type member missing documentation.
- `"require-tsdoc-syntax"` — W006: TSDoc syntax parse error (invalid tag, malformed block, etc.).
- `"require-remarks"` — E013: Exported function/class is missing a `\@remarks` block.
- `"require-default-value"` — E014: Optional property with default is missing `\@defaultValue`.
- `"require-type-param"` — E015: Generic symbol is missing `\@typeParam` for its type parameters.
- `"require-see"` — W005: Symbol references other symbols via `\@link` but has no `\@see` tags.
- `"require-release-tag"` — E016: Exported symbol is missing a release tag (`\@public`, `\@beta`, `\@internal`).
- `"require-fresh-guides"` — W007: Guide FORGE:AUTO section references a symbol that no longer exists or has changed.
- `"require-guide-coverage"` — W008: Exported public symbol is not mentioned in any guide page.
- `"require-internal-boundary"` — E017: `\@internal` symbol re-exported through public barrel (index.ts).
- `"require-route-response"` — E018: `\@route`-tagged function missing `\@response` tag.
- `"require-inheritdoc-source"` — W009: `\@inheritDoc` references a symbol that does not exist.
- `"require-migration-path"` — W010: `\@breaking` without `\@migration` path.
- `"require-since"` — W011: New public export missing `\@since` version tag.
- `"require-fresh-examples"` — W013: `\@example` block may be stale — function call arg count mismatches parameter count.
- `"require-no-ts-ignore"` — E019: Non-test file contains ts-ignore or ts-expect-error directive.
- `"require-no-any-in-api"` — E020: Exported symbol has `any` in its public API signature.
- `"require-fresh-link-text"` — W012: `\@link` display text appears stale relative to target summary.

### `ForgeConfig`

Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

```typescript
ForgeConfig
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
- `tsdoc` — TSDoc ecosystem configuration.
- `bypass` — Bypass budget configuration for temporary rule overrides.
- `guides` — Guide generation configuration.
- `guards` — Downstream config drift guards.
- `_configWarnings` — Warnings generated during config loading (e.g., unknown keys). Populated by loadConfig(). Agents should surface these in output.
- `project` — Project metadata — auto-detected from package.json if not provided.

### `ForgeResult`

The result of a forge-ts compilation pass.

```typescript
ForgeResult
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
ForgeError
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
ForgeWarning
```

**Members:**

- `code` — Machine-readable warning code (e.g. "W001").
- `message` — Human-readable description of the warning.
- `filePath` — Absolute path of the file where the warning occurred.
- `line` — 1-based line number.
- `column` — 0-based column.

### `ForgeLockManifest`

Manifest stored in `.forge-lock.json`. Captures a point-in-time snapshot of the project's forge-ts configuration so that future runs can detect when settings have been weakened.

```typescript
ForgeLockManifest
```

**Members:**

- `version` — Schema version of the lock manifest.
- `lockedAt` — ISO-8601 timestamp when the lock was created.
- `lockedBy` — Identifier of the user or agent that created the lock.
- `config` — Snapshot of locked configuration values.

### `LockViolation`

A single violation found when comparing current config against the lock.

```typescript
LockViolation
```

**Members:**

- `field` — Dot-path of the config field that changed (e.g., "rules.require-summary").
- `locked` — The value stored in the lock file.
- `current` — The current value in the live config.
- `message` — Human-readable explanation of the violation.

### `OpenAPISchemaObject`

OpenAPI 3.2 schema object.

```typescript
OpenAPISchemaObject
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
OpenAPIInfoObject
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
OpenAPITagObject
```

**Members:**

- `name` — The name of the tag, used to group operations in the document.
- `description` — An optional description of the tag, supporting CommonMark markdown.

### `OpenAPIPathItemObject`

OpenAPI 3.2 path item object.

```typescript
OpenAPIPathItemObject
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
OpenAPIOperationObject
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
OpenAPIParameterObject
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
OpenAPIEncodingObject
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
OpenAPIMediaTypeObject
```

**Members:**

- `schema` — The schema defining the structure and type of the media type's payload.
- `encoding` — Encoding information for specific properties of a `multipart` or `application/x-www-form-urlencoded` request body.

### `OpenAPIResponseObject`

OpenAPI 3.2 response object.

```typescript
OpenAPIResponseObject
```

**Members:**

- `description` — A required human-readable description of the response, supporting CommonMark markdown.
- `headers` — HTTP headers returned with this response, keyed by header name.
- `content` — The response body content, keyed by media type (e.g., "application/json").

### `OpenAPIDocument`

Complete OpenAPI 3.2 document.

```typescript
OpenAPIDocument
```

**Members:**

- `openapi` — The OpenAPI specification version this document conforms to. Must be "3.2.0".
- `$self` — An optional self-referencing URL for this document, used for tooling and resolution.
- `info` — Metadata about the API including title, version, and description.
- `paths` — The available paths and their operations, keyed by path template (e.g., `/users/\{id\}`).
- `components` — Reusable schema and media type definitions shared across the document.
- `tags` — A list of tags used to group operations, with optional descriptions.

### `ASTWalker`

The return type of `createWalker`.

```typescript
ASTWalker
```

**Members:**

- `walk` — Walk all source files referenced by the configured tsconfig and return one `ForgeSymbol` per exported declaration.

### `SDKProperty`

A single property extracted from an interface or class symbol.

```typescript
SDKProperty
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
SDKType
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
ReferenceEntry
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

### `ForgeLoggerOptions`

Options for configuring the forge-ts logger at CLI startup.

```typescript
ForgeLoggerOptions
```

**Members:**

- `quiet` — Suppress all consola output (--quiet flag).
- `json` — JSON output mode (--json flag). LAFS handles JSON; suppress consola.
- `verbose` — Enable debug-level output (--verbose flag).

### `CommandOutput`

Typed result from a forge-ts command.

```typescript
CommandOutput<T>
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
ForgeCliError
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
ForgeCliWarning
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
OutputFlags
```

**Members:**

- `json` — Emit output as a LAFS JSON envelope instead of human-readable text.
- `human` — Emit output as formatted human-readable text.
- `quiet` — Suppress all output regardless of format.
- `mvi` — MVI verbosity level: "minimal", "standard", or "full".

### `AuditArgs`

Arguments for the `audit` command.

```typescript
AuditArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `limit` — Maximum number of events to display (default: 20).
- `type` — Filter events by type.

### `AuditResult`

Typed result for the `audit` command.

```typescript
AuditResult
```

**Members:**

- `success` — Whether the audit log was read successfully.
- `count` — Number of events returned.
- `events` — The audit events, newest first.

### `GuideSource`

The source heuristic that discovered a guide.

```typescript
GuideSource
```

### `DiscoveredGuide`

A guide discovered from the symbol graph by code analysis heuristics.

```typescript
DiscoveredGuide
```

**Members:**

- `slug` — URL-safe slug (e.g. "configuration", "error-handling").
- `title` — Human-readable title (e.g. "Configuration Guide").
- `description` — Short description of the guide's content.
- `source` — Which heuristic discovered this guide.
- `symbols` — The symbols that contribute content to this guide.

### `MdText`

Inline leaf node: literal text.

```typescript
MdText
```

**Members:**

- `type`
- `value`

### `MdInlineCode`

Inline leaf node: code span.

```typescript
MdInlineCode
```

**Members:**

- `type`
- `value`

### `MdStrong`

Inline container: strong emphasis (bold).

```typescript
MdStrong
```

**Members:**

- `type`
- `children`

### `MdEmphasis`

Inline container: emphasis (italic).

```typescript
MdEmphasis
```

**Members:**

- `type`
- `children`

### `MdLink`

Inline container: hyperlink.

```typescript
MdLink
```

**Members:**

- `type`
- `url`
- `children`

### `MdPhrasing`

Union of all inline (phrasing) content types.

```typescript
MdPhrasing
```

### `MdHeading`

Block node: heading (depth 1-6).

```typescript
MdHeading
```

**Members:**

- `type`
- `depth`
- `children`

### `MdParagraph`

Block node: paragraph.

```typescript
MdParagraph
```

**Members:**

- `type`
- `children`

### `MdCode`

Block node: fenced code block.

```typescript
MdCode
```

**Members:**

- `type`
- `lang`
- `value`

### `MdBlockquote`

Block node: blockquote.

```typescript
MdBlockquote
```

**Members:**

- `type`
- `children`

### `MdHtml`

Block node: raw HTML (including comments).

```typescript
MdHtml
```

**Members:**

- `type`
- `value`

### `MdThematicBreak`

Block node: horizontal rule.

```typescript
MdThematicBreak
```

**Members:**

- `type`

### `MdListItem`

List item container.

```typescript
MdListItem
```

**Members:**

- `type`
- `spread`
- `children`

### `MdList`

Block node: ordered or unordered list.

```typescript
MdList
```

**Members:**

- `type`
- `ordered`
- `spread`
- `children`

### `MdTableCell`

GFM table cell.

```typescript
MdTableCell
```

**Members:**

- `type`
- `children`

### `MdTableRow`

GFM table row.

```typescript
MdTableRow
```

**Members:**

- `type`
- `children`

### `MdTable`

GFM table.

```typescript
MdTable
```

**Members:**

- `type`
- `align`
- `children`

### `MdBlock`

Union of all block content types.

```typescript
MdBlock
```

### `MdRoot`

Document root.

```typescript
MdRoot
```

**Members:**

- `type`
- `children`

### `FrontmatterResult`

Result of parsing frontmatter from markdown/MDX content.

```typescript
FrontmatterResult
```

**Members:**

- `body` — The body content without the frontmatter block.
- `data` — The parsed frontmatter data as a key-value map.

### `DocPage`

A single generated documentation page.

```typescript
DocPage
```

**Members:**

- `path` — Relative path from outDir (e.g., "packages/core/index.md")
- `content` — Page content (Markdown or MDX)
- `frontmatter` — Frontmatter fields
- `stub` — When true, this page is scaffolding intended for human/agent editing. Stub pages are created only on the first build and never overwritten, preserving manual edits across subsequent `forge-ts build` runs. Auto-generated pages (stub=false) are always regenerated from source.

### `SiteGeneratorOptions`

Options controlling the doc site generator.

```typescript
SiteGeneratorOptions
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
SSGTarget
```

### `GeneratedFile`

A file to write to disk during scaffolding or generation.

```typescript
GeneratedFile
```

**Members:**

- `path` — Relative path from the docs output directory.
- `content` — File content (string for text).
- `stub` — When true, this file is scaffolding intended for human/agent editing. Stub files are created only on the first build and never overwritten, preserving manual edits across subsequent `forge-ts build` runs. Callers should check this flag and skip writing if the file exists.

### `SSGStyleGuide`

Style guide configuration for the SSG target.

```typescript
SSGStyleGuide
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
ScaffoldManifest
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
AdapterContext
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
DevServerCommand
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
SSGAdapter
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
MarkdownOptions
```

**Members:**

- `mdx` — Whether to use MDX syntax (default: Markdown).

### `ReadmeSyncOptions`

Options controlling README sync behaviour.

```typescript
ReadmeSyncOptions
```

**Members:**

- `badge` — Include a "Documented with forge-ts" badge above the API table.
- `includeExamples` — Include first

### `SkillPackage`

A generated skill package following the agentskills.io directory structure. Contains SKILL.md plus optional references and scripts files.

```typescript
SkillPackage
```

**Members:**

- `directoryName` — The skill directory name (lowercase, hyphens only, max 64 chars).
- `files` — Files to write inside the skill directory.

### `SSGConfigFile`

A single generated SSG configuration file.

```typescript
SSGConfigFile
```

**Members:**

- `path` — Relative path from outDir (e.g., "mint.json", "_meta.json")
- `content` — File content

### `GenerateOptions`

Options for the generation pipeline.

```typescript
GenerateOptions
```

**Members:**

- `forceStubs` — When true, overwrite stub pages even if they already exist on disk. Normally stub pages (concepts, guides, faq, contributing, changelog) are only created on the first build to preserve manual edits. Use this to reset stubs to their scaffolding state.

### `BuildArgs`

Arguments for the `build` command.

```typescript
BuildArgs
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
BuildStep
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
BuildResult
```

**Members:**

- `success` — Whether the build succeeded.
- `summary` — Aggregate pipeline counts — always present.
- `steps` — Per-step details.
- `generatedFiles` — Files written during the build — present at standard and full MVI levels.

### `BypassCreateResult`

Typed result for the `bypass` command when creating a bypass.

```typescript
BypassCreateResult
```

**Members:**

- `success` — Whether the bypass was successfully created.
- `bypass` — The bypass record that was created.
- `remainingBudget` — Number of remaining bypass slots for today after creation.
- `dailyBudget` — The configured daily budget.

### `BypassStatusResult`

Typed result for the `bypass --status` command.

```typescript
BypassStatusResult
```

**Members:**

- `success` — Always true for status queries.
- `activeBypasses` — Active (non-expired) bypass records.
- `remainingBudget` — Number of remaining bypass slots for today.
- `dailyBudget` — The configured daily budget.
- `expiredRemoved` — Number of expired bypasses that were cleaned up.

### `DeprecatedUsage`

A detected usage of a deprecated symbol.

```typescript
DeprecatedUsage
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
FormatOptions
```

**Members:**

- `colors` — Emit ANSI colour escape sequences when `true`.
- `verbose` — When `true`, include the symbol's type signature alongside each diagnostic so the reader has immediate context.

### `CheckArgs`

Arguments for the `check` command.

```typescript
CheckArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `strict` — Exit with non-zero code on warnings as well as errors.
- `verbose` — Include symbol signatures alongside diagnostics.
- `mvi` — MVI verbosity level for structured output.
- `rule` — Filter errors to a specific rule code (e.g., "E001").
- `file` — Filter errors to a specific file path (substring match).
- `staged` — Only check symbols from git-staged .ts/.tsx files.
- `limit` — Maximum number of file groups to return in byFile (default: 20).
- `offset` — Offset into the byFile list for pagination (default: 0).

### `CheckFileError`

A single error entry within a file group.

```typescript
CheckFileError
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
CheckFileWarning
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
CheckFileGroup
```

**Members:**

- `file` — Absolute path to the source file.
- `errors` — Errors in this file.
- `warnings` — Warnings in this file.

### `CheckRuleCount`

Error breakdown by rule code, sorted by count descending.

```typescript
CheckRuleCount
```

**Members:**

- `code` — Machine-readable rule code (e.g., "E001").
- `rule` — Human-readable rule name (e.g., "require-summary").
- `count` — Number of violations.
- `files` — Number of unique files affected by this rule.

### `CheckTriage`

Triage data for prioritizing fixes. Always present when the check has errors, bounded in size (~9 rules + top 20 files).

```typescript
CheckTriage
```

**Members:**

- `byRule` — Error counts by rule, sorted descending.
- `topFiles` — Top files by error count (max 20).
- `fixOrder` — Suggested fix order: rules sorted by fewest files affected first (quick wins).

### `CheckPage`

Pagination metadata for byFile results.

```typescript
CheckPage
```

**Members:**

- `offset` — Current offset.
- `limit` — Page size.
- `hasMore` — Whether more results exist beyond this page.
- `total` — Total number of file groups (after filters).

### `CheckResult`

Typed result for the `check` command.

```typescript
CheckResult
```

**Members:**

- `success` — Whether the check passed without errors.
- `summary` — Aggregate counts — always present regardless of MVI level.
- `triage` — Triage data for prioritizing fixes — present when errors  0 (except minimal).
- `byFile` — Per-file breakdown — present at standard and full MVI levels, paginated.
- `page` — Pagination metadata when byFile is paginated.
- `filters` — Active filters applied to this result.
- `nextCommand` — CLI command hint for the agent to run next.

### `PkgJson`

Parsed package.json with formatting metadata for lossless round-tripping.

```typescript
PkgJson
```

**Members:**

- `path` — Absolute path to the file.
- `raw` — Raw file content as read from disk.
- `obj` — Parsed JSON object.
- `indent` — Detected indent string (tabs or spaces).
- `trailingNewline` — Whether the original file ended with a newline.

### `HookManager`

Detected hook manager in the project.

```typescript
HookManager
```

### `InitHooksResult`

Result of the `init hooks` command.

```typescript
InitHooksResult
```

**Members:**

- `success` — Whether the hook scaffolding succeeded.
- `hookManager` — The detected or chosen hook manager.
- `summary` — Summary of what was created.
- `files` — Relative paths of all files written.
- `instructions` — Post-scaffold instructions for the user.

```typescript
import { runInitHooks } from "@forge-ts/cli/commands/init-hooks";
const output = await runInitHooks({ cwd: process.cwd() });
console.log(output.data.hookManager); // "husky" | "lefthook" | "none"
```

### `InitHooksArgs`

Arguments for the `init hooks` command.

```typescript
InitHooksArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `force` — Force overwrite existing hook files.
- `mvi` — MVI verbosity level for structured output.

### `InitProjectEnvironment`

Detected project environment from Step 1 of the init flow.

```typescript
InitProjectEnvironment
```

**Members:**

- `packageJsonExists` — Whether package.json exists.
- `tsconfigExists` — Whether tsconfig.json exists.
- `biomeDetected` — Whether biome.json or biome.jsonc exists.
- `typescriptVersion` — TypeScript version from dependencies, or null if not found.
- `hookManager` — Detected hook manager.
- `monorepo` — Whether the project is a monorepo.
- `monorepoType` — Monorepo type if detected.

### `InitProjectResult`

Result of the `init` (project setup) command.

```typescript
InitProjectResult
```

**Members:**

- `success` — Whether the init succeeded.
- `created` — Files that were created.
- `skipped` — Files that already existed and were skipped.
- `warnings` — Warning messages collected during init.
- `environment` — Detected project environment.
- `nextSteps` — Next steps for the user.
- `scriptsAdded` — Scripts that were added to package.json (empty if none were added).

```typescript
import { runInitProject } from "@forge-ts/cli/commands/init-project";
const output = await runInitProject({ cwd: process.cwd() });
console.log(output.data.created); // list of created files
```

### `InitProjectArgs`

Arguments for the `init` (project setup) command.

```typescript
InitProjectArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `mvi` — MVI verbosity level for structured output.

### `DoctorCheckStatus`

Status of a single doctor check.

```typescript
DoctorCheckStatus
```

### `DoctorCheckResult`

Result of a single doctor check.

```typescript
DoctorCheckResult
```

**Members:**

- `name` — Name of the check.
- `status` — Status of the check.
- `message` — Human-readable message.
- `fixable` — Whether this issue can be auto-fixed with --fix.

### `DoctorResult`

Result of the `doctor` command.

```typescript
DoctorResult
```

**Members:**

- `success` — Whether all checks passed without errors.
- `checks` — Individual check results.
- `summary` — Summary counts.
- `fixed` — Files that were fixed (only populated when --fix is used).

```typescript
import { runDoctor } from "@forge-ts/cli/commands/doctor";
const output = await runDoctor({ cwd: process.cwd() });
console.log(output.data.summary.passed); // number of passed checks
```

### `DoctorArgs`

Arguments for the `doctor` command.

```typescript
DoctorArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `fix` — Auto-fix resolvable issues.
- `mvi` — MVI verbosity level for structured output.

### `InitDocsResult`

Result of the `init docs` command.

```typescript
InitDocsResult
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
InitDocsArgs
```

**Members:**

- `target` — SSG target to scaffold. Defaults to `DEFAULT_TARGET`.
- `cwd` — Project root directory (default: cwd).
- `outDir` — Output directory for the doc site (default: outDir from config or ./docs).
- `force` — Overwrite an existing scaffold without prompting.
- `mvi` — MVI verbosity level for structured output.

### `LockResult`

Typed result for the `lock` command.

```typescript
LockResult
```

**Members:**

- `success` — Whether the lock was successfully created.
- `lockFile` — Path to the lock file that was written.
- `lockedAt` — ISO-8601 timestamp when the lock was created.
- `lockedBy` — Identifier of who created the lock.
- `locked` — Summary of what was locked.
- `overwrote` — Whether a previous lock file was overwritten.

### `PrepublishResult`

Typed result for the `prepublish` command.

```typescript
PrepublishResult
```

**Members:**

- `success` — Whether both check and build passed.
- `summary` — Summary of the prepublish pipeline.
- `check` — Result of the check step.
- `build` — Result of the build step (absent if check failed and build was skipped).
- `skippedReason` — If check failed, the reason build was skipped.

```typescript
import { runPrepublish } from "@forge-ts/cli/commands/prepublish";
const output = await runPrepublish({ cwd: process.cwd() });
console.log(output.data.check.success); // true if check passed
console.log(output.data.build?.success); // true if build passed
```

### `PrepublishArgs`

Arguments for the `prepublish` command.

```typescript
PrepublishArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `strict` — Treat warnings as errors during the check step.
- `mvi` — MVI verbosity level for structured output.

### `ExtractedExample`

A single extracted `@example` block ready for test generation.

```typescript
ExtractedExample
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
GeneratorOptions
```

**Members:**

- `cacheDir` — Directory where virtual test files will be written.

### `VirtualTestFile`

A generated virtual test file.

```typescript
VirtualTestFile
```

**Members:**

- `path` — Absolute path where the file will be written.
- `content` — File contents (valid TypeScript).

### `RunResult`

Result of running the generated test files.

```typescript
RunResult
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
TestCaseResult
```

**Members:**

- `name` — The full test name as reported by the runner.
- `passed` — Whether this test passed.
- `sourceFile` — The source file this test was generated from, if determinable.

### `TestArgs`

Arguments for the `test` command.

```typescript
TestArgs
```

**Members:**

- `cwd` — Project root directory (default: cwd).
- `mvi` — MVI verbosity level for structured output.

### `TestFailure`

A single test failure entry, included at standard and full MVI levels.

```typescript
TestFailure
```

**Members:**

- `symbol` — Symbol name where the doctest failed.
- `file` — Absolute path to the source file.
- `line` — 1-based line number of the failing example.
- `message` — Human-readable failure message.

### `TestResult`

Typed result for the `test` command.

```typescript
TestResult
```

**Members:**

- `success` — Whether all doctests passed.
- `summary` — Aggregate counts — always present regardless of MVI level.
- `failures` — Per-failure details — present at standard and full MVI levels.

### `UnlockResult`

Typed result for the `unlock` command.

```typescript
UnlockResult
```

**Members:**

- `success` — Whether the unlock was successful.
- `reason` — The reason provided for unlocking.
- `previousLockedBy` — Who originally locked the config, if known.
- `previousLockedAt` — When the config was originally locked, if known.

## Constants

### `RULE_GROUP_MAP`

Maps each rule key in `EnforceRules` to its TSDoc standardisation group.  - **core**: Tags defined in the TSDoc core standard (`@param`, `@returns`, etc.). - **extended**: Tags from the extended standard (`@example`, `@defaultValue`, etc.). - **discretionary**: Release-tag family (`@public`, `@beta`, `@internal`). - Rules not listed here are **guard rules** and are not affected by group settings.

```typescript
Partial<Record<keyof EnforceRules, "core" | "extended" | "discretionary">>
```

### `forgeLogger`

Pre-configured consola instance branded for forge-ts.

```typescript
import("consola").ConsolaInstance
```

```typescript
import { forgeLogger } from "./forge-logger.js";
forgeLogger.info("Checking 42 files...");
forgeLogger.success("All checks passed");
forgeLogger.warn("Deprecated import detected");
forgeLogger.error("Build failed");
forgeLogger.debug("Resolved config from forge-ts.config.ts");
```

### `auditCommand`

Citty command definition for `forge-ts audit`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly limit: { readonly type: "string"; readonly description: "Maximum events to display (default: 20)"; }; readonly type: { readonly type: "string"; readonly description: "Filter by event type (config.lock, config.unlock, config.drift, bypass.create, bypass.expire, rule.change)"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; }>
```

### `md`

Concise factory functions for building mdast nodes.  Usage:

```typescript
{ text: (value: string) => MdText; inlineCode: (value: string) => MdInlineCode; strong: (...children: MdPhrasing[]) => MdStrong; emphasis: (...children: MdPhrasing[]) => MdEmphasis; link: (url: string, ...children: MdPhrasing[]) => MdLink; heading: (depth: 1 | 2 | 3 | 4 | 5 | 6, ...children: MdPhrasing[]) => MdHeading; paragraph: (...children: MdPhrasing[]) => MdParagraph; code: (lang: string, value: string) => MdCode; blockquote: (...children: MdBlock[]) => MdBlockquote; html: (value: string) => MdHtml; thematicBreak: () => MdThematicBreak; listItem: (...children: MdBlock[]) => MdListItem; list: (items: MdListItem[], ordered?: boolean) => MdList; tableCell: (...children: MdPhrasing[]) => MdTableCell; tableRow: (...cells: MdTableCell[]) => MdTableRow; table: (align: ("left" | "center" | "right" | null)[] | null, ...rows: MdTableRow[]) => MdTable; root: (...children: MdBlock[]) => MdRoot; }
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
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly "skip-api": { readonly type: "boolean"; readonly description: "Skip OpenAPI generation"; readonly default: false; }; readonly "skip-gen": { readonly type: "boolean"; readonly description: "Skip doc generation"; readonly default: false; }; readonly "force-stubs": { readonly type: "boolean"; readonly description: "Overwrite stub pages even if they exist (reset to scaffolding)"; readonly default: false; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

### `bypassCommand`

Citty command definition for `forge-ts bypass`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly reason: { readonly type: "string"; readonly description: "Mandatory justification for bypassing rules"; }; readonly rule: { readonly type: "string"; readonly description: "Specific rule code to bypass (e.g., \"E009\"). Defaults to \"all\""; }; readonly status: { readonly type: "boolean"; readonly description: "Show active bypasses and remaining budget"; readonly default: false; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; }>
```

### `checkCommand`

Citty command definition for `forge-ts check`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly strict: { readonly type: "boolean"; readonly description: "Treat warnings as errors"; readonly default: false; }; readonly verbose: { readonly type: "boolean"; readonly description: "Show detailed output"; readonly default: false; }; readonly rule: { readonly type: "string"; readonly description: "Filter by rule code (e.g., E001, W004)"; }; readonly file: { readonly type: "string"; readonly description: "Filter by file path (substring match)"; }; readonly staged: { readonly type: "boolean"; readonly description: "Only check symbols from git-staged .ts/.tsx files"; readonly default: false; }; readonly limit: { readonly type: "string"; readonly description: "Max file groups in output (default: 20)"; }; readonly offset: { readonly type: "string"; readonly description: "Skip N file groups for pagination (default: 0)"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

### `docsDevCommand`

Citty command definition for `forge-ts docs dev`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly target: { readonly type: "string"; readonly description: "SSG target override (reads from config by default)"; }; readonly port: { readonly type: "string"; readonly description: "Port for the dev server"; }; }>
```

```typescript
import { docsDevCommand } from "@forge-ts/cli";
```

### `initHooksCommand`

Citty command definition for `forge-ts init hooks`.  Scaffolds git hook integration for the project by detecting the hook manager (husky or lefthook) and generating pre-commit hooks.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly force: { readonly type: "boolean"; readonly description: "Overwrite existing hook files"; readonly default: false; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

```typescript
import { initHooksCommand } from "@forge-ts/cli/commands/init-hooks";
// Registered as a subcommand of `forge-ts init`
```

### `initProjectCommand`

Citty command definition for `forge-ts init` (bare — full project setup).  Detects the project environment, writes default configuration files, validates tsconfig/package.json, and reports a summary.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

```typescript
import { initProjectCommand } from "@forge-ts/cli/commands/init-project";
// Registered as the default handler for `forge-ts init`
```

### `doctorCommand`

Citty command definition for `forge-ts doctor`.  Performs project integrity checks and optionally auto-fixes resolvable issues with `--fix`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly fix: { readonly type: "boolean"; readonly description: "Auto-fix resolvable issues"; readonly default: false; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

```typescript
import { doctorCommand } from "@forge-ts/cli/commands/doctor";
// Registered as a top-level subcommand of `forge-ts`
```

### `initDocsCommand`

Citty command definition for `forge-ts init docs`.  Scaffolds a complete documentation site for the target SSG platform. Use `--json` for LAFS JSON envelope output (agent/CI-friendly).

```typescript
import("citty").CommandDef<{ readonly target: { readonly type: "string"; readonly description: `SSG target: ${string} (default: docusaurus)` | `SSG target: ${string} (default: mintlify)` | `SSG target: ${string} (default: nextra)` | `SSG target: ${string} (default: vitepress)`; }; readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly "out-dir": { readonly type: "string"; readonly description: "Output directory for doc site (default: ./docs)"; }; readonly force: { readonly type: "boolean"; readonly description: "Overwrite existing scaffold"; readonly default: false; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

```typescript
import { initDocsCommand } from "@forge-ts/cli/commands/init-docs";
// Registered automatically as a subcommand of `forge-ts init`
```

### `initCommand`

Citty command definition for `forge-ts init`.  Exposes subcommands for scaffolding project artefacts.

```typescript
import("citty").CommandDef<import("citty").ArgsDef>
```

```typescript
import { initCommand } from "@forge-ts/cli/commands/init-docs";
// Registered automatically as a subcommand of `forge-ts`
```

### `lockCommand`

Citty command definition for `forge-ts lock`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; }>
```

### `prepublishCommand`

Citty command definition for `forge-ts prepublish`.  Runs check then build as a publish safety gate. Add to package.json as: `"prepublishOnly": "forge-ts prepublish"`

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly strict: { readonly type: "boolean"; readonly description: "Treat warnings as errors during check"; readonly default: false; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

```typescript
import { prepublishCommand } from "@forge-ts/cli/commands/prepublish";
// Registered as `forge-ts prepublish`
```

### `testCommand`

Citty command definition for `forge-ts test`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; readonly mvi: { readonly type: "string"; readonly description: "MVI verbosity level: minimal, standard, full"; }; }>
```

### `unlockCommand`

Citty command definition for `forge-ts unlock`.

```typescript
import("citty").CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly reason: { readonly type: "string"; readonly description: "Mandatory reason for unlocking (audit trail)"; readonly required: true; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { readonly type: "boolean"; readonly description: "Output as formatted text (default for TTY)"; readonly default: false; }; readonly quiet: { readonly type: "boolean"; readonly description: "Suppress non-essential output"; readonly default: false; }; }>
```
