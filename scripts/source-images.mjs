import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";

const sourceDirectory = new URL("../src/assets/", import.meta.url);

/** Keep existing public image URLs while Astro generates responsive derivatives. */
export function sourceImages() {
  return {
    name: "source-images",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: "source-image-urls",
                configureServer(server) {
                  server.middlewares.use((request, _response, next) => {
                    const url = new URL(request.url ?? "/", "http://localhost");
                    const source = new URL(`.${url.pathname}`, sourceDirectory);
                    if (
                      source.pathname.startsWith(sourceDirectory.pathname) &&
                      /\.(jpg|jpeg|png|webp)$/i.test(source.pathname) &&
                      existsSync(source)
                    ) {
                      request.url = `/@fs${source.pathname}${url.search}`;
                    }
                    next();
                  });
                },
              },
            ],
          },
        });
      },
      "astro:build:done": async ({ dir }) => {
        await cp(sourceDirectory, dir, { recursive: true });
      },
    },
  };
}
