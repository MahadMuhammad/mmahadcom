import { site } from "../data/site";

export const prerender = true;

export function GET() {
  const sitemap = new URL("/sitemap-index.xml", site.url);
  const body = [`User-agent: *`, `Allow: /`, ``, `Sitemap: ${sitemap}`].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
