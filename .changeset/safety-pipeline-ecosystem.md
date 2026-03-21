---
"@forge-ts/cli": minor
"@forge-ts/enforcer": minor
"@forge-ts/core": minor
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
"@forge-ts/tsdoc-config": patch
---

feat: safety pipeline + ecosystem integration — init --hooks, prepublish, E011/E012/E016

- forge-ts init hooks: detect husky/lefthook and scaffold pre-commit hooks with forge-ts check
- forge-ts prepublish: combined check+build gate for npm prepublishOnly lifecycle
- E011 rule: Biome config weakening detection (error->warn/off drift against locked state)
- E012 rule: package.json engine field tampering (Node.js version downgrade detection)
- E016 rule: require release tag (@public/@beta/@internal) on all exported symbols
- 730 tests (65 new), all passing
- Complete enforcement suite: 22 rules across 4 layers (API, Dev, Consumer, Config Guard)
