/**
 * sync-tsdoc-spec.ts
 *
 * Extracts standard tag definitions and parser message IDs from the installed
 * @microsoft/tsdoc package and writes them as machine-readable JSON to
 * packages/core/spec/standard-tags.json and packages/core/spec/message-ids.json.
 *
 * Usage: npx tsx scripts/sync-tsdoc-spec.ts
 *
 * Idempotent — running twice produces identical output (sorted arrays,
 * deterministic formatting, stable generatedAt only changes on real diffs).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { StandardTags, TSDocMessageId, TSDocTagSyntaxKind } from "@microsoft/tsdoc";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SPEC_DIR = resolve(ROOT, "packages/core/spec");
const TAGS_PATH = resolve(SPEC_DIR, "standard-tags.json");
const MESSAGE_IDS_PATH = resolve(SPEC_DIR, "message-ids.json");

// ---------------------------------------------------------------------------
// Resolve @microsoft/tsdoc version from its own package.json
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const tsdocPkgPath = require.resolve("@microsoft/tsdoc/package.json");
const tsdocPkg = JSON.parse(readFileSync(tsdocPkgPath, "utf-8")) as {
	version: string;
};
const tsdocVersion: string = tsdocPkg.version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function syntaxKindLabel(kind: TSDocTagSyntaxKind): string {
	switch (kind) {
		case TSDocTagSyntaxKind.InlineTag:
			return "inline";
		case TSDocTagSyntaxKind.BlockTag:
			return "block";
		case TSDocTagSyntaxKind.ModifierTag:
			return "modifier";
		default:
			return "unknown";
	}
}

/**
 * Writes JSON to disk only when content has actually changed. This keeps
 * generatedAt stable across no-op runs (true idempotency for git).
 */
function writeIfChanged(filePath: string, payload: object): boolean {
	const json = `${JSON.stringify(payload, null, 2)}\n`;
	if (existsSync(filePath)) {
		const existing = readFileSync(filePath, "utf-8");
		// Compare ignoring generatedAt field
		const strip = (s: string) => s.replace(/"generatedAt":\s*"[^"]*"/, '"generatedAt": ""');
		if (strip(existing) === strip(json)) {
			console.log(`  [skip] ${filePath} (unchanged)`);
			return false;
		}
	}
	writeFileSync(filePath, json, "utf-8");
	console.log(`  [write] ${filePath}`);
	return true;
}

// ---------------------------------------------------------------------------
// 1. Standard Tags
// ---------------------------------------------------------------------------

interface TagEntry {
	tagName: string;
	syntaxKind: string;
	standardization: string;
	allowMultiple: boolean;
}

const tags: TagEntry[] = StandardTags.allDefinitions
	.map((def) => ({
		tagName: def.tagName,
		syntaxKind: syntaxKindLabel(def.syntaxKind),
		standardization: def.standardization,
		allowMultiple: def.allowMultiple,
	}))
	.sort((a, b) => a.tagName.localeCompare(b.tagName));

const tagsPayload = {
	source: "@microsoft/tsdoc",
	version: tsdocVersion,
	generatedAt: new Date().toISOString(),
	tags,
};

// ---------------------------------------------------------------------------
// 2. Message IDs
// ---------------------------------------------------------------------------

interface MessageIdEntry {
	id: string;
	enumKey: string;
}

// Build a reverse map: string value -> enum key name
const messageIdEntries: MessageIdEntry[] = [];
for (const [key, value] of Object.entries(TSDocMessageId)) {
	// TypeScript string enums only have string -> string mappings (no reverse)
	if (typeof value === "string") {
		messageIdEntries.push({
			id: value,
			enumKey: key,
		});
	}
}

messageIdEntries.sort((a, b) => a.id.localeCompare(b.id));

const messageIdsPayload = {
	source: "@microsoft/tsdoc",
	version: tsdocVersion,
	generatedAt: new Date().toISOString(),
	messageIds: messageIdEntries,
};

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

console.log(`Syncing TSDoc spec from @microsoft/tsdoc v${tsdocVersion}...`);
writeIfChanged(TAGS_PATH, tagsPayload);
writeIfChanged(MESSAGE_IDS_PATH, messageIdsPayload);
console.log(`Done. ${tags.length} tags, ${messageIdEntries.length} message IDs.`);
