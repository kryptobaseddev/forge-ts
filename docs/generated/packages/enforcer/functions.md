---
title: enforcer — Functions
outline: deep
description: Functions and classes for the enforcer package
---

# enforcer — Functions & Classes

Functions and classes exported by this package.

## enforce(config)

Runs the TSDoc enforcement pass against a project.  The enforcer walks all exported symbols that meet the configured minimum visibility threshold and emits diagnostics for any documentation deficiencies it finds.  ### Error codes | Code | Severity | Condition | |------|----------|-----------| | E001 | error    | Exported symbol is missing a TSDoc summary. | | E002 | error    | Function/method parameter lacks a `@param` tag. | | E003 | error    | Non-void function/method lacks a `@returns` tag. | | E004 | error    | Exported function/method is missing an `@example` block. | | E005 | error    | Package entry point (index.ts) is missing `@packageDocumentation`. | | E006 | error    | Public/protected class member is missing a TSDoc comment. | | E007 | error    | Interface/type alias property is missing a TSDoc comment. | | W001 | warning  | TSDoc comment contains parse errors. | | W002 | warning  | Function body throws but has no `@throws` tag. | | W003 | warning  | `@deprecated` tag is present without explanation. |  When `config.enforce.strict` is `true` all warnings are promoted to errors.

**Signature**

```typescript
(config: ForgeConfig) => Promise<ForgeResult>
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `config` | — | The resolved  for the project. |

**Returns** — A  describing which symbols passed or failed.

## formatResults(result, options)

Formats a  into a human-readable string suitable for printing to a terminal.  Diagnostics are grouped by source file.  Each file heading shows the relative-ish path, followed by indented error and warning lines.  A summary line is appended at the end.

**Signature**

```typescript
(result: ForgeResult, options: FormatOptions) => string
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `result` | — | The result produced by . |
| `options` | — | Rendering options (colours, verbosity). |

**Returns** — A formatted string ready to write to stdout or stderr.
