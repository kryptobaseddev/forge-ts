import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: ".",
  description: ". documentation",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
    ],
    sidebar: [
      {
          "text": "Getting Started",
          "items": [
              {
                  "text": "Index",
                  "link": "/"
              },
              {
                  "text": "Getting Started",
                  "link": "/getting-started"
              }
          ]
      },
      {
          "text": "core",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/core/"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/core/api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/core/types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/core/functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/core/examples"
              }
          ]
      },
      {
          "text": ".",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/./"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/./api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/./types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/./functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/./examples"
              }
          ]
      },
      {
          "text": "api",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/api/"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/api/api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/api/types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/api/functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/api/examples"
              }
          ]
      },
      {
          "text": "gen",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/gen/"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/gen/api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/gen/types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/gen/functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/gen/examples"
              }
          ]
      },
      {
          "text": "cli",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/cli/"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/cli/api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/cli/types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/cli/functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/cli/examples"
              }
          ]
      },
      {
          "text": "enforcer",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/enforcer/"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/enforcer/api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/enforcer/types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/enforcer/functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/enforcer/examples"
              }
          ]
      },
      {
          "text": "doctest",
          "items": [
              {
                  "text": "Index",
                  "link": "/packages/doctest/"
              },
              {
                  "text": "Api Reference",
                  "link": "/packages/doctest/api-reference"
              },
              {
                  "text": "Types",
                  "link": "/packages/doctest/types"
              },
              {
                  "text": "Functions",
                  "link": "/packages/doctest/functions"
              },
              {
                  "text": "Examples",
                  "link": "/packages/doctest/examples"
              }
          ]
      }
  ],
    socialLinks: [],
  },
});
