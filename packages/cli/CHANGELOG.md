# @forge-ts/cli

## 0.4.0

### Patch Changes

- [`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - v0.4 release: configurable rules, dead link validation, OpenAPI path extraction, deprecation tracking.

  - Per-rule configuration: toggle E001-E008 individually as error/warn/off
  - E008: {@link} dead link validation against the project symbol graph
  - @route TSDoc tag → OpenAPI path entries with parameters and responses
  - W004: cross-monorepo deprecation tracking for @deprecated imports

- Updated dependencies [[`c072beb`](https://github.com/kryptobaseddev/forge-ts/commit/c072beb925961adf9b16be584389897f98909a2f)]:
  - @forge-ts/core@0.4.0
  - @forge-ts/enforcer@0.4.0
  - @forge-ts/api@0.4.0
  - @forge-ts/doctest@0.4.0
  - @forge-ts/gen@0.4.0

## 0.3.1

### Patch Changes

- Complete TSDoc coverage across all packages. Every exported symbol, interface member, and function now has documentation with @example blocks. forge-ts check passes with 0 errors on all 6 packages (229 symbols). Fixed @packageDocumentation tag extraction in walker.

- Updated dependencies []:
  - @forge-ts/core@0.3.1
  - @forge-ts/enforcer@0.3.1
  - @forge-ts/doctest@0.3.1
  - @forge-ts/api@0.3.1
  - @forge-ts/gen@0.3.1

## 0.3.0

### Minor Changes

- [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Opinionated SSoT release: multi-page doc site generation, strict enforcement (E004-E007), SSG config generation (Mintlify/Docusaurus/Nextra/VitePress), LAFS MVI progressive disclosure for agent guidance. llms.txt now defaults to enabled.

### Patch Changes

- [`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805) Thanks [@kryptobaseddev](https://github.com/kryptobaseddev)! - Upgrade OpenAPI spec output from 3.1.0 to 3.2.0. Added new type contracts for 3.2 features: query method, additionalOperations, querystring parameters, MediaType/Encoding objects. Upgraded TypeScript to 6.0.1-rc, vite to v8, pnpm to 10.32.1. True dogfood with published @forge-ts/cli from npm.

- Updated dependencies [[`87eac0d`](https://github.com/kryptobaseddev/forge-ts/commit/87eac0df66adea004dd44fcc2166d8e6e3476805), [`b7af205`](https://github.com/kryptobaseddev/forge-ts/commit/b7af205fb3aa9189464024ad84fd45d2f0c11361)]:
  - @forge-ts/core@0.3.0
  - @forge-ts/api@0.3.0
  - @forge-ts/enforcer@0.3.0
  - @forge-ts/doctest@0.3.0
  - @forge-ts/gen@0.3.0

## 0.2.1

### Patch Changes

- Fix package metadata: add per-package READMEs, correct repository URLs to kryptobaseddev/forge-ts, remove stale codluv references.

- Updated dependencies []:
  - @forge-ts/core@0.2.1
  - @forge-ts/enforcer@0.2.1
  - @forge-ts/doctest@0.2.1
  - @forge-ts/api@0.2.1
  - @forge-ts/gen@0.2.1

## 0.2.0

### Minor Changes

- [`0ce2f3e`](https://github.com/kryptobaseddev/forge-ts/commit/0ce2f3eca6e67e18d9baba867bcd4ac6236b1ae6) - Initial release of forge-ts - the universal TypeScript documentation compiler.
