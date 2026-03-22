# forge-ts TSDoc Tag Reference (v0.19.4)

Quick reference for LLM agents. 15 custom tags, 33 enforcement rules.
Canonical source: `docs/FORGE-TSDOC-TAGS.md`

## Enforcement Rules (33 total)

### TSDoc Documentation Rules (E001-E008, E013-E020, W001-W013)

| Code | Key | Default | Condition |
|------|-----|---------|-----------|
| E001 | `require-summary` | error | Exported symbol missing TSDoc summary |
| E002 | `require-param` | error | Function parameter missing `@param` tag |
| E003 | `require-returns` | error | Non-void function missing `@returns` tag |
| E004 | `require-example` | error | Exported function missing `@example` block |
| E005 | `require-package-doc` | error | index.ts missing `@packageDocumentation` |
| E006 | `require-class-member-doc` | error | Class member missing TSDoc comment |
| E007 | `require-interface-member-doc` | error | Interface/type property missing TSDoc comment |
| E008 | -- | error | Dead `{@link}` -- target symbol does not exist |
| E013 | `require-remarks` | error | Function/class missing `@remarks` block |
| E014 | `require-default-value` | warn | Optional property missing `@defaultValue` |
| E015 | `require-type-param` | error | Generic symbol missing `@typeParam` |
| E016 | `require-release-tag` | error | Missing `@public`, `@beta`, or `@internal` |
| E017 | `require-internal-boundary` | error | `@internal` symbol re-exported via public barrel |
| E018 | `require-route-response` | warn | `@route` handler missing `@response` tag |
| E019 | `require-no-ts-ignore` | error | `@ts-ignore`/`@ts-expect-error` in non-test file |
| E020 | `require-no-any-in-api` | error | `any` type in public API signature |
| W001 | -- | warn | TSDoc parse errors (documented; subsumed by W006) |
| W002 | -- | warn | Function throws without `@throws` tag (documented; reserved) |
| W003 | -- | warn | `@deprecated` without explanation text |
| W004 | -- | warn | Importing deprecated symbol from another package |
| W005 | `require-see` | warn | `{@link}` present but no `@see` tags |
| W006 | `require-tsdoc-syntax` | warn | TSDoc parser syntax error |
| W007 | `require-fresh-guides` | warn | FORGE:AUTO references removed/renamed symbol |
| W008 | `require-guide-coverage` | warn | Public symbol not in any guide page |
| W009 | `require-inheritdoc-source` | warn | `{@inheritDoc}` target does not exist |
| W010 | `require-migration-path` | warn | `@breaking` without `@migration` |
| W011 | `require-since` | warn | Public export missing `@since` version |
| W012 | `require-fresh-link-text` | warn | `{@link}` display text stale vs target summary |
| W013 | `require-fresh-examples` | warn | `@example` call arg count mismatches signature |

### Config Guard Rules

| Code | Default | Condition |
|------|---------|-----------|
| E009 | error | tsconfig.json strict-mode flag missing/disabled |
| E010 | error | Rule severity weaker than `.forge-lock.json` |
| E011 | error | Biome rule weakened below locked level |
| E012 | error | `engines.node` below minimum or required field missing |

E008, W001-W004: Not in `EnforceRules` -- always emit, cannot be set to `"off"` individually.
E009-E012: Config guards -- suppressed via bypass budget, not `@forgeIgnore`.

## Custom Tags (15)

Defined in `packages/core/tsdoc-preset/tsdoc.json`:

| Tag | syntaxKind | Purpose |
|-----|-----------|---------|
| `@route` | block | HTTP method + path for OpenAPI gen |
| `@category` | block | Symbol grouping for guide discovery |
| `@since` | block | Version when symbol was introduced |
| `@guide` | block | Associate symbol with guide page |
| `@concept` | block | Link symbol to concepts page |
| `@response` | block | HTTP response type/status |
| `@query` | block | Query parameter documentation |
| `@header` | block | HTTP header documentation |
| `@body` | block | Request body schema |
| `@quickstart` | modifier | "Start here" marker for new users |
| `@faq` | block | FAQ entry association |
| `@breaking` | block | Breaking change documentation |
| `@migration` | block | Migration path from old API |
| `@complexity` | block | Algorithmic complexity |
| `@forgeIgnore` | modifier | Skip all enforcement on this symbol |

## Standard Tags (24 enabled)

`@alpha`, `@beta`, `@decorator`, `@defaultValue`, `@deprecated`, `@eventProperty`,
`@example`, `@inheritDoc`, `@internal`, `@label`, `@link`, `@override`,
`@packageDocumentation`, `@param`, `@privateRemarks`, `@public`, `@readonly`,
`@remarks`, `@returns`, `@sealed`, `@see`, `@throws`, `@typeParam`, `@virtual`

## `@forgeIgnore` Tag

Modifier tag. Suppresses all enforcer diagnostics for the annotated symbol.

```typescript
/** @forgeIgnore @public */
export type Generated = z.infer<typeof Schema>;
```

Does not affect config guard rules (E009-E012).

## Enforcement Suppression

### Per-Symbol

```typescript
/** @forgeIgnore */
export const skipped = "no enforcement";
```

### Per-File: `enforce.ignoreFile`

```typescript
// forge-ts.config.ts
enforce: {
  ignoreFile: ".forge-ignore",
}
```

`.forge-ignore` format: one symbol name per line, `#` comments.

```text
# .forge-ignore
GeneratedPayload
legacyHelper
```

Knip integration:

```bash
npx knip --reporter json | jq -r '.exports[].name' > .forge-ignore
```

### Per-Rule: `enforce.rules`

```typescript
enforce: {
  rules: {
    "require-example": "warn",
    "require-remarks": "off",
  },
}
```

### Strict Mode

`enforce.strict: true` promotes all warnings to errors.

## Per-Group Enforcement (tsdoc.enforce)

> Actively being implemented. Config interface defined; wiring in progress.
> Individual `enforce.rules` overrides always take precedence.

```typescript
tsdoc: {
  enforce: {
    core: "error",           // @param, @returns, @remarks, etc.
    extended: "warn",        // @example, @throws, @see, etc.
    discretionary: "off",    // @public, @beta, @internal
  },
}
```

| Group | Tags | Default |
|-------|------|---------|
| `core` | `@param`, `@returns`, `@remarks`, `@deprecated`, `@packageDocumentation`, `@privateRemarks`, `{@link}`, `{@label}` | `"error"` |
| `extended` | `@example`, `@throws`, `@see`, `@decorator`, `@defaultValue`, `@typeParam`, `@eventProperty`, `@readonly`, `@override`, `@sealed`, `@virtual`, `{@inheritDoc}` | `"warn"` |
| `discretionary` | `@public`, `@beta`, `@internal`, `@alpha` | `"off"` |

## Custom Tags Config

Add project-specific tags beyond the 15 preset tags:

```typescript
tsdoc: {
  customTags: [
    { tagName: "@permission", syntaxKind: "block" },
  ],
}
```

Written to `tsdoc.json` when `tsdoc.writeConfig: true`.

## tsdoc.json Preset

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
  "extends": ["@forge-ts/tsdoc-config/tsdoc.json"]
}
```

Consumed by: eslint-plugin-tsdoc, TypeDoc, API Extractor, forge-ts check, VS Code.

## TSDoc Config Ownership

```
forge-ts.config.ts  -->  tsdoc.json  -->  eslint-plugin-tsdoc / TypeDoc / API Extractor
```

forge-ts owns `tsdoc.json`. Walker loads via `TSDocConfigFile.loadForFolder()`.
Falls back to bare `new TSDocConfiguration()` if no config found.
