---
title: ". — API Reference"
outline: deep
description: "Full API reference for the . package"
---
# . — API Reference

## Functions

### `calculate()`

```typescript
(operation: string, a: number, b: number) => number
```

Get a calculator result.   GET /calculate/operation

**Parameters**

- `operation` — The math operation to perform.
- `a` — First operand.
- `b` — Second operand.

**Returns**: The calculation result.


### `add()`

```typescript
(a: number, b: number) => number
```

Adds two numbers together.

**Parameters**

- `a` — The first number.
- `b` — The second number.

**Returns**: The sum of `a` and `b`.

**Examples**

```ts
import { add } from "./math.js";
const result = add(1, 2);
// => 3
```


### `subtract()`

```typescript
(a: number, b: number) => number
```

Subtracts the second number from the first.

**Parameters**

- `a` — The number to subtract from.
- `b` — The number to subtract.

**Returns**: The difference `a - b`.


### `multiply()`

```typescript
(a: number, b: number) => number
```

Multiplies two numbers.


### `_internalHelper()`

```typescript
() => void
```


### `noDocsFunction()`

```typescript
(x: number) => number
```


## Interfaces

### `CalculatorConfig`

```typescript
any
```

Configuration for the calculator.

**Examples**

```ts
const config: CalculatorConfig = {
  precision: 2,
  mode: "standard",
};
```

#### `precision`

```typescript
number
```

Number of decimal places.

#### `mode`

```typescript
"standard" | "scientific"
```

Calculator mode.

#### `label`

```typescript
string | undefined
```

Optional label.


### `NoDocsInterface`

```typescript
any
```

#### `value`

```typescript
string
```


## Types

### `LegacyConfig`

> **Deprecated**: Use `CalculatorConfig` instead.

```typescript
any
```


## Enums

### `Operation`

```typescript
typeof Operation
```

Supported operations.

#### `Add`

```typescript
Operation.Add
```

#### `Subtract`

```typescript
Operation.Subtract
```

#### `Multiply`

```typescript
Operation.Multiply
```

#### `Divide`

```typescript
Operation.Divide
```
