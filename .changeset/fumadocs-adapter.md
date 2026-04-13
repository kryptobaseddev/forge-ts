---
"@forge-ts/core": minor
"@forge-ts/gen": minor
"@forge-ts/cli": minor
---

feat: add Fumadocs SSG adapter and set as default target

- New `fumadocs` SSG adapter with full scaffold, meta.json navigation, and Fumadocs UI integration
- Fumadocs is now the default SSG target (was Mintlify)
- Scaffold generates a complete Next.js app in `outDir/site/` that reads content from `outDir/`
- Per-directory `meta.json` navigation files generated at every level
- Tailwind v4 + fumadocs-ui CSS preset included in scaffold
- `buildFrontmatterFields` handles fumadocs target (title + description)
