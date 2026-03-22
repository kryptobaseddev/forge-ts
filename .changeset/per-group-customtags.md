---
"@forge-ts/core": patch
"@forge-ts/cli": patch
"@forge-ts/enforcer": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

fix: implement per-group TSDoc enforcement + customTags writing to tsdoc.json

- tsdoc.enforce.core/extended/discretionary now controls rule severity by group
- Individual enforce.rules overrides always take precedence over group settings
- Guard rules (E009-E012) unaffected by group settings
- forge-ts init writes customTags from config into tsdoc.json (tagDefinitions + supportForTags)
- doctor --fix respects customTags when generating tsdoc.json
- Updated FORGE-TSDOC-TAGS.md and skill doc to v0.19.1 with all 33 rules and 15 tags
- 859 tests (18 new), all passing
