import { site } from "../data/site";
import { createBlogMarkdown } from "./blog-markdown.mjs";
import { getWritingPath, type PublishedWriting } from "./blog-source";
import { getContentSourceUrl } from "./source-links";

export function getBlogExport(entry: PublishedWriting) {
  const path = getWritingPath(entry);
  const canonicalUrl = new URL(path, site.url).href;
  return {
    githubUrl: getContentSourceUrl(entry),
    canonicalUrl,
    markdownUrl: `${path.slice(0, -1)}.md`,
    markdownContent: createBlogMarkdown({
      title: entry.data.title,
      description: entry.data.description,
      body: entry.body ?? "",
      canonicalUrl,
      author: site.fullName,
      date: entry.data.publishedAt.toISOString().slice(0, 10),
      updatedDate: entry.data.updatedAt?.toISOString().slice(0, 10),
      attribution: entry.data.attribution,
    }),
  };
}
