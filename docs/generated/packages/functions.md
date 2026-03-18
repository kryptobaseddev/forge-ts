---
title: . — Functions
outline: deep
description: Functions and classes for the . package
---

# . — Functions & Classes

Functions and classes exported by this package.

## add(a, b)

Adds two numbers together.

**Signature**

```typescript
(a: number, b: number) => number
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `a` | — | The first number. |
| `b` | — | The second number. |

**Returns** — The sum of `a` and `b`.

**Example**

```ts
import { add } from "./math.js";
const result = add(1, 2);
// => 3
```

## subtract(a, b)

Subtracts the second number from the first.

**Signature**

```typescript
(a: number, b: number) => number
```

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `a` | — | The number to subtract from. |
| `b` | — | The number to subtract. |

**Returns** — The difference `a - b`.

## multiply()

Multiplies two numbers.

**Signature**

```typescript
(a: number, b: number) => number
```

## _internalHelper()

**Signature**

```typescript
() => void
```

## noDocsFunction()

**Signature**

```typescript
(x: number) => number
```
