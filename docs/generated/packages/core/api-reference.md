---
title: core — API Reference
outline: deep
description: Full API reference for the core package
---

# core — API Reference

## Functions

### `defaultConfig()`

```typescript
(rootDir: string) => ForgeConfig
```

Constructs a sensible default  rooted at `rootDir`.

**Parameters**

- `rootDir` — Absolute path to the project root.

**Returns**: A fully-populated default configuration.


### `loadConfig()`

```typescript
(rootDir?: string | undefined) => Promise<ForgeConfig>
```

Loads the forge-ts configuration for a project.  Resolution order: 1. `<rootDir>/forge-ts.config.ts` 2. `<rootDir>/forge-ts.config.js` 3. `"forge-ts"` key inside `<rootDir>/package.json` 4. Built-in defaults (returned when none of the above is found)

**Parameters**

- `rootDir` — The project root to search for config.  Defaults to `process.cwd()`.

**Returns**: A fully-resolved .


### `resolveVisibility()`

```typescript
(tags: Record<string, string[]> | undefined) => Visibility
```

Determines the visibility level of a symbol from its TSDoc release tags.  The precedence order is: 1. `@internal`  →  2. `@beta`      →  3. `@public`    →  4. (no tag)     →  (default for exports)

**Parameters**

- `tags` — The parsed `tags` map from `ForgeSymbol.documentation`.

**Returns**: The resolved  value.


### `meetsVisibility()`

```typescript
(candidate: Visibility, minVisibility: Visibility) => boolean
```

Returns whether `candidate` meets or exceeds the required minimum visibility.  "Meets" means the symbol is at least as visible as `minVisibility`. For example, `Public` meets a minimum of `Public`, but `Internal` does not.

**Parameters**

- `candidate` — The visibility of the symbol being tested.
- `minVisibility` — The minimum visibility threshold.

**Returns**: `true` if `candidate` is at least as visible as `minVisibility`.


### `filterByVisibility()`

```typescript
(symbols: ForgeSymbol[], minVisibility: Visibility) => ForgeSymbol[]
```

Filters an array of  objects to only include symbols whose visibility meets or exceeds `minVisibility`.

**Parameters**

- `symbols` — The full list of symbols to filter.
- `minVisibility` — The minimum visibility threshold to keep.

**Returns**: A new array containing only symbols that pass the visibility check.


### `createWalker()`

```typescript
(config: ForgeConfig) => ASTWalker
```

Creates an  configured for the given forge config.  The walker uses the TypeScript Compiler API to create a `ts.Program` from the project's tsconfig, then visits every source file to extract exported declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to populate the `documentation` field on each .

**Parameters**

- `config` — The resolved  for the project.

**Returns**: An  instance whose `walk()` method performs the extraction.


## Interfaces

### `ForgeSymbol`

```typescript
any
```

A single extracted and annotated symbol from the TypeScript AST.

#### `name`

```typescript
string
```

The declared name of the symbol.

#### `kind`

```typescript
"function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "property"
```

The syntactic kind of the symbol.

#### `visibility`

```typescript
Visibility
```

Resolved visibility from TSDoc release tags.

#### `filePath`

```typescript
string
```

Absolute path to the source file.

#### `line`

```typescript
number
```

1-based line number of the declaration.

#### `column`

```typescript
number
```

0-based column of the declaration.

#### `documentation`

```typescript
{ summary?: string | undefined; params?: { name: string; description: string; type?: string | undefined; }[] | undefined; returns?: { description: string; type?: string | undefined; } | undefined; throws?: { ...; }[] | undefined; examples?: { ...; }[] | undefined; tags?: Record<...> | undefined; deprecated?: string ...
```

Parsed TSDoc documentation, if present.

#### `signature`

```typescript
string | undefined
```

Human-readable type signature of the symbol.

#### `children`

```typescript
ForgeSymbol[] | undefined
```

Child symbols (e.g., class members, enum values).

#### `exported`

```typescript
boolean
```

Whether this symbol is part of the public module exports.


### `ForgeConfig`

```typescript
any
```

Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

#### `rootDir`

```typescript
string
```

Root directory of the project.

#### `tsconfig`

```typescript
string
```

Path to the tsconfig.json to compile against.

