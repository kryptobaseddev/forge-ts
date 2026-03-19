# Documentation Site Structure Research

**Date**: 2026-03-18
**Scope**: 6 best-in-class TypeScript/JavaScript open source projects
**Purpose**: Inform forge-ts documentation generation architecture

---

## 1. tRPC (trpc.io/docs)

### Navigation Structure

```
tRPC (Introduction)
  - Introduction
  - Quickstart
  - Concepts
  - Videos & Community Resources
  - Example Apps

Backend Usage
  - Overview
  - Define Routers
  - Define Procedures
  - Context
  - Input & Output Validators
  - Middlewares
  - Merging Routers
  - Adapters
  - Server Side Calls
  - Authorization
  - Error Handling
  - Error Formatting
  - Data Transformers
  - Content Types (JSON, FormData, File, Blob)
  - Metadata
  - Response Caching
  - Subscriptions
  - WebSockets

Client Usage
  - Overview
  - Links
  - Vanilla Client
    - Overview
    - Setup
    - Inferring Types
    - Aborting Procedure Calls
  - TanStack React Query
  - React Query Integration (Classic)
  - Next.js Integration
  - OpenAPI (alpha)

Community
  - Awesome tRPC Collection

Extra Information
  - FAQ
  - API Reference (auto-generated)
```

### Content Patterns
- **Getting Started**: "Quickstart" page - scaffolds a project, walks through first procedure
- **Installation**: Embedded within Quickstart (not separate)
- **Configuration**: No dedicated config page; configuration is woven into per-adapter pages
- **Concepts**: Yes, dedicated "Concepts" page explaining core mental model
- **API Reference**: Auto-generated, linked from sidebar but clearly secondary
- **Guides vs Reference**: Backend Usage and Client Usage serve as guides; API Reference is separate
- **Migration**: Not prominent (stable API)
- **FAQ**: Yes
- **Changelog**: Not in docs sidebar (GitHub releases)
- **TypeScript types**: Shown inline in code blocks with inferred type annotations as comments/tooltips
- **Hierarchy depth**: 3 levels max (Client Usage > Vanilla Client > Setup)

---

## 2. Drizzle ORM (orm.drizzle.team)

### Navigation Structure

```
Meet Drizzle
  - Get started
  - Sustainability
  - Why Drizzle?
  - Guides
  - Tutorials
  - Latest releases
  - Gotchas

Upgrade to v1.0 RC
  - How to upgrade?
  - Relational Queries v1 to v2

Fundamentals
  - Schema
  - Relations
  - Database connection
  - Query Data
  - Migrations

Connect (by database/driver)
  - PostgreSQL (12 variants: Neon, Supabase, PGLite, etc.)
  - MySQL (3 variants: PlanetScale, TiDB, etc.)
  - SQLite (8 variants: Turso, D1, Bun SQLite, etc.)
  - Mobile SQLite (3 variants: Expo, OP SQLite, RN SQLite)
  - Cloud APIs (2: AWS Data API Postgres/MySQL)
  - Drizzle Proxy

Manage Schema
  - Data types
  - Indexes & Constraints
  - Sequences
  - Views
  - Schemas
  - Drizzle Relations
  - Row-Level Security (RLS)
  - Extensions

Migrations
  - Overview
  - generate / migrate / push / pull / export / check / up / studio
  - Custom migrations
  - Migrations for teams
  - Web and mobile
  - drizzle.config.ts

Seeding
  - Overview / Generators / Versioning

Access Your Data
  - Query / Select / Insert / Update / Delete
  - Filters / Utils / Joins
  - Magic sql`` operator

Performance
  - Queries / Serverless

Advanced
  - Set Operations / Generated Columns / Transactions / Batch
  - Cache / Dynamic query building / Read Replicas / Custom types / Goodies

Validations
  - zod / valibot / typebox / arktype / effect-schema

Extensions
  - Prisma / ESLint Plugin / drizzle-graphql
```

