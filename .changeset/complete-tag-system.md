---
"@forge-ts/core": minor
"@forge-ts/enforcer": minor
"@forge-ts/tsdoc-config": minor
"@forge-ts/cli": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

feat: complete tag system — all 14 custom tags, 27 enforcer rules, zero PLANNED items

- Fix: @category and @since extraction was broken (defined in tsdoc.json but never extracted by walker)
- Add 9 new custom tags: @response, @query, @header, @body, @quickstart, @faq, @breaking, @migration, @complexity
- Add 5 new enforcer rules: E017 (internal re-export), E018 (route without response), W009 (inheritDoc source), W010 (breaking without migration), W011 (since on public exports)
- Extract {@inheritDoc} targets in walker for W009 validation
- tsdoc.json preset: 14 custom tags, 38 total supported tags
- 751 tests (21 new), all passing
- FORGE-TSDOC-TAGS.md: zero PLANNED items — everything is ACTIVE
