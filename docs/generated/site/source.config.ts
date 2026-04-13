import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "..",
});

export default defineConfig({
  mdxOptions: {
    // Add remark/rehype plugins here
  },
});
