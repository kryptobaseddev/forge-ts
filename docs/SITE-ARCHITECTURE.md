# forge-ts Site Architecture

## 5-Stage Information Architecture

forge-ts generates documentation following a research-backed 5-stage information architecture.
Each stage answers a distinct question the reader has at that moment, reducing cognitive load and
improving discoverability for both humans and AI assistants.

---

### 1. ORIENT (What is this?)

The entry point for someone who has never seen the project.

| File | Purpose |
|------|---------|
| `index.md` | Landing page with features, install snippet, and a quick example |
| `getting-started.md` | Step-by-step tutorial that produces a working result |

---

### 2. LEARN (How does it work?)

Mental model and conceptual background for readers who want to understand before they build.

| File | Purpose |
|------|---------|
| `concepts.md` | Core concepts, design decisions, and mental model (generated as a stub) |

---

### 3. BUILD (How do I do X?)

Task-oriented guides for readers who know what they want to accomplish.

| File | Purpose |
|------|---------|
| `guides/index.md` | Index of how-to guides (generated as stubs, filled in manually) |

---

### 4. REFERENCE (What is the exact API?)

Exhaustive, machine-generated reference material.

| File | Purpose |
|------|---------|
| `packages/<name>/index.md` | Package overview and export summary |
| `packages/<name>/api/index.md` | Symbol table for the package |
| `packages/<name>/api/functions.md` | All exported functions with full TSDoc |
| `packages/<name>/api/types.md` | All exported types, interfaces, and enums |
| `packages/<name>/api/examples.md` | Extracted `@example` blocks, runnable snippets |
| `configuration.md` | Full `ForgeConfig` reference |
| `changelog.md` | Release history (linked from `CHANGELOG.md` at root) |

---

### 5. COMMUNITY (Where do I get help?)

Resources for readers who are stuck or want to contribute.

| File | Purpose |
|------|---------|
| `faq.md` | Frequently asked questions |
| `contributing.md` | Contribution guide (generated stub, links to `CONTRIBUTING.md`) |

---

## AI Context Files

In addition to the human-readable site, forge-ts writes three files to `outDir` that help
AI assistants and LLM-powered tooling consume the project's documentation efficiently.

| File | Purpose |
|------|---------|
| `llms.txt` | Compact routing manifest following the llms.txt specification. Lists sections and a quick-reference of all exported symbols. Designed for agents that need to decide *which* file to fetch. |
| `llms-full.txt` | Dense context dump with full documentation for every exported symbol. Intended for agents that need complete API context in a single file. |
| `skill.md` | AI skill file that teaches assistants *how to use* the project. Contains overview, installation, key concepts, common patterns (from `@example` blocks), API quick reference, and configuration reference. SSG-agnostic — no platform-specific content. |

---

## SSG Adapter System

forge-ts is SSG-agnostic at the symbol-graph level. The adapter system translates the
platform-neutral `DocPage[]` tree into the conventions of each supported static site generator.

| Target | Config file | Extensions | Notes |
|--------|-------------|------------|-------|
| `mintlify` | `docs.json` | `.mdx` | Includes `contextual` AI assistant options |
| `docusaurus` | `sidebars.js` | `.md` / `.mdx` | `sidebar_position` frontmatter |
| `nextra` | `_meta.json` | `.mdx` | `description` frontmatter |
| `vitepress` | `.vitepress/config.ts` | `.md` | `outline: deep` frontmatter |

### Adapter Contract

Every adapter implements `SSGAdapter`:

```typescript
interface SSGAdapter {
  target: string;
  displayName: string;
  styleGuide: SSGStyleGuide;
  scaffold(context: AdapterContext): ScaffoldManifest;
  transformPages(pages: DocPage[], context: AdapterContext): GeneratedFile[];
  generateConfig(context: AdapterContext): GeneratedFile[];
  getDevCommand(outDir: string): DevCommand;
  detectExisting(outDir: string): Promise<boolean>;
}
```

Adapters are self-registering — importing the module calls `registerAdapter()` automatically,
so the adapter registry stays in sync with the module graph.
