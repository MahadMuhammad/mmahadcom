import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import { structure, type StructuredData } from "fumadocs-core/mdx-plugins";
import { loader, type StaticSource } from "fumadocs-core/source";
import { getNotesRelativePath } from "./notes-slug";

type NoteData = CollectionEntry<"notes">["data"] & {
  _raw: CollectionEntry<"notes">;
  structuredData: StructuredData;
};

export const notesSource = loader({
  source: await createNotesSource(),
  baseUrl: "/notes",
});

async function createNotesSource() {
  const source: StaticSource<{
    metaData: CollectionEntry<"notesMeta">["data"];
    pageData: NoteData;
  }> = {
    files: [],
  };

  for (const note of await getCollection("notes")) {
    if (note.data.draft) continue;

    source.files.push({
      type: "page",
      path: getNotesRelativePath(note),
      data: {
        ...note.data,
        _raw: note,
        structuredData: structure(note.body ?? ""),
      },
    });
  }

  for (const meta of await getCollection("notesMeta")) {
    source.files.push({
      type: "meta",
      path: getNotesRelativePath(meta),
      data: meta.data,
    });
  }

  return source;
}
