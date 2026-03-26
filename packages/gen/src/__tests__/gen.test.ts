import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { describe, expect, it } from "vitest";
import { generateLlmsFullTxt, generateLlmsTxt } from "../llms.js";
import { generateMarkdown } from "../markdown.js";
import { syncReadme } from "../readme-sync.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ForgeConfig["gen"]> = {}): ForgeConfig {
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

const fnSubtract = sym({
	name: "subtract",
	kind: "function",
	signature: "function subtract(a: number, b: number): number",
	documentation: {
		summary: "Subtracts b from a.",
		deprecated: "Use `math.sub()` instead.",
	},
});

const ifaceConfig = sym({
	name: "Config",
	kind: "interface",
	documentation: {
		summary: "Configuration options for the tool.",
	},
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

const classLogger = sym({
	name: "Logger",
	kind: "class",
	documentation: { summary: "A simple logger." },
	children: [
		sym({
			name: "log",
			kind: "method",
			signature: "log(message: string): void",
			documentation: { summary: "Logs a message." },
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
// Markdown tests
// ---------------------------------------------------------------------------

describe("generateMarkdown", () => {
	it("groups symbols by kind with H2 headers", () => {
		const result = generateMarkdown([fnAdd, ifaceConfig], makeConfig());
		expect(result).toContain("## Functions");
		expect(result).toContain("## Interfaces");
	});

	it("does not include a section for absent kinds", () => {
		const result = generateMarkdown([fnAdd], makeConfig());
		expect(result).not.toContain("## Interfaces");
		expect(result).not.toContain("## Classes");
	});

	it("generates a table of contents with anchor links", () => {
		const result = generateMarkdown([fnAdd, ifaceConfig], makeConfig());
		expect(result).toContain("## Table of Contents");
		expect(result).toContain("[Functions](#functions)");
		expect(result).toContain("[Interfaces](#interfaces)");
		expect(result).toContain("[`add()`](#add)");
		expect(result).toContain("[`Config`](#config)");
	});

	it("renders class children as nested sections", () => {
		const result = generateMarkdown([classLogger], makeConfig());
		expect(result).toContain("`log()`");
		expect(result).toContain("Logs a message.");
	});

	it("renders interface children as nested sections", () => {
		const result = generateMarkdown([ifaceConfig], makeConfig());
		expect(result).toContain("`rootDir`");
		expect(result).toContain("`strict`");
	});

	it("shows deprecation notice for deprecated symbols", () => {
		const result = generateMarkdown([fnSubtract], makeConfig());
		expect(result).toContain("**Deprecated**");
		expect(result).toContain("Use `math.sub()` instead.");
	});

	it("includes source link with relative path", () => {
		const result = generateMarkdown([fnAdd], makeConfig());
		// filePath is /project/src/index.ts, rootDir is /project → relative is src/index.ts
		expect(result).toContain("src/index.ts:1");
	});

	it("adds docusaurus frontmatter when ssgTarget is docusaurus", () => {
		const result = generateMarkdown([fnAdd], makeConfig({ ssgTarget: "docusaurus" }));
		expect(result).toMatch(/^---\nsidebar_position: 1\ntitle: API Reference\n---/);
	});

	it("adds mintlify frontmatter when ssgTarget is mintlify", () => {
		const result = generateMarkdown([fnAdd], makeConfig({ ssgTarget: "mintlify" }));
		expect(result).toMatch(/^---\ntitle: API Reference\n---/);
	});

	it("adds nextra frontmatter when ssgTarget is nextra", () => {
		const result = generateMarkdown([fnAdd], makeConfig({ ssgTarget: "nextra" }));
		expect(result).toContain("description: Auto-generated API reference");
	});

	it("adds vitepress frontmatter when ssgTarget is vitepress", () => {
		const result = generateMarkdown([fnAdd], makeConfig({ ssgTarget: "vitepress" }));
		expect(result).toContain("outline: deep");
	});

	it("adds no frontmatter when ssgTarget is not set", () => {
		const result = generateMarkdown([fnAdd], makeConfig());
		expect(result).not.toMatch(/^---/);
	});

	it("MDX mode adds component import at the top", () => {
		const result = generateMarkdown([fnAdd], makeConfig({ formats: ["mdx"] }), { mdx: true });
		expect(result).toContain("import { Callout }");
	});

	it("renders only exported symbols", () => {
		const unexported = sym({ name: "secret", kind: "function", exported: false });
		const result = generateMarkdown([fnAdd, unexported], makeConfig());
		expect(result).toContain("`add()`");
		expect(result).not.toContain("`secret()`");
	});

	it("handles empty symbol list gracefully", () => {
		const result = generateMarkdown([], makeConfig());
		expect(result).toContain("# API Reference");
		expect(result).not.toContain("## Table of Contents");
	});
});

// ---------------------------------------------------------------------------
// llms.txt tests
// ---------------------------------------------------------------------------

describe("generateLlmsTxt", () => {
	it("produces a routing manifest with Sections block", () => {
		const result = generateLlmsTxt([fnAdd], makeConfig());
		expect(result).toContain("## Sections");
		expect(result).toContain("./api-reference.md");
	});

	it("includes Quick Reference block with compact entries", () => {
		const result = generateLlmsTxt([fnAdd, ifaceConfig], makeConfig());
		expect(result).toContain("## Quick Reference");
		expect(result).toContain("Adds two numbers together.");
		expect(result).toContain("Configuration options for the tool.");
	});

	it("links to llms-full.txt when llmsTxt is enabled", () => {
		const result = generateLlmsTxt([fnAdd], makeConfig({ llmsTxt: true }));
		expect(result).toContain("llms-full.txt");
	});

	it("handles empty symbol list", () => {
		const result = generateLlmsTxt([], makeConfig());
		expect(result).toContain("## Sections");
		expect(result).not.toContain("## Quick Reference");
	});
});

// ---------------------------------------------------------------------------
// llms-full.txt tests
// ---------------------------------------------------------------------------

describe("generateLlmsFullTxt", () => {
	it("includes full details: params, returns, examples", () => {
		const result = generateLlmsFullTxt([fnAdd], makeConfig());
		expect(result).toContain("### add()");
		expect(result).toContain("Parameters:");
		expect(result).toContain("- a (number): First number");
		expect(result).toContain("Returns (number): The sum of a and b");
		expect(result).toContain("Example:");
		expect(result).toContain("add(1, 2) // => 3");
	});

	it("groups by kind with H2 headers", () => {
		const result = generateLlmsFullTxt([fnAdd, ifaceConfig], makeConfig());
		expect(result).toContain("## Functions");
		expect(result).toContain("## Interfaces");
	});

	it("shows deprecation notice", () => {
		const result = generateLlmsFullTxt([fnSubtract], makeConfig());
		expect(result).toContain("DEPRECATED: Use `math.sub()` instead.");
	});

	it("renders interface members inline", () => {
		const result = generateLlmsFullTxt([ifaceConfig], makeConfig());
		expect(result).toContain("Members:");
		expect(result).toContain("rootDir");
		expect(result).toContain("strict");
	});

	it("handles empty symbol list gracefully", () => {
		const result = generateLlmsFullTxt([], makeConfig());
		expect(result).toContain("# project — Full Context");
		expect(result).not.toContain("## Functions");
	});
});

// ---------------------------------------------------------------------------
// readme-sync tests
// ---------------------------------------------------------------------------

describe("syncReadme", () => {
	async function tmpReadme(content = ""): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "forge-test-"));
		const path = join(dir, "README.md");
		if (content) {
			await writeFile(path, content, "utf8");
		}
		return path;
	}

	it("injects API table between existing markers", async () => {
		const initial = `# My Project\n\n${`<!-- forge-ts:start -->`}\n${`<!-- forge-ts:end -->`}\n`;
		const path = await tmpReadme(initial);
		await syncReadme(path, [fnAdd]);
		const result = await readFile(path, "utf8");
		expect(result).toMatch(/\|\s*Symbol\s*\|\s*Kind\s*\|\s*Description\s*\|/);
		expect(result).toContain("add");
		expect(result).toContain("function");
	});

	it("appends markers and table when none exist", async () => {
		const path = await tmpReadme("# My Project\n");
		await syncReadme(path, [ifaceConfig]);
		const result = await readFile(path, "utf8");
		expect(result).toContain("<!-- forge-ts:start -->");
		expect(result).toContain("<!-- forge-ts:end -->");
		expect(result).toContain("Config");
	});

	it("handles an empty README (no existing content)", async () => {
		const path = await tmpReadme();
		const modified = await syncReadme(path, [fnAdd]);
		expect(modified).toBe(true);
		const result = await readFile(path, "utf8");
		expect(result).toContain("## API Overview");
	});

	it("returns false when no exported symbols are provided", async () => {
		const path = await tmpReadme("# Hello\n");
		const modified = await syncReadme(path, []);
		expect(modified).toBe(false);
	});

	it("generates markdown table format with type signatures", async () => {
		const path = await tmpReadme();
		await syncReadme(path, [fnAdd, ifaceConfig]);
		const result = await readFile(path, "utf8");
		// remark-gfm table serializer uses column-aligned padding
		expect(result).toMatch(/\|\s*Symbol\s*\|\s*Kind\s*\|\s*Description\s*\|/);
		expect(result).toMatch(/\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/);
		// signatures should appear in cells
		expect(result).toMatch(/`[^`]+add[^`]*`/);
	});

	it("replaces old content between markers on subsequent runs", async () => {
		const initial = `# Docs\n<!-- forge-ts:start -->\n## Old content\n<!-- forge-ts:end -->\n`;
		const path = await tmpReadme(initial);
		await syncReadme(path, [typeAlias]);
		const result = await readFile(path, "utf8");
		expect(result).not.toContain("Old content");
		expect(result).toContain("ID");
	});

	it("includes examples when includeExamples option is true", async () => {
		const path = await tmpReadme();
		await syncReadme(path, [fnAdd], { includeExamples: true });
		const result = await readFile(path, "utf8");
		expect(result).toContain("### Examples");
		expect(result).toContain("add(1, 2)");
	});

	it("includes badge when badge option is true", async () => {
		const path = await tmpReadme();
		await syncReadme(path, [fnAdd], { badge: true });
		const result = await readFile(path, "utf8");
		expect(result).toContain("forge-ts");
		expect(result).toContain("img.shields.io");
	});
});
