---
title: api
outline: deep
description: api package overview
---

# api

## Exported Symbols

| Symbol | Kind | Description |
|--------|------|-------------|
| [`signatureToSchema()`](./api-reference.md#signaturetoschema) | function | Maps a TypeScript type signature string to an OpenAPI 3.2 schema object.  Handles common primitives, arrays, unions, `Record<K, V>`, and falls back to `{ type: "object" }` for anything it cannot parse. |
| [`SDKProperty`](./api-reference.md#sdkproperty) | interface | A single property extracted from an interface or class symbol. |
| [`SDKType`](./api-reference.md#sdktype) | interface | An SDK type descriptor extracted from the symbol graph. |
| [`extractSDKTypes()`](./api-reference.md#extractsdktypes) | function | Extracts SDK-relevant types (interfaces, type aliases, classes, enums) from a list of  objects.  Only exported symbols whose visibility is not  or  are included. |
| [`generateOpenAPISpec()`](./api-reference.md#generateopenapispec) | function | Generates a production-quality OpenAPI 3.2 document from the extracted SDK types.  The document is populated with: - An `info` block sourced from the config or reasonable defaults. - A `components.schemas` section with one schema per exported type. - `tags` derived from unique source file paths (grouping by file). - Visibility filtering: `@internal` symbols are never emitted.  HTTP paths are not yet emitted (`paths` is always `{}`); route extraction will be added in a future release. |
| [`ReferenceEntry`](./api-reference.md#referenceentry) | interface | A single entry in the generated API reference. |
| [`buildReference()`](./api-reference.md#buildreference) | function | Builds a structured API reference from a list of exported symbols.  Unlike the minimal stub, this version includes nested children (class methods, interface properties) and all available TSDoc metadata.  Symbols with  or  are excluded from the top-level results. Children with private/internal visibility are also filtered out. |
| [`generateApi()`](./api-reference.md#generateapi) | function | Runs the API generation pipeline: walk → extract → generate → write. |
