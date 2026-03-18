import type { ForgeConfig, ForgeSymbol } from "@codluv/forge-core";
import { Visibility } from "@codluv/forge-core";
import { describe, expect, it } from "vitest";
import { generateOpenAPISpec } from "../openapi.js";
import { buildReference } from "../reference.js";
import { signatureToSchema } from "../schema-mapper.js";
import { extractSDKTypes } from "../sdk-extractor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ForgeConfig> = {}): ForgeConfig {
	return {
		rootDir: "/project",
		tsconfig: "/project/tsconfig.json",
		outDir: "/project/dist",
		enforce: { enabled: false, minVisibility: Visibility.Public, strict: false },
		doctest: { enabled: false, cacheDir: "/project/.cache" },
		api: { enabled: true, openapi: true, openapiPath: "/project/dist/openapi.json" },
		gen: { enabled: false, formats: [], llmsTxt: false, readmeSync: false },
		...overrides,
	};
}

function makeSymbol(overrides: Partial<ForgeSymbol> = {}): ForgeSymbol {
	return {
		name: "MyType",
		kind: "interface",
		visibility: Visibility.Public,
		filePath: "/project/src/types.ts",
		line: 1,
		column: 0,
		exported: true,
		...overrides,
	};
}

function makeProperty(name: string, type: string, required = true): ForgeSymbol {
	return makeSymbol({
		name,
		kind: "property",
		signature: `${name}${required ? "" : "?"}: ${type}`,
		visibility: Visibility.Public,
	});
}

// ---------------------------------------------------------------------------
// generateOpenAPISpec
// ---------------------------------------------------------------------------

