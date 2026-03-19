import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { describe, expect, it } from "vitest";
import { generateSkillMd } from "../skill.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ForgeConfig["project"]> = {}): ForgeConfig {
	return {
		rootDir: "/project",
		tsconfig: "/project/tsconfig.json",
		outDir: "/project/docs",
		enforce: { enabled: false, minVisibility: Visibility.Public, strict: false },
		doctest: { enabled: false, cacheDir: "/project/.cache" },
		api: { enabled: false, openapi: false, openapiPath: "/project/docs/openapi.json" },
		gen: {
			enabled: true,
			formats: ["markdown"],
			llmsTxt: true,
			readmeSync: false,
		},
		project: {
			packageName: "my-lib",
			...overrides,
		},
	};
}

function sym(overrides: Partial<ForgeSymbol> & Pick<ForgeSymbol, "name" | "kind">): ForgeSymbol {
	return {
		visibility: Visibility.Public,
		filePath: "/project/src/index.ts",
		line: 1,
		column: 0,
		exported: true,
		...overrides,
	};
}

const fnAdd = sym({
	name: "add",
	kind: "function",
	signature: "function add(a: number, b: number): number",
	documentation: {
		summary: "Adds two numbers together.",
		params: [
			{ name: "a", description: "First number", type: "number" },
			{ name: "b", description: "Second number", type: "number" },
		],
		returns: { description: "The sum of a and b", type: "number" },
		examples: [{ code: "add(1, 2) // => 3", language: "typescript", line: 10 }],
	},
});

const fnNoExample = sym({
	name: "subtract",
	kind: "function",
	signature: "function subtract(a: number, b: number): number",
	documentation: {
		summary: "Subtracts b from a.",
	},
});

const ifaceConfig = sym({
	name: "MyConfig",
	kind: "interface",
	documentation: { summary: "Configuration options." },
	children: [
		sym({
			name: "rootDir",
			kind: "property",
			signature: "rootDir: string",
			documentation: { summary: "Root directory." },
		}),
		sym({
			name: "strict",
			kind: "property",
			signature: "strict: boolean",
			documentation: { summary: "Enable strict mode." },
		}),
	],
});

const typeAlias = sym({
	name: "ID",
	kind: "type",
	signature: "type ID = string | number",
	documentation: { summary: "Identifier type." },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateSkillMd", () => {
	it("generates valid markdown with a top-level H1", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toMatch(/^# /m);
	});

	it("contains the project name in the heading", () => {
		const result = generateSkillMd([fnAdd], makeConfig({ packageName: "my-lib" }));
		expect(result).toContain("# my-lib");
	});

	it("uses rootDir basename as fallback when packageName is absent", () => {
		const result = generateSkillMd([fnAdd], makeConfig({ packageName: undefined }));
		// rootDir is /project → fallback is "project"
		expect(result).toContain("# project");
	});

	it("contains an Installation section with a bash code block", () => {
		const result = generateSkillMd([fnAdd], makeConfig({ packageName: "my-lib" }));
		expect(result).toContain("## Installation");
		expect(result).toContain("```bash");
		expect(result).toContain("npm install -D my-lib");
	});

	it("contains function patterns derived from @example blocks", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("## Common Patterns");
		expect(result).toContain("### add");
		expect(result).toContain("add(1, 2) // => 3");
	});

	it("omits Common Patterns section when no symbols have @example blocks", () => {
		const result = generateSkillMd([fnNoExample], makeConfig());
		expect(result).not.toContain("## Common Patterns");
	});

	it("contains an API quick-reference table", () => {
		const result = generateSkillMd([fnAdd, fnNoExample], makeConfig());
		expect(result).toContain("## API Quick Reference");
		expect(result).toContain("| Symbol | Signature | Description |");
		expect(result).toContain("`add()`");
		expect(result).toContain("`subtract()`");
	});

	it("includes function summary in the API table", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("Adds two numbers together.");
	});

	it("lists types and interfaces in Key Concepts section", () => {
		const result = generateSkillMd([ifaceConfig, typeAlias], makeConfig());
		expect(result).toContain("## Key Concepts");
		expect(result).toContain("`MyConfig`");
		expect(result).toContain("`ID`");
	});

	it("renders Configuration section from an interface named *Config with children", () => {
		const result = generateSkillMd([ifaceConfig], makeConfig());
		expect(result).toContain("## Configuration");
		expect(result).toContain("`rootDir`");
		expect(result).toContain("`strict`");
	});

	it("skips Configuration section when no config-like interface is present", () => {
		const result = generateSkillMd([fnAdd, typeAlias], makeConfig());
		expect(result).not.toContain("## Configuration");
	});

	it("handles an empty symbol list gracefully without throwing", () => {
		expect(() => generateSkillMd([], makeConfig())).not.toThrow();
	});

	it("produces a non-empty string for an empty symbol list", () => {
		const result = generateSkillMd([], makeConfig());
		expect(result.length).toBeGreaterThan(0);
		expect(result).toContain("## Installation");
		expect(result).toContain("name:");  // YAML frontmatter
	});

	it("excludes unexported symbols from all sections", () => {
		const secret = sym({ name: "internalFn", kind: "function", exported: false });
		const result = generateSkillMd([fnAdd, secret], makeConfig());
		expect(result).not.toContain("internalFn");
	});

	it("omits method and property rows from the API table", () => {
		const method = sym({ name: "log", kind: "method", exported: true });
		const result = generateSkillMd([method], makeConfig());
		// Table should not appear if the only symbol is a method
		expect(result).not.toContain("| `log()`");
	});

	it("ends with a single trailing newline", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result.endsWith("\n")).toBe(true);
		expect(result.endsWith("\n\n")).toBe(false);
	});
});
