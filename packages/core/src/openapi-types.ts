/**
 * OpenAPI 3.1 type contracts shared across the forge-ts toolchain.
 *
 * All OpenAPI-related types are defined here so that consumers never resort
 * to `Record<string, unknown>` or inline structural types.
 *
 * @packageDocumentation
 * @public
 */

/**
 * OpenAPI 3.1 schema object.
 * @public
 */
export interface OpenAPISchemaObject {
	type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
	format?: string;
	description?: string;
	properties?: Record<string, OpenAPISchemaObject>;
	required?: string[];
	items?: OpenAPISchemaObject;
	additionalProperties?: boolean | OpenAPISchemaObject;
	enum?: Array<string | number | boolean>;
	oneOf?: OpenAPISchemaObject[];
	allOf?: OpenAPISchemaObject[];
	anyOf?: OpenAPISchemaObject[];
	nullable?: boolean;
	deprecated?: boolean;
	default?: string | number | boolean | null;
	$ref?: string;
}

/**
 * OpenAPI 3.1 info object.
 * @public
 */
export interface OpenAPIInfoObject {
	title: string;
	version: string;
	description?: string;
	license?: { name: string; url?: string };
}

/**
 * OpenAPI 3.1 tag object.
 * @public
 */
export interface OpenAPITagObject {
	name: string;
	description?: string;
}

/**
 * OpenAPI 3.1 path item object.
 * @public
 */
export interface OpenAPIPathItemObject {
	summary?: string;
	description?: string;
	get?: OpenAPIOperationObject;
	post?: OpenAPIOperationObject;
	put?: OpenAPIOperationObject;
	delete?: OpenAPIOperationObject;
	patch?: OpenAPIOperationObject;
}

/**
 * OpenAPI 3.1 operation object.
 * @public
 */
export interface OpenAPIOperationObject {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	parameters?: OpenAPIParameterObject[];
	responses?: Record<string, OpenAPIResponseObject>;
}

/**
 * OpenAPI 3.1 parameter object.
 * @public
 */
export interface OpenAPIParameterObject {
	name: string;
	in: "query" | "header" | "path" | "cookie";
	description?: string;
	required?: boolean;
	schema?: OpenAPISchemaObject;
}

/**
 * OpenAPI 3.1 response object.
 * @public
 */
export interface OpenAPIResponseObject {
	description: string;
	content?: Record<string, { schema: OpenAPISchemaObject }>;
}

/**
 * Complete OpenAPI 3.1 document.
 * @public
 */
export interface OpenAPIDocument {
	openapi: "3.1.0";
	info: OpenAPIInfoObject;
	paths: Record<string, OpenAPIPathItemObject>;
	components: {
		schemas: Record<string, OpenAPISchemaObject>;
	};
	tags?: OpenAPITagObject[];
}
