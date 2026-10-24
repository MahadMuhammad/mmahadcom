import { fileURLToPath } from "node:url";
import { assertHardenedCache } from "./harden-cache.mjs";

export function buildSecurity() {
  const verify = () => assertHardenedCache(fileURLToPath(new URL("../", import.meta.url)));
  return {
    name: "build-dependency-security",
    hooks: {
      "astro:config:setup": verify,
      "astro:build:done": verify,
    },
  };
}
