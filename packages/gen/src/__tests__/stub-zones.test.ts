import { describe, expect, it } from "vitest";
import { isStubModified, stubHash, updateStubSections } from "../markdown-utils.js";

// ---------------------------------------------------------------------------
// stubHash
// ---------------------------------------------------------------------------

describe("stubHash", () => {
	it("returns an 8-character string", () => {
		const hash = stubHash("hello world");
		expect(hash).toHaveLength(8);
	});

	it("is deterministic for the same input", () => {
		expect(stubHash("test content")).toBe(stubHash("test content"));
	});

	it("produces different hashes for different input", () => {
		expect(stubHash("content A")).not.toBe(stubHash("content B"));
	});

	it("handles empty string", () => {
		const hash = stubHash("");
		expect(hash).toHaveLength(8);
		expect(typeof hash).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// updateStubSections — insertion
// ---------------------------------------------------------------------------

describe("updateStubSections", () => {
	it("inserts a new stub with hash when it does not exist", () => {
		const existing = "# My Doc\n\nSome content.\n";
		const result = updateStubSections(existing, [
			{ id: "getting-started", content: "TODO: Write getting started guide." },
		]);

		expect(result).toContain("<!-- FORGE:STUB-START getting-started -->");
		expect(result).toContain("<!-- FORGE:STUB-END getting-started -->");
		expect(result).toContain("<!-- FORGE:STUB-HASH");
		expect(result).toContain("TODO: Write getting started guide.");
	});

	it("includes the correct hash for generated content", () => {
		const content = "TODO: Fill this in.";
		const hash = stubHash(content);
		const result = updateStubSections("# Doc\n", [{ id: "intro", content }]);

		expect(result).toContain(`<!-- FORGE:STUB-HASH ${hash} -->`);
	});

	// ---------------------------------------------------------------------------
	// updateStubSections — unmodified regeneration
	// ---------------------------------------------------------------------------

	it("regenerates an unmodified stub (hash matches)", () => {
		const originalContent = "TODO: Old placeholder.";
		const hash = stubHash(originalContent);

		const existing = [
			"# Doc",
			"",
			"<!-- FORGE:STUB-START intro -->",
			`<!-- FORGE:STUB-HASH ${hash} -->`,
			originalContent,
			"<!-- FORGE:STUB-END intro -->",
		].join("\n");

		const newContent = "TODO: New and improved placeholder.";
		const result = updateStubSections(existing, [{ id: "intro", content: newContent }]);

		expect(result).toContain(newContent);
		expect(result).not.toContain(originalContent);
		expect(result).toContain(`<!-- FORGE:STUB-HASH ${stubHash(newContent)} -->`);
	});

	// ---------------------------------------------------------------------------
	// updateStubSections — modified preservation
	// ---------------------------------------------------------------------------

	it("preserves a modified stub (user edited content)", () => {
		const generatedContent = "TODO: Fill this in.";
		const hash = stubHash(generatedContent);

		const userContent = "This is my custom guide that I wrote by hand.";
		const existing = [
			"# Doc",
			"",
			"<!-- FORGE:STUB-START guide -->",
			`<!-- FORGE:STUB-HASH ${hash} -->`,
			userContent,
			"<!-- FORGE:STUB-END guide -->",
		].join("\n");

		const result = updateStubSections(existing, [{ id: "guide", content: "TODO: Fill this in." }]);

		// The user's content should be preserved because the inner content
		// no longer matches the hash
		expect(result).toContain(userContent);
	});

	it("preserves a stub when user removed the hash comment", () => {
		const userContent = "My custom content without any hash.";
		const existing = [
			"# Doc",
			"",
			"<!-- FORGE:STUB-START guide -->",
			userContent,
			"<!-- FORGE:STUB-END guide -->",
		].join("\n");

		const result = updateStubSections(existing, [
			{ id: "guide", content: "TODO: New generated content." },
		]);

		// No hash means we treat it as modified — preserve
		expect(result).toContain(userContent);
		expect(result).not.toContain("TODO: New generated content.");
	});

	// ---------------------------------------------------------------------------
	// updateStubSections — multiple stubs
	// ---------------------------------------------------------------------------

	it("handles multiple stubs in one document", () => {
		const existing = "# Doc\n\nIntro paragraph.\n";
		const result = updateStubSections(existing, [
			{ id: "overview", content: "TODO: Overview" },
			{ id: "quickstart", content: "TODO: Quickstart" },
			{ id: "faq", content: "TODO: FAQ" },
		]);

		expect(result).toContain("<!-- FORGE:STUB-START overview -->");
		expect(result).toContain("<!-- FORGE:STUB-END overview -->");
		expect(result).toContain("<!-- FORGE:STUB-START quickstart -->");
		expect(result).toContain("<!-- FORGE:STUB-END quickstart -->");
		expect(result).toContain("<!-- FORGE:STUB-START faq -->");
		expect(result).toContain("<!-- FORGE:STUB-END faq -->");
		expect(result).toContain("TODO: Overview");
		expect(result).toContain("TODO: Quickstart");
		expect(result).toContain("TODO: FAQ");
	});

	it("regenerates one unmodified stub while preserving another modified stub", () => {
		const genA = "TODO: Section A content.";
		const hashA = stubHash(genA);
		const genB = "TODO: Section B content.";
		const hashB = stubHash(genB);

		const existing = [
			"# Doc",
			"",
			"<!-- FORGE:STUB-START section-a -->",
			`<!-- FORGE:STUB-HASH ${hashA} -->`,
			genA,
			"<!-- FORGE:STUB-END section-a -->",
			"",
			"<!-- FORGE:STUB-START section-b -->",
			`<!-- FORGE:STUB-HASH ${hashB} -->`,
			"User wrote their own content for section B.",
			"<!-- FORGE:STUB-END section-b -->",
		].join("\n");

		const newGenA = "TODO: Updated Section A.";
		const result = updateStubSections(existing, [
			{ id: "section-a", content: newGenA },
			{ id: "section-b", content: genB },
		]);

		// section-a was unmodified, should be regenerated
		expect(result).toContain(newGenA);
		expect(result).toContain(`<!-- FORGE:STUB-HASH ${stubHash(newGenA)} -->`);

		// section-b was modified, should be preserved
		expect(result).toContain("User wrote their own content for section B.");
	});

	// ---------------------------------------------------------------------------
	// Mixed FORGE:AUTO and FORGE:STUB
	// ---------------------------------------------------------------------------

	it("does not interfere with FORGE:AUTO sections in the same document", () => {
		const stubContent = "TODO: Write about concepts.";
		const stubHashVal = stubHash(stubContent);

		const existing = [
			"# Doc",
			"",
			"<!-- FORGE:AUTO-START api-table -->",
			"| Name | Type |",
			"| --- | --- |",
			"| add | function |",
			"<!-- FORGE:AUTO-END api-table -->",
			"",
			"<!-- FORGE:STUB-START concepts -->",
			`<!-- FORGE:STUB-HASH ${stubHashVal} -->`,
			stubContent,
			"<!-- FORGE:STUB-END concepts -->",
		].join("\n");

		const newStubContent = "TODO: Updated concepts.";
		const result = updateStubSections(existing, [{ id: "concepts", content: newStubContent }]);

		// AUTO section should be untouched
		expect(result).toContain("<!-- FORGE:AUTO-START api-table -->");
		expect(result).toContain("| add | function |");
		expect(result).toContain("<!-- FORGE:AUTO-END api-table -->");

		// STUB section should be regenerated (was unmodified)
		expect(result).toContain(newStubContent);
	});

	// ---------------------------------------------------------------------------
	// Code block protection
	// ---------------------------------------------------------------------------

	it("does not match FORGE:STUB markers inside code blocks", () => {
		const existing = [
			"# Doc",
			"",
			"Here is an example:",
			"",
			"```markdown",
			"<!-- FORGE:STUB-START example -->",
			"This is in a code block.",
			"<!-- FORGE:STUB-END example -->",
			"```",
		].join("\n");

		const result = updateStubSections(existing, [{ id: "example", content: "TODO: New content." }]);

		// The marker is inside a code block, so it should NOT be matched.
		// Instead the stub should be appended at the end.
		expect(result).toContain("```markdown");
		expect(result).toContain("This is in a code block.");

		// Count occurrences of STUB-START — should be 2 (one in code block, one appended)
		const startMatches = result.match(/FORGE:STUB-START example/g);
		expect(startMatches).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// isStubModified
// ---------------------------------------------------------------------------

describe("isStubModified", () => {
	it("returns false when section does not exist", () => {
		expect(isStubModified("# Empty doc", "missing", "content")).toBe(false);
	});

	it("returns false when stub is unmodified (content matches hash)", () => {
		const content = "TODO: Generated placeholder.";
		const hash = stubHash(content);
		const doc = [
			"<!-- FORGE:STUB-START intro -->",
			`<!-- FORGE:STUB-HASH ${hash} -->`,
			content,
			"<!-- FORGE:STUB-END intro -->",
		].join("\n");

		expect(isStubModified(doc, "intro", content)).toBe(false);
	});

	it("returns true when stub content was edited by user", () => {
		const generatedContent = "TODO: Generated placeholder.";
		const hash = stubHash(generatedContent);
		const doc = [
			"<!-- FORGE:STUB-START intro -->",
			`<!-- FORGE:STUB-HASH ${hash} -->`,
			"I replaced the placeholder with real content!",
			"<!-- FORGE:STUB-END intro -->",
		].join("\n");

		expect(isStubModified(doc, "intro", generatedContent)).toBe(true);
	});

	it("returns true when hash comment was removed", () => {
		const doc = [
			"<!-- FORGE:STUB-START intro -->",
			"User content without hash.",
			"<!-- FORGE:STUB-END intro -->",
		].join("\n");

		expect(isStubModified(doc, "intro", "anything")).toBe(true);
	});
});
