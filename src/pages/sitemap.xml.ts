import { getCollection } from "astro:content";
import { site } from "../data/site";
import { getWritingPath, getPublishedBlog } from "../lib/blog-source";
import { notesSource } from "../lib/notes-source";

export const prerender = true;

const portfolioRoutes = ["/", "/open-source/", "/teaching/", "/volunteering/", "/education/", "/contact/"] as const;

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET() {
  const [posts, workshops] = await Promise.all([getPublishedBlog(), getCollection("workshops")]);
  const routes = new Set<string>([
    ...portfolioRoutes,
    ...(posts.length ? ["/blog/"] : []),
    ...notesSource.getPages().map((page) => `${page.url.replace(/\/$/, "")}/`),
    ...posts.map(getWritingPath),
    ...workshops.map((workshop) => `/volunteering/${workshop.data.slug}/`),
  ]);
  const urls = [...routes]
    .sort()
    .map((route) => `  <url><loc>${escapeXml(new URL(route, site.url).toString())}</loc></url>`)
    .join("\n");
  const body = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, urls, `</urlset>`].join(
    "\n"
  );

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
