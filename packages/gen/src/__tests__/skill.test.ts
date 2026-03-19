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

function makeConfigWithCli(overrides: Partial<ForgeConfig["project"]> = {}): ForgeConfig {
	return makeConfig({
		bin: { "my-cli": "./dist/cli.js" },
		scripts: { check: "my-cli check", build: "my-cli build", test: "my-cli test" },
		...overrides,
	});
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
// generateSkillMd — core output tests
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
		expect(result).toContain("## Quick Start");
		expect(result).toContain("```bash");
		expect(result).toContain("npm install my-lib");
	});

	it("contains API section with function table", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("## API");
		expect(result).toContain("`add()`");
	});

	it("omits API section when no functions exist", () => {
		const result = generateSkillMd([ifaceConfig], makeConfig());
		expect(result).not.toContain("## API");
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
		expect(result).toContain("## Quick Start");
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
	// YAML frontmatter compliance
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

	it("description contains numbered trigger scenarios", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toMatch(/\(1\)/);
	});

	it("description is under 1024 characters", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		const descMatch = result.match(/description: >\n([\s\S]*?)(?=\n---)/);
		if (descMatch) {
			const descContent = descMatch[1]
				.split("\n")
				.map((l) => l.replace(/^ {2}/, ""))
				.join("\n")
				.trim();
			expect(descContent.length).toBeLessThanOrEqual(1024);
		}
	});

	it("YAML frontmatter only has name and description (no license, metadata)", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		// Extract frontmatter block
		const fmMatch = result.match(/^---\n([\s\S]*?)\n---/);
		expect(fmMatch).toBeDefined();
		const fm = fmMatch![1];
		expect(fm).not.toContain("license:");
		expect(fm).not.toContain("compatibility:");
		expect(fm).not.toContain("metadata:");
	});

	it("SKILL.md is under 500 lines", () => {
		const result = generateSkillMd([fnAdd, fnNoExample, ifaceConfig, typeAlias], makeConfig());
		const lineCount = result.split("\n").length;
		expect(lineCount).toBeLessThan(500);
	});

	it("includes References section with pointers to bundled files", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("## References");
		expect(result).toContain("references/API-REFERENCE.md");
		expect(result).toContain("references/CONFIGURATION.md");
	});

	// -------------------------------------------------------------------------
	// Configuration section
	// -------------------------------------------------------------------------

	it("renders Configuration section with code example when config type exists", () => {
		const result = generateSkillMd([ifaceConfig], makeConfig());
		expect(result).toContain("## Configuration");
		expect(result).toContain("```typescript");
		expect(result).toContain("MyConfig");
	});

	it("omits Configuration section when no config-like types exist", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).not.toContain("## Configuration");
	});

	// -------------------------------------------------------------------------
	// CLI detection
	// -------------------------------------------------------------------------

	it("shows CLI commands in Quick Start when bin is present", () => {
		const result = generateSkillMd([fnAdd], makeConfigWithCli());
		expect(result).toContain("npx my-cli");
	});

	it("uses -D flag for install when CLI project", () => {
		const result = generateSkillMd([fnAdd], makeConfigWithCli());
		expect(result).toContain("npm install -D");
	});

	it("shows API example in Quick Start when no bin", () => {
		const result = generateSkillMd([fnAdd], makeConfig());
		expect(result).toContain("add(1, 2) // => 3");
	});

	// -------------------------------------------------------------------------
	// Description enrichment from package.json
	// -------------------------------------------------------------------------

	it("uses project.description as lead sentence when available", () => {
		const result = generateSkillMd(
			[fnAdd],
			makeConfig({ description: "A math utilities library." }),
		);
		expect(result).toContain("A math utilities library.");
	});

	it("includes keywords in description triggers", () => {
		const result = generateSkillMd(
			[fnAdd],
			makeConfig({ keywords: ["math", "utils"] }),
		);
		expect(result).toContain("math");
		expect(result).toContain("utils");
	});
});

// ---------------------------------------------------------------------------
// generateSkillPackage — directory structure tests
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

	it("includes at least one script file", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const scriptFiles = pkg.files.filter((f) => f.path.startsWith("scripts/"));
		expect(scriptFiles.length).toBeGreaterThanOrEqual(1);
	});

	it("generates purpose-built scripts when CLI is detected", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfigWithCli());
		const paths = pkg.files.map((f) => f.path);
		expect(paths).toContain("scripts/build.sh");
		expect(paths).toContain("scripts/check.sh");
		expect(paths).toContain("scripts/test.sh");
	});

	it("CLI scripts reference the correct bin name", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfigWithCli());
		const buildSh = pkg.files.find((f) => f.path === "scripts/build.sh");
		expect(buildSh?.content).toContain("npx my-cli build");
	});

	it("falls back to generic test.sh when no CLI detected", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const testSh = pkg.files.find((f) => f.path === "scripts/test.sh");
		expect(testSh?.content).toContain("npm test");
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
		const descMatch = skillMd?.content.match(/description: >\n([\s\S]*?)(?=\n---)/);
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

	it("API-REFERENCE.md has grouped sections with ToC", () => {
		const pkg = generateSkillPackage([fnAdd, ifaceConfig], makeConfig());
		const apiRef = pkg.files.find((f) => f.path === "references/API-REFERENCE.md");
		expect(apiRef?.content).toContain("## Table of Contents");
		expect(apiRef?.content).toContain("## Functions");
		expect(apiRef?.content).toContain("## Types");
	});

	it("API-REFERENCE.md contains full function signatures", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const apiRef = pkg.files.find((f) => f.path === "references/API-REFERENCE.md");
		expect(apiRef?.content).toContain("add");
		expect(apiRef?.content).toContain("Adds two numbers together.");
	});

	it("CONFIGURATION.md contains code example with inline comments", () => {
		const pkg = generateSkillPackage([ifaceConfig], makeConfig());
		const configMd = pkg.files.find((f) => f.path === "references/CONFIGURATION.md");
		expect(configMd?.content).toContain("MyConfig");
		expect(configMd?.content).toContain("```typescript");
		expect(configMd?.content).toContain("// Root directory.");
	});

	it("CONFIGURATION.md contains property table", () => {
		const pkg = generateSkillPackage([ifaceConfig], makeConfig());
		const configMd = pkg.files.find((f) => f.path === "references/CONFIGURATION.md");
		expect(configMd?.content).toContain("| Property | Type | Description |");
		expect(configMd?.content).toContain("rootDir");
		expect(configMd?.content).toContain("strict");
	});

	it("scripts are valid bash scripts", () => {
		const pkg = generateSkillPackage([fnAdd], makeConfig());
		const scriptFiles = pkg.files.filter((f) => f.path.startsWith("scripts/"));
		for (const script of scriptFiles) {
			expect(script.content).toContain("#!/usr/bin/env bash");
		}
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
