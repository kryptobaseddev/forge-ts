import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	type DocBlock,
	type DocCodeSpan,
	type DocComment,
	type DocFencedCode,
	type DocLinkTag,
	type DocNode,
	DocNodeKind,
	type DocParagraph,
	type DocPlainText,
	type DocSection,
	StandardTags,
	TSDocConfiguration,
	TSDocParser,
} from "@microsoft/tsdoc";
import ts from "typescript";
import type { ForgeConfig, ForgeSymbol } from "./types.js";
import { resolveVisibility } from "./visibility.js";

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

/**
 * The return type of {@link createWalker}.
 * @public
 */
export interface ASTWalker {
	/**
	 * Walk all source files referenced by the configured tsconfig and return
	 * one {@link ForgeSymbol} per exported declaration.
	 */
	walk(): ForgeSymbol[];
}

// ---------------------------------------------------------------------------
// TSDoc helpers
// ---------------------------------------------------------------------------

/** Render inline nodes (PlainText, CodeSpan, SoftBreak) to a plain string. @internal */
function renderInlineNodes(nodes: readonly DocNode[]): string {
	const parts: string[] = [];
	for (const node of nodes) {
		switch (node.kind) {
			case DocNodeKind.PlainText:
				parts.push((node as DocPlainText).text);
				break;
			case DocNodeKind.CodeSpan:
				parts.push(`\`${(node as DocCodeSpan).code}\``);
				break;
			case DocNodeKind.SoftBreak:
				parts.push(" ");
				break;
			case DocNodeKind.Paragraph:
				// Recurse into paragraph nodes to extract nested text
				parts.push(renderInlineNodes((node as DocParagraph).nodes));
				break;
			default:
				break;
		}
	}
	return parts.join("");
}

/** Render a `DocSection` (or similar node) to a plain string. @internal */
function renderDocSection(section: DocSection | undefined): string {
	if (!section) return "";
	return renderInlineNodes(section.nodes).trim();
}

/** Render a `DocBlock`'s content to a plain string. @internal */
function renderBlock(block: DocBlock): string {
	return renderDocSection(block.content);
}

/** Extract all `@example` fenced code blocks from a parsed comment. @internal */
function extractExamples(
	comment: DocComment,
	startLine: number,
): Array<{ code: string; language: string; line: number }> {
	const examples: Array<{ code: string; language: string; line: number }> = [];

	for (const block of comment.customBlocks) {
		if (block.blockTag.tagName.toLowerCase() !== "@example") continue;

		for (const node of block.content.nodes) {
			if (node.kind === DocNodeKind.FencedCode) {
				const fenced = node as DocFencedCode;
				examples.push({
					code: fenced.code,
					language: fenced.language || "typescript",
					line: startLine,
				});
			}
		}
	}

	return examples;
}

/** Parse a raw JSDoc/TSDoc comment string into a structured documentation object. @internal */
function parseTSDoc(rawComment: string, startLine: number): ForgeSymbol["documentation"] {
	const configuration = new TSDocConfiguration();
	const parser = new TSDocParser(configuration);
	const result = parser.parseString(rawComment);
	const comment = result.docComment;

	const tags: Record<string, string[]> = {};

	// Release tags
	if (comment.modifierTagSet.hasTag(StandardTags.public)) {
		tags.public = [];
	}
	if (comment.modifierTagSet.hasTag(StandardTags.beta)) {
		tags.beta = [];
	}
	if (comment.modifierTagSet.hasTag(StandardTags.internal)) {
		tags.internal = [];
	}
	if (comment.modifierTagSet.hasTag(StandardTags.alpha)) {
		tags.alpha = [];
	}
	if (comment.modifierTagSet.hasTag(StandardTags.packageDocumentation)) {
		tags.packageDocumentation = [];
	}

	// @deprecated
	let deprecated: string | undefined;
	if (comment.deprecatedBlock) {
		deprecated = renderBlock(comment.deprecatedBlock).trim() || "true";
	}

	// @param blocks
	const params: Array<{ name: string; description: string; type?: string }> = [];
	for (const paramBlock of comment.params.blocks) {
		params.push({
			name: paramBlock.parameterName,
			description: renderBlock(paramBlock),
		});
	}

	// @returns block
	let returns: { description: string; type?: string } | undefined;
	if (comment.returnsBlock) {
		const desc = renderBlock(comment.returnsBlock);
		if (desc) returns = { description: desc };
	}

	// @throws blocks
	const throws: Array<{ type?: string; description: string }> = [];
	for (const block of comment.customBlocks) {
		if (block.blockTag.tagName.toLowerCase() === "@throws") {
			throws.push({ description: renderBlock(block) });
		}
	}

	// @route blocks - format: "METHOD /path"
	for (const block of comment.customBlocks) {
		if (block.blockTag.tagName.toLowerCase() === "@route") {
			const routeText = renderBlock(block).trim();
			const match = routeText.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(\S+)/i);
			if (match) {
				if (!tags.route) tags.route = [];
				tags.route.push(`${match[1].toUpperCase()} ${match[2]}`);
			}
		}
	}

	// @example blocks
	const examples = extractExamples(comment, startLine);

	// Extract {@link} references
	const links: Array<{ target: string; line: number }> = [];
	function walkForLinks(node: DocNode): void {
		if (node.kind === DocNodeKind.LinkTag) {
			const linkTag = node as DocLinkTag;
			if (linkTag.codeDestination) {
				const target = linkTag.codeDestination.memberReferences
					.map((ref) => ref.memberIdentifier?.identifier ?? "")
					.filter(Boolean)
					.join(".");
				if (target) {
					links.push({ target, line: startLine });
				}
			}
		}
		for (const child of node.getChildNodes()) {
			walkForLinks(child);
		}
	}
	walkForLinks(comment);

	const summary = renderDocSection(comment.summarySection);

	return {
		summary: summary || undefined,
		params: params.length > 0 ? params : undefined,
		returns,
		throws: throws.length > 0 ? throws : undefined,
		examples: examples.length > 0 ? examples : undefined,
		tags: Object.keys(tags).length > 0 ? tags : undefined,
		deprecated,
		links: links.length > 0 ? links : undefined,
	};
}

