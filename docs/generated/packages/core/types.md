---
title: core — Types
outline: deep
description: Type contracts for the core package
---

# core — Types

Type contracts exported by this package: interfaces, type aliases, and enums.

## Visibility

Visibility levels for exported symbols. Derived from TSDoc release tags (public, beta, internal).

```typescript
typeof Visibility
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Public` | `Visibility.Public` | Yes |  |
| `Beta` | `Visibility.Beta` | Yes |  |
| `Internal` | `Visibility.Internal` | Yes |  |
| `Private` | `Visibility.Private` | Yes |  |

## ForgeSymbol

A single extracted and annotated symbol from the TypeScript AST.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | The declared name of the symbol. |
| `kind` | `"function" \| "class" \| "interface" \| "type" \| "enum" \| "variable" \| "method" \| "property"` | Yes | The syntactic kind of the symbol. |
| `visibility` | `Visibility` | Yes | Resolved visibility from TSDoc release tags. |
| `filePath` | `string` | Yes | Absolute path to the source file. |
| `line` | `number` | Yes | 1-based line number of the declaration. |
| `column` | `number` | Yes | 0-based column of the declaration. |
| `documentation` | `{ summary?: string \| undefined; params?: { name: string; description: string; type?: string \| undefined; }[] \| undefined; returns?: { description: string; type?: string \| undefined; } \| undefined; throws?: { ...; }[] \| undefined; examples?: { ...; }[] \| undefined; tags?: Record<...> \| undefined; deprecated?: string ...` | No | Parsed TSDoc documentation, if present. |
| `signature` | `string \| undefined` | No | Human-readable type signature of the symbol. |
| `children` | `ForgeSymbol[] \| undefined` | No | Child symbols (e.g., class members, enum values). |
| `exported` | `boolean` | Yes | Whether this symbol is part of the public module exports. |

## ForgeConfig

Full configuration for a forge-ts run. Loaded from forge-ts.config.ts or the "forge-ts" key in package.json.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `rootDir` | `string` | Yes | Root directory of the project. |
| `tsconfig` | `string` | Yes | Path to the tsconfig.json to compile against. |
| `outDir` | `string` | Yes | Output directory for generated files. |
| `enforce` | `{ enabled: boolean; minVisibility: Visibility; strict: boolean; }` | Yes | Enforce TSDoc on all public exports. |
| `doctest` | `{ enabled: boolean; cacheDir: string; }` | Yes | DocTest configuration. |
| `api` | `{ enabled: boolean; openapi: boolean; openapiPath: string; }` | Yes | API generation configuration. |
| `gen` | `{ enabled: boolean; formats: ("markdown" \| "mdx")[]; llmsTxt: boolean; readmeSync: boolean; ssgTarget?: "docusaurus" \| "mintlify" \| "nextra" \| "vitepress" \| undefined; }` | No | Output generation configuration. |

## ForgeResult

The result of a forge-ts compilation pass.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether the run succeeded without errors. |
| `symbols` | `ForgeSymbol[]` | Yes | All symbols extracted during this run. |
| `errors` | `ForgeError[]` | Yes | Errors that caused or would cause failure. |
| `warnings` | `ForgeWarning[]` | Yes | Non-fatal warnings. |
| `duration` | `number` | Yes | Wall-clock duration of the run in milliseconds. |

## ForgeError

A diagnostic error produced during a forge-ts run.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable error code (e.g. "E001"). |
| `message` | `string` | Yes | Human-readable description of the error. |
| `filePath` | `string` | Yes | Absolute path of the file where the error occurred. |
| `line` | `number` | Yes | 1-based line number. |
| `column` | `number` | Yes | 0-based column. |
| `suggestedFix` | `string \| undefined` | No | Suggested fix for the agent — exact TSDoc block to add. |
| `symbolName` | `string \| undefined` | No | The symbol name that needs fixing. |
| `symbolKind` | `string \| undefined` | No | The symbol kind (function, class, interface, etc.). |

## ForgeWarning

A diagnostic warning produced during a forge-ts run.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Machine-readable warning code (e.g. "W001"). |
| `message` | `string` | Yes | Human-readable description of the warning. |
| `filePath` | `string` | Yes | Absolute path of the file where the warning occurred. |
| `line` | `number` | Yes | 1-based line number. |
| `column` | `number` | Yes | 0-based column. |

## OpenAPISchemaObject

