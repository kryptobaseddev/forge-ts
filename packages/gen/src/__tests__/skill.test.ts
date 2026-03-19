import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";
import { Visibility } from "@forge-ts/core";
import { describe, expect, it } from "vitest";
import { generateSkillMd, generateSkillPackage } from "../skill.js";

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
// generateSkillMd — legacy backward-compat tests
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

	it("contains a Quick Start section with a bash code block", () => {
		const result = generateSkillMd([fnAdd], makeConfig({ packageName: "my-lib" }));
		expect(result).toContain("## Installation");
		expect(result).toContain("```bash");
		expect(result).toContain("npm install my-lib");
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

	it("includes function summary in the output", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("Adds two numbers together.");
	});

	it("lists types and interfaces in Key Types section", () => {
		const result = generateSkillMd([ifaceConfig, typeAlias], makeConfig());
		expect(result).toContain("## Key Types");
		expect(result).toContain("`MyConfig`");
		expect(result).toContain("`ID`");
	});

	it("handles an empty symbol list gracefully without throwing", () => {
		expect(() => generateSkillMd([], makeConfig())).not.toThrow();
	});

	it("produces a non-empty string for an empty symbol list", () => {
		const result = generateSkillMd([], makeConfig());
		expect(result.length).toBeGreaterThan(0);
		expect(result).toContain("## Installation");
		expect(result).toContain("name:"); // YAML frontmatter
	});

	it("excludes unexported symbols from all sections", () => {
		const secret = sym({ name: "internalFn", kind: "function", exported: false });
		const result = generateSkillMd([fnAdd, secret], makeConfig());
		expect(result).not.toContain("internalFn");
	});

	it("omits method and property rows from the key types section", () => {
		const method = sym({ name: "log", kind: "method", exported: true });
		const result = generateSkillMd([method], makeConfig());
		expect(result).not.toContain("log");
	});

	it("ends with a single trailing newline", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result.endsWith("\n")).toBe(true);
		expect(result.endsWith("\n\n")).toBe(false);
	});

	// -------------------------------------------------------------------------
	// YAML frontmatter compliance (agentskills.io spec)
	// -------------------------------------------------------------------------

	it("YAML frontmatter contains name field", () => {
		const result = generateSkillMd([fnAdd], makeConfig({ packageName: "my-lib" }));
		expect(result).toContain("name:");
	});

	it("YAML frontmatter name is lowercase with hyphens only", () => {
		const result = generateSkillMd([fnAdd], makeConfig({ packageName: "MyLib" }));
		expect(result).toMatch(/name: [a-z0-9-]+/);
		expect(result).not.toMatch(/name: [A-Z]/);
	});

	it("YAML frontmatter contains description field", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("description:");
	});

	it("description uses imperative phrasing with 'Use'", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("Use");
	});

	it("description is under 1024 characters", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		// Extract the description value from the YAML block scalar
		const descMatch = result.match(/description: >\n([\s\S]*?)(?=\nlicense:)/);
		if (descMatch) {
			const descContent = descMatch[1]
				.split("\n")
				.map((l) => l.replace(/^ {2}/, ""))
				.join("\n")
				.trim();
			expect(descContent.length).toBeLessThanOrEqual(1024);
		}
	});

	it("YAML frontmatter contains license field", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("license: MIT");
	});

	it("SKILL.md is under 500 lines", () => {
		const result = generateSkillMd([fnAdd, fnNoExample, ifaceConfig, typeAlias], makeConfig());
		const lineCount = result.split("\n").length;
		expect(lineCount).toBeLessThan(500);
	});
});

// ---------------------------------------------------------------------------
// generateSkillPackage — new directory structure tests
// ---------------------------------------------------------------------------