// ---------------------------------------------------------------------------
// TypeScript AST helpers
// ---------------------------------------------------------------------------

/** Extract the leading JSDoc comment text for a node. @internal */
function getLeadingComment(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
	const fullText = sourceFile.getFullText();
	const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
	if (!ranges || ranges.length === 0) return undefined;

	// Take the last leading comment (closest to the declaration)
	const range = ranges[ranges.length - 1];
	if (
		range.kind !== ts.SyntaxKind.MultiLineCommentTrivia ||
		!fullText.slice(range.pos, range.end).startsWith("/**")
	) {
		return undefined;
	}

	return fullText.slice(range.pos, range.end);
}

/** Map a TypeScript `SyntaxKind` to a `ForgeSymbol` kind string. @internal */
function kindToString(kind: ts.SyntaxKind): ForgeSymbol["kind"] | null {
	switch (kind) {
		case ts.SyntaxKind.FunctionDeclaration:
		case ts.SyntaxKind.ArrowFunction:
		case ts.SyntaxKind.FunctionExpression:
			return "function";
		case ts.SyntaxKind.ClassDeclaration:
			return "class";
		case ts.SyntaxKind.InterfaceDeclaration:
			return "interface";
		case ts.SyntaxKind.TypeAliasDeclaration:
			return "type";
		case ts.SyntaxKind.EnumDeclaration:
			return "enum";
		case ts.SyntaxKind.VariableDeclaration:
		case ts.SyntaxKind.VariableStatement:
			return "variable";
		case ts.SyntaxKind.MethodDeclaration:
		case ts.SyntaxKind.MethodSignature:
			return "method";
		case ts.SyntaxKind.PropertyDeclaration:
		case ts.SyntaxKind.PropertySignature:
		case ts.SyntaxKind.EnumMember:
			return "property";
		default:
			return null;
	}
}

