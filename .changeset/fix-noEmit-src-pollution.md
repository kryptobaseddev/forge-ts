---
"@forge-ts/core": patch
---

Fix walker emitting compiled artifacts (.js, .d.ts, .map) into consumer src/ directories (GH-28)

The walker's `ts.createProgram()` was using the consumer's raw tsconfig compiler options without
overriding emit flags. If the consumer's tsconfig had `declaration: true` or `sourceMap: true`,
TypeScript would silently emit compiled files alongside source files, causing tsup/esbuild to
resolve stale .js files instead of .ts source — a silent build-breaking bug.

Now forces `noEmit: true`, `declaration: false`, `declarationMap: false`, `sourceMap: false`, and
`emitDeclarationOnly: false` since the walker is strictly read-only analysis.
