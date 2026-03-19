# Documentation Platform Scaffold Research

Exact file structures, configs, dependencies, and setup for Mintlify, Docusaurus v3, Nextra v4, and VitePress.

---

## 1. Mintlify

### CLI / Starter Command

```bash
# Install CLI globally
npm i -g mint

# Clone the starter template
# Use the GitHub template: https://github.com/mintlify/starter
# Or: npx skills add https://mintlify.com/docs

# Local dev
mint dev
```

### Minimal File Tree (from mintlify/starter)

```
.
├── docs.json                  # Main config (replaces old mint.json)
├── favicon.svg
├── index.mdx                  # Homepage
├── quickstart.mdx
├── development.mdx
├── logo/
│   ├── dark.svg
│   └── light.svg
├── images/
│   └── hero-dark.svg
├── essentials/
│   ├── navigation.mdx
│   ├── markdown.mdx
│   ├── code.mdx
│   ├── images.mdx
│   └── reusable-snippets.mdx
├── api-reference/
│   ├── openapi.json           # OpenAPI spec file
│   └── endpoint/
│       ├── get.mdx
│       ├── create.mdx
│       ├── delete.mdx
│       └── update.mdx
├── snippets/
│   └── snippet-intro.mdx
├── ai-tools/
│   ├── cursor.mdx
│   ├── claude-code.mdx
│   └── windsurf.mdx
└── .mintignore
```

### docs.json (Full Config with All Required Fields)

```json
{
  "$schema": "https://mintlify.com/docs.json",
  "theme": "mint",
  "name": "Your Project Name",
  "description": "Your project description.",
  "colors": {
    "primary": "#3B82F6",
    "light": "#F8FAFC",
    "dark": "#0F172A"
  },
  "logo": {
    "light": "/logo/light.svg",
    "dark": "/logo/dark.svg",
    "href": "https://yoursite.com"
  },
  "favicon": "/favicon.svg",
  "navigation": {
    "tabs": [
      {
        "tab": "Docs",
        "groups": [
          {
            "group": "Getting Started",
            "pages": ["index", "quickstart", "development"]
          },
          {
            "group": "Essentials",
            "pages": [
              "essentials/navigation",
              "essentials/markdown",
              "essentials/code",
              "essentials/images",
              "essentials/reusable-snippets"
            ]
          }
        ]
      },
      {
        "tab": "API Reference",
        "groups": [
          {
            "group": "Endpoints",
            "openapi": "api-reference/openapi.json",
            "pages": [
              "api-reference/endpoint/get",
              "api-reference/endpoint/create",
              "api-reference/endpoint/update",
              "api-reference/endpoint/delete"
            ]
          }
        ]
      }
    ]
  },
  "navbar": {
    "links": [
      {
        "label": "Community",
        "href": "https://yoursite.com/community"
      }
    ],
    "primary": {
      "type": "button",
      "label": "Get Started",
      "href": "https://yoursite.com/start"
    }
  },
  "footer": {
    "socials": {
      "github": "https://github.com/yourorg",
      "x": "https://x.com/yourorg"
    }
  }
}
```

**Required fields in docs.json:**
- `name` - project/org name
- `theme` - layout theme (`"mint"`, `"maple"`, etc.)
- `colors.primary` - hex color code
- `navigation` - content structure

### OpenAPI Integration

Two approaches:

**1. Auto-generate from navigation (no MDX files needed):**
```json
{
  "navigation": {
    "groups": [
      {
        "group": "API reference",
        "openapi": "/path/to/openapi.json",
        "pages": [
          "GET /users",
          "POST /users"
        ]
      }
    ]
  }
}
```

**2. Manual MDX files with openapi frontmatter:**
```mdx
---
title: "Get users"
description: "Returns all users"
openapi: "/api-reference/openapi.json GET /users"
---
```

### npm Dependencies

```
# Only the CLI is needed - no package.json required for the docs project itself
npm i -g mint
```

Mintlify is NOT a Node.js project. There is no `package.json` in the starter. The `mint` CLI handles everything.