/** Build a human-readable type signature string using the type checker. @internal */
function buildSignature(node: ts.Declaration, checker: ts.TypeChecker): string | undefined {
	try {
		const symbol = checker.getSymbolAtLocation((node as ts.NamedDeclaration).name ?? node);
		if (!symbol) return undefined;
		const type = checker.getTypeOfSymbolAtLocation(symbol, node);
		return checker.typeToString(type);
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------------------
// Walker implementation
// ---------------------------------------------------------------------------

/** @internal */
function extractSymbolsFromFile(
	sourceFile: ts.SourceFile,
	checker: ts.TypeChecker,
	_tsdocParser: TSDocParser,
): ForgeSymbol[] {
	const symbols: ForgeSymbol[] = [];
	const filePath = sourceFile.fileName;

	function visit(node: ts.Node, parentExported: boolean): void {
		const isExported =
			parentExported ||
			(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;

		// Handle export declarations: `export { Foo, Bar }`
		if (ts.isExportDeclaration(node)) {
			ts.forEachChild(node, (child) => visit(child, true));
			return;
		}

		const kind = kindToString(node.kind);

		// Variable statements need special handling: `export const foo = ...`
		if (ts.isVariableStatement(node)) {
			if (!isExported) {
				ts.forEachChild(node, (child) => visit(child, false));
				return;
			}
			for (const decl of node.declarationList.declarations) {
				const name = decl.name.getText(sourceFile);
				const pos = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
				const rawComment = getLeadingComment(node, sourceFile);
				const documentation = rawComment ? parseTSDoc(rawComment, pos.line + 1) : undefined;
				const tags = documentation?.tags;
				const visibility = resolveVisibility(tags);

				symbols.push({
					name,
					kind: "variable",
					visibility,
					filePath,
					line: pos.line + 1,
					column: pos.character,
					documentation,
					signature: buildSignature(decl, checker),
					exported: true,
				});
			}
			return;
		}

		if (kind === null || !isExported) {
			ts.forEachChild(node, (child) => visit(child, isExported));
			return;
		}

		const namedNode = node as ts.NamedDeclaration;
		const nameNode = namedNode.name;
		if (!nameNode) {
			ts.forEachChild(node, (child) => visit(child, isExported));
			return;
		}

		const name = nameNode.getText(sourceFile);
		const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
		const rawComment = getLeadingComment(node, sourceFile);
		const documentation = rawComment ? parseTSDoc(rawComment, pos.line + 1) : undefined;
		const tags = documentation?.tags;
		const visibility = resolveVisibility(tags);

		const children: ForgeSymbol[] = [];

		// Walk class members / interface members / enum members
		if (
			ts.isClassDeclaration(node) ||
			ts.isInterfaceDeclaration(node) ||
			ts.isEnumDeclaration(node)
		) {
			for (const member of node.members) {
				const memberKind = kindToString(member.kind);
				if (!memberKind) continue;
				const memberName = (member as ts.NamedDeclaration).name?.getText(sourceFile) ?? "";
				const memberPos = sourceFile.getLineAndCharacterOfPosition(member.getStart());
				const memberComment = getLeadingComment(member, sourceFile);
				const memberDoc = memberComment ? parseTSDoc(memberComment, memberPos.line + 1) : undefined;
				const memberTags = memberDoc?.tags;
				const memberVisibility = resolveVisibility(memberTags);

				children.push({
					name: memberName,
					kind: memberKind,
					visibility: memberVisibility,
					filePath,
					line: memberPos.line + 1,
					column: memberPos.character,
					documentation: memberDoc,
					signature: buildSignature(member as ts.Declaration, checker),
					exported: false,
				});
			}
		}

		symbols.push({
			name,
			kind,
			visibility,
			filePath,
			line: pos.line + 1,
			column: pos.character,
			documentation,
			signature: buildSignature(namedNode as ts.Declaration, checker),
			children: children.length > 0 ? children : undefined,
			exported: isExported,
		});
	}

	ts.forEachChild(sourceFile, (node) => visit(node, false));
	return symbols;
}

/**
 * Creates an {@link ASTWalker} configured for the given forge config.
 *
 * The walker uses the TypeScript Compiler API to create a `ts.Program` from
 * the project's tsconfig, then visits every source file to extract exported
 * declarations.  TSDoc comments are parsed with `@microsoft/tsdoc` to
 * populate the `documentation` field on each {@link ForgeSymbol}.
 *
 * @param config - The resolved {@link ForgeConfig} for the project.
 * @returns An {@link ASTWalker} instance whose `walk()` method performs the extraction.
 * @example
 * ```typescript
 * import { loadConfig, createWalker } from "@forge-ts/core";
 * const config = await loadConfig();
 * const walker = createWalker(config);
 * const symbols = walker.walk();
 * console.log(`Found ${symbols.length} symbols`);
 * ```
 * @public
 */
export function createWalker(config: ForgeConfig): ASTWalker {
	return {
		walk(): ForgeSymbol[] {
			// Load tsconfig
			const tsconfigPath = resolve(config.tsconfig);
			const configFile = ts.readConfigFile(tsconfigPath, (path) => readFileSync(path, "utf8"));

			if (configFile.error) {
				throw new Error(
					`Failed to read tsconfig at ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`,
				);
			}

			const parsedCommandLine = ts.parseJsonConfigFileContent(
				configFile.config,
				ts.sys,
				resolve(config.rootDir),
			);

			const program = ts.createProgram({
				rootNames: parsedCommandLine.fileNames,
				options: parsedCommandLine.options,
			});

			const checker = program.getTypeChecker();

			const tsdocConfiguration = new TSDocConfiguration();
			const tsdocParser = new TSDocParser(tsdocConfiguration);

			const allSymbols: ForgeSymbol[] = [];

			for (const sourceFile of program.getSourceFiles()) {
				// Skip declaration files and node_modules
				if (sourceFile.isDeclarationFile || sourceFile.fileName.includes("node_modules")) {
					continue;
				}

				const fileSymbols = extractSymbolsFromFile(sourceFile, checker, tsdocParser);
				allSymbols.push(...fileSymbols);
			}

			return allSymbols;
		},
	};
}
