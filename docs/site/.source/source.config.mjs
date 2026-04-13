// source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "../generated",
  docs: {
    files: ["**/*.mdx"]
  }
});
var source_config_default = defineConfig({
  mdxOptions: {
    // Add remark/rehype plugins here
  }
});
export {
  source_config_default as default,
  docs
};
