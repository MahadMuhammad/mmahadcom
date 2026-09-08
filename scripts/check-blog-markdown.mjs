import assert from "node:assert/strict";
import { createBlogMarkdown } from "../src/lib/blog-markdown.mjs";

const post = {
  title: "Export fixture",
  description: "Portable article content",
  canonicalUrl: "https://www.mmahad.com/blog/export-fixture/",
  author: "Muhammad Mahad",
  date: "2026-09-05",
  body: [
    'import { Demo } from "./Demo";',
    "",
    "## Example",
    "",
    "[Notes](/notes/) and [this section](#example)",
    "",
    "```tsx",
    'import { Demo } from "./Demo";',
    "<Demo />",
    "```",
    "",
    "| Stage | Result |",
    "| --- | --- |",
    "| Build | HTML |",
    "",
    "<Demo client:load />",
    "",
    "<Callout>Keep this explanation.</Callout>",
    "",
    "A claim.[^source]",
    "",
    "<figure>\n\n![A diagram](/figure.webp)\n\n<figcaption>An explanatory caption.</figcaption>\n</figure>",
    "",
    "[^source]: [Evidence](https://example.com/source).",
  ].join("\n"),
};
const output = createBlogMarkdown(post);
assert.match(output, /^# Export fixture\n/);
assert.match(output, /```tsx\nimport \{ Demo \} from "\.\/Demo";\n<Demo \/>\n```/);
assert.equal(output.match(/import \{ Demo \}/g)?.length, 1, "Remove MDX imports, never imports inside code samples");
assert.match(output, /\| Build\s*\| HTML\s*\|/);
assert.match(output, /Keep this explanation\./);
assert.ok(output.includes("![A diagram](https://www.mmahad.com/figure.webp)"));
assert.ok(output.includes("An explanatory caption."), "Figure captions must survive MDX export");
assert.ok(output.includes("A claim.[^source]"));
assert.ok(output.includes("[^source]: [Evidence](https://example.com/source)."), "Footnote references must retain their source definitions");
assert.match(output, /\[Notes\]\(https:\/\/www.mmahad.com\/notes\/\)/);
assert.match(output, /\[this section\]\(https:\/\/www.mmahad.com\/blog\/export-fixture\/#example\)/);
assert.match(output, /View interactive example on the website/);
assert.doesNotMatch(output, /client:load|<Callout>/);
assert.match(output, /Written by Muhammad Mahad · \[Original article\].*\n$/);
assert.doesNotMatch(output, /Updated:/);
assert.match(createBlogMarkdown({ ...post, updatedDate: "2026-09-08" }), /Published: 2026-09-05\n\nUpdated: 2026-09-08\n/);
assert.doesNotMatch(createBlogMarkdown({ ...post, attribution: false }), /Written by|Original article/);
assert.throws(() => createBlogMarkdown({ ...post, body: "The answer is {answer}." }), /computed MDX text/);
console.log("Blog Markdown passed: code, tables, links, MDX fallback, attribution, and computed-prose guard.");
