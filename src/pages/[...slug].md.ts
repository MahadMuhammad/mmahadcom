import type { APIRoute } from "astro";
import { getNoteMarkdown, getNoteMarkdownPath, markdownHeaders } from "../lib/notes-llm";
import { notesSource } from "../lib/notes-source";

import { getPublishedBlog } from "../lib/blog-source";
import { getBlogExport } from "../lib/blog-export";

interface Props {
  markdown: string;
}

export async function getStaticPaths() {
  const blog = (await getPublishedBlog()).map(getBlogExport).map((post) => ({
    params: { slug: post.markdownUrl.slice(1, -3) },
    props: { markdown: post.markdownContent },
  }));
  return [
    ...blog,
    ...notesSource.getPages().map((page) => ({
      params: { slug: getNoteMarkdownPath(page.url).replace(/^\//, "").replace(/\.md$/, "") },
      props: { markdown: getNoteMarkdown(page) },
    })),
  ];
}

export const GET: APIRoute<Props> = ({ props }) => new Response(props.markdown, { headers: markdownHeaders });