### package.json Scripts

Not applicable. Mintlify uses the global CLI:
```bash
mint dev              # Local preview at localhost:3000
mint dev --port 3333  # Custom port
mint update           # Update CLI
mint upgrade          # Migrate mint.json -> docs.json
```

### MDX Components Available

```mdx
<Note>Helpful info</Note>
<Warning>Important caution</Warning>
<Tip>Best practice</Tip>
<Info>Contextual info</Info>
<Check>Success confirmation</Check>

<Tabs>
  <Tab title="Tab 1">Content</Tab>
  <Tab title="Tab 2">Content</Tab>
</Tabs>

<CodeGroup>
  ```bash npm
  npm install package
  ```
  ```bash yarn
  yarn add package
  ```
</CodeGroup>

<Card title="Title" icon="rocket" href="/path">
  Card content
</Card>
<CardGroup cols={2}>
  <Card>...</Card>
  <Card>...</Card>
</CardGroup>

<Steps>
  <Step title="Step 1">Instructions</Step>
  <Step title="Step 2">Instructions</Step>
</Steps>

<Accordion title="Expand me">Hidden content</Accordion>
<Frame>
  <img src="/images/example.png" alt="description" />
</Frame>
<Expandable title="Properties">Nested details</Expandable>

<!-- API-specific -->
<ParamField path="id" type="string" required>Description</ParamField>
<ResponseField name="data" type="object">Description</ResponseField>
<RequestExample>```json {...}```</RequestExample>
<ResponseExample>```json {...}```</ResponseExample>
```

---

## 2. Docusaurus v3

### CLI / Starter Command

```bash
npx create-docusaurus@latest my-website classic
# or with TypeScript:
npx create-docusaurus@latest my-website classic --typescript
```

### Minimal File Tree (from create-docusaurus classic template)

```
my-website/
├── docusaurus.config.ts       # Main config
├── sidebars.ts                # Sidebar definition
├── package.json
├── tsconfig.json
├── babel.config.js
├── blog/
│   └── ...                    # Blog posts (can be removed for docs-only)
├── docs/
│   ├── intro.md
│   └── tutorial-basics/
│       ├── congratulations.md
│       ├── create-a-blog-post.md
│       ├── create-a-document.md
│       ├── create-a-page.md
│       ├── deploy-your-site.md
│       └── markdown-features.md
├── src/
│   ├── components/
│   │   └── HomepageFeatures/
│   │       ├── index.tsx
│   │       └── styles.module.css
│   ├── css/
│   │   └── custom.css
│   └── pages/
│       ├── index.tsx           # Can be removed for docs-only
│       └── index.module.css
└── static/
    └── img/
        ├── docusaurus.png
        ├── favicon.ico
        └── logo.svg
```

### docusaurus.config.ts (Docs-Only Site)

```typescript
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'My Docs',
  tagline: 'Documentation for my project',
  favicon: 'img/favicon.ico',
  url: 'https://my-docs.example.com',
  baseUrl: '/',

  organizationName: 'my-org',
  projectName: 'my-project',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',     // Docs-only: serve docs at root
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/my-org/my-project/tree/main/',
        },
        blog: false,              // Docs-only: disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'My Docs',
      logo: {
        alt: 'My Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/my-org/my-project',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/',
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} My Org.`,
    },
    prism: {
      theme: require('prism-react-renderer').themes.github,
      darkTheme: require('prism-react-renderer').themes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
```

### sidebars.ts

```typescript
import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Tutorial',
      items: [
        'tutorial-basics/create-a-document',
        'tutorial-basics/create-a-page',
        'tutorial-basics/markdown-features',
        'tutorial-basics/deploy-your-site',
        'tutorial-basics/congratulations',
      ],
    },
  ],
};

