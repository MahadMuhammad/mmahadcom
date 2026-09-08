// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import { rehypeCode, remarkCodeTab, remarkHeading, remarkNpm, remarkStructure } from "fumadocs-core/mdx-plugins";

const remarkPlugins = /** @type {import("@astrojs/markdown-remark").RemarkPlugins} */ (
  /** @type {unknown} */ ([remarkHeading, remarkCodeTab, remarkNpm, [remarkStructure, { exportAs: "structuredData" }]])
);

const rehypePlugins = /** @type {import("@astrojs/markdown-remark").RehypePlugins} */ (
  /** @type {unknown} */ ([[rehypeCode, { themes: { light: "github-light-high-contrast", dark: "github-dark" } }]])
);

export default defineConfig({
  site: "https://www.mmahad.com",
  // Accept both URL spellings in development while links and canonical metadata
  // continue to emit the preferred trailing-slash form.
  trailingSlash: "ignore",
  output: "static",
  redirects: {
    "/essays": "/blog/",
    "/about": "/",
    "/open-sources": "/open-source/",
  },
  markdown: {
    processor: unified({
      syntaxHighlight: false,
      remarkPlugins,
      rehypePlugins,
    }),
  },
  integrations: [
    react(),
    mdx({
      extendMarkdownConfig: true,
      syntaxHighlight: false,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
