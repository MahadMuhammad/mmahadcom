import { getCollection } from "astro:content";
import { getPublishedBlog, getWritingPath } from "./blog-source";
import { getNotePath } from "./notes-slug";

export interface HomeWritingEntry {
  title: string;
  href: string;
  format: "Blog" | "Note";
  publishedAt: Date;
}

/** A reader-facing selection; Blog and Notes remain separate. */
export async function getRecentWriting(): Promise<HomeWritingEntry[]> {
  const [blog, notes] = await Promise.all([getPublishedBlog(), getCollection("notes")]);

  const entries: HomeWritingEntry[] = blog.map((entry) => ({
    title: entry.data.title,
    href: getWritingPath(entry),
    format: "Blog",
    publishedAt: entry.data.publishedAt,
  }));

  for (const note of notes) {
    if (note.data.draft || note.data.pageType !== "note" || !note.data.publishedAt) continue;
    entries.push({
      title: note.data.title,
      href: getNotePath(note),
      format: "Note",
      publishedAt: note.data.publishedAt,
    });
  }

  return entries.sort((a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf() || a.href.localeCompare(b.href)).slice(0, 3);
}
