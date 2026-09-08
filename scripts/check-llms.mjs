import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");
const [siteIndex, siteFull, notesIndex, notesFull, sitemap] = await Promise.all(
  ["llms.txt", "llms-full.txt", "notes/llms.txt", "notes/llms-full.txt", "sitemap.xml"].map((file) =>
    readFile(path.join(outputDirectory, file), "utf8")
  )
);
const notesIndexUrls = new Set([
  "https://www.mmahad.com/notes.md",
  "https://www.mmahad.com/notes/courses.md",
  "https://www.mmahad.com/notes/tags.md",
  "https://www.mmahad.com/notes/topics.md",
]);
const notesIndexPageUrls = new Set([
  "https://www.mmahad.com/notes/",
  "https://www.mmahad.com/notes/courses/",
  "https://www.mmahad.com/notes/tags/",
  "https://www.mmahad.com/notes/topics/",
]);
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
const siteOrigin = "https://www.mmahad.com";
const notePageUrls = [...sitemapUrls].filter((url) => url.startsWith(`${siteOrigin}/notes/`));
const expectedNoteMarkdownUrls = notePageUrls.map((url) => `${url.replace(/\/$/, "")}.md`);
const search = JSON.parse(await readFile(path.join(outputDirectory, "notes/api/search.json"), "utf8"));
const searchPageUrls = Object.values(search.docs.docs)
  .filter((document) => document.type === "page")
  .map((document) => new URL(document.url, siteOrigin).href);
assert.deepEqual(searchPageUrls.toSorted(), notePageUrls.toSorted(), "Notes search must match all public Notes routes");

for (const url of sitemapUrls) {
  const exportedUrl = url.startsWith(`${siteOrigin}/notes/`) ? `${url.replace(/\/$/, "")}.md` : url;
  assert.ok(siteIndex.includes(`](${exportedUrl})`), `Site-wide llms.txt is missing public route ${url}`);
}

async function outputFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await outputFiles(entryPath)));
    else files.push(entryPath);
  }
  return files;
}