### Content Patterns
- **Getting Started**: "Get started" page with installation + first schema + first query
- **Installation**: Embedded in Get Started
- **Configuration**: `drizzle.config.ts` has its own page under Migrations
- **Concepts**: "Fundamentals" section serves this role
- **API Reference**: No separate auto-generated API ref; the "Access Your Data" section IS the API docs with inline examples
- **Guides vs Reference**: "Guides" and "Tutorials" are separate from reference-style "Manage Schema" and "Access Your Data"
- **Migration**: Yes, prominent "Upgrade to v1.0 RC" section + per-command migration pages
- **FAQ**: No dedicated FAQ; "Gotchas" serves similar purpose
- **Changelog**: "Latest releases" page
- **TypeScript types**: Inline in code blocks; schema definitions double as type definitions
- **Hierarchy depth**: 2 levels (flat sections with page lists)
- **Notable**: Extremely adapter/driver-heavy; "Connect" section has 28+ pages for different databases

---

## 3. Zod (zod.dev)

### Navigation Structure

```
Zod 4
  - Release notes
  - Migration guide

Documentation
  - Intro
  - Basic usage
  - Defining schemas (API)
  - Customizing errors
  - Formatting errors
  - Metadata and registries (New)
  - JSON Schema (New)
  - Codecs (New)
  - Ecosystem
  - For library authors

Packages
  - Zod
  - Zod Mini (New)
  - Zod Core (New)
```

### Content Patterns
- **Getting Started**: "Intro" page with installation + first schema + parse example
- **Installation**: Embedded in Intro (npm/yarn/pnpm/bun commands)
- **Configuration**: No config file; library has no configuration
- **Concepts**: "Basic usage" serves as conceptual introduction
- **API Reference**: "Defining schemas" is essentially the API reference - a massive single page with every schema type
- **Guides vs Reference**: Minimal separation; docs are primarily reference-oriented
- **Migration**: Yes, dedicated "Migration guide" for Zod 3 to Zod 4
- **FAQ**: No
- **Changelog**: "Release notes" page
- **TypeScript types**: Heavily inline; shows input/output type inference patterns
- **Hierarchy depth**: 2 levels (very flat)
- **Notable**: Very concise navigation (~15 pages total). "For library authors" is a distinctive page. Multi-package docs (Zod, Zod Mini, Zod Core) under "Packages" section.

---

## 4. Effect (effect.website/docs)

### Navigation Structure

```
Getting Started
  - Introduction / Why Effect? / Installation / Devtools
  - Importing Effect / The Effect Type / Creating Effects
  - Running Effects / Using Generators / Building Pipelines
  - Control Flow Operators

Error Management
  - Two Types of Errors / Expected Errors / Unexpected Errors
  - Fallback / Matching / Retrying / Timing Out / Sandboxing
  - Error Accumulation / Error Channel Operations
  - Parallel and Sequential Errors / Yieldable Errors

Requirements Management
  - Managing Services / Default Services / Managing Layers / Layer Memoization

Resource Management
  - Introduction / Scope

Observability
  - Logging / Metrics / Tracing / Supervisor

Configuration (single page)

Runtime (single page)

Scheduling
  - Introduction / Repetition / Built-In Schedules
  - Schedule Combinators / Cron / Examples

State Management
  - Ref / SynchronizedRef / SubscriptionRef

Batching (single page)

Caching
  - Caching Effects / Cache

Concurrency
  - Basic Concurrency / Fibers / Deferred / Queue / PubSub / Semaphore / Latch

Stream
  - Introduction / Creating / Consuming / Error Handling / Operations / Resourceful

Sink
  - Introduction / Creating / Operations / Concurrency / Leftovers

Testing
  - TestClock

Code Style
  - Guidelines / Dual APIs / Branded Types / Pattern Matching / Excessive Nesting

Data Types
  - BigDecimal / Cause / Chunk / Data / DateTime / Duration
  - Either / Exit / HashSet / Option / Redacted

Traits
  - Equal / Hash

Behaviours
  - Equivalence / Order

Schema (sub-library)
  - Introduction / Getting Started / Basic Usage / Filters / Advanced Usage
  - Projections / Transformations / Annotations / Error Messages
  - Error Formatters / Class APIs / Default Constructors
  - Effect Data Types / Standard Schema / Arbitrary / JSON Schema
  - Equivalence / Pretty Printer

AI (Unstable)
  - Introduction / Getting Started / Execution Planning / Tool Use

Micro (Unstable)
  - Getting Started / Micro for Effect Users

Platform (Unstable)
  - Introduction / Command / FileSystem / KeyValueStore / Path
  - PlatformLogger / Runtime / Terminal

Additional Resources
  - Myths / API Reference / Coming From ZIO
  - Effect vs fp-ts / Effect vs Promise / Effect vs neverthrow
```