#### `outDir`

```typescript
string
```

Output directory for generated files.

#### `enforce`

```typescript
{ enabled: boolean; minVisibility: Visibility; strict: boolean; }
```

Enforce TSDoc on all public exports.

#### `doctest`

```typescript
{ enabled: boolean; cacheDir: string; }
```

DocTest configuration.

#### `api`

```typescript
{ enabled: boolean; openapi: boolean; openapiPath: string; }
```

API generation configuration.

#### `gen`

```typescript
{ enabled: boolean; formats: ("markdown" | "mdx")[]; llmsTxt: boolean; readmeSync: boolean; ssgTarget?: "docusaurus" | "mintlify" | "nextra" | "vitepress" | undefined; }
```

Output generation configuration.


### `ForgeResult`

```typescript
any
```

The result of a forge-ts compilation pass.

#### `success`

```typescript
boolean
```

Whether the run succeeded without errors.

#### `symbols`

```typescript
ForgeSymbol[]
```

All symbols extracted during this run.

#### `errors`

```typescript
ForgeError[]
```

Errors that caused or would cause failure.

#### `warnings`

```typescript
ForgeWarning[]
```

Non-fatal warnings.

#### `duration`

```typescript
number
```

Wall-clock duration of the run in milliseconds.


### `ForgeError`

```typescript
any
```

A diagnostic error produced during a forge-ts run.

#### `code`

```typescript
string
```

Machine-readable error code (e.g. "E001").

#### `message`

```typescript
string
```

Human-readable description of the error.

#### `filePath`

```typescript
string
```

Absolute path of the file where the error occurred.

#### `line`

```typescript
number
```

1-based line number.

#### `column`

```typescript
number
```

0-based column.

#### `suggestedFix`

```typescript
string | undefined
```

Suggested fix for the agent — exact TSDoc block to add.

#### `symbolName`

```typescript
string | undefined
```

The symbol name that needs fixing.

#### `symbolKind`

```typescript
string | undefined
```

The symbol kind (function, class, interface, etc.).


### `ForgeWarning`

```typescript
any
```

A diagnostic warning produced during a forge-ts run.

#### `code`

```typescript
string
```

Machine-readable warning code (e.g. "W001").

#### `message`

```typescript
string
```

Human-readable description of the warning.

#### `filePath`

```typescript
string
```

Absolute path of the file where the warning occurred.

#### `line`

```typescript
number
```

1-based line number.

#### `column`

```typescript
number
```

0-based column.


### `OpenAPISchemaObject`

```typescript
any
```

OpenAPI 3.2 schema object.

#### `type`

```typescript
"string" | "number" | "boolean" | "object" | "integer" | "array" | "null" | undefined
```

#### `format`

```typescript
string | undefined
```

#### `description`

```typescript
string | undefined
```

#### `properties`

```typescript
Record<string, OpenAPISchemaObject> | undefined
```

#### `required`

```typescript
string[] | undefined
```

#### `items`

```typescript
OpenAPISchemaObject | undefined
```

#### `additionalProperties`

```typescript
boolean | OpenAPISchemaObject | undefined
```

#### `enum`

```typescript
(string | number | boolean)[] | undefined
```

#### `oneOf`

```typescript
OpenAPISchemaObject[] | undefined
```

#### `allOf`

```typescript
OpenAPISchemaObject[] | undefined
```

#### `anyOf`

```typescript
OpenAPISchemaObject[] | undefined
```

#### `nullable`

```typescript
boolean | undefined
```

#### `deprecated`

```typescript
boolean | undefined
```

#### `default`

```typescript
string | number | boolean | null | undefined
```

#### `$ref`

```typescript
string | undefined
```


### `OpenAPIInfoObject`

```typescript
any
```

OpenAPI 3.2 info object.

#### `title`

```typescript
string
```

#### `version`

```typescript
string
```

#### `description`

```typescript
string | undefined
```

#### `summary`

```typescript
string | undefined
```

#### `license`

```typescript
{ name: string; url?: string | undefined; identifier?: string | undefined; } | undefined
```


### `OpenAPITagObject`

```typescript
any
```

OpenAPI 3.2 tag object.

#### `name`

```typescript
string
```

