/**
 * Shared utilities for idempotent package.json read-modify-write operations.
 *
 * Every command that touches package.json MUST use these helpers to ensure:
 * - Existing content is never lost
 * - JSON formatting (indent style, trailing newline) is preserved
 * - Scripts are only added when the key doesn't already exist
 *
 * @packageDocumentation
 * @internal
 */

import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parsed package.json with formatting metadata for lossless round-tripping.
 * @internal
 */
export interface PkgJson {
	/** Absolute path to the file. */
	path: string;
	/** Raw file content as read from disk. */
	raw: string;
	/** Parsed JSON object. */
	obj: Record<string, unknown>;
	/** Detected indent string (tabs or spaces). */
	indent: string;
	/** Whether the original file ended with a newline. */
	trailingNewline: boolean;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read and parse package.json from a project root.
 *
 * Detects indent style and trailing newline for lossless round-tripping.
 * Returns `null` if the file doesn't exist or can't be parsed.
 *
 * @param rootDir - Absolute path to the project root.
 * @returns Parsed package.json with formatting metadata, or null.
 * @internal
 */
export function readPkgJson(rootDir: string): PkgJson | null {
	const pkgPath = join(rootDir, "package.json");
	if (!existsSync(pkgPath)) return null;
	try {
		const raw = readFileSync(pkgPath, "utf8");
		const obj = JSON.parse(raw) as Record<string, unknown>;
		const match = raw.match(/\n(\s+)"/);
		const indent = match ? match[1] : "  ";
		const trailingNewline = raw.endsWith("\n");
		return { path: pkgPath, raw, obj, indent, trailingNewline };
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Serialize a package.json object preserving original formatting.
 *
 * @param pkg - The parsed package.json with formatting metadata.
 * @returns Formatted JSON string ready to write to disk.
 * @internal
 */
export function serializePkgJson(pkg: PkgJson): string {
	return JSON.stringify(pkg.obj, null, pkg.indent) + (pkg.trailingNewline ? "\n" : "");
}

/**
 * Write a modified package.json back to disk, preserving formatting.
 *
 * @param pkg - The parsed and modified package.json.
 * @internal
 */
export async function writePkgJson(pkg: PkgJson): Promise<void> {
	await writeFile(pkg.path, serializePkgJson(pkg), "utf8");
}

// ---------------------------------------------------------------------------
// Script helpers
// ---------------------------------------------------------------------------

/**
 * Add scripts to package.json idempotently.
 *
 * Only adds scripts where the key doesn't already exist.
 * Never overwrites existing script values. Returns the list of keys added.
 *
 * @param pkg - The parsed package.json to modify (mutated in place).
 * @param scripts - Map of script key to command value.
 * @returns Array of script keys that were added (empty if all already existed).
 * @internal
 */
export function addScripts(pkg: PkgJson, scripts: Record<string, string>): string[] {
	const existing = (pkg.obj.scripts ?? {}) as Record<string, string>;
	const added: string[] = [];

	for (const [key, value] of Object.entries(scripts)) {
		if (!(key in existing)) {
			existing[key] = value;
			added.push(key);
		}
	}

	if (added.length > 0) {
		pkg.obj.scripts = existing;
	}

	return added;
}
