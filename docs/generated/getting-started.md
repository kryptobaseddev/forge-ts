---
title: Getting Started
outline: deep
description: Quick start guide for .
---

# Getting Started

Welcome to **.**.

## Installation

```bash
npm install .
```

## Quick Start

The following example demonstrates `defaultConfig` from the `core` package.

```typescript
import { defaultConfig } from "@forge-ts/core";
const config = defaultConfig("/path/to/project");
console.log(config.enforce.enabled); // true
```

## Next Steps

- Browse the [API Reference](./packages/)
  - [core](./packages/core/api-reference.md)
  - [.](./packages/./api-reference.md)
  - [api](./packages/api/api-reference.md)
  - [gen](./packages/gen/api-reference.md)
  - [cli](./packages/cli/api-reference.md)
  - [enforcer](./packages/enforcer/api-reference.md)
  - [doctest](./packages/doctest/api-reference.md)
