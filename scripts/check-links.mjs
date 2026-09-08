import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlFragments as parseHtmlFragments, htmlReferences } from "./html-validation.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");
const htmlExtensions = new Set([".html", ".htm"]);
const stylesheets = new Set([".css"]);
const textExtensions = new Set([".md", ".txt", ".xml"]);
const canonicalOrigin = new URL("https://www.mmahad.com");
const requiredOutputRoutes = [
  "/robots.txt",
  "/sitemap-index.xml",
  "/blog/rss.xml",
  "/notes/rss.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/notes/llms.txt",
  "/notes/llms-full.txt",
  "/notes.md",
  "/notes/courses.md",
  "/notes/topics.md",
  "/notes/tags.md",
  "/notes/api/search.json",
];

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      return entry.isFile() ? [entryPath] : [];
    })
  );

  return nested.flat();
}

function unquote(value) {
  const trimmed = value.trim();
  const quote = trimmed.at(0);

  return quote === '"' || quote === "'" ? trimmed.slice(1, -1) : trimmed;
}

function normalizeReference(reference) {
  if (reference.startsWith("//")) {
    reference = `https:${reference}`;
  }

  if (/^https?:/i.test(reference)) {
    try {
      const url = new URL(reference);

      if (url.hostname === canonicalOrigin.hostname) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return reference;
    }
  }

  return reference;
}

function isExternal(reference) {
  const normalized = normalizeReference(reference);
  return normalized.length === 0 || /^[a-z][a-z\d+.-]*:/i.test(normalized) || normalized.startsWith("//");
}

function pathnameFrom(reference) {
  reference = normalizeReference(reference);
  const separator = reference.search(/[?#]/);
  const pathname = separator === -1 ? reference : reference.slice(0, separator);

  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function isInsideOutput(candidate) {
  return candidate === outputDirectory || candidate.startsWith(`${outputDirectory}${path.sep}`);
}

function possibleTargets(reference, sourceFile) {
  reference = normalizeReference(reference);
  const pathname = pathnameFrom(reference);

  if (pathname.length === 0) {
    return [sourceFile];
  }

  const target = reference.startsWith("/") ? path.resolve(outputDirectory, `.${pathname}`) : path.resolve(path.dirname(sourceFile), pathname);

  if (!isInsideOutput(target)) {
    return [];
  }

  const candidates = [target];

  if (path.extname(target) === "") {
    candidates.push(`${target}.html`, path.join(target, "index.html"));
  }

  return [...new Set(candidates)];
}

function fragmentFrom(reference) {
  const normalized = normalizeReference(reference);
  const hashIndex = normalized.indexOf("#");

  if (hashIndex === -1) {
    return undefined;
  }

  const fragment = normalized.slice(hashIndex + 1);

  if (!fragment || fragment.startsWith(":~:text=")) {
    return undefined;
  }

  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

async function firstExistingFile(candidates) {
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) {
        return candidate;
      }
    } catch {
      // Keep trying route and extension variants.
    }
  }

  return undefined;
}

function redirectReferences(source) {
  const references = [];

  for (const line of source.split(/\r?\n/)) {
    const rule = line.trim();

    if (!rule || rule.startsWith("#")) {
      continue;
    }

    const [, destination] = rule.split(/\s+/);

    if (destination?.startsWith("/") && !destination.includes(":")) {
      references.push(destination);
    }
  }

  return references;
}

function stylesheetReferences(source) {
  const references = [];
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gim;

  for (const match of source.matchAll(urlPattern)) {
    references.push(match[1] ?? match[2] ?? match[3]);
  }

  return references;
}

function textReferences(source) {
  const references = [];
  const markdownLinkPattern = /\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+['"][^'"]*['"])?\s*\)/gim;
  const canonicalPattern = /^(?:Canonical|Sitemap):\s*(\S+)\s*$/gim;
  const sitemapPattern = /<loc>([^<]+)<\/loc>/gim;

  for (const match of source.matchAll(markdownLinkPattern)) {
    references.push(match[1] ?? match[2]);
  }

  for (const match of source.matchAll(canonicalPattern)) {
    references.push(match[1]);
  }

  for (const match of source.matchAll(sitemapPattern)) {
    references.push(match[1].replaceAll("&amp;", "&"));
  }

  return references;
}

const htmlFragmentCache = new Map();

async function htmlFragments(file) {
  let fragments = htmlFragmentCache.get(file);

  if (fragments) {
    return fragments;
  }

  const source = await readFile(file, "utf8");
  fragments = parseHtmlFragments(source);

  htmlFragmentCache.set(file, fragments);
  return fragments;
}

async function validateReference(rawReference, sourceFile, errors) {
  const reference = unquote(rawReference);

  if (isExternal(reference)) {
    return false;
  }

  const target = await firstExistingFile(possibleTargets(reference, sourceFile));

  if (!target) {
    errors.add(`${displayPath(sourceFile)} -> ${reference}`);
    return true;
  }

  const fragment = fragmentFrom(reference);

  if (fragment && htmlExtensions.has(path.extname(target).toLowerCase()) && !(await htmlFragments(target)).has(fragment)) {
    errors.add(`${displayPath(sourceFile)} -> ${reference} (missing fragment)`);
  }

  return true;
}

function displayPath(file) {
  return path.relative(projectRoot, file) || ".";
}

if (!(await pathExists(outputDirectory))) {
  console.error("Static link check requires dist/. Run npm run build before npm run check:links.");
  process.exitCode = 1;
} else {
  const files = await collectFiles(outputDirectory);
  const htmlFiles = files.filter((file) => htmlExtensions.has(path.extname(file).toLowerCase()));
  const cssFiles = files.filter((file) => stylesheets.has(path.extname(file).toLowerCase()));
  const textFiles = files.filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
  const errors = new Set();
  let checkedReferences = 0;

  for (const sourceFile of [...htmlFiles, ...cssFiles, ...textFiles]) {
    const source = await readFile(sourceFile, "utf8");
    const extension = path.extname(sourceFile).toLowerCase();
    const references = htmlExtensions.has(extension)
      ? htmlReferences(source)
      : stylesheets.has(extension)
        ? stylesheetReferences(source)
        : textReferences(source);

    for (const rawReference of references) {
      if (await validateReference(rawReference, sourceFile, errors)) {
        checkedReferences += 1;
      }
    }
  }

  const redirectsFile = path.join(outputDirectory, "_redirects");

  if (await pathExists(redirectsFile)) {
    const redirects = redirectReferences(await readFile(redirectsFile, "utf8"));

    for (const reference of redirects) {
      if (await validateReference(reference, redirectsFile, errors)) {
        checkedReferences += 1;
      }
    }
  }

  const rootDocument = path.join(outputDirectory, "index.html");

  for (const route of requiredOutputRoutes) {
    if (await validateReference(route, rootDocument, errors)) {
      checkedReferences += 1;
    }
  }

  if (errors.size > 0) {
    console.error(`Static link check found ${errors.size} unresolved internal reference${errors.size === 1 ? "" : "s"}:`);

    for (const error of [...errors].sort()) {
      console.error(`  ${error}`);
    }

    process.exitCode = 1;
  } else {
    console.log(
      `Static link check passed: ${checkedReferences} internal reference${checkedReferences === 1 ? "" : "s"} across ${htmlFiles.length} HTML file${
        htmlFiles.length === 1 ? "" : "s"
      }, ${cssFiles.length} stylesheet${cssFiles.length === 1 ? "" : "s"}, and ${textFiles.length} text document${textFiles.length === 1 ? "" : "s"}.`
    );
  }
}
