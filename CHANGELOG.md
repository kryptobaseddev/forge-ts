# Changelog

All notable changes to forge-ts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.21.1] - 2026-03-26

### Added
- CKM enforcement rules: W018 (operation completeness), W019 (CKM tag content), W020 (constraint @throws)
- 40 enforcement rules total (was 37)

### Fixed
- Biome schema migration 2.4.8 to 2.4.9 (CI lint failure)

## [0.21.0] - 2026-03-26

### Added
- Codebase Knowledge Manifest (CKM) generator: `forge-ts build` produces `ckm.json`
- 3 new TSDoc tags: `@operation`, `@constraint`, `@workflow`
- Hybrid extraction: heuristic analysis + TSDoc tag overrides
- `gen.ckm` config flag (default: `true`)

### CKM Output
- 36 concepts, 53 operations, 2 constraints, 41 config schema entries (self-report)
- Concepts from @concept tags and Config/Options/State interfaces
- Operations from @operation tags and run*/create*/validate* function patterns
- Constraints from @constraint tags and @throws analysis
- Config schema from Config interfaces with types/defaults/effects

## [0.20.0] - 2026-03-26

### Added
- TypeScript 6.0.2 upgrade across all 6 packages
- `@remarks` pipeline: walker promotes @remarks to ForgeSymbol.documentation.remarks, rendered in llms-full.txt
- Staleness detection rules: W014 (param name drift), W015 (param count mismatch), W016 (void @returns), W017 (placeholder @remarks)
- `forge-ts barometer` command: generates documentation effectiveness Q&A from the AST
- `forge-ts version` subcommand with `-V` and `-v` flag support
- Versionguard integration with strict config and husky pre-commit/pre-push hooks
- Package-grouped llms.txt with @packageDocumentation summaries
- Documentation effectiveness barometer at `.forge/barometer.md`

### Changed
- Renamed `@cleocode/lafs-protocol` to `@cleocode/lafs`
- Generator uses `config.project.packageName` for project identity (was rootDir path)
- OpenAPI spec reads title/version/description from config.project
- llms.txt shows named functions instead of anonymous signatures
- Site generator excludes root config files from package grouping
- Hero example selection prefers index.ts entry-point functions
- Updated deps: biome 2.4.9, vite 8.0.3, vitest 4.1.1

### Fixed
- Full TSDoc coverage: 0 errors across 355 symbols (was 95 errors)
- EnforceRules TSDoc updated to document all 33+ rules
- Docs cleanup: removed stale files, updated VISION.md references

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

[Unreleased]: https://github.com/kryptobaseddev/forge-ts/compare/v0.20.0...HEAD
[0.20.0]: https://github.com/kryptobaseddev/forge-ts/compare/v0.19.5...v0.20.0
[0.19.5]: https://github.com/kryptobaseddev/forge-ts/compare/v0.19.0...v0.19.5
[0.19.0]: https://github.com/kryptobaseddev/forge-ts/compare/v0.1.0...v0.19.0
[0.1.0]: https://github.com/kryptobaseddev/forge-ts/releases/tag/v0.1.0
