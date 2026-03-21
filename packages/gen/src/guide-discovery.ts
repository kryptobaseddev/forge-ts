/**
 * Guide discovery heuristics from the forge-ts symbol graph.
 *
 * Analyzes extracted symbols to automatically discover and propose
 * documentation guides based on code patterns: config interfaces,
 * error types, @guide tags, @category groupings, and entry points.
 *
 * @internal
 */

import type { ForgeConfig, ForgeSymbol } from "@forge-ts/core";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The source heuristic that discovered a guide.
 * @public
 */
export type GuideSource =
	| "entry-point"
	| "config-interface"
	| "error-types"
	| "guide-tag"
	| "category";

/**
 * A guide discovered from the symbol graph by code analysis heuristics.
 * @public
 */
export interface DiscoveredGuide {
	/** URL-safe slug (e.g. "configuration", "error-handling"). */
	slug: string;
	/** Human-readable title (e.g. "Configuration Guide"). */
	title: string;
	/** Short description of the guide's content. */
	description: string;
	/** Which heuristic discovered this guide. */
	source: GuideSource;
	/** The symbols that contribute content to this guide. */
	symbols: ForgeSymbol[];
}

// ---------------------------------------------------------------------------
// Heuristic helpers
// ---------------------------------------------------------------------------

/** Regex matching config/options/settings interface names. */
const CONFIG_NAME_RE = /config|options|settings/i;

/**
 * Heuristic (a): Find exported interfaces/types whose name contains
 * "Config", "Options", or "Settings" and generate a Configuration Guide.
 */
function discoverConfigGuides(allSymbols: ForgeSymbol[]): DiscoveredGuide[] {
	const configSymbols = allSymbols.filter(
		(s) =>
			s.exported && (s.kind === "interface" || s.kind === "type") && CONFIG_NAME_RE.test(s.name),
	);

	if (configSymbols.length === 0) return [];

	return [
		{
			slug: "configuration",
			title: "Configuration Guide",
			description: "How to configure the project using its exported configuration interfaces.",
			source: "config-interface",
			symbols: configSymbols,
		},
	];
}

/**
 * Heuristic (b): Find symbols with @throws tags or exported classes
 * extending Error and generate an Error Handling Guide.
 */
function discoverErrorGuides(allSymbols: ForgeSymbol[]): DiscoveredGuide[] {
	const errorSymbols = allSymbols.filter((s) => {
		if (!s.exported) return false;

		// Symbols with @throws documentation
		const hasThrows = s.documentation?.throws != null && s.documentation.throws.length > 0;

		// Classes whose name ends with "Error" or "Exception"
		const isErrorClass = s.kind === "class" && /Error$|Exception$/.test(s.name);

		return hasThrows || isErrorClass;
	});

	if (errorSymbols.length === 0) return [];

	return [
		{
			slug: "error-handling",
			title: "Error Handling Guide",
			description:
				"How to handle errors thrown by the library, including error types and recovery patterns.",
			source: "error-types",
			symbols: errorSymbols,
		},
	];
}

/**
 * Heuristic (c): Group symbols by their @guide tag value.
 * Each unique @guide value becomes a dedicated guide page.
 */
function discoverGuideTagGuides(allSymbols: ForgeSymbol[]): DiscoveredGuide[] {
	const guideMap = new Map<string, ForgeSymbol[]>();

	for (const s of allSymbols) {
		if (!s.exported) continue;
		const guideValues = s.documentation?.tags?.guide;
		if (!guideValues || guideValues.length === 0) continue;

		for (const value of guideValues) {
			const trimmed = value.trim();
			if (!trimmed) continue;
			const list = guideMap.get(trimmed) ?? [];
			list.push(s);
			guideMap.set(trimmed, list);
		}
	}

	const guides: DiscoveredGuide[] = [];
	for (const [guideValue, symbols] of guideMap) {
		const slug = toSlug(guideValue);
		guides.push({
			slug,
			title: toTitle(guideValue),
			description: `Guide covering ${guideValue}.`,
			source: "guide-tag",
			symbols,
		});
	}

	return guides;
}

/**
 * Heuristic (d): Group symbols by their @category tag value.
 * Each unique @category value becomes a guide page.
 */
function discoverCategoryGuides(allSymbols: ForgeSymbol[]): DiscoveredGuide[] {
	const categoryMap = new Map<string, ForgeSymbol[]>();

	for (const s of allSymbols) {
		if (!s.exported) continue;
		const categoryValues = s.documentation?.tags?.category;
		if (!categoryValues || categoryValues.length === 0) continue;

		for (const value of categoryValues) {
			const trimmed = value.trim();
			if (!trimmed) continue;
			const list = categoryMap.get(trimmed) ?? [];
			list.push(s);
			categoryMap.set(trimmed, list);
		}
	}

	const guides: DiscoveredGuide[] = [];
	for (const [categoryValue, symbols] of categoryMap) {
		const slug = toSlug(categoryValue);
		guides.push({
			slug,
			title: `${toTitle(categoryValue)} Guide`,
			description: `Symbols in the "${categoryValue}" category.`,
			source: "category",
			symbols,
		});
	}

	return guides;
}

/**
 * Heuristic (e): Functions exported from index.ts files.
 * These feed into the Getting Started guide.
 */
function discoverEntryPointGuides(allSymbols: ForgeSymbol[]): DiscoveredGuide[] {
	const entryPointFunctions = allSymbols.filter(
		(s) => s.exported && s.kind === "function" && /[/\\]index\.ts$/.test(s.filePath),
	);

	if (entryPointFunctions.length === 0) return [];

	return [
		{
			slug: "getting-started",
			title: "Getting Started",
			description: "Key entry-point functions to get started with the library.",
			source: "entry-point",
			symbols: entryPointFunctions,
		},
	];
}

// ---------------------------------------------------------------------------
// Slug / title utilities
// ---------------------------------------------------------------------------

/**
 * Convert a human-readable string to a URL-safe slug.
 * "Error Handling" -> "error-handling"
 * "authentication" -> "authentication"
 */
function toSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Convert a slug or tag value to Title Case.
 * "error-handling" -> "Error Handling"
 * "authentication" -> "Authentication"
 */
function toTitle(text: string): string {
	return text
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze the symbol graph and discover guides using multiple heuristics.
 *
 * Each heuristic produces zero or more {@link DiscoveredGuide} entries.
 * When multiple heuristics produce a guide with the same slug, the first
 * one wins (priority order: guide-tag, config-interface, error-types,
 * category, entry-point).
 *
 * @param symbolsByPackage - Symbols grouped by package name.
 * @param config - The resolved forge-ts configuration.
 * @returns An array of discovered guides, deduplicated by slug.
 * @public
 */
export function discoverGuides(
	symbolsByPackage: Map<string, ForgeSymbol[]>,
	config: ForgeConfig,
): DiscoveredGuide[] {
	const allSymbols = [...symbolsByPackage.values()].flat();

	// Run heuristics in priority order
	const candidates: DiscoveredGuide[] = [
		...discoverGuideTagGuides(allSymbols),
		...discoverConfigGuides(allSymbols),
		...discoverErrorGuides(allSymbols),
		...discoverCategoryGuides(allSymbols),
		...discoverEntryPointGuides(allSymbols),
	];

	// Deduplicate by slug — first wins
	const seen = new Set<string>();
	const result: DiscoveredGuide[] = [];
	for (const guide of candidates) {
		if (!seen.has(guide.slug)) {
			seen.add(guide.slug);
			result.push(guide);
		}
	}

	// Suppress unused variable warning — config is available for future use
	void config;

	return result;
}
