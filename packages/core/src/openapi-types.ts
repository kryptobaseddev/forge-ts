/**
 * OpenAPI 3.2 type contracts shared across the forge-ts toolchain.
 *
 * All OpenAPI-related types are defined here so that consumers never resort
 * to `Record<string, unknown>` or inline structural types.
 *
 * @packageDocumentation
 * @public
 */

/**
 * OpenAPI 3.2 schema object.
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
 * OpenAPI 3.2 info object.
 * @public
 */
export interface OpenAPIInfoObject {
	title: string;
	version: string;
	description?: string;
	summary?: string;
	license?: { name: string; url?: string; identifier?: string };
}

/**
 * OpenAPI 3.2 tag object.
 * @public
 */
export interface OpenAPITagObject {
	name: string;
	description?: string;
}

/**
 * OpenAPI 3.2 path item object.
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
	options?: OpenAPIOperationObject;
	head?: OpenAPIOperationObject;
	trace?: OpenAPIOperationObject;
	query?: OpenAPIOperationObject;
	additionalOperations?: Record<string, OpenAPIOperationObject>;
}

/**
 * OpenAPI 3.2 operation object.
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
 * OpenAPI 3.2 parameter object.
 * @public
 */
export interface OpenAPIParameterObject {
	name: string;
	in: "query" | "header" | "path" | "cookie" | "querystring";
	description?: string;
	required?: boolean;
	schema?: OpenAPISchemaObject;
	deprecated?: boolean;
}

/**
 * OpenAPI 3.2 encoding object.
 * @public
 */
export interface OpenAPIEncodingObject {
	contentType?: string;
	headers?: Record<string, OpenAPIParameterObject>;
	style?: string;
	explode?: boolean;
	allowReserved?: boolean;
}

/**
 * OpenAPI 3.2 media type object.
 * @public
 */
export interface OpenAPIMediaTypeObject {
	schema?: OpenAPISchemaObject;
	encoding?: Record<string, OpenAPIEncodingObject>;
}

/**
 * OpenAPI 3.2 response object.
 * @public
 */
export interface OpenAPIResponseObject {
	description: string;
	headers?: Record<string, OpenAPIParameterObject>;
	content?: Record<string, OpenAPIMediaTypeObject>;
}

/**
 * Complete OpenAPI 3.2 document.
 * @public
 */
export interface OpenAPIDocument {
	openapi: "3.2.0";
	$self?: string;
	info: OpenAPIInfoObject;
	paths: Record<string, OpenAPIPathItemObject>;
	components: {
		schemas: Record<string, OpenAPISchemaObject>;
		mediaTypes?: Record<string, OpenAPIMediaTypeObject>;
	};
	tags?: OpenAPITagObject[];
}
