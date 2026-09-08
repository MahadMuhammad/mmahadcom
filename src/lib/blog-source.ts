import { getCollection, type CollectionEntry } from "astro:content";

export type WritingEntry = CollectionEntry<"blog">;
export type PublishedWriting = WritingEntry & { data: WritingEntry["data"] & { publishedAt: Date } };

export async function getPublishedBlog(): Promise<PublishedWriting[]> {
  return (await getCollection("blog"))
    .filter((entry): entry is PublishedWriting => !entry.data.draft && entry.data.publishedAt instanceof Date)
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
}

export function getWritingPath(entry: WritingEntry) {
  return `/${entry.collection}/${entry.data.slug ?? entry.id.replace(/\.(md|mdx)$/, "")}/`;
}

export const formatWritingDate = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