OpenAPI 3.2 schema object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"string" \| "number" \| "boolean" \| "object" \| "integer" \| "array" \| "null" \| undefined` | No |  |
| `format` | `string \| undefined` | No |  |
| `description` | `string \| undefined` | No |  |
| `properties` | `Record<string, OpenAPISchemaObject> \| undefined` | No |  |
| `required` | `string[] \| undefined` | No |  |
| `items` | `OpenAPISchemaObject \| undefined` | No |  |
| `additionalProperties` | `boolean \| OpenAPISchemaObject \| undefined` | No |  |
| `enum` | `(string \| number \| boolean)[] \| undefined` | No |  |
| `oneOf` | `OpenAPISchemaObject[] \| undefined` | No |  |
| `allOf` | `OpenAPISchemaObject[] \| undefined` | No |  |
| `anyOf` | `OpenAPISchemaObject[] \| undefined` | No |  |
| `nullable` | `boolean \| undefined` | No |  |
| `deprecated` | `boolean \| undefined` | No |  |
| `default` | `string \| number \| boolean \| null \| undefined` | No |  |
| `$ref` | `string \| undefined` | No |  |

## OpenAPIInfoObject

OpenAPI 3.2 info object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` | Yes |  |
| `version` | `string` | Yes |  |
| `description` | `string \| undefined` | No |  |
| `summary` | `string \| undefined` | No |  |
| `license` | `{ name: string; url?: string \| undefined; identifier?: string \| undefined; } \| undefined` | No |  |

## OpenAPITagObject

OpenAPI 3.2 tag object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes |  |
| `description` | `string \| undefined` | No |  |

## OpenAPIPathItemObject

OpenAPI 3.2 path item object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `summary` | `string \| undefined` | No |  |
| `description` | `string \| undefined` | No |  |
| `get` | `OpenAPIOperationObject \| undefined` | No |  |
| `post` | `OpenAPIOperationObject \| undefined` | No |  |
| `put` | `OpenAPIOperationObject \| undefined` | No |  |
| `delete` | `OpenAPIOperationObject \| undefined` | No |  |
| `patch` | `OpenAPIOperationObject \| undefined` | No |  |
| `options` | `OpenAPIOperationObject \| undefined` | No |  |
| `head` | `OpenAPIOperationObject \| undefined` | No |  |
| `trace` | `OpenAPIOperationObject \| undefined` | No |  |
| `query` | `OpenAPIOperationObject \| undefined` | No |  |
| `additionalOperations` | `Record<string, OpenAPIOperationObject> \| undefined` | No |  |

## OpenAPIOperationObject

OpenAPI 3.2 operation object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `operationId` | `string \| undefined` | No |  |
| `summary` | `string \| undefined` | No |  |
| `description` | `string \| undefined` | No |  |
| `tags` | `string[] \| undefined` | No |  |
| `parameters` | `OpenAPIParameterObject[] \| undefined` | No |  |
| `responses` | `Record<string, OpenAPIResponseObject> \| undefined` | No |  |

## OpenAPIParameterObject

OpenAPI 3.2 parameter object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes |  |
| `in` | `"query" \| "header" \| "path" \| "cookie" \| "querystring"` | Yes |  |
| `description` | `string \| undefined` | No |  |
| `required` | `boolean \| undefined` | No |  |
| `schema` | `OpenAPISchemaObject \| undefined` | No |  |
| `deprecated` | `boolean \| undefined` | No |  |

## OpenAPIEncodingObject

OpenAPI 3.2 encoding object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `contentType` | `string \| undefined` | No |  |
| `headers` | `Record<string, OpenAPIParameterObject> \| undefined` | No |  |
| `style` | `string \| undefined` | No |  |
| `explode` | `boolean \| undefined` | No |  |
| `allowReserved` | `boolean \| undefined` | No |  |

## OpenAPIMediaTypeObject

OpenAPI 3.2 media type object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `schema` | `OpenAPISchemaObject \| undefined` | No |  |
| `encoding` | `Record<string, OpenAPIEncodingObject> \| undefined` | No |  |

## OpenAPIResponseObject

OpenAPI 3.2 response object.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes |  |
| `headers` | `Record<string, OpenAPIParameterObject> \| undefined` | No |  |
| `content` | `Record<string, OpenAPIMediaTypeObject> \| undefined` | No |  |

## OpenAPIDocument

Complete OpenAPI 3.2 document.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `openapi` | `"3.2.0"` | Yes |  |
| `$self` | `string \| undefined` | No |  |
| `info` | `OpenAPIInfoObject` | Yes |  |
| `paths` | `Record<string, OpenAPIPathItemObject>` | Yes |  |
| `components` | `{ schemas: Record<string, OpenAPISchemaObject>; mediaTypes?: Record<string, OpenAPIMediaTypeObject> \| undefined; }` | No |  |
| `tags` | `OpenAPITagObject[] \| undefined` | No |  |

## ASTWalker

The return type of .

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `walk` | `() => ForgeSymbol[]` | Yes | Walk all source files referenced by the configured tsconfig and return one  per exported declaration. |
