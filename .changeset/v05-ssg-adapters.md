---
"@forge-ts/gen": minor
"@forge-ts/cli": minor
"@forge-ts/core": patch
"@forge-ts/enforcer": patch
"@forge-ts/api": patch
"@forge-ts/doctest": patch
---

SSG adapter system with `forge-ts init docs` command.

- Central SSGAdapter interface with registry pattern (DRY/SOLID)
- 4 first-class providers: Mintlify (docs.json), Docusaurus v3, Nextra v4, VitePress v2
- `forge-ts init docs --target mintlify` scaffolds complete doc site
- Safety checks for existing scaffold, cross-target collision detection
- Default target: Mintlify
- LAFS JSON output on init command
- generate() refactored to use adapter system
