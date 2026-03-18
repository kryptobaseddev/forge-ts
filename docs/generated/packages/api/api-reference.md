---
title: api — API Reference
outline: deep
description: Full API reference for the api package
---

# api — API Reference

## Functions

### `signatureToSchema()`

```typescript
(signature: string) => OpenAPISchemaObject
```

Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse.

**Parameters**

- `signature` — A TypeScript type signature string, e.g. `"string"`, `"number[]"`,   `"string | number"`, `"Record<string, boolean>"`.

**Returns**: An OpenAPI schema object.

**Examples**

```typescript
import { signatureToSchema } from "@forge-ts/api";
const schema = signatureToSchema("string[]");
// { type: "array", items: { type: "string" } }
```


### `extractSDKTypes()`

```typescript
(symbols: ForgeSymbol[]) => SDKType[]
```

Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of  objects.  Only exported symbols whose visibility is not  or  are included.

**Parameters**

- `symbols` — The symbols produced by the core AST walker.

**Returns**: An array of  objects for public-facing type definitions.

**Examples**

```typescript
import { extractSDKTypes } from "@forge-ts/api";
const sdkTypes = extractSDKTypes(symbols);
console.log(sdkTypes.length); // number of public SDK types
```


### `generateOpenAPISpec()`

```typescript
(config: ForgeConfig, sdkTypes: SDKType[]) => OpenAPIDocument
```

Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release.

**Parameters**

- `config` — The resolved .
- `sdkTypes` — SDK types to include as component schemas.

**Returns**: An  object.

**Examples**

```typescript
import { generateOpenAPISpec } from "@forge-ts/api";
import { extractSDKTypes } from "@forge-ts/api";
const spec = generateOpenAPISpec(config, extractSDKTypes(symbols));
console.log(spec.openapi); // "3.2.0"
```


### `buildReference()`

```typescript
(symbols: ForgeSymbol[]) => ReferenceEntry[]
```

Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with  or  are excluded from the top-level results. Children with private/internal visibility are also filtered out.

**Parameters**

- `symbols` — All symbols from the AST walker.

**Returns**: An array of  objects sorted by name.

**Examples**

```typescript
import { buildReference } from "@forge-ts/api";
const entries = buildReference(symbols);
console.log(entries[0].name); // first symbol name, alphabetically
```


### `generateApi()`

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

Runs the API generation pipeline: walk → extract → generate → write.

**Parameters**

- `config` — The resolved  for the project.

**Returns**: A  with success/failure and any diagnostics.

**Examples**

```typescript
import { generateApi } from "@forge-ts/api";
const result = await generateApi(config);
console.log(result.success); // true if spec was written successfully
```


## Interfaces

### `SDKProperty`

```typescript
any
```

A single property extracted from an interface or class symbol.

#### `name`

```typescript
string
```

The property name.

#### `type`

```typescript
string
```

The TypeScript type string of the property.

#### `description`

```typescript
string | undefined
```

TSDoc summary for this property.

#### `required`

```typescript
boolean
```

Whether the property is required (not optional).

#### `deprecated`

```typescript
string | undefined
```

Deprecation notice, if present.


### `SDKType`

```typescript
any
```

An SDK type descriptor extracted from the symbol graph.

#### `name`

```typescript
string
```

The symbol name.

#### `kind`

```typescript
"class" | "interface" | "type" | "enum"
```

Syntactic kind of the type.

#### `signature`

```typescript
string | undefined
```

Human-readable type signature.

#### `description`

```typescript
string | undefined
```

TSDoc summary.

#### `deprecated`

```typescript
string | undefined
```

Deprecation notice, if present.

#### `visibility`

```typescript
Visibility
```

Resolved visibility level.

#### `properties`

```typescript
SDKProperty[]
```

Extracted properties (for interfaces, classes) or values (for enums).

#### `sourceFile`

```typescript
string
```

Absolute path to the source file.


### `ReferenceEntry`

```typescript
any
```

A single entry in the generated API reference.

#### `name`

```typescript
string
```

Symbol name.

#### `kind`

```typescript
"function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "property"
```

Symbol kind.

#### `summary`

```typescript
string | undefined
```

TSDoc summary.

#### `signature`

```typescript
string | undefined
```

Human-readable type signature.

#### `visibility`

```typescript
Visibility
```

Resolved visibility level.

#### `deprecated`

```typescript
string | undefined
```

Deprecation notice, if present.

#### `params`

```typescript
{ name: string; description: string; type?: string | undefined; }[] | undefined
```

Documented parameters.

#### `returns`

```typescript
{ description: string; type?: string | undefined; } | undefined
```

Documented return value.

#### `throws`

```typescript
{ type?: string | undefined; description: string; }[] | undefined
```

Documented thrown exceptions.

#### `examples`

```typescript
{ code: string; language: string; }[] | undefined
```

Code examples from TSDoc `@example` tags.

#### `children`

```typescript
ReferenceEntry[] | undefined
```

Nested child symbols (class methods, interface properties, enum members).

#### `location`

```typescript
{ filePath: string; line: number; }
```

Source file location.
