import { createFromSource, type AdvancedIndex } from "fumadocs-core/search/server";
import { notesSource } from "../../../lib/notes-source";
import { withTrailingSlash } from "../../../lib/url-paths";

const search = createFromSource(notesSource, {
  buildIndex: async (page): Promise<AdvancedIndex> => ({
    title: page.data.title,
    description: page.data.description,
    url: withTrailingSlash(page.url),
    id: page.url,
    structuredData: page.data.structuredData,
    tag: page.data.tags,
  }),
});

export const GET = () => search.staticGET();