### Content Patterns
- **Getting Started**: 10-page progressive tutorial from installation through pipelines
- **Installation**: Dedicated page within Getting Started
- **Configuration**: Yes, dedicated single page
- **Concepts**: The entire Getting Started section IS conceptual education (The Effect Type, Creating Effects, etc.)
- **API Reference**: Linked under Additional Resources; auto-generated separately
- **Guides vs Reference**: Primarily guide-oriented; API reference is external
- **Migration**: "Coming From ZIO" and comparison pages serve migration use case
- **FAQ**: "Myths" page serves FAQ-like purpose
- **Changelog**: Not in docs
- **TypeScript types**: Extensive inline type signatures; shows generic type parameters
- **Hierarchy depth**: 2 levels
- **Notable**: By far the largest docs (~100+ pages). Sub-libraries (Schema, Platform, AI) have their own sections. "Code Style" section is unique. Comparison pages (vs fp-ts, vs Promise) are distinctive.

---

## 5. Hono (hono.dev)

### Navigation Structure

```
Getting Started
  - Basic
  - (18 runtime/platform-specific pages: Node.js, Bun, Deno,
    Cloudflare Workers, Cloudflare Pages, Vercel, Netlify,
    AWS Lambda, Lambda Edge, Google Cloud Run, Azure Functions,
    Fastly, Ali Function Compute, Supabase Functions, Next.js,
    Service Worker, WebAssembly WASI)

Guides
  - Create Hono / JSX / JSX DOM / Validation / Middleware
  - Helpers / RPC / Testing / Examples / Best Practices / FAQ / Others

API
  - Hono / Context / Request / Exception / Routing / Presets / Index

Helpers
  - Dev / Testing / CSS / Route / ConnInfo / SSG / Cookie
  - Streaming / Factory / HTML / Adapter / Proxy / JWT / Accepts / WebSocket

Middleware (Built-in)
  - Third Party
  - Logger / CORS / JWT / Basic Auth / Bearer Auth / Request ID
  - Secure Headers / Compress / ETag / Cache / Timeout / CSRF
  - Combine / Timing / JSX Renderer / Body Limit / Method Override
  - Pretty JSON / Trailing Slash / Context Storage / Language
  - JWK / IP Restriction

Concepts
  - Web Standard / Motivation / Routers / Developer Experience
  - Stacks / Middleware / Benchmarks
```

### Content Patterns
- **Getting Started**: "Basic" page + per-platform setup pages (18 platforms!)
- **Installation**: Per-platform within Getting Started
- **Configuration**: No dedicated config page
- **Concepts**: Yes, dedicated section with philosophical pages (Motivation, Web Standard, DX)
- **API Reference**: "API" section with per-class pages (Hono, Context, Request, etc.)
- **Guides vs Reference**: Clear separation: Guides (how-to) vs API (reference) vs Concepts (why)
- **Migration**: Not prominent
- **FAQ**: Yes, under Guides
- **Changelog**: Not in docs
- **TypeScript types**: Inline in code blocks
- **Hierarchy depth**: 2 levels
- **Notable**: Middleware and Helpers each get their own top-level sections with per-item pages. Benchmarks page is distinctive.

---

## 6. Turborepo (turborepo.dev)

### Navigation Structure

```
Getting Started
  - Introduction
  - Installation
  - Examples
  - Editor integration
  - Add to existing repository

Crafting Your Repository (progressive guide)
  - Structuring a repository
  - Managing dependencies
  - Creating an internal package
  - Configuring tasks
  - Running tasks
  - Caching
  - Developing apps
  - Using environment variables
  - Constructing CI
  - Upgrading
  - Understanding your repository

Core Concepts
  - Package and task graph
  - Internal packages
  - Remote caching
  - Package types

Guides
  - AI
  - Migrating from Nx
  - Multi-language
  - Publishing libraries
  - Single-package workspaces
  - CI Vendors (6: GitHub Actions, GitLab CI, Buildkite, CircleCI, Vercel, Travis CI)
  - Frameworks (5: Next.js, Nuxt, SvelteKit, Vite, Framework Bindings)
  - Tools (12: ESLint, Jest, TypeScript, Vitest, Playwright, Storybook,
    Tailwind, Prisma, Docker, Biome, oxc, shadcn-ui)

Reference
  - Configuration
  - CLI: run / generate / ls / link / login / logout / telemetry / watch / scan / bin / query
```

