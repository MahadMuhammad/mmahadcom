import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoInlineEventHandlers } from "./html-validation.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");
const headersFile = path.join(outputDirectory, "_headers");
const cspPlaceholder = "__GENERATED_CSP__";

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) return collectHtmlFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
    })
  );

  return files.flat();
}

const inlineScriptHashes = new Set();
const htmlFiles = await collectHtmlFiles(outputDirectory);

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");

  assertNoInlineEventHandlers(html, path.relative(projectRoot, htmlFile));

  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attributes, body] = match;

    if (/\bsrc\s*=/i.test(attributes) || body.length === 0) continue;

    const digest = createHash("sha256").update(body).digest("base64");
    inlineScriptHashes.add(`'sha256-${digest}'`);
  }
}

const scriptSources = ["'self'", "https://static.cloudflareinsights.com", ...[...inlineScriptHashes].toSorted()].join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src ${scriptSources}`,
  "script-src-attr 'none'",
  "connect-src 'self'",
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const headers = await readFile(headersFile, "utf8");
const placeholderCount = headers.split(cspPlaceholder).length - 1;

if (placeholderCount !== 1) {
  throw new Error(`Expected exactly one ${cspPlaceholder} placeholder in dist/_headers; found ${placeholderCount}.`);
}

await writeFile(headersFile, headers.replace(cspPlaceholder, contentSecurityPolicy));
console.log(`Generated CSP with ${inlineScriptHashes.size} inline-script hash${inlineScriptHashes.size === 1 ? "" : "es"}.`);
