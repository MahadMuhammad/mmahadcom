import type { CollectionEntry } from "astro:content";
import { llms } from "fumadocs-core/source";
import { site } from "../data/site";
import { createBlogMarkdown } from "./blog-markdown.mjs";
import { notesSource } from "./notes-source";
import { getContentSourceUrl } from "./source-links";
import { withTrailingSlash } from "./url-paths";

export type NotesPage = ReturnType<typeof notesSource.getPages>[number];

export const llmTextHeaders = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Content-Type": "text/plain; charset=utf-8",
} as const;

export const markdownHeaders = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Content-Type": "text/markdown; charset=utf-8",
} as const;

export function getNoteMarkdownPath(pageUrl: string): string {
  return `${pageUrl.replace(/\/$/, "")}.md`;
}

export function getNoteSourceUrl(entry: CollectionEntry<"notes">): string | undefined {
  return getContentSourceUrl(entry);
}

export function getNoteMarkdown(page: NotesPage): string {
  const canonicalUrl = new URL(withTrailingSlash(page.url), site.url).href;
  let markdown: string;
  try {
    markdown = createBlogMarkdown({
      title: page.data.title,
      description: `> ${page.data.description}\n\nCanonical: ${canonicalUrl}`,
      body: page.data._raw.body ?? "",
      canonicalUrl,
      author: site.fullName,
      date: page.data.publishedAt?.toISOString().slice(0, 10),
      updatedDate: page.data.updatedAt?.toISOString().slice(0, 10),
      attribution: false,
    });
  } catch (error) {
    throw new Error(`Cannot export Notes source ${page.data._raw.id}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (page.data.pageType !== "index") return markdown;

  const matchingNotes = getPublishedNotes().filter((note) => {
    if (page.data.indexType === "courses") return note.data.kind === "course" || Boolean(note.data.course);
    if (page.data.indexType === "topics") return note.data.kind === "topic" || Boolean(note.data.topic);
    if (page.data.indexType === "tags") return note.data.tags.length > 0;
    return true;
  });
  const links = matchingNotes.map((note) => `- [${note.data.title}](${new URL(getNoteMarkdownPath(note.url), site.url)}): ${note.data.description}`);
  return `${markdown.trim()}\n\n## Notes in this collection\n\n${links.length ? links.join("\n") : "No notes are published in this collection yet."}\n`;
}

export function getNotesIndexPages(): NotesPage[] {
  return notesSource
    .getPages()
    .filter((page) => page.data.pageType === "index")
    .toSorted((left, right) => left.url.localeCompare(right.url));
}

export function getPublishedNotes(): NotesPage[] {
  return notesSource
    .getPages()
    .filter((page) => page.data.pageType === "note")
    .toSorted((left, right) => left.url.localeCompare(right.url));
}

export function getNotesLLMsIndex(): string {
  const publishedNotes = getPublishedNotes();
  const index = llms(notesSource)
    .index()
    .replace(/\]\((\/notes[^)]*)\)/g, (_match, pageUrl: string) => `](${new URL(getNoteMarkdownPath(pageUrl), site.url)})`);

  return [
    index,
    "",
    "## Publication status",
    "",
    publishedNotes.length === 0
      ? "No notes are published yet. The links above are index pages prepared for future notes."
      : `${publishedNotes.length} ${publishedNotes.length === 1 ? "note is" : "notes are"} published; the links above include each note.`,
    "",
    "## Additional resources",
    "",
    `- [Notes content export](${new URL("/notes/llms-full.txt", site.url)}): Available note content in a single text file, with an explicit empty state when no notes are published.`,
    `- [Site-wide LLM index](${new URL("/llms.txt", site.url)}): ${site.fullName}'s portfolio, writing, events, notes, and contact information.`,
    "",
  ].join("\n");
}

export function getNotesLLMsFullText(): string {
  const publishedNotes = getPublishedNotes();

  if (publishedNotes.length === 0) {
    return "# Notes\n\nNo notes are published yet.\n";
  }

  const content = publishedNotes.map((page) => getNoteMarkdown(page).replace(/^# /, "## ")).join("\n---\n\n");
  return `# Notes\n\n${content.trim()}\n`;
}