### Content Patterns
- **Getting Started**: Dedicated section with Installation as separate page
- **Installation**: Yes, separate dedicated page
- **Configuration**: Yes, under Reference
- **Concepts**: "Core Concepts" section
- **API Reference**: "Reference" section with CLI command pages + configuration reference
- **Guides vs Reference**: Excellent separation: Getting Started > Crafting (tutorial) > Concepts > Guides > Reference
- **Migration**: "Migrating from Nx" guide + "Upgrading" in Crafting section
- **FAQ**: No
- **Changelog**: Not in docs
- **TypeScript types**: N/A (build tool, not a library)
- **Hierarchy depth**: 3 levels (Guides > CI Vendors > GitHub Actions)
- **Notable**: "Crafting Your Repository" is a unique progressive tutorial pattern. Tool integration guides are extensive.

---

## Universal Patterns Analysis

### Pages That Appear on EVERY Project

| Page/Section | tRPC | Drizzle | Zod | Effect | Hono | Turborepo |
|---|---|---|---|---|---|---|
| Introduction / Overview | Yes | Yes | Yes | Yes | Yes | Yes |
| Getting Started / Quickstart | Yes | Yes | Yes | Yes | Yes | Yes |
| Installation (embedded or separate) | Yes | Yes | Yes | Yes | Yes | Yes |
| Concepts / Fundamentals | Yes | Yes | Partial | Yes | Yes | Yes |
| API / Reference | Yes | Inline | Yes | Yes | Yes | Yes |
| Examples / Example Apps | Yes | No | No | No | Yes | Yes |
| Migration guide | No | Yes | Yes | Partial | No | No |
| FAQ | Yes | Partial | No | Partial | Yes | No |
| Ecosystem / Community | Yes | No | Yes | No | No | Yes |

### Universal Must-Haves (present in 5+ of 6 projects)

1. **Introduction page** - What it is, why it exists, key features
2. **Getting Started / Quickstart** - Installation + first working example
3. **Core Concepts** - Mental model, key abstractions, how it works
4. **API Reference** - Detailed per-function/class/method documentation
5. **Guides** - Task-oriented how-to content
6. **Examples** - Working code samples (inline or linked to repos)

### Universal Navigation Structure

The consensus pattern across all 6 projects follows this information architecture:

```
1. ORIENT     → Introduction, Why This Tool?, Getting Started
2. LEARN      → Concepts, Fundamentals, Tutorials
3. BUILD      → Guides, How-To, Integration pages
4. REFERENCE  → API Reference, Configuration, CLI Reference
5. COMMUNITY  → FAQ, Migration, Ecosystem, Community links
```

This maps to the documentation maturity model:
- **Orient** = "Should I use this?"
- **Learn** = "How does this work?"
- **Build** = "How do I do X?"
- **Reference** = "What is the exact API?"
- **Community** = "Where do I get help?"

### How They Handle Multi-Package Docs

- **Zod**: "Packages" section in sidebar with per-package page (Zod, Zod Mini, Zod Core)
- **Effect**: Sub-libraries get their own full sections (Schema, Platform, AI, Micro)
- **Drizzle**: Integrations listed as flat pages under a category (Validations > zod, valibot, etc.)
- **Turborepo**: Single product; no multi-package concern

**Pattern**: Small packages get a page each; large sub-libraries get their own section with multiple pages.

### Landing Page Content

Every project's docs landing page contains:
1. One-line description of what it is
2. Key value propositions / feature highlights (usually 3-6 bullet points)
3. Quick installation command
4. Minimal "hello world" code example
5. Links to next steps (Getting Started, Examples)

### Code Examples

