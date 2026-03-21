# @forge-ts/tsdoc-config

## 0.10.0

### Patch Changes

- 5d4a328: feat: agent-proof guardrails — config locking, audit trail, bypass budget, E009/E010

  - Config locking system: `forge-ts lock` / `forge-ts unlock --reason="..."`
  - Append-only audit trail: `.forge-audit.jsonl` with `forge-ts audit` command
  - Bypass budget: `forge-ts bypass --reason="..."` with configurable daily limit (default 3/day)
  - E009 rule: tsconfig.json strictness regression detection
  - E010 rule: forge-ts config drift detection against locked state
  - Lock/unlock events recorded in audit trail
  - Bypassed E009/E010 violations downgraded to warnings with [BYPASSED] prefix
  - ForgeConfig.bypass section with dailyBudget and durationHours
  - 553 tests (85 new), all passing

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
