import type { CollectionEntry } from "astro:content";

const notesContentDirectory = "src/content/notes/";
const contentExtension = /\.(?:md|mdx)$/i;

type ContentEntryLocation = Pick<CollectionEntry<"notes">, "filePath" | "id">;

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

/**
 * Returns the content-relative path used by Fumadocs and Astro route helpers.
 * It accepts either Astro's collection id or its file path so callers do not
 * need to know which loader representation they were given.
 */
export function getNotesRelativePath(entry: ContentEntryLocation): string {
  const source = normalizePath(entry.filePath ?? entry.id);
  const markerIndex = source.lastIndexOf(notesContentDirectory);
  const relative = markerIndex === -1 ? source : source.slice(markerIndex + notesContentDirectory.length);

  return relative.replace(/^\/+/, "");
}

export function getNoteSlugs(entry: ContentEntryLocation): string[] {
  const relative = getNotesRelativePath(entry).replace(contentExtension, "");
  const segments = relative.split("/").filter(Boolean);

  return segments.at(-1) === "index" ? segments.slice(0, -1) : segments;
}

export function getNotePath(entry: ContentEntryLocation): string {
  const slugs = getNoteSlugs(entry);

  return slugs.length === 0 ? "/notes/" : `/notes/${slugs.map(encodeURIComponent).join("/")}/`;
}

function encodeAnchorSignature(value: string): string {
  return [...value].map((character) => character.codePointAt(0)?.toString(16).padStart(6, "0")).join("-");
}

/**
 * Creates readable, collision-safe fragment identifiers for future course,
 * topic, and tag indexes. The code-point signature makes C, C++, and C#
 * distinct without depending on the current index order.
 */
export function toNotesAnchorId(value: string): string {
  const normalized = value.trim().normalize("NFKC");
  const readable = normalized
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return `${readable || "note"}--${encodeAnchorSignature(normalized) || "000000"}`;
}

export function getNotesTagPath(tag: string): string {
  return `/notes/tags/#${encodeURIComponent(toNotesAnchorId(tag))}`;
}
