import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const { values: options } = parseArgs({
  options: {
    routes: { type: "string" },
    theme: { type: "string", default: "dark" },
    screenshots: { type: "boolean", default: false },
  },
});
if (!["light", "dark"].includes(options.theme)) throw new Error("--theme must be light or dark.");
const requestedRoutes = options.routes?.split(",").map((route) => route.trim());
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(projectRoot, "dist");
const screenshotDirectory = resolve(projectRoot, "test-results/a11y", options.theme);
const routes = (await listHtmlFiles(outputDirectory)).map(routeFor).sort();
for (const route of requestedRoutes ?? []) {
  if (!routes.includes(route)) throw new Error(`Unknown built route: ${route}. Use its exact path, for example /blog/.`);
}
const selectedRoutes = requestedRoutes ? routes.filter((route) => requestedRoutes.includes(route)) : routes;
const includesRoute = (route) => selectedRoutes.includes(route);
const headersFile = join(outputDirectory, "_headers");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);
const viewports = [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "320px", width: 320, height: 900 },
];
const stateChecks = [
  {
    label: "Notes search open",
    route: "/notes/",
    open: async (page) => {
      const trigger = page.locator("button[data-search]:visible, button[data-search-full]:visible").first();
      await trigger.click();
      await page.locator('[role="dialog"]:visible').waitFor({ state: "visible" });
      await page.getByPlaceholder("Search").fill("course");
      await page.locator('[role="dialog"]:visible').getByText("Course notes", { exact: true }).waitFor({ state: "visible" });
    },
  },
  {
    label: "Workshop lightbox open",
    route: "/volunteering/hacktoberfest-lahore-2025/",
    open: async (page) => {
      await page.locator("[data-gallery-trigger]").first().click();
      await page.locator("[data-workshop-lightbox][open]").waitFor({ state: "visible" });
    },
  },
];

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listHtmlFiles(path) : [path];
    })
  );

  return files.flat().filter((file) => file.endsWith(".html"));
}

function routeFor(file) {
  const route = relative(outputDirectory, file).split(sep).join("/");
  if (route === "index.html") return "/";
  if (route.endsWith("/index.html")) return `/${route.slice(0, -"index.html".length)}`;
  return `/${route}`;
}

async function readGeneratedContentSecurityPolicy() {
  const lines = (await readFile(headersFile, "utf8")).split(/\r?\n/);
  const globalHeaderIndex = lines.findIndex((line) => line.trim() === "/*");

  if (globalHeaderIndex === -1) throw new Error("dist/_headers does not contain a global /* header block.");

  for (const line of lines.slice(globalHeaderIndex + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) break;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (name === "content-security-policy") {
      if (!value || value.includes("__GENERATED_CSP__")) {
        throw new Error("dist/_headers contains an unresolved Content-Security-Policy placeholder.");
      }

      return value;
    }
  }

  throw new Error("dist/_headers does not contain a generated Content-Security-Policy header.");
}

async function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl ?? "/", "http://localhost").pathname);
  const requestedPath = resolve(outputDirectory, `.${pathname}`);

  if (requestedPath !== outputDirectory && !requestedPath.startsWith(`${outputDirectory}${sep}`)) {
    return null;
  }

  try {
    const metadata = await stat(requestedPath);
    return metadata.isDirectory() ? join(requestedPath, "index.html") : requestedPath;
  } catch {
    if (!extname(requestedPath)) return join(requestedPath, "index.html");
    return requestedPath;
  }
}

const contentSecurityPolicy = await readGeneratedContentSecurityPolicy();
const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveRequestPath(request.url);
    if (!filePath || !(await stat(filePath)).isFile()) throw new Error("Not found");

    response.writeHead(200, {
      "Content-Security-Policy": contentSecurityPolicy,
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

function formatScenario(route, viewport, state) {
  return `${route} (${viewport.label}${state ? `, ${state}` : ""})`;
}

async function preparePage(context) {
  const page = await context.newPage();
  await page.addInitScript(() => {
    globalThis.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      globalThis.__cspViolations.push({
        blockedURI: event.blockedURI,
        disposition: event.disposition,
        effectiveDirective: event.effectiveDirective,
        lineNumber: event.lineNumber,
        sourceFile: event.sourceFile,
        violatedDirective: event.violatedDirective,
      });
    });
  });
  return page;
}

async function loadRoute(page, baseUrl, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
  if (!response) throw new Error(`No main-document response received for ${route}.`);
  // Wait for interactive islands, rather than a fixed period of network silence.
  await page.waitForFunction(() => !document.querySelector('astro-island[client="load"][ssr]'));

  const servedPolicy = await response.headerValue("content-security-policy");
  if (servedPolicy !== contentSecurityPolicy) {
    throw new Error(`Generated Content-Security-Policy was not served for ${route}.`);
  }
}

async function checkSharedHeader(page, viewport) {
  const header = page.locator(".site-header");
  if (!(await header.count())) return;
  assert.equal(await header.count(), 1);
  const brand = header.locator(".site-brand");
  assert.match((await brand.innerText()).replace(/\s+/g, " "), /Mahad \/ مہد/);
  const initial = await page.locator("html").getAttribute("data-theme");
  const toggle = header.locator("[data-theme-toggle]");
  await toggle.click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme !== theme, initial);
  const next = await page.locator("html").getAttribute("data-theme");
  assert.equal(await page.evaluate(() => localStorage.getItem("mahad-theme")), next);
  assert.equal(await page.locator("html").evaluate((root) => root.classList.contains("dark")), next === "dark");
  await toggle.click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, initial);
  if (viewport.width === 320) {
    const summary = header.getByRole("button", { name: "Open navigation menu", exact: true });
    await summary.focus();
    await page.keyboard.press("Enter");
    await header.getByRole("navigation", { name: "Mobile navigation" }).waitFor({ state: "visible" });
    assert.equal(await header.locator('#mobile-navigation a[href="/notes/"]').count(), 1);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".mobile-menu").open);
    assert.equal(await summary.evaluate((node) => document.activeElement === node), true);
  }
}