describe("generateSkillPackage", () => {
	it("returns a SkillPackage with directoryName and files array", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig({ packageName: "my-lib" }));
		expect(pkg).toHaveProperty("directoryName");
		expect(pkg).toHaveProperty("files");
		expect(Array.isArray(pkg.files)).toBe(true);
	});

	it("directoryName is lowercase-hyphenated", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig({ packageName: "MyLib" }));
		expect(pkg.directoryName).toMatch(/^[a-z0-9-]+$/);
	});

	it("directoryName matches the name field in SKILL.md frontmatter", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig({ packageName: "my-lib" }));
		const skillMd = pkg.files.find((f) => f.path === "SKILL.md");
		expect(skillMd).toBeDefined();
		expect(skillMd?.content).toContain(`name: ${pkg.directoryName}`);
	});

	it("includes SKILL.md file", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const paths = pkg.files.map((f) => f.path);
		expect(paths).toContain("SKILL.md");
	});

	it("includes references/API-REFERENCE.md file", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const paths = pkg.files.map((f) => f.path);
		expect(paths).toContain("references/API-REFERENCE.md");
	});

	it("includes references/CONFIGURATION.md file", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const paths = pkg.files.map((f) => f.path);
		expect(paths).toContain("references/CONFIGURATION.md");
	});

	it("includes scripts/check.sh file", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const paths = pkg.files.map((f) => f.path);
		expect(paths).toContain("scripts/test.sh");
	});

	it("SKILL.md content has valid YAML frontmatter with name", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig({ packageName: "test-pkg" }));
		const skillMd = pkg.files.find((f) => f.path === "SKILL.md");
		expect(skillMd?.content).toContain("name: test-pkg");
	});

	it("SKILL.md description uses imperative phrasing", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const skillMd = pkg.files.find((f) => f.path === "SKILL.md");
		expect(skillMd?.content).toContain("Use");
	});

	it("SKILL.md description is under 1024 chars", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const skillMd = pkg.files.find((f) => f.path === "SKILL.md");
		const descMatch = skillMd?.content.match(/description: >\n([\s\S]*?)(?=\nlicense:)/);
		if (descMatch) {
			const descContent = descMatch[1]
				.split("\n")
				.map((l) => l.replace(/^ {2}/, ""))
				.join("\n")
				.trim();
			expect(descContent.length).toBeLessThanOrEqual(1024);
		}
	});

	it("SKILL.md is under 500 lines", () => {
		const pkg = generateSkillPackage([fnAdd, fnNoExample, ifaceConfig, typeAlias], makeConfig());
		const skillMd = pkg.files.find((f) => f.path === "SKILL.md");
		const lineCount = skillMd?.content.split("\n").length ?? 0;
		expect(lineCount).toBeLessThan(500);
	});

	it("API-REFERENCE.md contains full function signatures", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const apiRef = pkg.files.find((f) => f.path === "references/API-REFERENCE.md");
		expect(apiRef?.content).toContain("add");
		expect(apiRef?.content).toContain("Adds two numbers together.");
	});

	it("CONFIGURATION.md contains config interface properties", () => {
		const pkg = generateSkillPackage([ifaceConfig], makeConfig());
		const configMd = pkg.files.find((f) => f.path === "references/CONFIGURATION.md");
		expect(configMd?.content).toContain("MyConfig");
		expect(configMd?.content).toContain("rootDir");
		expect(configMd?.content).toContain("strict");
	});

	it("scripts/test.sh is a valid bash script", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig({ packageName: "my-lib" }));
		const checkSh = pkg.files.find((f) => f.path === "scripts/test.sh");
		expect(checkSh?.content).toContain("#!/usr/bin/env bash");
		expect(checkSh?.content).toContain("npm test");
	});

	it("handles empty symbol list without throwing", () => {
		expect(() => generateSkillPackage([], makeConfig())).not.toThrow();
	});

	it("directoryName max length is 64 chars", () => {
		const longName = "a".repeat(100);
		const pkg = generateSkillPackage([], makeConfig({ packageName: longName }));
		expect(pkg.directoryName.length).toBeLessThanOrEqual(64);
	});
});