export default sidebars;
```

### npm Dependencies (package.json)

```json
{
  "name": "my-website",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "docusaurus": "docusaurus",
    "start": "docusaurus start",
    "build": "docusaurus build",
    "swizzle": "docusaurus swizzle",
    "deploy": "docusaurus deploy",
    "clear": "docusaurus clear",
    "serve": "docusaurus serve",
    "write-translations": "docusaurus write-translations",
    "write-heading-ids": "docusaurus write-heading-ids",
    "typecheck": "tsc"
  },
  "dependencies": {
    "@docusaurus/core": "^3.9.2",
    "@docusaurus/preset-classic": "^3.9.2",
    "@mdx-js/react": "^3.0.0",
    "clsx": "^2.0.0",
    "prism-react-renderer": "^2.3.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@docusaurus/module-type-aliases": "^3.9.2",
    "@docusaurus/tsconfig": "^3.9.2",
    "@docusaurus/types": "^3.9.2",
    "typescript": "~5.6.0"
  },
  "browserslist": {
    "production": [">0.5%", "not dead", "not op_mini all"],
    "development": ["last 3 chrome version", "last 3 firefox version", "last 5 safari version"]
  },
  "engines": {
    "node": ">=18.0"
  }
}
```

### OpenAPI Integration (docusaurus-openapi-docs)

**Additional dependencies:**
```bash
yarn add docusaurus-plugin-openapi-docs docusaurus-theme-openapi-docs
# Current versions: ^4.7.1 (compatible with Docusaurus 3.5.0 - 3.9.2)
```

**docusaurus.config.ts additions:**
```typescript
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';

const config: Config = {
  // ... base config ...
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          docItemComponent: '@theme/ApiItem',  // Required for OpenAPI
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          petstore: {
            specPath: 'examples/petstore.yaml',
            outputDir: 'docs/petstore',
            sidebarOptions: {
              groupPathsBy: 'tag',
            },
          } satisfies OpenApiPlugin.Options,
        },
      },
    ],
  ],
  themes: ['docusaurus-theme-openapi-docs'],
};
```

**CLI to generate docs from spec:**
```bash
yarn docusaurus gen-api-docs all
yarn docusaurus clean-api-docs all
```

### MDX Components Available (built-in)

```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="js" label="JavaScript">Content</TabItem>
  <TabItem value="py" label="Python">Content</TabItem>
</Tabs>

import CodeBlock from '@theme/CodeBlock';
<CodeBlock language="jsx">{`const x = 1;`}</CodeBlock>

import Admonition from '@theme/Admonition';
<!-- Or use the shorthand: -->
:::note
Note content
:::

:::tip
Tip content
:::

:::info
Info content
:::

:::warning
Warning content
:::

:::danger
Danger content
:::

<!-- Details/Collapsible -->
<details>
  <summary>Click to expand</summary>
  Hidden content
</details>
```

---

## 3. Nextra v4

### CLI / Starter Command

There is no dedicated `create-nextra` CLI. You set it up manually in a Next.js project.

```bash
# Create Next.js project, then add Nextra
mkdir my-docs && cd my-docs
npm init -y
npm i next react react-dom nextra nextra-theme-docs
```

### Minimal File Tree (Nextra 4 with App Router)

```
.
├── next.config.mjs
├── package.json
├── mdx-components.ts           # Required for MDX in App Router
├── app/
│   ├── layout.tsx              # Root layout with Nextra theme
│   └── [[...mdxPath]]/
│       └── page.tsx            # Catch-all route for MDX pages
├── content/
│   ├── _meta.js                # Root navigation config
│   ├── index.mdx               # Homepage
│   ├── getting-started.mdx
│   └── guide/
│       ├── _meta.js            # Folder navigation config
│       ├── index.mdx
│       └── advanced.mdx
└── public/
    └── favicon.ico
```

### next.config.mjs

```javascript
import nextra from 'nextra'

const withNextra = nextra({
  // Nextra options
  // contentDirBasePath: '/docs'  // Optional: serve content from /docs path
})

export default withNextra({
  // Regular Next.js config
})
```

### mdx-components.ts

```typescript
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components) {
  return {
    ...docsComponents,
    ...components,
  }
}
```

### app/layout.tsx (Root Layout)

```tsx
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: 'My Docs',
  description: 'My documentation site',
}

