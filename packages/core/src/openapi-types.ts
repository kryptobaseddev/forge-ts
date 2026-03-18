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
	/** The data type of the schema (e.g., "string", "number", "object", "array"). */
	type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
	/** A format hint for the data type (e.g., "int32", "date-time", "email", "uuid"). */
	format?: string;
	/** A human-readable description of the schema's purpose or constraints. */
	description?: string;
	/** Property definitions for object-type schemas. Maps each property name to its schema. */
	properties?: Record<string, OpenAPISchemaObject>;
	/** List of property names that must be present on the object. */
	required?: string[];
	/** Schema definition for the elements of an array-type schema. Required when `type` is "array". */
	items?: OpenAPISchemaObject;
	/** Controls whether additional properties are allowed (`true`/`false`) or defines their schema. */
	additionalProperties?: boolean | OpenAPISchemaObject;
	/** Restricts the value to one of the listed constants. */
	enum?: Array<string | number | boolean>;
	/** Validates the value against exactly one of the listed sub-schemas. */
	oneOf?: OpenAPISchemaObject[];
	/** Validates the value against all of the listed sub-schemas (intersection). */
	allOf?: OpenAPISchemaObject[];
	/** Validates the value against at least one of the listed sub-schemas. */
	anyOf?: OpenAPISchemaObject[];
	/** Indicates that the value may be `null` in addition to its declared type. */
	nullable?: boolean;
	/** Marks the schema as deprecated, signalling that it may be removed in a future version. */
	deprecated?: boolean;
	/** The default value to use when the property is absent. */
	default?: string | number | boolean | null;
	/** A JSON Reference (`$ref`) pointing to another schema definition in the document. */
	$ref?: string;
}

/**
 * OpenAPI 3.2 info object.
 * @public
 */
export interface OpenAPIInfoObject {
	/** The human-readable name of the API. */
	title: string;
	/** The version string for the API (e.g., "1.0.0"). */
	version: string;
	/** A detailed description of the API, supporting CommonMark markdown. */
	description?: string;
	/** A short summary of the API, intended for display in tooling. */
	summary?: string;
	/** Licensing information for the exposed API, including name, URL, and SPDX identifier. */
	license?: { name: string; url?: string; identifier?: string };
}

/**
 * OpenAPI 3.2 tag object.
 * @public
 */
export interface OpenAPITagObject {
	/** The name of the tag, used to group operations in the document. */
	name: string;
	/** An optional description of the tag, supporting CommonMark markdown. */
	description?: string;
}

/**
 * OpenAPI 3.2 path item object.
 * @public
 */
export interface OpenAPIPathItemObject {
	/** A short summary of the path item, intended for tooling display. */
	summary?: string;
	/** A detailed description of the path item, supporting CommonMark markdown. */
	description?: string;
	/** The operation definition for HTTP GET requests to this path. */
	get?: OpenAPIOperationObject;
	/** The operation definition for HTTP POST requests to this path. */
	post?: OpenAPIOperationObject;
	/** The operation definition for HTTP PUT requests to this path. */
	put?: OpenAPIOperationObject;
	/** The operation definition for HTTP DELETE requests to this path. */
	delete?: OpenAPIOperationObject;
	/** The operation definition for HTTP PATCH requests to this path. */
	patch?: OpenAPIOperationObject;
	/** The operation definition for HTTP OPTIONS requests to this path. */
	options?: OpenAPIOperationObject;
	/** The operation definition for HTTP HEAD requests to this path. */
	head?: OpenAPIOperationObject;
	/** The operation definition for HTTP TRACE requests to this path. */
	trace?: OpenAPIOperationObject;
	/** The operation definition for HTTP QUERY requests to this path (OpenAPI 3.2 extension). */
	query?: OpenAPIOperationObject;
	/** Additional non-standard HTTP method operations keyed by method name. */
	additionalOperations?: Record<string, OpenAPIOperationObject>;
}