async function checkLandscapeNavigation(browser, baseUrl) {
  const context = await browser.newContext({ colorScheme: options.theme, viewport: { width: 780, height: 320 } });
  const page = await preparePage(context);

  try {
    await loadRoute(page, baseUrl, "/");
    const summary = page.locator(".mobile-menu summary");
    const menu = page.getByRole("navigation", { name: "Mobile navigation" });
    await summary.focus();
    await page.keyboard.press("Enter");
    await menu.waitFor({ state: "visible" });
    for (let index = 0; index < (await menu.getByRole("link").count()); index += 1) await page.keyboard.press("Tab");
    const contact = menu.getByRole("link", { name: "contact", exact: true });
    assert.equal(await contact.evaluate((element) => document.activeElement === element), true, "Keyboard navigation did not reach Contact.");
    const menuBounds = await menu.boundingBox();
    const contactBounds = await contact.boundingBox();
    assert.ok(menuBounds.y + menuBounds.height <= 320, "The landscape menu extends below the viewport.");
    assert.ok(contactBounds.y >= menuBounds.y && contactBounds.y + contactBounds.height <= 320, "Contact is outside the visible menu.");
    assert.ok(await menu.evaluate((element) => element.scrollTop > 0), "Keyboard focus did not scroll the landscape menu.");
    await page.keyboard.press("Escape");
    assert.equal(await summary.evaluate((element) => document.activeElement === element), true);
  } finally {
    await context.close();
  }
}

async function checkBlogFilters(page, baseUrl) {
  const filters = page.getByRole("navigation", { name: "Filter posts by topic" });
  if (!(await filters.count())) return;
  const total = await page.locator(".blog-post-preview").count();
  const topic = filters.locator('a[href*="?tag="]').first();
  const href = await topic.getAttribute("href");
  const key = new URL(href, baseUrl).searchParams.get("tag");
  const expected = await page
    .locator(".blog-post-preview")
    .evaluateAll(
      (posts, selected) =>
        posts.filter((post) => [...post.querySelectorAll(".blog-tags a")].some((tag) => tag.textContent.trim().toLowerCase() === selected)).length,
      key
    );
  await topic.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((tag) => new URLSearchParams(location.search).get("tag") === tag, key);
  assert.equal(await topic.getAttribute("aria-current"), "true");
  assert.equal(await page.locator(".blog-post-preview").count(), expected);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => !document.querySelector('astro-island[client="load"][ssr]'));
  await page.waitForFunction(() => document.querySelector('.blog-filters a[aria-current="true"]')?.getAttribute("href")?.includes("?tag="));
  await filters.getByRole("link", { name: /^All posts/ }).click();
  await page.waitForFunction(() => !location.search);
  assert.equal(await page.locator(".blog-post-preview").count(), total);
  await page.goBack();
  await page.waitForFunction((tag) => new URLSearchParams(location.search).get("tag") === tag, key);
  await page.waitForFunction(() => document.querySelector('.blog-filters a[aria-current="true"]')?.getAttribute("href")?.includes("?tag="));
  await loadRoute(page, baseUrl, "/blog/?tag=topic-with-no-posts");
  await page.getByRole("heading", { name: "No posts for this topic yet" }).waitFor();
  assert.equal(await page.locator(".blog-post-preview").count(), 0);
  await page.getByRole("link", { name: "see all posts", exact: true }).click();
  await page.waitForFunction(() => !location.search);
  assert.equal(await page.locator(".blog-post-preview").count(), total);
}