const navbar = (
  <Navbar
    logo={<b>My Docs</b>}
    projectLink="https://github.com/my-org/my-project"
  />
)
const footer = <Footer>MIT {new Date().getFullYear()} (c) My Org.</Footer>

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/my-org/my-project/tree/main/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
```

### app/[[...mdxPath]]/page.tsx

```tsx
import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents } from '../../mdx-components'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

export async function generateMetadata(props) {
  const params = await props.params
  const { metadata } = await importPage(params.mdxPath)
  return metadata
}

export default async function Page(props) {
  const params = await props.params
  const { default: MDXContent, toc, metadata } = await importPage(params.mdxPath)
  return <MDXContent {...{ params }} components={useMDXComponents({})} />
}
```

### _meta.js Format (Navigation)

```javascript
// content/_meta.js (root level)
export default {
  index: {
    title: 'Home',
    type: 'page'      // Top-level page (not in sidebar)
  },
  'getting-started': 'Getting Started',
  guide: 'Guide',
  // External link
  github: {
    title: 'GitHub',
    href: 'https://github.com/my-org',
    type: 'page',
    newWindow: true
  }
}

// content/guide/_meta.js (folder level)
export default {
  index: 'Introduction',
  advanced: 'Advanced Usage',
  // Hide from sidebar
  hidden: {
    display: 'hidden'
  },
  // Separator
  '---': {
    type: 'separator',
    title: 'More'
  }
}
```

### package.json

```json
{
  "name": "my-docs",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "nextra": "^4.0.0",
    "nextra-theme-docs": "^4.0.0"
  }
}
```

### MDX Components Available (built-in from nextra/components)

```mdx
import { Callout, Tabs, Cards, Card, Steps, FileTree } from 'nextra/components'

<Callout type="info">Informational message</Callout>
<Callout type="warning">Warning message</Callout>
<Callout type="error">Error message</Callout>
<Callout>Default callout</Callout>

<Tabs items={['npm', 'pnpm', 'yarn']}>
  <Tabs.Tab>npm install package</Tabs.Tab>
  <Tabs.Tab>pnpm add package</Tabs.Tab>
  <Tabs.Tab>yarn add package</Tabs.Tab>
</Tabs>

<Cards>
  <Card title="Getting Started" href="/getting-started" />
  <Card title="Guide" href="/guide" />
</Cards>

<Steps>
### Step 1
Do this first.

### Step 2
Then do this.
</Steps>

<FileTree>
  <FileTree.Folder name="content" defaultOpen>
    <FileTree.File name="_meta.js" />
    <FileTree.File name="index.mdx" />
    <FileTree.Folder name="guide">
      <FileTree.File name="_meta.js" />
      <FileTree.File name="index.mdx" />
    </FileTree.Folder>
  </FileTree.Folder>
</FileTree>
```

**Note on Nextra v3 vs v4:** Nextra 4 removed `theme.config.tsx` entirely. All theme config is now done via Layout component props in `app/layout.tsx`. The old `theme.config.tsx` pattern (`nextra({theme: 'nextra-theme-docs', themeConfig: './theme.config.tsx'})`) is Nextra v3 / Pages Router only.

---

## 4. VitePress

### CLI / Starter Command

```bash
# Install
npm add -D vitepress@next

# Scaffold (interactive wizard)
npx vitepress init
```

### Minimal File Tree (from `npx vitepress init` with `./docs` target)

```
.
├── package.json
└── docs/
    ├── .vitepress/
    │   └── config.mts          # Main config (TypeScript)
    ├── index.md                # Homepage
    ├── api-examples.md
    └── markdown-examples.md
```

With a more complete structure:

```
.
├── package.json
└── docs/
    ├── .vitepress/
    │   ├── config.mts
    │   ├── theme/
    │   │   ├── index.ts        # Custom theme extensions
    │   │   └── custom.css      # Custom styles
    │   ├── cache/              # .gitignore this
    │   └── dist/               # .gitignore this (build output)
    ├── public/
    │   └── favicon.ico
    ├── index.md                # Homepage
    ├── guide/
    │   ├── index.md
    │   ├── getting-started.md
    │   └── configuration.md
    └── api/
        ├── index.md
        └── reference.md
