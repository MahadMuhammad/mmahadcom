import { readFile } from "node:fs/promises";
import { parse } from "parse5";

/** Use the built page's indexing policy, including empty indexes and redirects. */
export async function serializeSitemapPage(item) {
  const pathname = new URL(item.url).pathname.replace(/\/$/, "");
  const html = await readFile(new URL(`../dist${pathname}/index.html`, import.meta.url), "utf8");
  const document = parse(html);
  const head = document.childNodes.find((node) => node.tagName === "html")?.childNodes.find((node) => node.tagName === "head");
  const elements = (head?.childNodes ?? []).map((node) => ({
    tag: node.tagName,
    attrs: Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value])),
  }));
  if (elements.some(({ tag, attrs }) => tag === "meta" && attrs.name === "robots" && /\bnoindex\b/i.test(attrs.content))) return undefined;
  const canonical = elements.find(({ tag, attrs }) => tag === "link" && attrs.rel === "canonical")?.attrs.href;
  if (!canonical) throw new Error(`Missing canonical URL for ${item.url}`);
  return { ...item, url: canonical };
}
