---
title: api — Functions
outline: deep
description: Functions and classes for the api package
---

# api — Functions & Classes

Functions and classes exported by this package.

## signatureToSchema(signature)

Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse.

**Signature**

```typescript
(signature: string) => OpenAPISchemaObject
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `signature` | — | A TypeScript type signature string, e.g. `"string"`, `"number[]"`,   `"string \| number"`, `"Record<string, boolean>"`. |

**Returns** — An OpenAPI schema object.

## extractSDKTypes(symbols)

Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of  objects.  Only exported symbols whose visibility is not  or  are included.

**Signature**

```typescript
(symbols: ForgeSymbol[]) => SDKType[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | The symbols produced by the core AST walker. |

**Returns** — An array of  objects for public-facing type definitions.

## generateOpenAPISpec(config, sdkTypes)

Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release.

**Signature**

```typescript
(config: ForgeConfig, sdkTypes: SDKType[]) => OpenAPIDocument
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `config` | — | The resolved . |
| `sdkTypes` | — | SDK types to include as component schemas. |

**Returns** — An  object.

## buildReference(symbols)

Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with  or  are excluded from the top-level results. Children with private/internal visibility are also filtered out.

**Signature**

```typescript
(symbols: ForgeSymbol[]) => ReferenceEntry[]
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `symbols` | — | All symbols from the AST walker. |

**Returns** — An array of  objects sorted by name.

## generateApi(config)

Runs the API generation pipeline: walk → extract → generate → write.

**Signature**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `config` | — | The resolved  for the project. |

**Returns** — A  with success/failure and any diagnostics.
