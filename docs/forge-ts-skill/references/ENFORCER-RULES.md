# forge-ts Enforcer Rules Reference

Complete reference for all enforcement rules. Each error includes a
`suggestedFix` field with the exact TSDoc block to paste.

## Error Rules

### E001 — Missing TSDoc Summary

Every exported symbol (function, class, interface, type, enum, variable)
must have a TSDoc comment with a summary line.

**Fix:** Add a `/** ... */` comment above the export.

```typescript
/** Adds two numbers together. */
export function add(a: number, b: number): number { ... }
```

### E002 — Missing @param Tag

Every parameter of an exported function must have a `@param` tag.

**Fix:** Add `@param name - Description` for each parameter.

```typescript
/**
 * Adds two numbers.
 * @param a - The first number.
 * @param b - The second number.
 */
```

### E003 — Missing @returns Tag

Exported functions with non-void return types must have `@returns`.

**Fix:** Add `@returns Description of the return value`.

### E004 — Missing @example Block

Every exported function must have at least one `@example` with a fenced
code block. This ensures generated docs have usage samples and doctests
can validate the examples compile.

**Fix:**

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

Entry point files (`index.ts`) should have a `@packageDocumentation` tag
on one of their exported symbols. This becomes the package overview page.

**Default severity:** warn (not error).

### E006 — Class Member Missing Documentation

Every public/protected member of an exported class must have a TSDoc comment.

### E007 — Interface/Type Member Missing Documentation

Every property of an exported interface or type must have a TSDoc comment.

### E008 — Dead {@link} Reference

All `{@link SymbolName}` tags must reference symbols that exist in the
project's symbol graph. Supports qualified names like `{@link Class.method}`.

## Warning Rules

### W004 — Cross-Package Deprecated Import

Fires when a workspace package imports a `@deprecated` symbol from a
sibling package. The warning includes the deprecation message.

## Per-Rule Configuration

```typescript
// forge-ts.config.ts
enforce: {
  rules: {
    "require-summary": "error",           // E001
    "require-param": "error",             // E002
    "require-returns": "error",           // E003
    "require-example": "error",           // E004
    "require-package-doc": "warn",        // E005
    "require-class-member-doc": "error",  // E006
    "require-interface-member-doc": "error", // E007
  }
}
```

Each rule accepts: `"error"` | `"warn"` | `"off"`.
When `strict: true`, all warnings are promoted to errors.
