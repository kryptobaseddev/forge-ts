---
"@forge-ts/core": patch
"@forge-ts/enforcer": patch
"@forge-ts/cli": patch
"@forge-ts/gen": patch
"@forge-ts/doctest": patch
"@forge-ts/api": patch
---

fix: rename @forge-ignore to @forgeIgnore — hyphen violated TSDoc tag name spec

The hyphen in @forge-ignore caused TSDocConfigFile to report hasErrors:true,
poisoning config loading for ALL projects. Custom tags (@since, @route, etc.)
were silently unrecognized, causing false W006 "tag not defined" and W011
"missing @since" warnings even when tags were correctly used.

Also relaxed the hasErrors guard in walker.ts — configureParser is tolerant
and should always be called when a tsdoc.json exists.
