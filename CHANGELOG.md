# Changelog

All notable changes to forge-ts will be documented in this file.

This project uses [changesets](https://github.com/changesets/changesets) for versioning.

## [0.1.0] - 2026-03-18

### Added
- Initial release of forge-ts monorepo
- `@forge-ts/core` - Shared types, config loader, AST walker
- `@forge-ts/enforcer` - TSDoc enforcement (build gate)
- `@forge-ts/doctest` - @example block testing with source maps
- `@forge-ts/api` - OpenAPI 3.1 and API reference generation
- `@forge-ts/gen` - Markdown/MDX, llms.txt, README sync generation
- `@forge-ts/cli` - Unified CLI (check, test, build commands)

### Technology
- Node.js 24 LTS with native TypeScript support
- TypeScript 6.0 Compiler API
- Biome 2.4 for linting/formatting
- Vitest 4.1 for testing
- pnpm workspaces with fixed versioning via changesets