- **All 6**: Use inline code blocks within documentation pages (not separate example pages)
- **tRPC, Effect, Zod**: Show inferred TypeScript types as comments/annotations in code blocks
- **Drizzle, Hono**: Show practical code-first, types are implicit
- **Turborepo**: Shows config files (turbo.json, package.json) inline
- **Common pattern**: Tabbed code blocks for different package managers (npm/yarn/pnpm/bun)

### TypeScript Type Display

Two dominant patterns:
1. **Inline inference annotations**: Show `// ^? type Result = { ... }` style hover-type comments (tRPC, Zod, Effect)
2. **Full type signatures before examples**: Show the TypeScript interface/type, then show usage (Effect Schema, Hono API)

---

## Recommended Structure for forge-ts

Based on this research, here is the opinionated page structure that forge-ts should generate for any TypeScript project. This is designed to be:
- Auto-generatable from TSDoc comments + package.json + tsconfig.json
- Applicable to single-package or monorepo
- SSG-agnostic (produces a content tree, not framework-specific output)

### Page Tree

```
/
├── index                          # Landing page
├── getting-started/
│   ├── index                      # Overview + installation + first example
│   ├── installation               # Detailed installation (if complex)
│   └── quick-start                # First working example, end-to-end
│
├── concepts/                      # Mental model & architecture
│   ├── index                      # Overview of key concepts
│   ├── [concept-slug]             # One page per core concept (auto from @concept tag or manual)
│   └── how-it-works               # Architecture / internals overview
│
├── guides/                        # Task-oriented how-to content
│   ├── index                      # Guide listing
│   └── [guide-slug]               # Individual guides (manual content)
│
├── api/                           # AUTO-GENERATED from TSDoc
│   ├── index                      # API overview + module listing
│   ├── [module-or-namespace]/     # Per-module or per-export-group
│   │   ├── index                  # Module overview (from module-level JSDoc)
│   │   ├── [function-name]        # Per-exported-function page
│   │   ├── [class-name]           # Per-exported-class page
│   │   ├── [interface-name]       # Per-exported-interface page
│   │   └── [type-name]            # Per-exported-type page
│   └── types                      # Consolidated type reference (all exported types)
│
├── configuration/                 # If project has config files
│   └── index                      # Config options reference (auto from typed config)
│
├── examples/                      # Working code examples
│   ├── index                      # Example listing
│   └── [example-slug]             # Individual examples
│
├── packages/                      # MONOREPO ONLY - one section per package
│   └── [package-name]/
│       ├── index                  # Package overview
│       └── api/                   # Same api/ structure as above, per-package
│           └── ...
│
├── migration/                     # Version migration guides
│   └── [version-slug]             # e.g., "v1-to-v2"
│
├── changelog                      # Auto-generated from CHANGELOG.md or git tags
│
├── ecosystem                      # Integrations, plugins, community projects
│
└── faq                            # Frequently asked questions
```

### Page Specifications

#### `index` (Landing Page)
**Source**: package.json (name, description), README.md hero section, manual overrides
**Contains**:
- Project name + one-line description
- 3-6 feature highlights (from README or manual config)
- Installation command (auto from package.json)
- Minimal code example (from README or `@example` in main export)
- Navigation cards to Getting Started, API Reference, Guides

#### `getting-started/index`
**Source**: README "Getting Started" section, manual content
**Contains**:
- Installation commands (auto: npm/yarn/pnpm/bun variants)
- Prerequisites (Node version from engines, TypeScript version from peerDeps)
- First working code example
- "Next steps" links

#### `getting-started/installation`
**Generated when**: Project has peer dependencies, multiple install targets, or platform-specific setup
**Source**: package.json dependencies, peerDependencies, manual content
**Contains**:
- Package manager commands (tabbed: npm/yarn/pnpm/bun)
- Peer dependency installation
- TypeScript configuration requirements (from tsconfig)
- Platform-specific instructions (manual)

#### `getting-started/quick-start`
**Source**: Manual content, `@example` tags from main entry point
**Contains**:
- End-to-end working example
- Step-by-step walkthrough
- Expected output

#### `concepts/index`
**Source**: Manual content, extracted from `@remarks` tags on core abstractions
**Contains**:
- Overview of the project's mental model
- Links to individual concept pages
- Diagram or architecture overview (manual)

