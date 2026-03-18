# typedoc-plugin-llms-txt

A TypeDoc plugin that generates `llms.txt` files for LLM consumption.

## What is llms.txt?

[llms.txt](https://llmstxt.org/) is a convention for providing LLM-friendly documentation summaries. This plugin automatically generates an `llms.txt` file from your TypeDoc documentation.

## Installation

```bash
npm install typedoc-plugin-llms-txt typedoc -D
```

> `typedoc` v0.28.0 or later is a required peer dependency.

## Usage

Add the plugin to your TypeDoc configuration:

```js
// typedoc.config.js
export default {
  plugin: ['typedoc-plugin-llms-txt'],
  // ... other options
};
```

That's it! The plugin will generate an `llms.txt` file in your output directory with reasonable defaults.

## Zero-Config Defaults

The plugin works out of the box with sensible defaults:

- **Project name**: From TypeDoc's `name` option
- **Description**: From your `package.json` description
- **Sections**: Auto-discovered from `projectDocuments` frontmatter categories
- **API links**: Auto-generated from TypeDoc entry points

## Configuration

Customize the output with these TypeDoc options:

### `llmsTxt`

Enable or disable llms.txt generation. Default: `true`

### `llmsTxtFilename`

Output filename. Default: `"llms.txt"`

### `llmsTxtHeader`

Customize the header section:

```js
{
  llmsTxtHeader: {
    name: 'My Project',           // defaults to TypeDoc name
    description: 'A cool library', // defaults to package.json description
    features: [                    // defaults to empty
      'Feature one',
      'Feature two',
    ],
  },
}
```

### `llmsTxtSections`

Control how document categories are displayed and ordered:

```js
{
  llmsTxtSections: {
    Guides: { displayName: 'Documentation', order: 1 },
    Reference: { displayName: 'Reference', order: 2 },
    About: { displayName: 'Optional', order: 3 },
  },
}
```

Categories not listed use their original name and appear alphabetically after configured sections.

### `llmsTxtDeclarations`

Add links to specific API symbols using TypeDoc declaration references:

```js
{
  llmsTxtDeclarations: [
    { ref: 'myproject!', label: 'API Reference', description: 'Full API docs' },
    { ref: 'myproject!myFunction', label: 'myFunction()' },
  ],
}
```

### `llmsTxtQuickReference`

Add a code examples section:

```js
{
  llmsTxtQuickReference: `
// Basic usage
import { foo } from 'myproject';
foo();
`,
}
```

### `llmsTxtTemplate`

Use a custom template file for full layout control:

```js
{
  llmsTxtTemplate: './llms-template.md',
}
```

Template slots:

- `{{header}}` - Name, description, and features
- `{{sections}}` - All document sections
- `{{section:CategoryName}}` - Specific category
- `{{declarations}}` - API links
- `{{quickReference}}` - Code examples

## License

[BlueOak-1.0.0](https://blueoakcouncil.org/license/1.0.0)
