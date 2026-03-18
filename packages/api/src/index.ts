/**
 * @codluv/forge-api — OpenAPI spec and API reference generator.
 *
 * Extracts public SDK types from the symbol graph and generates an
 * OpenAPI 3.1 document and a structured API reference.
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
import { createWalker, type ForgeConfig, type ForgeResult } from "@codluv/forge-core";
import { generateOpenAPISpec } from "./openapi.js";
import { extractSDKTypes } from "./sdk-extractor.js";

/**
 * Runs the API generation pipeline: walk → extract → generate → write.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns A {@link ForgeResult} with success/failure and any diagnostics.
 * @public
 */
export async function generateApi(config: ForgeConfig): Promise<ForgeResult> {
	const start = Date.now();

	const walker = createWalker(config);
	const symbols = walker.walk();
	const sdkTypes = extractSDKTypes(symbols);
	const spec = generateOpenAPISpec(config, sdkTypes);

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
