import rss from "@astrojs/rss";
import { site } from "../../data/site";
import { getPublishedBlog, getWritingPath } from "../../lib/blog-source";

export async function GET() {
  return rss({
    title: `${site.fullName} — Blog`,
    description: "Tutorials, experiments, and observations.",
    site: site.url,
    items: (await getPublishedBlog()).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: getWritingPath(post),
      categories: post.data.tags,
    })),
  });
}
