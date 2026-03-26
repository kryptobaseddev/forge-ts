# Documentation Effectiveness Barometer

> Measures whether an LLM agent can understand a codebase from ONLY the generated docs.
> Run this test after any significant code or documentation change.

## How to Run

1. Give an LLM agent access to ONLY `docs/generated/` files
2. Explicitly prohibit reading source code (`packages/`, `src/`)
3. Ask the 10 questions below
4. Score answers against the answer key
5. Use the rating scale to assess doc effectiveness

## Phase 1: Questions

Give these to an agent or contributor who has ONLY read the `docs/generated/` files.

### Q1: ESM Import Paths
When doctest generates virtual test files, what specific file extension does it use for the source file imports to ensure ESM compatibility?

### Q2: MDX Sanitization
The `sanitizeForMdx` function converts standard HTML comments (`<!-- comment -->`) into which specific MDX-compatible format?

### Q3: Offset Integrity
When applying multiple string replacements to a single document (like in MDX sanitization), what strategy does forge-ts use to ensure that character offsets remain valid for every transformation?

### Q4: OpenAPI Parameter Derivation
In the `@forge-ts/api` package, if a function has an `@param` tag but that parameter name is not present in the `@route` path template (e.g., `/users/{id}`), how is that parameter classified in the generated OpenAPI spec?

### Q5: Visibility Collision
If a developer accidentally tags a symbol with both `@public` and `@internal`, what is the final resolved visibility, and will it appear in the generated output?

### Q6: Bypass Governance
At what precise time (and in what timezone) does the "daily" bypass budget reset?

### Q7: Doctor Integrity Checks
To pass the `doctor` command's configuration check, the project's `tsdoc.json` file must extend which specific internal preset path?

### Q8: Inline Link Rendering
When rendering a `{@link Target}` tag for a documentation summary in llms.txt or similar output, how is the target name specifically formatted in the resulting plain string?

### Q9: Monorepo Package Discovery
How does the `groupSymbolsByPackage` function determine the name of a package when analyzing a monorepo structure?

### Q10: Rule E020 (Any-Type Detection)
Rule E020 flags the use of `any` in public APIs. How does the system avoid "false positives" for internal logic that might use `any` within the same file?

---

## Phase 2: Answer Key

| # | Expected Answer | Source Code Evidence | Doc Location |
|---|----------------|---------------------|-------------|
| 1 | `.js` extension | `relative(...).replace(/\.tsx?$/, ".js")` in generator.ts | generateTestFiles @remarks in llms-full.txt |
| 2 | `{/* comment */}` (MDX JSX comment) | `replacement: "{/*" + match[1] + "*/}"` in markdown-utils.ts | sanitizeForMdx description in llms-full.txt |
| 3 | Reverse position order (descending start offset) | `transforms.sort((a, b) => b.start - a.start)` in markdown-utils.ts | sanitizeForMdx @remarks in llms-full.txt |
| 4 | Query parameter (`in: "query"`) | Non-path params filter logic in openapi.ts | generateOpenAPISpec @remarks in llms-full.txt |
| 5 | `Visibility.Internal` (excluded from output) — most restrictive wins | Precedence filtering in visibility.ts | resolveVisibility @remarks in llms-full.txt |
| 6 | 00:00 UTC (midnight UTC) | `new Date(Date.UTC(...))` in bypass.ts | getRemainingBudget @remarks in llms-full.txt |
| 7 | `forge-ts/core/tsdoc-preset` | Checked in runDoctor flow | runDoctor description in llms-full.txt |
| 8 | Backtick-wrapped (e.g., `` `Target` ``) | `parts.push('\`' + linkText + '\`')` in walker.ts | renderInlineNodes @remarks in llms-full.txt |
| 9 | Directory segment immediately after `packages/` | `monorepoMatch[1]` regex capture in site-generator.ts | groupSymbolsByPackage description in llms-full.txt |
| 10 | Uses `getDeclaredTypeOfSymbol` to check declared API surface (signature string), not function bodies | AST-level signature check in enforcer.ts | enforce() @remarks in llms-full.txt |

---

## Rating Scale

| Score | Rating | Meaning |
|-------|--------|---------|
| 9-10 | **Elite SSoT** | Documentation is a perfect reflection of the codebase. Agents can operate with zero source code access. |
| 7-8 | **High Fidelity** | Documentation is excellent but might miss one or two implementation details. |
| 5-6 | **Standard** | Useful for usage, but internal architectural understanding requires source code access. |
| < 5 | **Stale/Shallow** | Documentation is too high-level and needs deeper enforcement of `@remarks` and internal function documentation. |

---

## Historical Results

| Date | Score | Notes |
|------|-------|-------|
| 2026-03-26 (pre-fix) | 3.5/10 | @remarks extracted by walker but not surfaced in generated output |
| 2026-03-26 (post-fix) | TBD | Fixed: remarks promoted to ForgeSymbol.documentation.remarks, rendered in llms-full.txt |

---

## Methodology

This barometer tests the **Extraction > Inference** principle from the forge-ts vision. Questions are designed to be answerable ONLY if:

1. The source code has the implementation detail documented in TSDoc (@remarks)
2. The walker extracts it into the ForgeSymbol graph
3. The generator renders it in the output artifacts

A low score means one of these three links is broken. The fix is always upstream — enrich the TSDoc, fix the walker, or fix the generator. Never patch the generated docs directly.