async function checkBlogReading(page, viewport) {
  if (await page.locator("body.blog-surface").count()) {
    assert.equal(await page.locator("#nd-sidebar, #nd-docs-layout").count(), 0, "Blog must remain separate from the documentation layout.");
  }
  if (!(await page.locator(".blog-article").count())) return;
  const actions = page.getByRole("group", { name: "Save or share this post" });
  const actionStatus = page.locator(".blog-action-status");
  assert.equal(await actionStatus.getAttribute("data-visible"), "false", "Idle controls should not reserve a confirmation row");
  const download = actions.getByRole("link", { name: "Download Markdown" });
  const exportResponse = await page.request.get(new URL(await download.getAttribute("href"), page.url()).href);
  assert.equal(exportResponse.status(), 200);
  const markdown = await exportResponse.text();
  assert.match(markdown, /^# /);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied for verification");
        },
      },
    });
  });
  await actions.getByRole("button", { name: "Copy Markdown", exact: true }).click();
  await actionStatus.getByText("Could not copy. Use Download Markdown instead.", { exact: true }).waitFor();
  assert.equal(await actionStatus.getAttribute("data-visible"), "true", "Copy failures must remain visible and actionable");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          globalThis.__blogCopiedText = text;
        },
      },
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  const markdownButton = actions.getByRole("button", { name: "Copy Markdown", exact: true });
  const markdownWidth = (await markdownButton.boundingBox()).width;
  await markdownButton.click();
  await actionStatus.getByText("Markdown copied", { exact: true }).waitFor();
  assert.equal(await actionStatus.getAttribute("data-visible"), "false", "Success should appear in the button without a duplicate visual message");
  assert.equal(await actionStatus.evaluate((element) => getComputedStyle(element).position), "absolute");
  assert.equal(await markdownButton.locator('.blog-feedback-label [data-visible="true"]').innerText(), "Copied");
  assert.equal(await page.evaluate(() => globalThis.__blogCopiedText), markdown, "Copy and download must supply identical Markdown");
  assert.equal(
    await actions
      .getByRole("button", { name: "Copy Markdown", exact: true })
      .locator('.blog-action-feedback[data-state="success"] .blog-copy-check')
      .count(),
    1,
    "Show a checkmark only after the copy succeeds"
  );
  assert.equal((await markdownButton.boundingBox()).width, markdownWidth, "Copy feedback must not shift toolbar geometry");
  const toolbarPositions = () =>
    actions.evaluate((toolbar) => {
      const origin = toolbar.getBoundingClientRect();
      return [...toolbar.querySelectorAll("button, a")].map((control) => {
        const bounds = control.getBoundingClientRect();
        return { x: bounds.x - origin.x, y: bounds.y - origin.y, width: bounds.width, height: bounds.height };
      });
    });
  const beforeShare = await toolbarPositions();
  const shareButton = actions.getByRole("button", { name: "Share", exact: true });
  await shareButton.click();
  await actionStatus.getByText("Link copied", { exact: true }).waitFor();
  assert.equal(
    await shareButton.locator(".blog-action-feedback").getAttribute("data-state"),
    "success",
    "Share fallback confirms on the clicked Share control"
  );
  assert.equal(
    await actions.getByRole("button", { name: "Copy link", exact: true }).locator(".blog-action-feedback").getAttribute("data-state"),
    "idle"
  );
  assert.deepEqual(await toolbarPositions(), beforeShare, "Share fallback must not move the toolbar controls");
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  assert.equal(await page.evaluate(() => globalThis.__blogCopiedText), canonical, "Share fallback must use the canonical URL");

  await page.waitForFunction(() => document.querySelector(".blog-action-status").textContent.trim() === "", null, { timeout: 5500 });
  assert.equal(await actions.getByRole("button", { name: "Copy link", exact: true }).isEnabled(), true);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          new Promise((resolve) => {
            globalThis.__releaseBlogCopy = resolve;
          }),
      },
    })
  );
  await actions.getByRole("button", { name: "Copy link", exact: true }).click();
  const pendingCopy = actions.getByRole("button", { name: "Copying link…", exact: true });
  await pendingCopy.waitFor();
  assert.equal(await pendingCopy.isDisabled(), true);
  assert.equal(
    await pendingCopy.evaluate((element) => getComputedStyle(element).cursor),
    "default",
    "Clipboard work should not impersonate a frozen browser"
  );
  assert.equal(await actionStatus.innerText(), "", "Do not acknowledge a copy until it succeeds");
  await page.evaluate(() => globalThis.__releaseBlogCopy());
  await actionStatus.getByText("Link copied", { exact: true }).waitFor();
  if (viewport.width !== 320) {
    await actions.getByRole("button", { name: "Copy link", exact: true }).click();
    await actionStatus.getByText("Could not copy. Select the link below instead.", { exact: true }).waitFor({ timeout: 10000 });
    assert.equal(
      await actions.getByRole("button", { name: "Copy link", exact: true }).isEnabled(),
      true,
      "A stalled clipboard must not lock the toolbar"
    );
    await page.evaluate(() => globalThis.__releaseBlogCopy());
    assert.equal(
      await actionStatus.innerText(),
      "Could not copy. Select the link below instead.",
      "A late clipboard completion must not replace timeout guidance"
    );
  }

  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        globalThis.__blogShareData = data;
      },
    })
  );
  await actions.getByRole("button", { name: "Share", exact: true }).click();
  assert.equal(await page.evaluate(() => globalThis.__blogShareData.url), canonical);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    })
  );
  await actions.getByRole("button", { name: "Share", exact: true }).click();
  assert.equal(await actionStatus.innerText(), "", "Cancelling a share should not report an error");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const body = page.locator(".blog-body");
  const initialSize = await body.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const standardSize = page.getByRole("radio", { name: "Standard text", exact: true });
  const largeSize = page.getByRole("radio", { name: "Larger text", exact: true });
  await standardSize.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await largeSize.isChecked(), true);
  await page.waitForFunction((size) => parseFloat(getComputedStyle(document.querySelector(".blog-body")).fontSize) > size, initialSize, {
    timeout: 3000,
  });
  await page.keyboard.press("ArrowLeft");
  assert.equal(await standardSize.isChecked(), true);
  const serifToggle = page.getByRole("button", { name: "Serif text", exact: true });
  const originalFont = await body.evaluate((node) => getComputedStyle(node).fontFamily);
  await serifToggle.click();
  await page.waitForFunction((font) => getComputedStyle(document.querySelector(".blog-body")).fontFamily !== font, originalFont);
  assert.equal(await serifToggle.getAttribute("aria-pressed"), "true");
  await serifToggle.click();
  await page.waitForFunction((font) => getComputedStyle(document.querySelector(".blog-body")).fontFamily === font, originalFont);
  await largeSize.check();
  await serifToggle.click();
  const articleUrl = new URL(page.url());
  await loadRoute(page, articleUrl.origin, articleUrl.pathname);
  assert.equal(await largeSize.isChecked(), true, "Text size persists on reload");
  assert.equal(await serifToggle.getAttribute("aria-pressed"), "true", "Typeface persists on reload");
  assert.ok(await body.evaluate((node, size) => parseFloat(getComputedStyle(node).fontSize) > size, initialSize));
  assert.notEqual(await body.evaluate((node) => getComputedStyle(node).fontFamily), originalFont);
  const otherArticle = selectedRoutes.find((route) => route.startsWith("/blog/") && route !== "/blog/" && route !== articleUrl.pathname);
  if (otherArticle) {
    await loadRoute(page, articleUrl.origin, otherArticle);
    assert.equal(await largeSize.isChecked(), true, "Text size persists across articles");
    assert.equal(await serifToggle.getAttribute("aria-pressed"), "true", "Typeface persists across articles");
    await loadRoute(page, articleUrl.origin, articleUrl.pathname);
  }
  await standardSize.check();
  await serifToggle.click();
  await page.evaluate(() => localStorage.setItem("mahad-blog-reading", "invalid JSON"));
  await loadRoute(page, articleUrl.origin, articleUrl.pathname);
  assert.equal(await standardSize.isChecked(), true, "Malformed storage falls back to standard text");
  assert.equal(await serifToggle.getAttribute("aria-pressed"), "false");
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "mahad-blog-reading") throw new DOMException("Storage denied for verification", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  await largeSize.check();
  await serifToggle.click();
  assert.equal(await largeSize.isChecked(), true, "Reading controls remain usable when persistence is denied");
  assert.equal(await serifToggle.getAttribute("aria-pressed"), "true");
  await standardSize.check();
  await serifToggle.click();
  await loadRoute(page, articleUrl.origin, articleUrl.pathname);
  assert.equal(await page.locator(".blog-heading .blog-tags").count(), 0);
  const tags = page.locator(".blog-tags");
  assert.equal(await tags.count(), await page.locator(".blog-end .blog-tags").count(), "Optional article tags belong only at the end");

  for (const comparison of await page.locator("blog-image-comparison").all()) {
    const before = comparison.locator('[data-panel="before"]');
    const after = comparison.locator('[data-panel="after"]');
    assert.equal(await before.getAttribute("aria-hidden"), "false");
    assert.equal(await after.getAttribute("aria-hidden"), "true");
    await comparison.locator("[data-panel] img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    const height = (await comparison.boundingBox()).height;
    await comparison.locator('button[data-view="after"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await after.getAttribute("aria-hidden"), "false");
    assert.equal(await before.evaluate((node) => node.inert), true);
    assert.equal((await comparison.boundingBox()).height, height, "Switching screenshots must not move the following paragraph");
    for (const panel of [before, after]) {
      const imagePath = await panel.locator("img").getAttribute("src");
      assert.ok(markdown.includes(new URL(imagePath, canonical).href), "Every comparison image must survive Markdown export");
      const captionParts = await panel.locator("figcaption").evaluateAll((captions) =>
        captions.flatMap((caption) => {
          const walker = document.createTreeWalker(caption, NodeFilter.SHOW_TEXT);
          const parts = [];
          while (walker.nextNode()) {
            const text = walker.currentNode.textContent.replace(/\s+/g, " ").trim();
            if (text) parts.push(text);
          }
          return parts;
        })
      );
      for (const text of captionParts) {
        assert.ok(markdown.replace(/\s+/g, " ").includes(text), "Comparison captions must survive Markdown export");
      }
    }
    const screenshotLink = after.locator("a:has(img)");
    await screenshotLink.waitFor({ state: "visible" });
    await screenshotLink.focus();
    const articleUrl = page.url();
    const readingPosition = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("Enter");
    const viewer = comparison.getByRole("dialog", { name: "Screenshot viewer" });
    await viewer.waitFor({ state: "visible" });
    assert.equal(page.url(), articleUrl, "Enlarging a screenshot must not navigate away");
    assert.equal(await viewer.locator("img").getAttribute("alt"), await after.locator("img").getAttribute("alt"));
    assert.ok(await viewer.getByRole("button", { name: "Close screenshot" }).evaluate((button) => document.activeElement === button));
    const stage = viewer.getByRole("region", { name: "Screenshot; scroll to explore at actual size" });
    const fit = viewer.getByRole("button", { name: "Fit", exact: true });
    const actualSize = viewer.getByRole("button", { name: "Actual size", exact: true });
    assert.equal(await fit.getAttribute("aria-pressed"), "true");
    await actualSize.click();
    assert.equal(await actualSize.getAttribute("aria-pressed"), "true");
    await viewer.locator("img").evaluate((image) => image.decode());
    assert.equal(
      await viewer.locator("img").evaluate((image) => image.getBoundingClientRect().width),
      await viewer.locator("img").evaluate((image) => image.naturalWidth),
      "Actual size displays the image at intrinsic width"
    );
    if (viewport.width === 320) {
      assert.ok(await stage.evaluate((node) => node.scrollWidth > node.clientWidth), "Actual-size screenshots can be explored on mobile");
      await stage.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector("dialog[open] .blog-image-dialog-stage").scrollLeft > 0);
    }
    await fit.click();
    assert.equal(await fit.getAttribute("aria-pressed"), "true");
    assert.ok(await stage.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "Fit restores a screenshot contained within the dialog");
    await actualSize.click();
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    assert.ok(await screenshotLink.evaluate((link) => document.activeElement === link), "Closing must restore keyboard focus");
    assert.equal(await page.evaluate(() => window.scrollY), readingPosition, "Closing must preserve reading position");
    const captionLink = after.locator('figcaption a[aria-haspopup="dialog"]').first();
    if (await captionLink.count()) {
      await captionLink.click();
      await viewer.waitFor({ state: "visible" });
      assert.equal(await fit.getAttribute("aria-pressed"), "true", "Reopening a screenshot resets its zoom");
      await viewer.getByRole("button", { name: "Close screenshot" }).click();
      await viewer.waitFor({ state: "hidden" });
      assert.equal(page.url(), articleUrl);
    }
    await comparison.locator('button[data-view="before"]').click();
  }
  if (await page.locator(".site-architecture").count()) {
    await page.locator(".site-architecture").getByRole("button", { name: "Before · Jekyll" }).click();
    await page.locator(".architecture-steps").getByText("GitHub Pages", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Now · Astro" }).click();
    await page.locator(".architecture-steps").getByText("Cloudflare Pages", { exact: true }).waitFor();
  }
  if (await page.getByRole("button", { name: "Copy code", exact: true }).count()) {
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard denied for verification");
          },
        },
      })
    );
    const copy = page.getByRole("button", { name: "Copy code", exact: true }).first();
    await copy.click();
    await page.getByText("Could not copy code", { exact: true }).waitFor();
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            globalThis.__blogCopiedText = text;
          },
        },
      })
    );
    const codeWidth = (await copy.boundingBox()).width;
    await copy.click();
    await page.getByText("Code copied", { exact: true }).waitFor();
    assert.ok((await page.evaluate(() => globalThis.__blogCopiedText)).length > 0);
    assert.equal((await copy.boundingBox()).width, codeWidth, "Code copy states must preserve width");
  }
  const reference = page.locator(".blog-body a[data-footnote-ref]").first();
  if (await reference.count()) {
    await reference.scrollIntoViewIfNeeded();
    if (viewport.width !== 320) {
      await page.locator(".blog-reference").waitFor();
      const beforeReference = await page.evaluate(() => scrollY);
      await reference.focus();
      await page.keyboard.press("Enter");
      const panel = page.getByRole("region", { name: /^Reference / });
      await panel.waitFor();
      assert.equal(await panel.evaluate((el) => el === document.activeElement), true, "Opening a reference transfers keyboard focus");
      assert.ok(Math.abs((await page.evaluate(() => scrollY)) - beforeReference) < 2, "Opening a reference must preserve the reading position");
      const panelBounds = await panel.boundingBox();
      const contentsBounds = await page.locator(".blog-toc-sticky").boundingBox();
      assert.ok(panelBounds.y >= contentsBounds.y + contentsBounds.height, "Reference must not cover the contents");
      assert.ok(panelBounds.y + panelBounds.height <= viewport.height, "Reference stays inside the viewport");
      const sourceId = (await reference.getAttribute("href")).slice(1);
      const sourceLinks = await page
        .locator(`[id="${sourceId}"] a:not([data-footnote-backref])`)
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      const panelLinks = await panel.locator(".blog-reference-content a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      assert.deepEqual(panelLinks, sourceLinks, "Reference preserves its source links when present");
      await page.setViewportSize({ width: viewport.width, height: 600 });
      const compactPanel = await panel.boundingBox();
      const compactContents = await page.locator(".blog-toc-sticky").boundingBox();
      assert.ok(compactPanel.y >= compactContents.y + compactContents.height, "Short windows must keep reference and TOC separate");
      assert.ok(compactPanel.y + compactPanel.height <= 600, "Reference remains reachable in a short window");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.keyboard.press("Escape");
      assert.equal(await panel.count(), 0);
      assert.equal(await reference.evaluate((el) => el === document.activeElement), true, "Closing returns focus to the citation");
    } else {
      await reference.click();
      const target = await reference.getAttribute("href");
      await page.waitForFunction((hash) => location.hash === hash, target);
      assert.equal(await page.locator(".blog-reference").count(), 0, "Narrow screens use native endnotes");
    }
  }
  const toc = viewport.width === 320 ? page.locator(".blog-toc-mobile") : page.locator(".blog-toc-rail");
  if (viewport.width === 320 && (await page.locator(".blog-toc-mobile button").count())) await page.locator(".blog-toc-mobile button").click();
  const link = toc.locator('a[href^="#"]').first();
  if (await link.count()) {
    const hash = await link.getAttribute("href");
    await link.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((hash) => location.hash === hash, hash);
    const headingTop = await page.locator(hash).evaluate((element) => element.getBoundingClientRect().top);
    assert.ok(headingTop >= 70 && headingTop < 200, "TOC must bring the section heading into view below the mobile navigation.");
    if (viewport.width === 320) assert.equal(await page.locator(".blog-toc-mobile button").getAttribute("aria-expanded"), "false");
  }
  assert.ok(await page.locator(".blog-heading").evaluate((element) => parseFloat(getComputedStyle(element).animationDuration) < 0.001));
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

async function saveScreenshot(page, scenario) {
  await mkdir(screenshotDirectory, { recursive: true });
  const filename = `${scenario.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}.png`;
  const path = join(screenshotDirectory, filename);
  await page.screenshot({ path, fullPage: true });
  console.log(`Screenshot: ${path}`);
}

async function auditPage(page, scenario, checkOverflow, failures, forbidOverflowConcealment = checkOverflow) {
  const failureCount = failures.length;
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length > 0) {
    failures.push({ kind: "axe", scenario, violations: results.violations });
  }

  const cspViolations = await page.evaluate(() => globalThis.__cspViolations ?? []);
  if (cspViolations.length > 0) {
    failures.push({ kind: "csp", scenario, violations: cspViolations });
  }

  if (checkOverflow) {
    const overflow = await page.evaluate(() => {
      const bodyStyle = document.body ? getComputedStyle(document.body) : undefined;
      const documentStyle = getComputedStyle(document.documentElement);

      return {
        bodyOverflowX: bodyStyle?.overflowX ?? "",
        bodyScrollWidth: document.body?.scrollWidth ?? 0,
        documentOverflowX: documentStyle.overflowX,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    const concealsHorizontalOverflow =
      forbidOverflowConcealment && [overflow.bodyOverflowX, overflow.documentOverflowX].some((value) => value === "hidden" || value === "clip");

    if (overflow.documentScrollWidth > overflow.viewportWidth || overflow.bodyScrollWidth > overflow.viewportWidth || concealsHorizontalOverflow) {
      failures.push({ kind: "overflow", scenario, ...overflow });
    }
  }
  if (options.screenshots || failures.length > failureCount) await saveScreenshot(page, scenario);
}

async function openClipboardScenario(browser, baseUrl, mode) {
  const context = await browser.newContext({ colorScheme: options.theme, viewport: viewports[0] });
  const page = await preparePage(context);

  await page.addInitScript((copyMode) => {
    let calls = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text) => {
          calls += 1;
          globalThis.__clipboardText = text;

          if (copyMode === "stalled") {
            return calls === 1 ? new Promise((resolve) => (globalThis.__resolveClipboard = resolve)) : Promise.resolve();
          }

          if (copyMode === "delayed-success") {
            return new Promise((resolve) => window.setTimeout(resolve, 250));
          }

          if (copyMode === "immediate-rejection") {
            return Promise.reject(new Error("Clipboard rejected immediately."));
          }

          if (copyMode === "delayed-rejection") {
            return new Promise((_resolve, reject) => window.setTimeout(() => reject(new Error("Clipboard rejected later.")), 180));
          }

          if (copyMode === "rapid-retry") {
            return calls === 1
              ? new Promise((_resolve, reject) => window.setTimeout(() => reject(new Error("Stale clipboard rejection.")), 180))
              : new Promise((resolve) => window.setTimeout(resolve, 20));
          }

          throw new Error(`Unknown clipboard test mode: ${copyMode}`);
        },
      },
    });
  }, mode);

  await loadRoute(page, baseUrl, "/notes/");
  await page.evaluate(() => {
    const status = document.querySelector(".notes-page-actions [role='status']");
    globalThis.__copyStatusHistory = [status?.textContent ?? ""];
    new MutationObserver(() => globalThis.__copyStatusHistory.push(status?.textContent ?? "")).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });

  return {
    button: page.locator(".notes-page-actions > button").first(),
    close: async () => context.close(),
    page,
    status: page.locator(".notes-page-actions [role='status']"),
  };
}

