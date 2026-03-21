# @forge-ts/tsdoc-config

## 0.9.0

### Minor Changes

- 49da7c5: feat: TSDoc ecosystem foundation — tsdoc-config integration, W006 rule, ForgeConfig expansion

  - Integrate @microsoft/tsdoc-config into walker.ts (replaces bare `new TSDocConfiguration()`)
  - Create @forge-ts/tsdoc-config package with opinionated tsdoc.json preset
  - Custom TSDoc tags: @route, @category, @since, @guide, @concept
  - Add W006 rule: surfaces 70+ TSDoc parser-level syntax errors as configurable warnings
  - Expand ForgeConfig with `tsdoc` section (writeConfig, customTags, enforce per standardization group)
  - Expand ForgeConfig with `guards` section (tsconfig, biome, packageJson drift detection config)
  - forge-ts init now writes tsdoc.json with extends to @forge-ts/tsdoc-config
  - 468 tests (27 new), all passing