const generatedFiles = await outputFiles(outputDirectory);
const indexablePageUrls = [];
for (const file of generatedFiles.filter((file) => file.endsWith(".html"))) {
  const html = await readFile(file, "utf8");
  const robots = (html.match(/<meta\b[^>]*>/gi) ?? []).find((tag) => /name=["']robots["']/i.test(tag));
  if (robots && /\bnoindex\b/i.test(robots)) continue;
  const canonical = (html.match(/<link\b[^>]*>/gi) ?? []).find((tag) => /rel=["']canonical["']/i.test(tag));
  const url = canonical?.match(/href=["']([^"']+)["']/i)?.[1];
  assert.ok(url, `${path.relative(outputDirectory, file)} is indexable but has no canonical URL`);
  indexablePageUrls.push(url);
}
assert.deepEqual(indexablePageUrls.toSorted(), [...sitemapUrls].toSorted(), "Sitemap must match every indexable generated page");

function descendants(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.childNodes ?? []).flatMap((child) => descendants(child, predicate))];
}
function nodeText(node) {
  return node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(nodeText).join("");
}
const normalizedFull = siteFull.replace(/\s+/g, " ");
for (const url of [...sitemapUrls].filter(
  (url) => new URL(url).pathname.startsWith("/volunteering/") && new URL(url).pathname !== "/volunteering/"
)) {
  const html = await readFile(path.join(outputDirectory, new URL(url).pathname, "index.html"), "utf8");
  const sections = descendants(parse(html), (node) =>
    node.attrs?.some((attr) => attr.name === "class" && attr.value.split(/\s+/).includes("content-section"))
  );
  for (const section of sections) {
    for (const block of descendants(section, (node) => ["p", "li"].includes(node.tagName))) {
      const text = nodeText(block).replace(/\s+/g, " ").trim();
      assert.ok(normalizedFull.includes(text), `Site full export is missing workshop prose from ${url}: ${text}`);
    }
    for (const anchor of descendants(section, (node) => node.tagName === "a")) {
      const href = anchor.attrs.find((attr) => attr.name === "href")?.value;
      if (href) assert.ok(siteFull.includes(href), `Site full export is missing workshop resource ${href}`);
    }
  }
}
const publishedNotePageUrls = [...sitemapUrls].filter((url) => url.startsWith("https://www.mmahad.com/notes/") && !notesIndexPageUrls.has(url));
const publishedNoteUrls = publishedNotePageUrls.map((url) => `${url.replace(/\/$/, "")}.md`);
const publishedBlogUrls = [...sitemapUrls].filter((url) => url.startsWith("https://www.mmahad.com/blog/") && url !== "https://www.mmahad.com/blog/");
const listedBlogUrls = [...new Set(siteIndex.match(/https:\/\/www\.mmahad\.com\/blog\/[^)\s]+\//g) ?? [])];
assert.deepEqual(listedBlogUrls.toSorted(), publishedBlogUrls.toSorted(), "Blog export must match published Blog routes");
for (const url of publishedBlogUrls) {
  const markdownPath = new URL(url).pathname.replace(/\/$/, ".md");
  const markdown = await readFile(path.join(outputDirectory, markdownPath), "utf8");
  assert.match(markdown, /^# .+\n/, "Every published Blog needs a readable Markdown export");
  assert.ok(siteFull.includes(markdown.trim()), `Site full export is missing Blog content from ${url}`);
}
const expectedMarkdownPaths = [...expectedNoteMarkdownUrls, ...publishedBlogUrls.map((url) => `${url.replace(/\/$/, "")}.md`)]
  .map((url) => new URL(url).pathname.slice(1))
  .toSorted();
const generatedMarkdownPaths = generatedFiles
  .filter((file) => file.endsWith(".md"))
  .map((file) => path.relative(outputDirectory, file))
  .toSorted();
assert.deepEqual(generatedMarkdownPaths, expectedMarkdownPaths, "Markdown exports must match public Blog and Notes routes only");
if (!publishedBlogUrls.length) assert.match(siteIndex, /No blog posts are published yet\./);

const listedNoteMarkdownUrls = new Set(notesIndex.match(/https:\/\/www\.mmahad\.com\/notes(?:\/[^)\s]+)?\.md/g) ?? []);
const listedPublishedNoteUrls = [...listedNoteMarkdownUrls].filter((url) => !notesIndexUrls.has(url));
const allLlmOutput = [siteIndex, siteFull, notesIndex, notesFull].join("\n");
assert.doesNotMatch(allLlmOutput + sitemap + JSON.stringify(search), /\/drafts\//, "Draft previews must not appear in public indexes");
assert.deepEqual([...listedNoteMarkdownUrls].toSorted(), expectedNoteMarkdownUrls.toSorted(), "Notes LLM index must match every public Notes route");

for (const url of expectedNoteMarkdownUrls) {
  const markdown = await readFile(path.join(outputDirectory, new URL(url).pathname), "utf8");
  assert.match(markdown, /^# .+\n/, `Notes export must be readable: ${url}`);
  if (!notesIndexUrls.has(url)) {
    const content = markdown.replace(/^# /, "## ").trim();
    assert.ok(notesFull.includes(content), `Notes full export is missing content from ${url}`);
    assert.ok(siteFull.includes(content), `Site full export is missing Notes content from ${url}`);
  }
}

assert.match(siteIndex, /^# Muhammad Mahad\n/);
assert.match(siteIndex, /## Portfolio/);
assert.match(siteIndex, /## Selected open-source work/);
assert.match(siteIndex, /## Community event pages/);
assert.match(siteIndex, /## Notes/);
assert.match(siteIndex, /## Contact/);

for (const url of [
  "https://www.mmahad.com/",
  "https://www.mmahad.com/open-source/",
  "https://www.mmahad.com/teaching/",
  "https://www.mmahad.com/volunteering/",
  "https://www.mmahad.com/education/",
  "https://www.mmahad.com/blog/",
  "https://www.mmahad.com/contact/",
  "https://www.mmahad.com/notes/",
  "https://www.mmahad.com/notes/llms.txt",
  "https://www.mmahad.com/notes/llms-full.txt",
]) {
  assert.ok(siteIndex.includes(url), `Site-wide llms.txt is missing ${url}`);
}

assert.match(siteFull, /^# Muhammad Mahad\n/);
assert.match(siteFull, /## Extended profile/);
assert.match(notesIndex, /^# Notes\n/);
assert.match(notesIndex, /https:\/\/www\.mmahad\.com\/notes\/llms-full\.txt/);
assert.match(notesIndex, /https:\/\/www\.mmahad\.com\/llms\.txt/);
assert.match(notesFull, /^# Notes\n/);
assert.doesNotMatch(allLlmOutput, /\bAll published notes\b/i);

for (const url of notesIndexUrls) {
  assert.ok(notesIndex.includes(url), `Notes llms.txt is missing index link ${url}`);
  assert.ok(siteIndex.includes(url), `Site-wide llms.txt is missing Notes index link ${url}`);
}

assert.deepEqual(
  listedPublishedNoteUrls.toSorted(),
  publishedNoteUrls.toSorted(),
  "Notes llms.txt must list every real note route, and only real notes"
);

for (const url of notesIndexPageUrls) {
  assert.ok(!notesFull.includes(`Canonical: ${url}\n`), `Notes full export must not present the index placeholder ${url} as a published note`);
}

assert.doesNotMatch(siteIndex + sitemap, /\/essays\//, "Retired Essays must not appear in indexes");

if (publishedNoteUrls.length === 0) {
  assert.match(siteIndex, /No notes are published yet\. The links above are index pages prepared for future notes\./);
  assert.match(siteFull, /## Notes content\n\nNo notes are published yet\./);
  assert.match(notesIndex, /## Publication status\n\nNo notes are published yet\./);
  assert.equal(notesFull, "# Notes\n\nNo notes are published yet.\n");
  assert.doesNotMatch(allLlmOutput, /#{2,3} Published notes/);
} else {
  assert.match(siteIndex, /### Published notes/);
  assert.match(siteFull, /## Published notes/);
  assert.doesNotMatch(allLlmOutput, /No notes are published yet\./);

  for (const url of publishedNoteUrls) {
    assert.ok(siteIndex.includes(url), `Site-wide llms.txt is missing published note ${url}`);
  }
}

console.log(
  `LLM content contract passed: ${publishedBlogUrls.length} blog posts, ${publishedNoteUrls.length} notes, and ${notesIndexUrls.size} Notes indexes.`
);