async function copyStatusHistory(page) {
  return page.evaluate(() => globalThis.__copyStatusHistory ?? []);
}

function compactStatusHistory(history) {
  return history.filter((status, index) => index === 0 || status !== history[index - 1]);
}

async function checkClipboardInteractions(browser, baseUrl) {
  {
    const scenario = await openClipboardScenario(browser, baseUrl, "delayed-success");
    try {
      await scenario.button.click();
      assert.equal(await scenario.button.innerText(), "Copying…", "Clipboard success must remain pending until writeText resolves.");
      assert.equal(await scenario.status.innerText(), "Copying Markdown.");
      await scenario.page.waitForFunction(
        () => document.querySelector(".notes-page-actions [role='status']")?.textContent === "Markdown copied to the clipboard."
      );
      assert.equal(await scenario.button.innerText(), "Copied");
      await scenario.page.waitForTimeout(1_850);
      assert.equal(await scenario.button.innerText(), "Copied", "The reset timer must start after clipboard settlement, not after the click.");
      await scenario.page.waitForFunction(() => document.querySelector(".notes-page-actions > button")?.textContent?.trim() === "Copy Markdown");
      assert.deepEqual(compactStatusHistory(await copyStatusHistory(scenario.page)), [
        "",
        "Copying Markdown.",
        "Markdown copied to the clipboard.",
        "",
      ]);
    } finally {
      await scenario.close();
    }
  }

  for (const mode of ["immediate-rejection", "delayed-rejection"]) {
    const scenario = await openClipboardScenario(browser, baseUrl, mode);
    try {
      await scenario.button.click();
      if (mode === "delayed-rejection") {
        assert.equal(await scenario.button.innerText(), "Copying…", "A delayed rejection must remain pending before it settles.");
        await scenario.page.waitForTimeout(80);
        assert.equal(await scenario.button.innerText(), "Copying…");
      }

      await scenario.page.waitForFunction(
        () =>
          document.querySelector(".notes-page-actions [role='status']")?.textContent ===
          "Markdown could not be copied. Use Download Markdown instead."
      );
      assert.equal(await scenario.button.innerText(), "Try again");
      assert.ok(!(await copyStatusHistory(scenario.page)).includes("Markdown copied to the clipboard."), `${mode} announced a false success.`);
    } finally {
      await scenario.close();
    }
  }

  {
    const scenario = await openClipboardScenario(browser, baseUrl, "rapid-retry");
    try {
      await scenario.button.click();
      await scenario.page.waitForTimeout(10);
      await scenario.button.click();
      await scenario.page.waitForFunction(
        () => document.querySelector(".notes-page-actions [role='status']")?.textContent === "Markdown copied to the clipboard."
      );
      await scenario.page.waitForTimeout(220);
      assert.equal(await scenario.button.innerText(), "Copied", "A stale rejection overwrote the successful retry.");
      assert.ok(
        !(await copyStatusHistory(scenario.page)).includes("Markdown could not be copied. Use Download Markdown instead."),
        "A stale rapid-retry rejection was announced."
      );
    } finally {
      await scenario.close();
    }
  }

  {
    const scenario = await openClipboardScenario(browser, baseUrl, "stalled");
    try {
      await scenario.page.clock.install();
      await scenario.button.click();
      await scenario.page.clock.runFor(7_000);
      assert.equal(await scenario.button.innerText(), "Copying…", "The clipboard should remain pending before its deadline.");
      await scenario.page.clock.runFor(1_100);
      await scenario.page.getByRole("link", { name: "Download Markdown", exact: true }).waitFor({ state: "visible" });
      assert.equal(await scenario.button.getAttribute("aria-busy"), "false");
      await scenario.page.clock.runFor(2_100);
      await scenario.page.evaluate(() => globalThis.__resolveClipboard());
      assert.equal(await scenario.button.innerText(), "Try again", "A late clipboard completion replaced the recovery state.");
      assert.ok(
        !(await copyStatusHistory(scenario.page)).includes("Markdown copied to the clipboard."),
        "A timed-out write announced a false success."
      );
      const recovery = scenario.page.getByRole("link", { name: "Download Markdown", exact: true });
      const downloadPromise = scenario.page.waitForEvent("download");
      await recovery.click();
      const download = await downloadPromise;
      assert.equal(await readFile(await download.path(), "utf8"), await scenario.page.evaluate(() => globalThis.__clipboardText));
      await scenario.button.click();
      await scenario.page.waitForFunction(
        () => document.querySelector(".notes-page-actions [role='status']")?.textContent === "Markdown copied to the clipboard."
      );
      assert.equal(await recovery.count(), 0, "A successful retry should clear the recovery link.");
    } finally {
      await scenario.close();
    }
  }
}