```

### .vitepress/config.mts

```typescript
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'My Docs',
  description: 'A VitePress Site',

  // Deploy sub-path (if needed)
  // base: '/my-project/',

  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Reference', link: '/api/reference' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/my-org/my-project' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present My Org'
    },

    editLink: {
      pattern: 'https://github.com/my-org/my-project/edit/main/docs/:path'
    },

    search: {
      provider: 'local'
    }
  }
})
```

### Sidebar Configuration Format

```typescript
// Simple array (single sidebar for all pages)
sidebar: [
  {
    text: 'Section Title',
    collapsed: false,     // Optional: collapsible
    items: [
      { text: 'Page A', link: '/page-a' },
      { text: 'Page B', link: '/page-b' },
    ]
  }
]

// Multi-sidebar (object keyed by path)
sidebar: {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Intro', link: '/guide/' },
        { text: 'Setup', link: '/guide/setup' },
      ]
    }
  ],
  '/reference/': [
    {
      text: 'Reference',
      items: [
        { text: 'API', link: '/reference/api' },
      ]
    }
  ]
}
```

Nesting up to 6 levels deep. Each item can have nested `items` for sub-groups.

### package.json

```json
{
  "name": "my-docs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  },
  "devDependencies": {
    "vitepress": "^2.0.0"
  }
}
```

**Note:** `"type": "module"` is required (VitePress is ESM-only). If you want Vue customization, also add `vue` as a dependency.

### npm Dependencies

```bash
# Core (only dependency needed)
npm add -D vitepress@next

# Optional: Vue (for custom components/theme)
npm add -D vue
```

### Markdown Extensions Available (built-in)

```markdown
<!-- Containers / Callouts -->
::: info
Informational box
:::

::: tip
Tip box
:::

::: warning
Warning box
:::

::: danger
Danger box
:::

::: details Click to expand
Collapsible content
:::

<!-- Custom title -->
::: danger STOP
Critical warning here
:::

<!-- Code groups -->
::: code-group
```js [config.js]
export default { }
```
```ts [config.ts]
export default { }
```
:::

<!-- Line highlighting in code blocks -->
```js{1,3-4}
const a = 1    // highlighted
const b = 2
const c = 3    // highlighted
const d = 4    // highlighted
```

<!-- Import code from files -->
<<< @/filepath

<!-- Badge -->
### Title <Badge type="warning" text="beta" />

<!-- Team page components -->
<VPTeamMembers :members="members" />
```

VitePress also supports Vue components directly in Markdown since it uses Vue as its rendering engine.

---

## Quick Comparison Table

| Feature | Mintlify | Docusaurus v3 | Nextra v4 | VitePress |
|---------|----------|---------------|-----------|-----------|
| **Config file** | `docs.json` | `docusaurus.config.ts` | `next.config.mjs` + `app/layout.tsx` | `.vitepress/config.mts` |
| **Sidebar config** | In `docs.json` navigation | `sidebars.ts` | `_meta.js` per folder | In `.vitepress/config.mts` |
| **Content format** | MDX | MDX | MDX | Markdown (+ Vue) |
| **Package manager dep** | None (global CLI) | npm/yarn/pnpm project | npm/yarn/pnpm project | npm/yarn/pnpm project |
| **OpenAPI** | Native (`openapi` field) | Plugin (`docusaurus-openapi-docs`) | No official plugin | No official plugin |
| **Dev command** | `mint dev` | `npm start` | `npm run dev` | `npm run docs:dev` |
| **Build** | Deployed via Mintlify dashboard | `npm run build` | `npm run build` | `npm run docs:build` |
| **Framework** | Proprietary platform | React | Next.js (App Router) | Vite + Vue |
| **Starter CLI** | `git clone mintlify/starter` | `npx create-docusaurus` | Manual setup | `npx vitepress init` |
