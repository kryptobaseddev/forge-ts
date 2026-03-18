---
"@forge-ts/core": minor
"@forge-ts/enforcer": minor
"@forge-ts/api": minor
"@forge-ts/cli": patch
"@forge-ts/doctest": patch
"@forge-ts/gen": patch
---

v0.4 release: configurable rules, dead link validation, OpenAPI path extraction, deprecation tracking.

- Per-rule configuration: toggle E001-E008 individually as error/warn/off
- E008: {@link} dead link validation against the project symbol graph
- @route TSDoc tag → OpenAPI path entries with parameters and responses
- W004: cross-monorepo deprecation tracking for @deprecated imports