async function checkSearchFailureRecovery(browser, baseUrl, failure) {
  const context = await browser.newContext({ colorScheme: options.theme, viewport: viewports[1] });
  const page = await preparePage(context);
  let requests = 0;

  await page.route(failure === "index" ? "**/notes/api/search.json" : "**/NotesSearchDialog.*.js", async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });

  try {
    await loadRoute(page, baseUrl, "/notes/");
    await page.locator("button[data-search]:visible, button[data-search-full]:visible").first().click();
    if (failure === "index") await page.getByPlaceholder("Search").fill("course");
    await page.getByRole("heading", { name: "Search unavailable" }).waitFor({ state: "visible" });

    assert.equal(await page.locator("#notes-content .notes-page-heading h1").isVisible(), true, "The Notes document unmounted after search failed.");
    assert.equal(
      await page.locator("#notes-content .notes-context-nav a[href='/']").isVisible(),
      true,
      "Notes navigation unmounted after search failed."
    );
    assert.equal(
      await page.locator("#notes-content .notes-page-actions > button").first().isVisible(),
      true,
      "Notes page actions unmounted after search failed."
    );
    assert.equal((await new AxeBuilder({ page }).analyze()).violations.length, 0, "The local search-failure fallback has accessibility violations.");

    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.getByRole("button", { name: "Retry search" }).click()]);

    await page.locator("button[data-search]:visible, button[data-search-full]:visible").first().click();
    const searchInput = page.getByPlaceholder("Search");
    await searchInput.waitFor({ state: "visible" });
    await searchInput.fill("course");
    await page.locator('[role="dialog"]:visible').getByText("Course notes", { exact: true }).waitFor({ state: "visible" });
    assert.ok(requests >= 2, `Retry did not request the failed search ${failure} again.`);
    assert.equal(await page.locator("#notes-content .notes-page-heading h1").isVisible(), true);
  } finally {
    await context.close();
  }
}

