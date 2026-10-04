import { getPublishedBlog, getWritingPath } from "./blog-source";
import { notesSource } from "./notes-source";
import { withTrailingSlash } from "./url-paths";

export interface HomeWritingEntry {
  title: string;
  href: string;
  format: "Blog" | "Note";
  publishedAt: Date;
}

/** A reader-facing selection; Blog and Notes remain separate. */
export async function getRecentWriting(): Promise<HomeWritingEntry[]> {
  const blog = await getPublishedBlog();

  const entries: HomeWritingEntry[] = blog.map((entry) => ({
    title: entry.data.title,
    href: getWritingPath(entry),
    format: "Blog",
    publishedAt: entry.data.publishedAt,
  }));

  for (const note of notesSource.getPages()) {
    if (note.data.draft || note.data.pageType !== "note" || !note.data.publishedAt) continue;
    entries.push({
      title: note.data.title,
      href: withTrailingSlash(note.url),
      format: "Note",
      publishedAt: note.data.publishedAt,
    });
  }

  return entries.sort((a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf() || a.href.localeCompare(b.href)).slice(0, 3);
}
