# CLEO Memory Bridge

> Auto-generated at 2026-03-19T00:41:00
> Do not edit manually. Regenerate with `cleo refresh-memory`.

## Key Learnings

- [L-83bf4771] Completed: Refactor existing SSG code to use adapter system — Replace ssg-config.ts and markdown.ts SSG-specific code with adapter calls. generate() u (confidence: 0.7)
- [L-468bc417] Completed: 4 SSG provider adapters (Mintlify, Docusaurus, Nextra, VitePress) — One file per provider implementing SSGAdapter. Each follows official gu (confidence: 0.7)
- [L-e61aa7e8] Completed: forge-ts init docs command with LAFS output — New CLI command: forge-ts init docs --target mintlify. Scaffolds complete doc site. Safety ch (confidence: 0.7)
- [L-0dfc6afc] Completed: Central SSG adapter SDK with provider interface — Create SSGAdapter interface in @forge-ts/gen. Single file per provider. Adapter handles:  (confidence: 0.7)
- [L-1160fe67] Completed: OpenAPI path extraction from @route/@get/@post TSDoc tags — Extract HTTP routes from TSDoc tags (@route, @get, @post, @put, @delete, @patch (confidence: 0.7)
- [L-9e46553e] Completed: Cross-monorepo deprecation tracking (W004) — Scan workspace packages for consumption of @deprecated exports from other packages. W004 warni (confidence: 0.7)
- [L-0d567615] Completed: {@link} dead link validation in enforcer (E008) — Validate all {@link SymbolName} tags against the project symbol graph. E008 error for lin (confidence: 0.7)
- [L-1668dcff] Completed: Per-rule configuration: toggle E001-E007 individually — Add rules config to ForgeConfig.enforce allowing error/warn/off per rule. Update en (confidence: 0.7)