async function checkNotesTocPopover(browser, baseUrl) {
  const context = await browser.newContext({ colorScheme: options.theme, viewport: { width: 320, height: 480 } });
  const page = await preparePage(context);
  const route = includesRoute("/notes/qa-notes-toc/") ? "/notes/qa-notes-toc/" : "/notes/";

  try {
    await loadRoute(page, baseUrl, route);
    const details = page.locator('nav[aria-label="On this page"] details');
    const summary = details.locator("summary");
    await summary.click();
    assert.equal(await details.evaluate((element) => element.open), true, "The mobile Notes table of contents did not open.");

    const panel = details.locator(":scope > div");
    const bounds = await panel.boundingBox();
    assert.ok(bounds.y + bounds.height <= 480, "The Notes contents panel extends below the viewport.");
    const lastLink = details.getByRole("link").last();
    await lastLink.focus();
    if (route === "/notes/qa-notes-toc/") {
      assert.ok((await details.getByRole("link").count()) >= 20, "The long Notes fixture must exercise scrolling.");
      assert.ok(await panel.evaluate((element) => element.scrollTop > 0 && element.scrollHeight > element.clientHeight));
    }
    await page.keyboard.press("Escape");
    assert.equal(await details.evaluate((element) => element.open), false, "Escape did not close the mobile Notes table of contents.");
    assert.equal(await summary.evaluate((element) => document.activeElement === element), true, "Escape did not restore contents-summary focus.");
    await summary.click();
    const href = await lastLink.getAttribute("href");
    await lastLink.click();
    await page.waitForFunction((hash) => window.location.hash === hash, href);
    assert.equal(await details.evaluate((element) => element.open), false, "The mobile Notes table of contents stayed open after navigation.");
  } finally {
    await context.close();
  }
}

