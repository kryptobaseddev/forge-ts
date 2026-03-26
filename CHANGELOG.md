# Changelog

All notable changes to forge-ts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.19.5] - 2026-03-22

### Added
- Cooperative git hooks with `--staged` and versionguard detection
- Hook templates use `--no-install` to prevent supply chain attacks

### Fixed
- forge-ts passes its own check with 0 violations (was 167)

## [0.19.0] - 2026-03-21

### Added
- Anti-pattern detection (knip integration, dead export skipping)
- Enhanced doctest runner for stricter validation
- Centralized logging via consola
- Merged `@forge-ts/tsdoc-config` into `@forge-ts/core`
- TSDoc spec sync script
- E016 rule: release tag required on public symbols
- `defineConfig()` for typed configuration

### Changed
- Replaced custom logger.ts with consola
- Package simplification: 6 packages (was 7)

## [0.1.0] - 2026-03-18

### Added
- Initial release of forge-ts monorepo
- `@forge-ts/core` - Shared types, config loader, AST walker
- `@forge-ts/enforcer` - TSDoc enforcement (build gate)
- `@forge-ts/doctest` - @example block testing with source maps
- `@forge-ts/api` - OpenAPI 3.2 and API reference generation
- `@forge-ts/gen` - Markdown/MDX, llms.txt, README sync generation
- `@forge-ts/cli` - Unified CLI (check, test, build commands)

### Technology
- Node.js 24 LTS with native TypeScript support
- TypeScript 5.9 Compiler API
- Biome 2.4 for linting/formatting
- Vitest 4.1 for testing
- pnpm workspaces with fixed versioning via changesets

[Unreleased]: https://github.com/kryptobaseddev/forge-ts/compare/v0.19.5...HEAD
[0.19.5]: https://github.com/kryptobaseddev/forge-ts/compare/v0.19.0...v0.19.5
[0.19.0]: https://github.com/kryptobaseddev/forge-ts/compare/v0.1.0...v0.19.0
[0.1.0]: https://github.com/kryptobaseddev/forge-ts/releases/tag/v0.1.0
