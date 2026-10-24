import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const cacheVersion = "4.3.0";
export const upstreamHash = "ede1cc404a492fa348eb9d97a3007a0d72aa717bd22cd86a56bd0824c19729ca";
export const hardenedHash = "f393f6e3d27e56ed69b14c37ffe01fbb663eb7df3b2f646c28f42cd49d884539";
export const cacheAnchor = "    evaluateRequest(req) {\n        this._assertRequestHasHeaders(req);\n";
export const cacheGuard =
  "\n        // Never revive a security-zeroed entry through max-stale or stale-while-revalidate.\n" +
  "        if (!this.storable() || this.maxAge() === 0) {\n" +
  "            return this._evaluateRequestMissResult(req);\n" +
  "        }\n";

const digest = (source) => createHash("sha256").update(source).digest("hex");

async function installedCaches(root) {
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  const entries = Object.entries(lock.packages).filter(([name]) => name.endsWith("node_modules/http-cache-semantics"));
  assert.ok(entries.length > 0, "The reviewed cache dependency is missing from the lockfile.");
  const files = [];
  for (const [name, locked] of entries) {
    assert.ok(name.startsWith("node_modules/") && !name.split("/").includes(".."), "Invalid cache dependency path.");
    assert.equal(locked.version, cacheVersion, "Cache dependency changed; review the upstream fix before updating the guard.");
    const directory = path.join(root, name);
    const sourcePath = path.join(directory, "index.js");
    assert.ok(!(await lstat(directory)).isSymbolicLink() && !(await lstat(sourcePath)).isSymbolicLink(), "Cache dependency must not be a symlink.");
    const installed = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    assert.equal(installed.name, "http-cache-semantics");
    assert.equal(installed.version, cacheVersion, "Installed cache version differs from the lockfile.");
    assert.equal(installed.main, "index.js", "Cache entry point changed.");
    assert.equal(installed.exports, undefined, "Cache export map changed.");
    assert.equal(installed.type ?? "commonjs", "commonjs", "Cache module format changed.");
    files.push(sourcePath);
  }
  return files;
}

export async function hardenCache(root) {
  for (const sourcePath of await installedCaches(root)) {
    const source = await readFile(sourcePath, "utf8");
    const hash = digest(source);
    if (hash === hardenedHash) continue;
    assert.equal(hash, upstreamHash, "Unknown cache source; refusing to modify or execute it.");
    assert.equal(source.split(cacheAnchor).length, 2, "Cache guard insertion point changed.");
    const hardened = source.replace(cacheAnchor, cacheAnchor + cacheGuard);
    assert.equal(digest(hardened), hardenedHash, "Unexpected hardened cache source.");
    await writeFile(sourcePath, hardened);
  }
  await assertHardenedCache(root);
}

export async function assertHardenedCache(root) {
  for (const sourcePath of await installedCaches(root)) {
    assert.equal(
      digest(await readFile(sourcePath)),
      hardenedHash,
      "Cache security guard is missing or modified; run the dependency audit before building."
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  hardenCache(fileURLToPath(new URL("../", import.meta.url))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