async function checkLightboxKeyboard(browser, baseUrl) {
  const context = await browser.newContext({ colorScheme: options.theme, viewport: viewports[0] });
  const page = await preparePage(context);

  try {
    await loadRoute(page, baseUrl, "/volunteering/hacktoberfest-lahore-2025/");
    const trigger = page.locator("[data-gallery-trigger]").first();
    const dialog = page.locator("[data-workshop-lightbox]");
    const status = dialog.locator("[data-lightbox-status]");
    await trigger.click();
    await dialog.waitFor({ state: "visible" });

    assert.match(await status.innerText(), /^Photo 1 of 11: Mahad addresses the auditorium/);
    assert.equal(await dialog.locator("[aria-live]").count(), 1, "The lightbox should expose one live announcement, without redundant speech.");
    assert.equal(await dialog.locator("[data-lightbox-count]").getAttribute("aria-hidden"), "true");
    assert.equal(await dialog.locator("[data-lightbox-caption]").innerText(), "Speaking session and audience engagement");
    assert.equal(
      await page.evaluate(() => document.activeElement?.hasAttribute("data-lightbox-close")),
      true,
      "The lightbox did not focus its close button."
    );

    await page.keyboard.press("ArrowLeft");
    assert.match(await status.innerText(), /^Photo 11 of 11: Mahad and a presenter hold an open Hacktoberfest award case/);
    await page.keyboard.press("ArrowRight");
    assert.match(await status.innerText(), /^Photo 1 of 11: Mahad addresses the auditorium/);
    await page.keyboard.press("End");
    assert.match(await status.innerText(), /^Photo 11 of 11:/);
    await page.keyboard.press("Home");
    assert.match(await status.innerText(), /^Photo 1 of 11:/);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      await trigger.evaluate((element) => element === document.activeElement),
      true,
      "Closing the lightbox did not restore trigger focus."
    );
  } finally {
    await context.close();
  }
}