/**
 * OpenAPI 3.2 operation object.
 * @public
 */
export interface OpenAPIOperationObject {
	/** A unique string identifier for the operation, used by tooling to reference it. */
	operationId?: string;
	/** A short, human-readable summary of what the operation does. */
	summary?: string;
	/** A detailed description of the operation's behaviour, supporting CommonMark markdown. */
	description?: string;
	/** A list of tag names that logically group this operation in documentation and tooling. */
	tags?: string[];
	/** The list of parameters applicable to this operation. */
	parameters?: OpenAPIParameterObject[];
	/** The possible responses returned by this operation, keyed by HTTP status code or "default". */
	responses?: Record<string, OpenAPIResponseObject>;
}

/**
 * OpenAPI 3.2 parameter object.
 * @public
 */
export interface OpenAPIParameterObject {
	/** The name of the parameter, case-sensitive. */
	name: string;
	/** The location of the parameter: path, query, header, cookie, or querystring. */
	in: "query" | "header" | "path" | "cookie" | "querystring";
	/** A human-readable description of the parameter's purpose, supporting CommonMark markdown. */
	description?: string;
	/** Whether the parameter is mandatory. Required for `in: "path"` parameters. */
	required?: boolean;
	/** The schema defining the type and constraints of the parameter value. */
	schema?: OpenAPISchemaObject;
	/** Marks the parameter as deprecated; clients should avoid using it. */
	deprecated?: boolean;
}

/**
 * OpenAPI 3.2 encoding object.
 * @public
 */
export interface OpenAPIEncodingObject {
	/** The MIME type to use for encoding a specific property (e.g., "application/json"). */
	contentType?: string;
	/** Additional headers to send alongside the encoded part, keyed by header name. */
	headers?: Record<string, OpenAPIParameterObject>;
	/** The serialization style for the encoded value (e.g., "form", "spaceDelimited"). */
	style?: string;
	/** Whether arrays and objects should be exploded into separate query parameters. */
	explode?: boolean;
	/** Whether reserved characters in the encoded value should be allowed without percent-encoding. */
	allowReserved?: boolean;
}

/**
 * OpenAPI 3.2 media type object.
 * @public
 */
export interface OpenAPIMediaTypeObject {
	/** The schema defining the structure and type of the media type's payload. */
	schema?: OpenAPISchemaObject;
	/** Encoding information for specific properties of a `multipart` or `application/x-www-form-urlencoded` request body. */
	encoding?: Record<string, OpenAPIEncodingObject>;
}

/**
 * OpenAPI 3.2 response object.
 * @public
 */
export interface OpenAPIResponseObject {
	/** A required human-readable description of the response, supporting CommonMark markdown. */
	description: string;
	/** HTTP headers returned with this response, keyed by header name. */
	headers?: Record<string, OpenAPIParameterObject>;
	/** The response body content, keyed by media type (e.g., "application/json"). */
	content?: Record<string, OpenAPIMediaTypeObject>;
}

/**
 * Complete OpenAPI 3.2 document.
 * @public
 */
export interface OpenAPIDocument {
	/** The OpenAPI specification version this document conforms to. Must be "3.2.0". */
	openapi: "3.2.0";
	/** An optional self-referencing URL for this document, used for tooling and resolution. */
	$self?: string;
	/** Metadata about the API including title, version, and description. */
	info: OpenAPIInfoObject;
	/** The available paths and their operations, keyed by path template (e.g., "/users/{id}"). */
	paths: Record<string, OpenAPIPathItemObject>;
	/** Reusable schema and media type definitions shared across the document. */
	components: {
		schemas: Record<string, OpenAPISchemaObject>;
		mediaTypes?: Record<string, OpenAPIMediaTypeObject>;
	};
	/** A list of tags used to group operations, with optional descriptions. */
	tags?: OpenAPITagObject[];
}
