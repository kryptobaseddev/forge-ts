---
"@forge-ts/core": patch
"@forge-ts/enforcer": patch
"@forge-ts/cli": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

fix: E020 false positives — interfaces/types no longer reported as containing `any`

The walker's buildSignature() used getTypeOfSymbolAtLocation() which returns
`any` for interface and type alias symbols. Changed to getDeclaredTypeOfSymbol()
for interfaces, type aliases, and enums. Also added NoTruncation flag to prevent
TypeScript from collapsing complex types to `any`.