function reportFailures(failures) {
  for (const failure of failures) {
    console.error(`\n${failure.scenario}`);

    if (failure.kind === "axe") {
      for (const violation of failure.violations) {
        console.error(`  ${violation.impact ?? "unknown"}: ${violation.id} - ${violation.help}`);
        for (const node of violation.nodes) console.error(`    ${node.target.join(" ")}`);
      }
    }

    if (failure.kind === "csp") {
      for (const violation of failure.violations) {
        const source = violation.sourceFile ? ` at ${violation.sourceFile}:${violation.lineNumber}` : "";
        console.error(`  ${violation.effectiveDirective} blocked ${violation.blockedURI || "inline content"}${source}`);
      }
    }

    if (failure.kind === "overflow") {
      console.error(
        `  horizontal overflow: viewport=${failure.viewportWidth}px document=${failure.documentScrollWidth}px body=${failure.bodyScrollWidth}px document-overflow-x=${failure.documentOverflowX} body-overflow-x=${failure.bodyOverflowX}`
      );
    }
  }
}

await new Promise((resolveListening, rejectListening) => {
  server.once("error", rejectListening);
  server.listen(0, "127.0.0.1", resolveListening);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Accessibility server failed to start.");

let browser;
try {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (process.platform !== "darwin") throw error;
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const failures = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ colorScheme: options.theme, viewport });

    try {
      for (const route of selectedRoutes) {
        const page = await preparePage(context);
        const scenario = formatScenario(route, viewport);

        try {
          await loadRoute(page, baseUrl, route);
          await auditPage(page, scenario, viewport.width === 320, failures);
          await checkSharedHeader(page, viewport);
          await checkBlogFilters(page, baseUrl);
          await checkBlogReading(page, viewport);
        } catch (error) {
          await saveScreenshot(page, scenario);
          throw new Error(`Failed ${scenario}`, { cause: error });
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  }

  for (const viewport of viewports) {
    const context = await browser.newContext({ colorScheme: options.theme, viewport });

    try {
      for (const stateCheck of stateChecks) {
        if (!includesRoute(stateCheck.route)) continue;
        const page = await preparePage(context);
        const scenario = formatScenario(stateCheck.route, viewport, stateCheck.label);

        try {
          await loadRoute(page, baseUrl, stateCheck.route);
          await stateCheck.open(page);
          await auditPage(page, scenario, viewport.width === 320, failures, false);
        } catch (error) {
          await saveScreenshot(page, scenario);
          throw new Error(`Failed ${scenario}`, { cause: error });
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  }

  if (failures.length > 0) {
    reportFailures(failures);
    throw new Error(`Accessibility, CSP, or overflow checks failed in ${failures.length} scenario(s).`);
  }

  if (includesRoute("/notes/")) {
    await checkClipboardInteractions(browser, baseUrl);
    await checkSearchFailureRecovery(browser, baseUrl, "chunk");
    await checkSearchFailureRecovery(browser, baseUrl, "index");
    await checkNotesTocPopover(browser, baseUrl);
  }
  if (includesRoute("/")) await checkLandscapeNavigation(browser, baseUrl);
  if (includesRoute("/volunteering/hacktoberfest-lahore-2025/")) await checkLightboxKeyboard(browser, baseUrl);

  console.log(
    `Accessibility, CSP, and overflow checks passed for ${selectedRoutes.length} generated pages (${options.theme}) at desktop and 320px, plus applicable interaction regressions.`
  );
} finally {
  await browser?.close();
  await new Promise((resolveClosed, rejectClosed) => server.close((error) => (error ? rejectClosed(error) : resolveClosed())));
}
