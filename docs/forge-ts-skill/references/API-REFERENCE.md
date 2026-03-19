# forge-ts — API Reference

Full function signatures, type property tables, and all @example blocks.

## Exports

| Symbol | Signature | Description |
|--------|-----------|-------------|
| `Visibility` | `typeof Visibility` | Visibility levels for exported symbols. Derived from TSDoc release tags (public, beta, internal). |
| `ForgeSymbol` | `any` | A single extracted and annotated symbol from the TypeScript AST. |
| `RuleSeverity` | `any` | Severity level for an individual enforcement rule. - `"error"` — violation fails the build. - `"warn"`  — violation is reported but does not fail the build. - `"off"`   — rule is disabled entirely. |
| `EnforceRules` | `any` | Per-rule severity configuration for the TSDoc enforcer. Each key corresponds to one of the E001–E007 rule codes. |
| `ForgeConfig` | `any` | Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json. |
| `ForgeResult` | `any` | The result of a forge-ts compilation pass. |
| `ForgeError` | `any` | A diagnostic error produced during a forge-ts run. |
| `ForgeWarning` | `any` | A diagnostic warning produced during a forge-ts run. |
| `defaultConfig()` | `(rootDir: string) => ForgeConfig` | Constructs a sensible default  rooted at `rootDir`. |
| `loadConfig()` | `(rootDir?: string | undefined) => Promise<ForgeConfig>` | Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found) |
| `OpenAPISchemaObject` | `any` | OpenAPI 3.2 schema object. |
| `OpenAPIInfoObject` | `any` | OpenAPI 3.2 info object. |
| `OpenAPITagObject` | `any` | OpenAPI 3.2 tag object. |
| `OpenAPIPathItemObject` | `any` | OpenAPI 3.2 path item object. |
| `OpenAPIOperationObject` | `any` | OpenAPI 3.2 operation object. |
| `OpenAPIParameterObject` | `any` | OpenAPI 3.2 parameter object. |
| `OpenAPIEncodingObject` | `any` | OpenAPI 3.2 encoding object. |
| `OpenAPIMediaTypeObject` | `any` | OpenAPI 3.2 media type object. |
| `OpenAPIResponseObject` | `any` | OpenAPI 3.2 response object. |
| `OpenAPIDocument` | `any` | Complete OpenAPI 3.2 document. |
| `resolveVisibility()` | `(tags: Record<string, string[]> | undefined) => Visibility` | Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  →  2. `@beta`      →  3. `@public`    →  4. (no tag)     →  (default for exports) |
| `meetsVisibility()` | `(candidate: Visibility, minVisibility: Visibility) => boolean` | Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not. |
| `filterByVisibility()` | `(symbols: ForgeSymbol[], minVisibility: Visibility) => ForgeSymbol[]` | Filters an array of  objects to only include symbols whose visibility meets or exceeds `minVisibility`. |
| `ASTWalker` | `any` | The return type of . |
| `createWalker()` | `(config: ForgeConfig) => ASTWalker` | Creates an  configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each . |
| `signatureToSchema()` | `(signature: string) => OpenAPISchemaObject` | Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse. |
| `SDKProperty` | `any` | A single property extracted from an interface or class symbol. |
| `SDKType` | `any` | An SDK type descriptor extracted from the symbol graph. |
| `extractSDKTypes()` | `(symbols: ForgeSymbol[]) => SDKType[]` | Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of  objects.  Only exported symbols whose visibility is not  or  are included. |
| `generateOpenAPISpec()` | `(config: ForgeConfig, sdkTypes: SDKType[], symbols?: ForgeSymbol[]) => OpenAPIDocument` | Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release. |
| `ReferenceEntry` | `any` | A single entry in the generated API reference. |
| `buildReference()` | `(symbols: ForgeSymbol[]) => ReferenceEntry[]` | Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with  or  are excluded from the top-level results. Children with private/internal visibility are also filtered out. |
| `generateApi()` | `(config: ForgeConfig) => Promise<ForgeResult>` | Runs the API generation pipeline: walk → extract → generate → write. |
| `DocPage` | `any` | A single generated documentation page. |
| `SiteGeneratorOptions` | `any` | Options controlling the doc site generator. |
| `groupSymbolsByPackage()` | `(symbols: ForgeSymbol[], rootDir: string) => Map<string, ForgeSymbol[]>` | Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name. |
| `generateDocSite()` | `(symbolsByPackage: Map<string, ForgeSymbol[]>, config: ForgeConfig, options: SiteGeneratorOptions) => DocPage[]` | Generates a full multi-page documentation site from symbols grouped by package.  Follows a 5-stage information architecture: 1. ORIENT — Landing page, Getting Started 2. LEARN — Concepts (stub) 3. BUILD — Guides (stub) 4. REFERENCE — API Reference, Types, Configuration, Changelog 5. COMMUNITY — FAQ, Contributing (stubs) |
| `SSGTarget` | `any` | Supported SSG target identifiers. |
| `GeneratedFile` | `any` | A file to write to disk during scaffolding or generation. |
| `SSGStyleGuide` | `any` | Style guide configuration for the SSG target. |
| `ScaffoldManifest` | `any` | Scaffold manifest describing what `init docs` creates. |
| `AdapterContext` | `any` | Context passed to adapter methods. |
| `DevServerCommand` | `any` | Command to start a local dev server for doc preview. |
| `SSGAdapter` | `any` | The central SSG adapter interface. Every doc platform provider implements this contract. One file per provider. No shared mutable state. |
| `registerAdapter()` | `(adapter: SSGAdapter) => void` | Register an SSG adapter. Called once per provider at module load time. |
| `getAdapter()` | `(target: SSGTarget) => SSGAdapter` | Get a registered adapter by target name. Throws if the target is not registered. |
| `getAvailableTargets()` | `() => SSGTarget[]` | Get all registered adapter targets. |
| `DEFAULT_TARGET` | `SSGTarget` | The default SSG target when none is specified. |
| `mintlifyAdapter` | `SSGAdapter` | Mintlify SSG adapter. Implements the  contract for the Mintlify platform. |
| `docusaurusAdapter` | `SSGAdapter` | Docusaurus SSG adapter. Implements the  contract for the Docusaurus platform. |
| `nextraAdapter` | `SSGAdapter` | Nextra SSG adapter (v4, App Router). Implements the  contract for the Nextra platform. |
| `vitepressAdapter` | `SSGAdapter` | VitePress SSG adapter. Implements the  contract for the VitePress platform. |
| `generateLlmsTxt()` | `(symbols: ForgeSymbol[], config: ForgeConfig) => string` | Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation. |
| `generateLlmsFullTxt()` | `(symbols: ForgeSymbol[], config: ForgeConfig) => string` | Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context. |
| `MarkdownOptions` | `any` | Options controlling Markdown output. |
| `generateMarkdown()` | `(symbols: ForgeSymbol[], config: ForgeConfig, options?: MarkdownOptions) => string` | Generates a Markdown (or MDX) string from a list of symbols. |
| `ReadmeSyncOptions` | `any` | Options controlling README sync behaviour. |
| `syncReadme()` | `(readmePath: string, symbols: ForgeSymbol[], options?: ReadmeSyncOptions) => Promise<boolean>` | Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file. |
| `SkillPackage` | `any` | A generated skill package following the agentskills.io directory structure. Contains SKILL.md plus optional references and scripts files. |
| `generateSkillPackage()` | `(symbols: ForgeSymbol[], config: ForgeConfig) => SkillPackage` | Generates a skill package directory following the agentskills.io specification (https://agentskills.io/specification).  The package includes: - `SKILL.md` — metadata frontmatter + instructional content (under 500 lines) - `references/API-REFERENCE.md` — full API signatures and examples - `references/CONFIGURATION.md` — full config type documentation - `scripts/check.sh` — helper script for TSDoc validation |
| `generateSkillMd()` | `(symbols: ForgeSymbol[], config: ForgeConfig) => string` | Generates a SKILL.md string following the Agent Skills specification (https://agentskills.io/specification).  The file includes YAML frontmatter with `name` and `description` fields for discovery-phase loading, followed by instructional content for activation-phase loading. |
| `SSGConfigFile` | `any` | A single generated SSG configuration file. |
| `generateSSGConfigs()` | `(pages: DocPage[], target: "docusaurus" | "mintlify" | "nextra" | "vitepress", projectName: string) => SSGConfigFile[]` | Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files). |
| `generate()` | `(config: ForgeConfig) => Promise<ForgeResult>` | Runs the full generation pipeline: walk → render → write. |
| `Logger` | `any` | A minimal structured logger used throughout the CLI commands. |
| `createLogger()` | `(options?: { colors?: boolean | undefined; } | undefined) => Logger` | Creates a  instance. |
| `CommandOutput` | `any` | Typed result from a forge-ts command. |
| `ForgeCliError` | `any` | Structured error for CLI commands. |
| `ForgeCliWarning` | `any` | Structured warning for CLI commands. |
| `OutputFlags` | `any` | Output format flags passed through from citty args. |
| `emitResult()` | `<T>(output: CommandOutput<T>, flags: OutputFlags, humanFormatter: (data: T, output: CommandOutput<T>) => string) => void` | Wraps a command result in a LAFS envelope and emits it.  - JSON mode: writes the projected envelope to stdout as JSON. - Human mode: calls the provided formatter function. - Quiet mode: suppresses all output regardless of format. |
| `resolveExitCode()` | `(output: CommandOutput<unknown>) => number` | Returns the LAFS-compliant exit code for a command output. |
| `BuildArgs` | `any` | Arguments for the `build` command. |
| `BuildStep` | `any` | A single step in the build pipeline. |
| `BuildResult` | `any` | Typed result for the `build` command. |
| `runBuild()` | `(args: BuildArgs) => Promise<CommandOutput<BuildResult>>` | Runs the full build pipeline and returns a typed command output. |
| `buildCommand` | `CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly "skip-api": { readonly type: "boolean"; readonly description: "Skip OpenAPI generation"; readonly default: false; }; ... 4 more ...; readonly mvi: { ...; }; }>` | Citty command definition for `forge-ts build`. |
| `DeprecatedUsage` | `any` | A detected usage of a deprecated symbol. |
| `findDeprecatedUsages()` | `(symbols: ForgeSymbol[]) => DeprecatedUsage[]` | Scans symbols for imports of deprecated exports from other packages. |
| `enforce()` | `(config: ForgeConfig) => Promise<ForgeResult>` | Runs the TSDoc enforcement pass against a project.  The enforcer walks all exported symbols that meet the configured minimum visibility threshold and emits diagnostics for any documentation deficiencies it finds.  ### Error codes | Code | Severity | Condition | |------|----------|-----------| | E001 | error    | Exported symbol is missing a TSDoc summary. | | E002 | error    | Function/method parameter lacks a `@param` tag. | | E003 | error    | Non-void function/method lacks a `@returns` tag. | | E004 | error    | Exported function/method is missing an `@example` block. | | E005 | error    | Package entry point (index.ts) is missing `@packageDocumentation`. | | E006 | error    | Public/protected class member is missing a TSDoc comment. | | E007 | error    | Interface/type alias property is missing a TSDoc comment. | | W001 | warning  | TSDoc comment contains parse errors. | | W002 | warning  | Function body throws but has no `@throws` tag. | | W003 | warning  | `@deprecated` tag is present without explanation. |  When `config.enforce.strict` is `true` all warnings are promoted to errors. |
| `FormatOptions` | `any` | Options that control how  renders its output. |
| `formatResults()` | `(result: ForgeResult, options: FormatOptions) => string` | Formats a  into a human-readable string suitable for printing to a terminal.  Diagnostics are grouped by source file.  Each file heading shows the relative-ish path, followed by indented error and warning lines.  A summary line is appended at the end. |
| `CheckArgs` | `any` | Arguments for the `check` command. |
| `CheckFileError` | `any` | A single error entry within a file group, included at standard and full MVI levels. |
| `CheckFileWarning` | `any` | A single warning entry within a file group, included at standard and full MVI levels. |
| `CheckFileGroup` | `any` | Errors and warnings grouped by file, included at standard and full MVI levels. |
| `CheckResult` | `any` | Typed result for the `check` command. |
| `runCheck()` | `(args: CheckArgs) => Promise<CommandOutput<CheckResult>>` | Runs the TSDoc enforcement pass and returns a typed command output. |
| `checkCommand` | `CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly strict: { readonly type: "boolean"; readonly description: "Treat warnings as errors"; readonly default: false; }; ... 4 more ...; readonly mvi: { ...; }; }>` | Citty command definition for `forge-ts check`. |
| `runDocsDev()` | `(args: { cwd?: string | undefined; target?: string | undefined; port?: string | undefined; }) => Promise<void>` | Starts the local dev server for the configured SSG target.  Reads `gen.ssgTarget` from the forge-ts config, resolves the adapter, and spawns the platform's dev server in the output directory. |
| `docsDevCommand` | `CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly target: { readonly type: "string"; readonly description: "SSG target override (reads from config by default)"; }; readonly port: { ...; }; }>` | Citty command definition for `forge-ts docs dev`. |
| `InitDocsResult` | `any` | Result of the `init docs` command. |
| `InitDocsArgs` | `any` | Arguments for the `init docs` command. |
| `runInitDocs()` | `(args: InitDocsArgs) => Promise<CommandOutput<InitDocsResult>>` | Scaffolds a documentation site for the target SSG platform.  Resolves the target from args, validates it, checks for an existing scaffold, calls the adapter's `scaffold()` method, and writes all files produced by the manifest to `outDir`. |
| `initDocsCommand` | `CommandDef<{ readonly target: { readonly type: "string"; readonly description: `SSG target: ${string} (default: docusaurus)` | `SSG target: ${string} (default: mintlify)` | `SSG target: ${string} (default: nextra)` | `SSG target: ${string} (default: vitepress)`; }; readonly cwd: { readonly type: "string"; readonly d...` | Citty command definition for `forge-ts init docs`.  Scaffolds a complete documentation site for the target SSG platform. Use `--json` for LAFS JSON envelope output (agent/CI-friendly). |
| `initCommand` | `CommandDef<ArgsDef>` | Citty command definition for `forge-ts init`.  Exposes subcommands for scaffolding project artefacts. |
| `ExtractedExample` | `any` | A single extracted `@example` block ready for test generation. |
| `extractExamples()` | `(symbols: ForgeSymbol[]) => ExtractedExample[]` | Extracts all `@example` blocks from a list of  objects. |
| `GeneratorOptions` | `any` | Options for virtual test file generation. |
| `VirtualTestFile` | `any` | A generated virtual test file. |
| `generateTestFiles()` | `(examples: ExtractedExample[], options: GeneratorOptions) => VirtualTestFile[]` | Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map. |
| `RunResult` | `any` | Result of running the generated test files. |
| `TestCaseResult` | `any` | The result of a single test case. |
| `runTests()` | `(files: VirtualTestFile[]) => Promise<RunResult>` | Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`). |
| `doctest()` | `(config: ForgeConfig) => Promise<ForgeResult>` | Runs the full doctest pipeline: extract → generate → run. |
| `TestArgs` | `any` | Arguments for the `test` command. |
| `TestFailure` | `any` | A single test failure entry, included at standard and full MVI levels. |
| `TestResult` | `any` | Typed result for the `test` command. |
| `runTest()` | `(args: TestArgs) => Promise<CommandOutput<TestResult>>` | Runs the doctest pipeline and returns a typed command output. |
| `testCommand` | `CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly json: { readonly type: "boolean"; readonly description: "Output as LAFS JSON envelope (agent-friendly)"; readonly default: false; }; readonly human: { ...; }; readonly quiet: { ...; }; readonly mvi: { .....` | Citty command definition for `forge-ts test`. |

## `defaultConfig`

Constructs a sensible default  rooted at `rootDir`.

**Signature:**

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

## `loadConfig`

Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found)

**Signature:**

```typescript
(rootDir?: string | undefined) => Promise<ForgeConfig>
```

**Parameters:**

- `rootDir` — The project root to search for config.  Defaults to `process.cwd()`.

**Returns:** A fully-resolved .

```typescript
import { loadConfig } from "@forge-ts/core";
const config = await loadConfig("/path/to/project");
// config is fully resolved with defaults
```

## `resolveVisibility`

Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  →  2. `@beta`      →  3. `@public`    →  4. (no tag)     →  (default for exports)

**Signature:**

```typescript
(tags: Record<string, string[]> | undefined) => Visibility
```

**Parameters:**

- `tags` — The parsed `tags` map from `ForgeSymbol.documentation`.

**Returns:** The resolved  value.

```typescript
import { resolveVisibility } from "@forge-ts/core";
const vis = resolveVisibility({ internal: [] });
// vis === Visibility.Internal
```

## `meetsVisibility`

Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not.

**Signature:**

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

## `filterByVisibility`

Filters an array of  objects to only include symbols whose visibility meets or exceeds `minVisibility`.

**Signature:**

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

## `createWalker`

Creates an  configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each .

**Signature:**

```typescript
(config: ForgeConfig) => ASTWalker
```

**Parameters:**

- `config` — The resolved  for the project.

**Returns:** An  instance whose `walk()` method performs the extraction.

```typescript
import { loadConfig, createWalker } from "@forge-ts/core";
const config = await loadConfig();
const walker = createWalker(config);
const symbols = walker.walk();
console.log(`Found ${symbols.length} symbols`);
```

## `signatureToSchema`

Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse.

**Signature:**

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

## `extractSDKTypes`

Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of  objects.  Only exported symbols whose visibility is not  or  are included.

**Signature:**

```typescript
(symbols: ForgeSymbol[]) => SDKType[]
```

**Parameters:**

- `symbols` — The symbols produced by the core AST walker.

**Returns:** An array of  objects for public-facing type definitions.

```typescript
import { extractSDKTypes } from "@forge-ts/api";
const sdkTypes = extractSDKTypes(symbols);
console.log(sdkTypes.length); // number of public SDK types
```

## `generateOpenAPISpec`

Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release.

**Signature:**

```typescript
(config: ForgeConfig, sdkTypes: SDKType[], symbols?: ForgeSymbol[]) => OpenAPIDocument
```

**Parameters:**

- `config` — The resolved .
- `sdkTypes` — SDK types to include as component schemas.
- `symbols` — Raw symbols used to extract HTTP route paths from `@route` tags.

**Returns:** An  object.

```typescript
import { generateOpenAPISpec } from "@forge-ts/api";
import { extractSDKTypes } from "@forge-ts/api";
const spec = generateOpenAPISpec(config, extractSDKTypes(symbols), symbols);
console.log(spec.openapi); // "3.2.0"
```

## `buildReference`

Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with  or  are excluded from the top-level results. Children with private/internal visibility are also filtered out.

**Signature:**

```typescript
(symbols: ForgeSymbol[]) => ReferenceEntry[]
```

**Parameters:**

- `symbols` — All symbols from the AST walker.

**Returns:** An array of  objects sorted by name.

```typescript
import { buildReference } from "@forge-ts/api";
const entries = buildReference(symbols);
console.log(entries[0].name); // first symbol name, alphabetically
```

## `generateApi`

Runs the API generation pipeline: walk → extract → generate → write.

**Signature:**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved  for the project.

**Returns:** A  with success/failure and any diagnostics.

```typescript
import { generateApi } from "@forge-ts/api";
const result = await generateApi(config);
console.log(result.success); // true if spec was written successfully
```

## `groupSymbolsByPackage`

Groups symbols by their package based on file path.  For monorepos (symbols under `packages/<name>/`) the package name is derived from the directory segment immediately after `packages/`. For non-monorepo projects all symbols fall under the project name.

**Signature:**

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

## `generateDocSite`

Generates a full multi-page documentation site from symbols grouped by package.  Follows a 5-stage information architecture: 1. ORIENT — Landing page, Getting Started 2. LEARN — Concepts (stub) 3. BUILD — Guides (stub) 4. REFERENCE — API Reference, Types, Configuration, Changelog 5. COMMUNITY — FAQ, Contributing (stubs)

**Signature:**

```typescript
(symbolsByPackage: Map<string, ForgeSymbol[]>, config: ForgeConfig, options: SiteGeneratorOptions) => DocPage[]
```

**Parameters:**

- `symbolsByPackage` — Symbols grouped by package name.
- `config` — The resolved .
- `options` — Site generation options.

**Returns:** An array of  objects ready to be written to disk.

```typescript
import { generateDocSite, groupSymbolsByPackage } from "@forge-ts/gen";
const grouped = groupSymbolsByPackage(symbols, config.rootDir);
const pages = generateDocSite(grouped, config, { format: "markdown", projectName: "my-project" });
console.log(pages.length > 0); // true
```

## `SSGAdapter`

The central SSG adapter interface. Every doc platform provider implements this contract. One file per provider. No shared mutable state.

**Signature:**

```typescript
any
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
const files = adapter.transformPages(pages, context);
```

## `registerAdapter`

Register an SSG adapter. Called once per provider at module load time.

**Signature:**

```typescript
(adapter: SSGAdapter) => void
```

**Parameters:**

- `adapter` — The adapter to register.

```typescript
import { registerAdapter } from "@forge-ts/gen";
registerAdapter(mintlifyAdapter);
```

## `getAdapter`

Get a registered adapter by target name. Throws if the target is not registered.

**Signature:**

```typescript
(target: SSGTarget) => SSGAdapter
```

**Parameters:**

- `target` — The SSG target identifier.

**Returns:** The registered  for the given target.

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
```

## `getAvailableTargets`

Get all registered adapter targets.

**Signature:**

```typescript
() => SSGTarget[]
```

**Returns:** An array of all registered  identifiers.

```typescript
import { getAvailableTargets } from "@forge-ts/gen";
const targets = getAvailableTargets(); // ["mintlify", "docusaurus", ...]
```

## `mintlifyAdapter`

Mintlify SSG adapter. Implements the  contract for the Mintlify platform.

**Signature:**

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("mintlify");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "docs.json"
```

## `docusaurusAdapter`

Docusaurus SSG adapter. Implements the  contract for the Docusaurus platform.

**Signature:**

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("docusaurus");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "sidebars.ts"
```

## `nextraAdapter`

Nextra SSG adapter (v4, App Router). Implements the  contract for the Nextra platform.

**Signature:**

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("nextra");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // "content/_meta.js"
```

## `vitepressAdapter`

VitePress SSG adapter. Implements the  contract for the VitePress platform.

**Signature:**

```typescript
SSGAdapter
```

```typescript
import { getAdapter } from "@forge-ts/gen";
const adapter = getAdapter("vitepress");
const configs = adapter.generateConfig(context);
console.log(configs[0].path); // ".vitepress/config.mts"
```

## `generateLlmsTxt`

Generates an `llms.txt` routing manifest from the extracted symbols.  The file follows the llms.txt specification: a compact, structured overview designed to help large language models navigate a project's documentation.

**Signature:**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters:**

- `symbols` — The symbols to include.
- `config` — The resolved .

**Returns:** The generated `llms.txt` content as a string.

```typescript
import { generateLlmsTxt } from "@forge-ts/gen";
const txt = generateLlmsTxt(symbols, config);
console.log(txt.startsWith("# ")); // true
```

## `generateLlmsFullTxt`

Generates an `llms-full.txt` dense context file from the extracted symbols.  Unlike `llms.txt`, this file contains complete documentation for every exported symbol, intended for LLM ingestion that requires full context.

**Signature:**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => string
```

**Parameters:**

- `symbols` — The symbols to include.
- `config` — The resolved .

**Returns:** The generated `llms-full.txt` content as a string.

```typescript
import { generateLlmsFullTxt } from "@forge-ts/gen";
const fullTxt = generateLlmsFullTxt(symbols, config);
console.log(fullTxt.includes("Full Context")); // true
```

## `generateMarkdown`

Generates a Markdown (or MDX) string from a list of symbols.

**Signature:**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig, options?: MarkdownOptions) => string
```

**Parameters:**

- `symbols` — The symbols to document.
- `config` — The resolved .
- `options` — Rendering options.

**Returns:** The generated Markdown string.

```typescript
import { generateMarkdown } from "@forge-ts/gen";
const md = generateMarkdown(symbols, config, { mdx: false });
console.log(md.startsWith("# API Reference")); // true
```

## `syncReadme`

Injects a summary of exported symbols into a `README.md` file.  The content is placed between `<!-- forge-ts:start -->` and `<!-- forge-ts:end -->` comment markers.  If neither marker exists, the summary is appended to the end of the file.

**Signature:**

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

## `generateSkillPackage`

Generates a skill package directory following the agentskills.io specification (https://agentskills.io/specification).  The package includes: - `SKILL.md` — metadata frontmatter + instructional content (under 500 lines) - `references/API-REFERENCE.md` — full API signatures and examples - `references/CONFIGURATION.md` — full config type documentation - `scripts/check.sh` — helper script for TSDoc validation

**Signature:**

```typescript
(symbols: ForgeSymbol[], config: ForgeConfig) => SkillPackage
```

**Parameters:**

- `symbols` — All symbols from the project.
- `config` — The resolved forge-ts config.

**Returns:** A  describing the directory and its files.

```typescript
import { generateSkillPackage } from "@forge-ts/gen";
const pkg = generateSkillPackage(symbols, config);
console.log(pkg.directoryName); // "my-lib"
console.log(pkg.files.map(f => f.path));
// ["SKILL.md", "references/API-REFERENCE.md", ...]
```

## `generateSkillMd`

Generates a SKILL.md string following the Agent Skills specification (https://agentskills.io/specification).  The file includes YAML frontmatter with `name` and `description` fields for discovery-phase loading, followed by instructional content for activation-phase loading.

**Signature:**

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

## `generateSSGConfigs`

Generate navigation configuration file(s) for the given SSG target.  Returns one file for most targets, but multiple files for Nextra (which uses per-directory `_meta.json` files).

**Signature:**

```typescript
(pages: DocPage[], target: "docusaurus" | "mintlify" | "nextra" | "vitepress", projectName: string) => SSGConfigFile[]
```

**Parameters:**

- `pages` — The  array produced by `generateDocSite`.
- `target` — The SSG target.
- `projectName` — The project name (used in config metadata).

**Returns:** An array of  objects ready to be written to disk.

```typescript
import { generateSSGConfigs } from "@forge-ts/gen";
const configs = generateSSGConfigs(pages, "vitepress", "my-project");
console.log(configs[0].path); // ".vitepress/sidebar.json"
```

## `generate`

Runs the full generation pipeline: walk → render → write.

**Signature:**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved  for the project.

**Returns:** A  describing the outcome.

```typescript
import { generate } from "@forge-ts/gen";
const result = await generate(config);
console.log(result.success); // true if all files were written
```

## `emitResult`

Wraps a command result in a LAFS envelope and emits it.  - JSON mode: writes the projected envelope to stdout as JSON. - Human mode: calls the provided formatter function. - Quiet mode: suppresses all output regardless of format.

**Signature:**

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

## `runBuild`

Runs the full build pipeline and returns a typed command output.

**Signature:**

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

## `enforce`

Runs the TSDoc enforcement pass against a project.  The enforcer walks all exported symbols that meet the configured minimum visibility threshold and emits diagnostics for any documentation deficiencies it finds.  ### Error codes | Code | Severity | Condition | |------|----------|-----------| | E001 | error    | Exported symbol is missing a TSDoc summary. | | E002 | error    | Function/method parameter lacks a `@param` tag. | | E003 | error    | Non-void function/method lacks a `@returns` tag. | | E004 | error    | Exported function/method is missing an `@example` block. | | E005 | error    | Package entry point (index.ts) is missing `@packageDocumentation`. | | E006 | error    | Public/protected class member is missing a TSDoc comment. | | E007 | error    | Interface/type alias property is missing a TSDoc comment. | | W001 | warning  | TSDoc comment contains parse errors. | | W002 | warning  | Function body throws but has no `@throws` tag. | | W003 | warning  | `@deprecated` tag is present without explanation. |  When `config.enforce.strict` is `true` all warnings are promoted to errors.

**Signature:**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved  for the project.

**Returns:** A  describing which symbols passed or failed.

```typescript
import { loadConfig } from "@forge-ts/core";
import { enforce } from "@forge-ts/enforcer";
const config = await loadConfig();
const result = await enforce(config);
if (!result.success) {
  console.error(`${result.errors.length} errors found`);
}
```

## `formatResults`

Formats a  into a human-readable string suitable for printing to a terminal.  Diagnostics are grouped by source file.  Each file heading shows the relative-ish path, followed by indented error and warning lines.  A summary line is appended at the end.

**Signature:**

```typescript
(result: ForgeResult, options: FormatOptions) => string
```

**Parameters:**

- `result` — The result produced by .
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

## `runCheck`

Runs the TSDoc enforcement pass and returns a typed command output.

**Signature:**

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

## `runDocsDev`

Starts the local dev server for the configured SSG target.  Reads `gen.ssgTarget` from the forge-ts config, resolves the adapter, and spawns the platform's dev server in the output directory.

**Signature:**

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

## `docsDevCommand`

Citty command definition for `forge-ts docs dev`.

**Signature:**

```typescript
CommandDef<{ readonly cwd: { readonly type: "string"; readonly description: "Project root directory"; }; readonly target: { readonly type: "string"; readonly description: "SSG target override (reads from config by default)"; }; readonly port: { ...; }; }>
```

```typescript
import { docsDevCommand } from "@forge-ts/cli";
```

## `InitDocsResult`

Result of the `init docs` command.

**Signature:**

```typescript
any
```

```typescript
import { runInitDocs } from "@forge-ts/cli/commands/init-docs";
const output = await runInitDocs({ target: "mintlify" });
console.log(output.data.summary.filesCreated); // number of files written
```

## `runInitDocs`

Scaffolds a documentation site for the target SSG platform.  Resolves the target from args, validates it, checks for an existing scaffold, calls the adapter's `scaffold()` method, and writes all files produced by the manifest to `outDir`.

**Signature:**

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

## `initDocsCommand`

Citty command definition for `forge-ts init docs`.  Scaffolds a complete documentation site for the target SSG platform. Use `--json` for LAFS JSON envelope output (agent/CI-friendly).

**Signature:**

```typescript
CommandDef<{ readonly target: { readonly type: "string"; readonly description: `SSG target: ${string} (default: docusaurus)` | `SSG target: ${string} (default: mintlify)` | `SSG target: ${string} (default: nextra)` | `SSG target: ${string} (default: vitepress)`; }; readonly cwd: { readonly type: "string"; readonly d...
```

```typescript
import { initDocsCommand } from "@forge-ts/cli/commands/init-docs";
// Registered automatically as a subcommand of `forge-ts init`
```

## `initCommand`

Citty command definition for `forge-ts init`.  Exposes subcommands for scaffolding project artefacts.

**Signature:**

```typescript
CommandDef<ArgsDef>
```

```typescript
import { initCommand } from "@forge-ts/cli/commands/init-docs";
// Registered automatically as a subcommand of `forge-ts`
```

## `extractExamples`

Extracts all `@example` blocks from a list of  objects.

**Signature:**

```typescript
(symbols: ForgeSymbol[]) => ExtractedExample[]
```

**Parameters:**

- `symbols` — The symbols produced by the core AST walker.

**Returns:** A flat array of  objects, one per code block.

```typescript
import { createWalker, loadConfig } from "@forge-ts/core";
import { extractExamples } from "@forge-ts/doctest";
const config = await loadConfig();
const symbols = createWalker(config).walk();
const examples = extractExamples(symbols);
console.log(`Found ${examples.length} examples`);
```

## `generateTestFiles`

Generates a virtual test file for a set of extracted examples.  Each example is wrapped in an `it()` block using the Node built-in `node:test` runner so that no additional test framework is required. Auto-imports the tested symbol from the source file, processes `// =>` assertion patterns, and appends an inline source map.

**Signature:**

```typescript
(examples: ExtractedExample[], options: GeneratorOptions) => VirtualTestFile[]
```

**Parameters:**

- `examples` — Examples to include in the generated file.
- `options` — Output configuration.

**Returns:** An array of  objects (one per source file).

```typescript
import { generateTestFiles } from "@forge-ts/doctest";
const files = generateTestFiles(examples, { cacheDir: "/tmp/doctest-cache" });
console.log(`Generated ${files.length} test file(s)`);
```

## `runTests`

Writes virtual test files to disk and executes them with Node 24 native TypeScript support (`--experimental-strip-types --test`).

**Signature:**

```typescript
(files: VirtualTestFile[]) => Promise<RunResult>
```

**Parameters:**

- `files` — The virtual test files to write and run.

**Returns:** A  summarising the test outcome.

```typescript
import { runTests } from "@forge-ts/doctest";
const result = await runTests(virtualFiles);
if (!result.success) {
  console.error(`${result.failed} doctest(s) failed`);
}
```

## `doctest`

Runs the full doctest pipeline: extract → generate → run.

**Signature:**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters:**

- `config` — The resolved  for the project.

**Returns:** A  with success/failure and any diagnostics.

```typescript
import { loadConfig } from "@forge-ts/core";
import { doctest } from "@forge-ts/doctest";
const config = await loadConfig();
const result = await doctest(config);
if (!result.success) {
  console.error(`${result.errors.length} doctest failure(s)`);
}
```

## `runTest`

Runs the doctest pipeline and returns a typed command output.

**Signature:**

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
