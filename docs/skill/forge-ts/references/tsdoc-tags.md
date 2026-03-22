# forge-ts TSDoc Tag Reference (v0.13.0)

forge-ts enables all 24 standard TSDoc tags plus 5 custom tags via the
`@forge-ts/tsdoc-config` preset. Tags are organized into standardization
groups with per-group enforcement severity.

## Tag Syntax Kinds

| Kind | Marker | Example |
|------|--------|---------|
| `block` | `@tagName` on its own line | `@param`, `@returns`, `@example` |
| `modifier` | `@tagName` standalone flag | `@public`, `@internal`, `@readonly` |
| `inline` | `{@tagName ...}` within text | `{@link Symbol}`, `{@inheritDoc}` |

## Standardization Groups

TSDoc defines 4 standardization levels. forge-ts enforces the first 3 via
`tsdoc.enforce` in config:

| Group | Meaning | Default Severity |
|-------|---------|-----------------|
| `core` | Essential tags every tool must support | `"error"` |
| `extended` | Optional tags tools may support | `"warn"` |
| `discretionary` | Implementation-specific semantics | `"off"` |
| `none` | Custom tags (user/tool-defined) | Not enforced via groups |

### Per-Group Enforcement Config

```typescript
// forge-ts.config.ts
tsdoc: {
  enforce: {
    core: "error",           // @param, @returns, @remarks, etc.
    extended: "warn",        // @example, @throws, @see, etc.
    discretionary: "off",    // @public, @beta, @internal
  },
}
```

## Core Tags (8 tags)

Essential tags that every TSDoc-compliant tool must support.

| Tag | Kind | Purpose | forge-ts Rule |
|-----|------|---------|---------------|
| `@param` | block | Document function parameters | E002 |
| `@returns` | block | Document return values | E003 |
| `@remarks` | block | Extended documentation beyond summary | E013 |
| `@deprecated` | block | Mark as no longer supported | W003 |
| `@packageDocumentation` | block | Document entire package (index.ts) | E005 |
| `@privateRemarks` | block | Private documentation (stripped from output) | -- |
| `@label` | inline | Label a declaration for `{@link}` reference | -- |
| `{@link}` | inline | Create hyperlink to another symbol | E008 |

## Extended Tags (13 tags)

Optional tags. Tools may support them; forge-ts enables and enforces all.

| Tag | Kind | Purpose | forge-ts Rule |
|-----|------|---------|---------------|
| `@example` | block | Code example (becomes doctest) | E004 |
| `@throws` | block | Document exceptions | -- |
| `@see` | block | Related references | W005 |
| `@decorator` | block | Document decorators | -- |
| `@defaultValue` | block | Default value for optional properties | E014 |
| `@typeParam` | block | Document generic type parameters | E015 |
| `@eventProperty` | block | Document event properties | -- |
| `@readonly` | modifier | Mark as read-only | -- |
| `@override` | modifier | Mark as overriding base class | -- |
| `@sealed` | modifier | Mark as non-overridable | -- |
| `@virtual` | modifier | Mark as overridable | -- |
| `{@inheritDoc}` | inline | Copy docs from another symbol | -- |

## Discretionary Tags (3 tags)

Release tags with implementation-specific semantics. forge-ts uses these
for visibility filtering and E016 enforcement.

| Tag | Kind | Purpose | forge-ts Rule |
|-----|------|---------|---------------|
| `@public` | modifier | Mark as publicly released API | E016 |
| `@beta` | modifier | Mark as beta/experimental | E016 |
| `@internal` | modifier | Mark as not for third-party use | E016 |

`@internal` symbols are excluded from ALL output. `@beta` symbols are
filtered when `enforce.minVisibility` is `"public"`. E016 requires every
exported symbol to have exactly one of these three tags.

Note: `@alpha` is a synonym for `@beta` in the TSDoc standard.

## forge-ts Custom Tags (5 tags)

Defined in `@forge-ts/tsdoc-config` preset (`tsdoc.json`). All are block tags.

| Tag | Kind | Purpose | Used By |
|-----|------|---------|---------|
| `@route` | block | HTTP route for OpenAPI generation | `@forge-ts/api` |
| `@category` | block | Symbol grouping for guide discovery | `@forge-ts/gen` |
| `@since` | block | Version when symbol was introduced | `@forge-ts/gen` |
| `@guide` | block | Associate symbol with a named guide page | `@forge-ts/gen` |
| `@concept` | block | Link symbol to a concepts page section | `@forge-ts/gen` |

### Usage Examples

```typescript
/**
 * Retrieves a user by ID.
 *
 * @route GET /api/users/:id
 * @category users
 * @since 1.0.0
 * @guide authentication
 * @public
 */
export function getUser(id: string): User { ... }

/**
 * The request pipeline model.
 *
 * @concept pipeline-architecture
 * @public
 */
export interface Pipeline { ... }
```

## Adding Custom Tags

Beyond the 5 preset tags, add project-specific tags via config:

```typescript
// forge-ts.config.ts
tsdoc: {
  customTags: [
    { tagName: "@permission", syntaxKind: "block" },
    { tagName: "@experimental", syntaxKind: "modifier" },
  ],
}
```

Custom tags are written to `tsdoc.json` when `tsdoc.writeConfig` is true,
making them available to eslint-plugin-tsdoc, TypeDoc, and API Extractor.

## TSDoc Config Ownership

forge-ts **owns** `tsdoc.json`. The config flow:

```
forge-ts.config.ts (tsdoc section)
        ↓
   tsdoc.json (written by forge-ts init / writeConfig)
        ↓
   consumed by: eslint-plugin-tsdoc, TypeDoc, API Extractor
```

The walker loads TSDoc config via `TSDocConfigFile.loadForFolder()` from
`@microsoft/tsdoc-config`. Configs are cached per directory. If no
`tsdoc.json` is found, falls back to bare `new TSDocConfiguration()`.

## Tag-to-Rule Mapping Summary

| Rule | Enforces Tag(s) |
|------|----------------|
| E001 | Summary line (not a tag — the first paragraph) |
| E002 | `@param` |
| E003 | `@returns` |
| E004 | `@example` |
| E005 | `@packageDocumentation` |
| E006 | Class member TSDoc (summary) |
| E007 | Interface member TSDoc (summary) |
| E008 | `{@link}` target validation |
| E013 | `@remarks` |
| E014 | `@defaultValue` |
| E015 | `@typeParam` |
| E016 | `@public` / `@beta` / `@internal` |
| W003 | `@deprecated` (requires explanation text) |
| W005 | `@see` (when `{@link}` present) |
| W006 | All tags (parser-level syntax validation, 70+ messages) |
