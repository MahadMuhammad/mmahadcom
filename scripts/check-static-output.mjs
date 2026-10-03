import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expires } from "./audit-dependencies.mjs";

export async function assertStaticOutput(root, now = Date.now()) {
  assert.ok(Number.isFinite(now) && now < expires, "Temporary dependency exception expired; do not publish these assets.");
  const forbidden = ["_worker.js", "functions", "wrangler.toml", "wrangler.json", "wrangler.jsonc", "package.json", "node_modules"];
  const top = await readdir(root);
  for (const entry of forbidden) assert.ok(!top.includes(entry), `Executable or server configuration in static output: ${entry}`);
  assert.ok(top.includes("index.html") && top.includes("_headers"), "Missing static index or security headers.");
  assert.ok(!(await readFile(path.join(root, "_headers"), "utf8")).includes("__GENERATED_CSP__"), "Unresolved security policy.");
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "Static output contains a symlink.");
      assert.ok(!entry.name.startsWith(".") || entry.name === ".well-known", "Unexpected hidden file in static output.");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && /\.(?:m?js|cjs)$/.test(entry.name)) {
        assert.doesNotMatch(
          await readFile(absolute, "utf8"),
          /http-cache-semantics|satisfiesWithoutRevalidation|class CachePolicy/,
          "Server cache implementation in shipped JavaScript."
        );
      }
    }
  }
  await visit(root);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL("../dist/", import.meta.url));
  assertStaticOutput(root)
    .then(() => console.log("Static artifact boundary passed."))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
