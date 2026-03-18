# TSOA: The True Single Source of Truth (SSoT) for APIs

## 1. Executive Summary
`tsoa` (TypeScript OpenAPI) represents the gold standard for Single Source of Truth (SSoT) in the TypeScript API ecosystem. As of early 2026, it remains the most robust architecture for ensuring that TypeScript interfaces, runtime routing, and OpenAPI documentation are inextricably linked and generated from a single codebase artifact.

## 2. Core Philosophy & SSoT Alignment
Unlike tools that operate strictly at runtime (e.g., `zod-to-openapi`) and decouple TSDoc from API definitions, `tsoa` operates at the **build stage** utilizing the TypeScript Compiler API. 

Its philosophy perfectly aligns with our zero-config documentation enforcer:
1. **TypeScript First**: It relies purely on TypeScript type annotations to generate API metadata.
2. **TSDoc for Context**: Pure text metadata (endpoint descriptions, parameter documentation) is pulled directly from jsdoc/TSDoc comments. 
3. **Decorators for Routing**: When types aren't enough to express HTTP semantics (e.g., `@Get`, `@Post`, `@Body`), `tsoa` uses decorators.
4. **Runtime Validation Parity**: The generated routes execute runtime validation that perfectly matches the generated OpenAPI 3.0 specs.

## 3. Architecture Overview

### 3.1 The AST Parsing Phase
When the `tsoa spec-and-routes` command is invoked, `tsoa` does not run your code. Instead, it:
1. Instantiates a TypeScript Program.
2. Crawls your entry points looking for classes decorated with `@Route()`.
3. Analyzes method signatures to determine required vs. optional parameters (e.g., `name?: string` maps to `required: false` in OpenAPI).
4. Extracts TSDoc comments (e.g., `/** @example "foo@bar.com" */`) to populate OpenAPI `description` and `example` fields.

### 3.2 The Generation Phase
`tsoa` outputs two distinct artifacts from the AST:
1. **`swagger.json` / `openapi.json`**: A fully compliant OpenAPI 3.0 specification.
2. **`routes.ts`**: A generated TypeScript file that wires up your controllers to the middleware of your choice (Express, Koa, Hapi, or custom adapters via Handlebars templates). This file includes the runtime validation logic inferred from your TS types.

## 4. Integration into the SSoT Toolchain (2026 Architecture)
For our new zero-config SSoT toolchain (targeting Node 24 and TS 6.0+), `tsoa` provides the foundational blueprint for API-level documentation. 

Instead of building an OpenAPI generator from scratch, our toolchain will:
1. Expose a unified `@ssot/api` module wrapping `tsoa`'s compiler APIs.
2. Feed the generated `openapi.json` directly into our LLM Context Aggregator (`@ssot/llm-gen`) to produce the `llms-full.txt` agent contexts automatically.
3. Use the exact same AST-parsing pass to enforce our `ts-doc-enforcer` rules (e.g., failing the build if an `@Get` endpoint lacks a TSDoc description).

## 5. Example: The "Perfect" SSoT Controller

```typescript
import { Body, Controller, Get, Path, Post, Query, Route, SuccessResponse } from "tsoa";

/**
 * A user in the system.
 * This interface acts as the SSoT for both TS type checking,
 * OpenAPI schema generation, and runtime request validation.
 */
export interface User {
  id: number;
  /** @example "john.doe@example.com" */
  email: string;
  name?: string;
}

@Route("users")
export class UsersController extends Controller {
  /**
   * Retrieves a user by their ID.
   * @param userId The unique identifier for the user
   */
  @Get("{userId}")
  public async getUser(
    @Path() userId: number,
    @Query() includePosts?: boolean
  ): Promise<User> {
    return { id: userId, email: "john@example.com" };
  }
}
```

In the SSoT toolchain, this single snippet yields:
1. Compile-time type safety.
2. Express/Koa routing with 400 Bad Request if `userId` is not a number.
3. An OpenAPI 3 schema.
4. LLM-optimized Markdown documentation for agent consumption.