#### `description`

```typescript
string | undefined
```


### `OpenAPIPathItemObject`

```typescript
any
```

OpenAPI 3.2 path item object.

#### `summary`

```typescript
string | undefined
```

#### `description`

```typescript
string | undefined
```

#### `get`

```typescript
OpenAPIOperationObject | undefined
```

#### `post`

```typescript
OpenAPIOperationObject | undefined
```

#### `put`

```typescript
OpenAPIOperationObject | undefined
```

#### `delete`

```typescript
OpenAPIOperationObject | undefined
```

#### `patch`

```typescript
OpenAPIOperationObject | undefined
```

#### `options`

```typescript
OpenAPIOperationObject | undefined
```

#### `head`

```typescript
OpenAPIOperationObject | undefined
```

#### `trace`

```typescript
OpenAPIOperationObject | undefined
```

#### `query`

```typescript
OpenAPIOperationObject | undefined
```

#### `additionalOperations`

```typescript
Record<string, OpenAPIOperationObject> | undefined
```


### `OpenAPIOperationObject`

```typescript
any
```

OpenAPI 3.2 operation object.

#### `operationId`

```typescript
string | undefined
```

#### `summary`

```typescript
string | undefined
```

#### `description`

```typescript
string | undefined
```

#### `tags`

```typescript
string[] | undefined
```

#### `parameters`

```typescript
OpenAPIParameterObject[] | undefined
```

#### `responses`

```typescript
Record<string, OpenAPIResponseObject> | undefined
```


### `OpenAPIParameterObject`

```typescript
any
```

OpenAPI 3.2 parameter object.

#### `name`

```typescript
string
```

#### `in`

```typescript
"query" | "header" | "path" | "cookie" | "querystring"
```

#### `description`

```typescript
string | undefined
```

#### `required`

```typescript
boolean | undefined
```

#### `schema`

```typescript
OpenAPISchemaObject | undefined
```

#### `deprecated`

```typescript
boolean | undefined
```


### `OpenAPIEncodingObject`

```typescript
any
```

OpenAPI 3.2 encoding object.

#### `contentType`

```typescript
string | undefined
```

#### `headers`

```typescript
Record<string, OpenAPIParameterObject> | undefined
```

#### `style`

```typescript
string | undefined
```

#### `explode`

```typescript
boolean | undefined
```

#### `allowReserved`

```typescript
boolean | undefined
```


### `OpenAPIMediaTypeObject`

```typescript
any
```

OpenAPI 3.2 media type object.

#### `schema`

```typescript
OpenAPISchemaObject | undefined
```

#### `encoding`

```typescript
Record<string, OpenAPIEncodingObject> | undefined
```


### `OpenAPIResponseObject`

```typescript
any
```

OpenAPI 3.2 response object.

#### `description`

```typescript
string
```

#### `headers`

```typescript
Record<string, OpenAPIParameterObject> | undefined
```

#### `content`

```typescript
Record<string, OpenAPIMediaTypeObject> | undefined
```


### `OpenAPIDocument`

```typescript
any
```

Complete OpenAPI 3.2 document.

#### `openapi`

```typescript
"3.2.0"
```

#### `$self`

```typescript
string | undefined
```

#### `info`

```typescript
OpenAPIInfoObject
```

#### `paths`

```typescript
Record<string, OpenAPIPathItemObject>
```

#### `components`

```typescript
{ schemas: Record<string, OpenAPISchemaObject>; mediaTypes?: Record<string, OpenAPIMediaTypeObject> | undefined; }
```

#### `tags`

```typescript
OpenAPITagObject[] | undefined
```


### `ASTWalker`

```typescript
any
```

The return type of .

#### `walk()`

```typescript
() => ForgeSymbol[]
```

Walk all source files referenced by the configured tsconfig and return one  per exported declaration.


## Enums

### `Visibility`

```typescript
typeof Visibility
```

Visibility levels for exported symbols. Derived from TSDoc release tags (public, beta, internal).

#### `Public`

```typescript
Visibility.Public
```

#### `Beta`

```typescript
Visibility.Beta
```

#### `Internal`

```typescript
Visibility.Internal
```

#### `Private`

```typescript
Visibility.Private
```
