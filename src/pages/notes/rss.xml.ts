import rss from "@astrojs/rss";
import { site } from "../../data/site";
import { getPublishedNotes } from "../../lib/notes-llm";
import { withTrailingSlash } from "../../lib/url-paths";

export function GET() {
  return rss({
    title: `${site.fullName} — Notes`,
    description: "Course notes, explanations, and references.",
    site: site.url,
    items: getPublishedNotes()
      .toSorted((a, b) => b.data.publishedAt!.valueOf() - a.data.publishedAt!.valueOf())
      .map((note) => ({
        title: note.data.title,
        description: note.data.description,
        pubDate: note.data.publishedAt,
        link: withTrailingSlash(note.url),
        categories: note.data.tags,
      })),
  });
}
