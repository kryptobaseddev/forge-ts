# forge-ts Enforcer Rules (v0.19.4)

33 rules across 4 enforcement layers. Configurable rules accept
`"error"` | `"warn"` | `"off"` in `enforce.rules`. Guard rules (E009-E012)
are always error severity and not configurable.

## API Layer (10 rules)

### E001 — Missing TSDoc Summary

Every exported symbol must have a `/** ... */` comment with a summary line.

```typescript
/** Adds two numbers together. */
export function add(a: number, b: number): number { ... }
```

### E002 — Missing @param Tag

Every parameter of an exported function must have `@param name - Description`.

```typescript
/**
 * Adds two numbers.
 * @param a - The first number.
 * @param b - The second number.
 */
```

### E003 — Missing @returns Tag

Non-void exported functions require `@returns Description`.

### E004 — Missing @example Block

Every exported function needs at least one `@example` with a fenced code block:

```typescript
/**
 * @example
 * ```typescript
 * const result = add(1, 2);
 * // => 3
 * ```
 */
```

### E005 — Missing @packageDocumentation

Entry point files (`index.ts`) should have `@packageDocumentation`.

### E006 — Class Member Missing Documentation

Every public/protected member of an exported class needs TSDoc.

### E007 — Interface/Type Member Missing Documentation

Every property of an exported interface or type needs TSDoc.

### E008 — Dead {@link} Reference

All `{@link SymbolName}` tags must reference symbols in the project's symbol graph.
Supports qualified names: `{@link Class.method}`.

### W003 — @deprecated Without Explanation

`@deprecated` tags must include a reason string:

```typescript
/** @deprecated Use `addNumbers` instead. */
export function add(a: number, b: number): number { ... }
```

### W004 — Cross-Package Deprecated Import

Fires when importing a `@deprecated` symbol from a sibling workspace package.

## Dev Layer (8 rules)

### E013 — Missing @remarks

Exported functions and classes must have a `@remarks` block providing context
beyond the summary line.

```typescript
/**
 * Adds two numbers.
 *
 * @remarks
 * Uses IEEE 754 double-precision arithmetic. For arbitrary precision,
 * consider using BigInt instead.
 */
```

### E014 — Missing @defaultValue

Optional properties with defaults should declare `@defaultValue`:

```typescript
interface Config {
  /**
   * Output directory.
   * @defaultValue `"./dist"`
   */
  outDir?: string;
}
```

Config key: `require-default-value`. Default severity: warn.

### E015 — Missing @typeParam

Generic functions, classes, and interfaces must document each type parameter:

```typescript
/**
 * Wraps a value in an array.
 * @typeParam T - The type of the value to wrap.
 */
export function wrap<T>(value: T): T[] { ... }
```

### E017 — @internal Re-Exported via Public Barrel

Fires when an `@internal` symbol is re-exported through a public `index.ts` barrel file.

### E018 — Missing @response on @route Handler

`@route`-tagged functions should document response types with `@response` tags.
Config key: `require-route-response`. Default severity: warn.

### W005 — Missing @see

Fires when a symbol contains `{@link}` references but no `@see` tags.

```typescript
/**
 * Parses config. See also {@link validateConfig}.
 * @see validateConfig
 */
```

### W006 — TSDoc Parse Errors

Surfaces 70+ parser-level syntax messages from `@microsoft/tsdoc`. Common causes:
malformed tags, unescaped `<` characters, unclosed `{@link}` references.

### W009 — Invalid {@inheritDoc} Source

Fires when `{@inheritDoc}` references a symbol that does not exist.

## Consumer Layer (5 rules)

### E016 — Missing Release Tag

Every exported symbol must have `@public`, `@beta`, or `@internal`:

```typescript
/**
 * Adds two numbers.
 * @public
 */
export function add(a: number, b: number): number { ... }
```

### W007 — Stale Guide FORGE:AUTO Zone

Fires when a `FORGE:AUTO` section in a guide page references a symbol that
no longer exists in the codebase. Fix: run `forge-ts build` to regenerate.

### W008 — Undocumented Public Symbol in Guides

Fires when a symbol exported from `index.ts` is not referenced in any guide
page. Ensures public API surface has guide coverage.

### W010 — @breaking Without @migration

Fires when a `@breaking` tag is present without a corresponding `@migration` path.

### W011 — Missing @since

Fires when a new public export is missing a `@since` version tag.

## LLM Anti-Pattern Layer (4 rules)

### E019 — @ts-ignore in Non-Test File

Fires when a non-test file contains `@ts-ignore` or `@ts-expect-error` directives.
Config key: `require-no-ts-ignore`. Default severity: error.

### E020 — any in Public API Signature

Fires when an exported symbol has `any` in its public API signature.
Uses `getDeclaredTypeOfSymbol` for interfaces/types to avoid false positives.
Config key: `require-no-any-in-api`. Default severity: error.

### W012 — Stale {@link} Display Text

Fires when `{@link Target | description}` display text appears stale relative
to the target's current summary.

### W013 — Stale @example

Fires when an `@example` block's function call argument count mismatches the
current function signature.

## Config Guard Layer (4 rules)

These rules are always error severity, not configurable, and check
`isRuleBypassed()` before emitting.

### E009 — tsconfig Strictness Regression

Fires when `tsconfig.json` is missing `strict: true` or other required flags
from `guards.tsconfig` config.

### E010 — Config Drift vs Lock File

Fires when any rule severity in `forge-ts.config.ts` is weaker than the value
stored in `.forge-lock.json`. Requires lock file to exist.

### E011 — Biome Config Weakening

Fires when a Biome rule in `biome.json` is weaker than the locked severity.
Requires `guards.biome.enabled` and a lock file.

### E012 — package.json Engine Field Tampering

Fires when `engines.node` is below `guards.packageJson.minNodeVersion` or
required fields are missing/changed.

## Per-Rule Configuration

```typescript
// forge-ts.config.ts
enforce: {
  strict: false,              // true promotes all warnings to errors
  minVisibility: "public",    // "public" | "beta" | "internal"
  ignoreFile: ".forge-ignore", // Knip integration: symbol names to skip
  rules: {
    // API Layer
    "require-summary": "error",              // E001
    "require-param": "error",                // E002
    "require-returns": "error",              // E003
    "require-example": "error",              // E004
    "require-package-doc": "error",          // E005
    "require-class-member-doc": "error",     // E006
    "require-interface-member-doc": "error", // E007
    // Dev Layer
    "require-remarks": "error",              // E013
    "require-default-value": "warn",         // E014
    "require-type-param": "error",           // E015
    "require-internal-boundary": "error",    // E017
    "require-route-response": "warn",        // E018
    "require-see": "warn",                   // W005
    "require-tsdoc-syntax": "warn",          // W006
    "require-inheritdoc-source": "warn",     // W009
    // Consumer Layer
    "require-release-tag": "error",          // E016
    "require-fresh-guides": "warn",          // W007
    "require-guide-coverage": "warn",        // W008
    "require-migration-path": "warn",        // W010
    "require-since": "warn",                 // W011
    // LLM Anti-Pattern Layer
    "require-no-ts-ignore": "error",         // E019
    "require-no-any-in-api": "error",        // E020
    "require-fresh-link-text": "warn",       // W012
    "require-fresh-examples": "warn",        // W013
  }
}
```