describe("generateOpenAPISpec", () => {
	it("generates a valid OpenAPI 3.1 structure", () => {
		const config = makeConfig();
		const spec = generateOpenAPISpec(config, []);

		expect(spec.openapi).toBe("3.1.0");
		expect(spec.info).toBeDefined();
		expect(spec.info.title).toBeTypeOf("string");
		expect(spec.info.version).toBeTypeOf("string");
		expect(spec.paths).toEqual({});
		expect(spec.components).toBeDefined();
		expect(spec.components.schemas).toBeDefined();
	});

	it("maps interface properties to schema properties", () => {
		const config = makeConfig();
		const sdkTypes = extractSDKTypes([
			makeSymbol({
				name: "User",
				kind: "interface",
				description: "A user object",
				documentation: { summary: "A user object" },
				children: [
					makeProperty("id", "string", true),
					makeProperty("name", "string", true),
					makeProperty("age", "number", false),
				],
			}),
		]);

		const spec = generateOpenAPISpec(config, sdkTypes);
		const schema = spec.components.schemas.User;

		expect(schema.type).toBe("object");
		const props = schema.properties;
		expect(props).toBeDefined();
		expect(props?.id?.type).toBe("string");
		expect(props?.name?.type).toBe("string");
		expect(props?.age?.type).toBe("number");
	});

	it("populates required array from non-optional properties", () => {
		const config = makeConfig();
		const sdkTypes = extractSDKTypes([
			makeSymbol({
				name: "Config",
				kind: "interface",
				children: [
					makeProperty("required1", "string", true),
					makeProperty("optional1", "boolean", false),
				],
			}),
		]);

		const spec = generateOpenAPISpec(config, sdkTypes);
		const schema = spec.components.schemas.Config;
		const required = schema.required;

		expect(required).toContain("required1");
		expect(required).not.toContain("optional1");
	});

	it("maps enum values to enum schema", () => {
		const config = makeConfig();
		const sdkTypes = extractSDKTypes([
			makeSymbol({
				name: "Status",
				kind: "enum",
				children: [
					makeProperty("Active", '"active"', true),
					makeProperty("Inactive", '"inactive"', true),
				],
			}),
		]);

		const spec = generateOpenAPISpec(config, sdkTypes);
		const schema = spec.components.schemas.Status;

		expect(schema.type).toBe("string");
		expect(Array.isArray(schema.enum)).toBe(true);
		expect((schema.enum ?? []).length).toBeGreaterThan(0);
	});

	it("filters out @internal symbols", () => {
		const config = makeConfig();
		const sdkTypes = extractSDKTypes([
			makeSymbol({ name: "PublicType", kind: "interface", visibility: Visibility.Public }),
			makeSymbol({ name: "InternalType", kind: "interface", visibility: Visibility.Internal }),
		]);

		const spec = generateOpenAPISpec(config, sdkTypes);

		expect(spec.components.schemas.PublicType).toBeDefined();
		expect(spec.components.schemas.InternalType).toBeUndefined();
	});

	it("includes description from TSDoc summary", () => {
		const config = makeConfig();
		const sdkTypes = extractSDKTypes([
			makeSymbol({
				name: "Described",
				kind: "interface",
				documentation: { summary: "A described type" },
			}),
		]);

		const spec = generateOpenAPISpec(config, sdkTypes);
		const schema = spec.components.schemas.Described;

		expect(schema.description).toBe("A described type");
	});

	it("generates tags from source file basenames", () => {
		const config = makeConfig();
		const types = extractSDKTypes([
			makeSymbol({ name: "A", kind: "interface", filePath: "/project/src/models.ts" }),
			makeSymbol({ name: "B", kind: "interface", filePath: "/project/src/models.ts" }),
			makeSymbol({ name: "C", kind: "interface", filePath: "/project/src/utils.ts" }),
		]);

		const spec = generateOpenAPISpec(config, types);
		const tagNames = (spec.tags ?? []).map((t) => t.name);

		expect(tagNames).toContain("models");
		expect(tagNames).toContain("utils");
		expect(tagNames.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// signatureToSchema
// ---------------------------------------------------------------------------

describe("signatureToSchema", () => {
	it("handles basic primitives", () => {
		expect(signatureToSchema("string")).toEqual({ type: "string" });
		expect(signatureToSchema("number")).toEqual({ type: "number" });
		expect(signatureToSchema("boolean")).toEqual({ type: "boolean" });
	});

	it("handles T[] array shorthand", () => {
		expect(signatureToSchema("string[]")).toEqual({ type: "array", items: { type: "string" } });
		expect(signatureToSchema("number[]")).toEqual({ type: "array", items: { type: "number" } });
	});

	it("handles Array<T> generic syntax", () => {
		expect(signatureToSchema("Array<string>")).toEqual({
			type: "array",
			items: { type: "string" },
		});
	});

	it("handles Record<string, V> mapping", () => {
		const schema = signatureToSchema("Record<string, number>");
		expect(schema.type).toBe("object");
		expect(schema.additionalProperties).toEqual({ type: "number" });
	});

	it("handles union types with oneOf", () => {
		const schema = signatureToSchema("string | number");
		expect(Array.isArray(schema.oneOf)).toBe(true);
		expect(schema.oneOf).toHaveLength(2);
	});

	it("strips | undefined from optional types", () => {
		const schema = signatureToSchema("string | undefined");
		expect(schema).toEqual({ type: "string" });
	});

	it("returns empty schema for unknown/any", () => {
		expect(signatureToSchema("unknown")).toEqual({});
		expect(signatureToSchema("any")).toEqual({});
	});

	it("falls back to object for complex types", () => {
		const schema = signatureToSchema("Map<string, number>");
		expect(schema.type).toBe("object");
	});
});

// ---------------------------------------------------------------------------
// buildReference
// ---------------------------------------------------------------------------

describe("buildReference", () => {
	it("includes children for classes", () => {
		const method = makeSymbol({
			name: "doSomething",
			kind: "method",
			visibility: Visibility.Public,
		});
		const cls = makeSymbol({
			name: "MyClass",
			kind: "class",
			children: [method],
		});

		const entries = buildReference([cls]);
		expect(entries).toHaveLength(1);
		expect(entries[0].children).toBeDefined();
		expect(entries[0].children?.[0].name).toBe("doSomething");
	});

	it("includes children for interfaces", () => {
		const prop = makeProperty("value", "string", true);
		const iface = makeSymbol({
			name: "MyInterface",
			kind: "interface",
			children: [prop],
		});

		const entries = buildReference([iface]);
		expect(entries[0].children).toBeDefined();
		expect(entries[0].children?.[0].name).toBe("value");
	});

	it("excludes @internal symbols from top-level", () => {
		const symbols = [
			makeSymbol({ name: "PublicFn", kind: "function", visibility: Visibility.Public }),
			makeSymbol({ name: "InternalFn", kind: "function", visibility: Visibility.Internal }),
		];

		const entries = buildReference(symbols);
		const names = entries.map((e) => e.name);
		expect(names).toContain("PublicFn");
		expect(names).not.toContain("InternalFn");
	});

	it("excludes @internal children from nested entries", () => {
		const internalChild = makeSymbol({
			name: "_hidden",
			kind: "method",
			visibility: Visibility.Internal,
		});
		const cls = makeSymbol({
			name: "MyClass",
			kind: "class",
			children: [internalChild],
		});

		const entries = buildReference([cls]);
		expect(entries[0].children).toBeUndefined();
	});

	it("populates params, returns, and throws from TSDoc", () => {
		const fn = makeSymbol({
			name: "compute",
			kind: "function",
			documentation: {
				summary: "Computes a value.",
				params: [{ name: "x", description: "The input.", type: "number" }],
				returns: { description: "The result.", type: "number" },
				throws: [{ type: "Error", description: "On invalid input." }],
			},
		});

		const entries = buildReference([fn]);
		expect(entries[0].params?.[0].name).toBe("x");
		expect(entries[0].returns?.description).toBe("The result.");
		expect(entries[0].throws?.[0].type).toBe("Error");
	});

	it("sorts entries by name", () => {
		const symbols = [
			makeSymbol({ name: "Zebra", kind: "interface" }),
			makeSymbol({ name: "Apple", kind: "interface" }),
			makeSymbol({ name: "Mango", kind: "interface" }),
		];

		const entries = buildReference(symbols);
		expect(entries.map((e) => e.name)).toEqual(["Apple", "Mango", "Zebra"]);
	});
});

// ---------------------------------------------------------------------------
// extractSDKTypes
// ---------------------------------------------------------------------------

describe("extractSDKTypes", () => {
	it("pulls properties from children of interfaces", () => {
		const iface = makeSymbol({
			name: "Options",
			kind: "interface",
			children: [makeProperty("timeout", "number", true), makeProperty("retries", "number", false)],
		});

		const types = extractSDKTypes([iface]);
		expect(types).toHaveLength(1);
		expect(types[0].properties).toHaveLength(2);
		expect(types[0].properties[0].name).toBe("timeout");
		expect(types[0].properties[0].required).toBe(true);
		expect(types[0].properties[1].name).toBe("retries");
		expect(types[0].properties[1].required).toBe(false);
	});

	it("excludes @internal symbols", () => {
		const types = extractSDKTypes([
			makeSymbol({ name: "Public", kind: "interface", visibility: Visibility.Public }),
			makeSymbol({ name: "Internal", kind: "interface", visibility: Visibility.Internal }),
		]);

		expect(types.map((t) => t.name)).toContain("Public");
		expect(types.map((t) => t.name)).not.toContain("Internal");
	});

	it("excludes non-exported symbols", () => {
		const types = extractSDKTypes([
			makeSymbol({ name: "Exported", kind: "interface", exported: true }),
			makeSymbol({ name: "NotExported", kind: "interface", exported: false }),
		]);

		expect(types.map((t) => t.name)).toContain("Exported");
		expect(types.map((t) => t.name)).not.toContain("NotExported");
	});

	it("includes enums with member properties", () => {
		const en = makeSymbol({
			name: "Color",
			kind: "enum",
			children: [makeProperty("Red", '"red"', true), makeProperty("Blue", '"blue"', true)],
		});

		const types = extractSDKTypes([en]);
		expect(types[0].kind).toBe("enum");
		expect(types[0].properties).toHaveLength(2);
	});

	it("extracts description from documentation summary", () => {
		const sym = makeSymbol({
			name: "Described",
			kind: "type",
			documentation: { summary: "A helpful description." },
		});

		const types = extractSDKTypes([sym]);
		expect(types[0].description).toBe("A helpful description.");
	});
});
