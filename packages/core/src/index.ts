/**
 * Foundation package for the forge-ts toolchain — shared types, config loader,
 * and TypeScript AST walker.
 *
 * Every other `@forge-ts` package depends on this one. It provides the single
 * AST traversal pass (`createWalker`) that produces a `ForgeSymbol[]` graph,
 * the config resolution pipeline (`loadConfig`), and all shared types used
 * across enforcement, generation, and API extraction.
 *
 * @remarks
 * The central data model is `ForgeSymbol`: one record per exported TypeScript
 * declaration, carrying its name, kind, visibility, source location, parsed
 * TSDoc documentation, and inferred type signature. The walker populates this
 * graph by running a `ts.Program` against the project tsconfig and parsing
 * each comment with `@microsoft/tsdoc`.
 *
 * Config is resolved in priority order: `forge-ts.config.ts` →
 * `forge-ts.config.js` → `"forge-ts"` key in `package.json` → built-in
 * defaults. All fields are fully populated after `loadConfig()` returns, so
 * consumers never need to null-check individual options.
 *
 * Key exports:
 * - `createWalker` — Build an `ASTWalker` and call `.walk()` to get all symbols.
 * - `loadConfig` — Resolve `ForgeConfig` from disk with defaults applied.
 * - `defineConfig` — Type-safe helper for writing `forge-ts.config.ts` files.
 * - `defaultConfig` — Return a fully-populated config rooted at a given path.
 * - `ForgeConfig` — Complete project configuration interface.
 * - `ForgeSymbol` — A single extracted and annotated TypeScript export.
 * - `ForgeResult` — Uniform result envelope returned by all pipeline commands.
 * - `ForgeError` / `ForgeWarning` — Diagnostic types with code, message, and location.
 * - `Visibility` — `"public"` | `"beta"` | `"internal"` | `"private"` enum.
 * - `EnforceRules` — Per-rule severity configuration (40 rules, E001–E020 + W001–W020).
 *
 * @example
 * ```typescript
 * import { loadConfig, createWalker } from "@forge-ts/core";
 *
 * const config = await loadConfig(); // reads forge-ts.config.ts or defaults
 * const walker = createWalker(config);
 * const symbols = walker.walk();     // ForgeSymbol[]
 * console.log(`Found ${symbols.length} exported symbols`);
 * ```
 *
 * @packageDocumentation
 * @public
 */

export * from "./audit.js";
export * from "./bypass.js";
export * from "./config.js";
export * from "./lock.js";
export * from "./openapi-types.js";
export * from "./types.js";
export * from "./visibility.js";
export * from "./walker.js";
