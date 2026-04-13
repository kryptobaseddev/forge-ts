/**
 * OpenAPI 3.2 spec generator and structured API reference builder for forge-ts.
 *
 * Inspects the `ForgeSymbol[]` graph produced by `@forge-ts/core`, extracts
 * TypeScript types annotated with `@route` tags, maps their signatures to
 * JSON Schema objects, and writes a complete OpenAPI 3.2 document alongside
 * a structured API reference catalogue. Integrates with the broader
 * documentation pipeline via `config.api.openapiPath`.
 *
 * @remarks
 * The pipeline runs in four steps: `createWalker` traverses the project AST;
 * `extractSDKTypes` selects symbols relevant to the public SDK surface;
 * `generateOpenAPISpec` converts those types to an OpenAPI 3.2 document
 * (including path items derived from `@route` tags and schemas from
 * `signatureToSchema`); `generateApi` writes the result to
 * `config.api.openapiPath`. The `buildReference` helper produces a flat
 * `ReferenceEntry[]` for use in rendered API reference pages.
 *
 * Key exports:
 * - `generateApi` — Run the full walk → extract → generate → write pipeline.
 * - `generateOpenAPISpec` — Build an `OpenAPIDocument` from config and SDK types.
 * - `extractSDKTypes` — Select public SDK types from the symbol graph.
 * - `buildReference` — Produce a flat API reference entry list.
 * - `signatureToSchema` — Map a TypeScript type signature to a JSON Schema object.
 * - `OpenAPIDocument` — The generated OpenAPI 3.2 document structure.
 * - `OpenAPISchemaObject` — A JSON Schema object as used inside the spec.
 * - `SDKType` / `SDKProperty` — Intermediate SDK type extraction types.
 * - `ReferenceEntry` — One entry in the structured API reference catalogue.
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { generateApi } from "@forge-ts/api";
 *
 * const config = await loadConfig();
 * const result = await generateApi(config);
 * console.log(result.success); // true if the spec was written successfully
 * ```
 *
 * @packageDocumentation
 * @public
 */

export { generateOpenAPISpec, type OpenAPIDocument } from "./openapi.js";
export { buildReference, type ReferenceEntry } from "./reference.js";
export { type OpenAPISchemaObject, signatureToSchema } from "./schema-mapper.js";
export { extractSDKTypes, type SDKProperty, type SDKType } from "./sdk-extractor.js";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createWalker, type ForgeConfig, type ForgeResult } from "@forge-ts/core";
import { generateOpenAPISpec } from "./openapi.js";
import { extractSDKTypes } from "./sdk-extractor.js";

/**
 * Runs the API generation pipeline: walk → extract → generate → write.
 *
 * @remarks
 * Composes four sub-stages in sequence:
 *
 * 1. **Walk** — `createWalker(config).walk()` produces the `ForgeSymbol[]`
 *    graph by traversing all source files referenced by `config.tsconfig`.
 *
 * 2. **Extract** — `extractSDKTypes` filters the symbol graph to the subset
 *    relevant to the public SDK surface (functions, interfaces, and type aliases
 *    that are `@public` or `@beta`), and maps their signatures to `SDKType`
 *    records that carry property shapes for schema generation.
 *
 * 3. **Generate** — `generateOpenAPISpec` builds a complete OpenAPI 3.2
 *    document. Functions annotated with `@route METHOD /path` become path
 *    items; `@query`, `@header`, `@body`, and `@response` tags populate the
 *    corresponding parameter and response objects. TypeScript signatures are
 *    converted to JSON Schema via `signatureToSchema`.
 *
 * 4. **Write** — The resulting document is serialised to JSON and written to
 *    `config.api.openapiPath`, creating parent directories as needed.
 *
 * @param config - The resolved `ForgeConfig` for the project. The relevant
 *   fields are `config.api.openapiPath` (output destination), `config.rootDir`,
 *   and `config.tsconfig`.
 * @returns A `ForgeResult` whose `success` field is `true` when the spec was
 *   written without error. `symbols` contains the full symbol graph from the
 *   walk step. `errors` and `warnings` are empty on success; file-system or
 *   walker errors are thrown rather than returned.
 * @example
 * ```typescript
 * import { loadConfig } from "@forge-ts/core";
 * import { generateApi } from "@forge-ts/api";
 *
 * const config = await loadConfig();
 * const result = await generateApi(config);
 * console.log(result.success); // true if the spec was written successfully
 * ```
 * @public
 */
export async function generateApi(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();

	const walker = createWalker(config);
	const symbols = walker.walk();
	const sdkTypes = extractSDKTypes(symbols);
	const spec = generateOpenAPISpec(config, sdkTypes, symbols);

	await mkdir(dirname(config.api.openapiPath), { recursive: true });
	await writeFile(config.api.openapiPath, JSON.stringify(spec, null, 2), "utf8");

	return {
		success: true,
		symbols,
		errors: [],
		warnings: [],
		duration: Date.now() - start,
	};
}
