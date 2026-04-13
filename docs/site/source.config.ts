import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "../generated",
  docs: {
    files: ["**/*.mdx"],
  },
});

export default defineConfig({
  mdxOptions: {
    // Add remark/rehype plugins here
  },
});