#### `concepts/[concept-slug]`
**Source**: Manual content files
**Contains**:
- Explanation of one core concept
- Code examples demonstrating the concept
- Links to related API pages

#### `guides/[guide-slug]`
**Source**: Manual content files
**Contains**:
- Task-oriented tutorial ("How to do X")
- Step-by-step with code
- Links to relevant API reference

#### `api/index`
**Source**: Auto-generated from TypeScript exports
**Contains**:
- List of all exported modules/namespaces
- For each: name, one-line description (from `@description` or first sentence of JSDoc)
- Quick links to most-used exports

#### `api/[module]/[export-name]`
**Source**: Auto-generated from TSDoc
**Contains**:
- Full TypeScript signature (syntax-highlighted)
- Description (from JSDoc `@description`)
- Parameters table (from `@param` tags) with types, defaults, descriptions
- Return type and description (from `@returns`)
- Thrown errors (from `@throws`)
- Code examples (from `@example` tags)
- "See also" links (from `@see` tags)
- Since version (from `@since`)
- Deprecation notice (from `@deprecated`)

#### `api/types`
**Source**: Auto-generated from all exported types/interfaces
**Contains**:
- Consolidated listing of all exported TypeScript types
- Each with: name, full type definition, description, properties table
- Grouped by module/namespace

#### `configuration/index`
**Generated when**: Project exports a config type/interface (detected heuristically or via annotation)
**Source**: Auto-generated from config type + `@default` and `@description` tags
**Contains**:
- Full options table: option name, type, default, description
- Example config file
- Environment variable mapping (if applicable)

#### `packages/[name]/index` (Monorepo only)
**Generated when**: Workspace has multiple packages
**Source**: Per-package package.json + README
**Contains**:
- Package description
- Installation
- Quick usage example
- Link to package API reference

#### `changelog`
**Source**: CHANGELOG.md file or git tag history
**Contains**:
- Version history with dates
- Breaking changes highlighted
- Links to migration guides where applicable

#### `migration/[version-slug]`
**Source**: Manual content, or auto-detected from `@since` and `@deprecated` tags
**Contains**:
- Breaking changes list
- Before/after code examples
- Step-by-step upgrade instructions

#### `ecosystem`
**Source**: Manual content
**Contains**:
- Official integrations/plugins
- Community projects
- Framework adapters

#### `faq`
**Source**: Manual content
**Contains**:
- Common questions with answers
- Links to relevant docs pages

### Generation Rules

1. **Always generate**: `index`, `getting-started/index`, `api/index`, `api/[module]/[export]` pages
2. **Generate if detected**: `configuration/` (config type exists), `packages/` (monorepo), `changelog` (CHANGELOG.md exists)
3. **Generate as stubs**: `concepts/`, `guides/`, `faq`, `ecosystem`, `migration/` -- create placeholder files for manual authoring
4. **Never generate without content**: Don't create empty pages; generate stubs with TODO markers or skip

### Metadata Each Page Needs

```typescript
interface PageMeta {
  title: string;           // Page title
  description: string;     // SEO meta description
  slug: string;            // URL path segment
  section: string;         // Parent section name
  order: number;           // Sort order within section
  editUrl?: string;        // Link to source file for "Edit this page"
  sourceFile?: string;     // TypeScript source file (for API pages)
  lastModified?: string;   // Git last modified date
  prev?: string;           // Previous page slug (for pagination)
  next?: string;           // Next page slug (for pagination)
}
```

### Key Design Decisions

1. **API pages are per-export, not per-file**: Group by public API surface, not internal file structure
2. **Guides are always manual**: Auto-generation produces reference, not tutorials
3. **Types get a consolidated page**: Users want to see all types in one place, in addition to per-export pages
4. **Configuration is a first-class page**: If you have a config object, it deserves its own reference page
5. **Monorepo packages mirror the single-package structure**: Each package gets its own api/ tree
6. **Code examples are inline**: Following the universal pattern, examples live on the same page as the API they demonstrate (from `@example` tags)
7. **Installation is always tabbed**: npm/yarn/pnpm/bun -- this is table stakes for TypeScript projects
