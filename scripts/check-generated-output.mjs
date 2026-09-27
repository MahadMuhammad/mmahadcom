import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { parse } from "parse5";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");
assert.ok(!(await readdir(outputDirectory)).includes("drafts"), "Development draft previews must never appear in production dist.");
const siteOrigin = "https://www.mmahad.com";
const sourceRepository = JSON.parse(await readFile(new URL("../src/data/source-repository.json", import.meta.url), "utf8"));
const rasterImageExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);

function metaContent(html, property) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attributes = Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]]));

    if (attributes.property === property || attributes.name === property) return attributes.content;
  }

  return undefined;
}

async function assertOpenGraphMetadata(relativePath, expectedImage) {
  const outputPath = path.join(outputDirectory, relativePath);
  const html = await readFile(outputPath, "utf8");
  const label = path.relative(projectRoot, outputPath);
  const document = parse(html, {
    onParseError: ({ code }) => assert.notEqual(code, "duplicate-attribute", `${label} contains duplicate HTML attributes.`),
  });
  function checkImageLoading(node) {
    if (node.tagName === "img") {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      if (attrs.fetchpriority === "high") assert.notEqual(attrs.loading, "lazy", `${label} must load its high-priority image eagerly.`);
    }
    for (const child of node.childNodes ?? []) checkImageLoading(child);
  }
  checkImageLoading(document);
  const image = metaContent(html, "og:image");

  assert.equal(image, expectedImage, `${label} has the wrong og:image.`);

  const imageUrl = new URL(image);
  assert.equal(imageUrl.origin, siteOrigin, `${label} uses an OG image outside the canonical site.`);

  const assetPath = path.resolve(outputDirectory, `.${decodeURIComponent(imageUrl.pathname)}`);
  const assetRelativePath = path.relative(outputDirectory, assetPath);
  assert.ok(
    assetRelativePath && !assetRelativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(assetRelativePath),
    `${label} has an unsafe OG image path.`
  );

  const metadata = await sharp(assetPath).metadata();
  assert.ok(metadata.width && metadata.height, `${label}'s OG image has no readable dimensions.`);
  assert.equal(metaContent(html, "og:image:width"), String(metadata.width), `${label} has an og:image:width that does not match the image file.`);
  assert.equal(metaContent(html, "og:image:height"), String(metadata.height), `${label} has an og:image:height that does not match the image file.`);
}

async function listFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(entryPath)));
    else files.push(entryPath);
  }

  return files;
}

async function assertPrivateDataStaysServerSide() {
  if (sourceRepository.public) return;
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".txt", ".xml"]);

  for (const outputPath of await listFiles(outputDirectory)) {
    if (!textExtensions.has(path.extname(outputPath))) continue;

    const output = await readFile(outputPath, "utf8");
    assert.ok(!output.includes(sourceRepository.url), `${path.relative(projectRoot, outputPath)} exposes the private repository URL.`);
  }
}

function assertJpegHasNoPrivateMetadata(buffer, label) {
  assert.ok(buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8, `${label} is not a valid JPEG.`);

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    while (buffer[offset] === 0xff) offset += 1;

    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const lengthOffset = offset;
    const length = buffer.readUInt16BE(lengthOffset);
    assert.ok(length >= 2 && lengthOffset + length <= buffer.length, `${label} has an invalid JPEG segment.`);

    const payload = buffer.subarray(lengthOffset + 2, lengthOffset + length);
    const isExif = marker === 0xe1 && payload.subarray(0, 6).equals(Buffer.from("Exif\0\0"));
    const isXmp = marker === 0xe1 && payload.subarray(0, 35).toString("ascii").includes("http://ns.adobe.com/xap/1.0/");
    const isExtendedXmp = marker === 0xe1 && payload.subarray(0, 45).toString("ascii").includes("http://ns.adobe.com/xmp/extension/");
    const isPhotoshop = marker === 0xed;

    assert.ok(!(isExif || isXmp || isExtendedXmp || isPhotoshop), `${label} contains publishable camera, XMP, or IPTC metadata.`);
    offset = lengthOffset + length;
  }
}

function assertPngHasNoPrivateMetadata(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature), `${label} is not a valid PNG.`);

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    assert.ok(offset + length + 12 <= buffer.length, `${label} has an invalid PNG chunk.`);
    assert.notEqual(chunkType, "eXIf", `${label} contains publishable EXIF metadata.`);
    offset += length + 12;
    if (chunkType === "IEND") break;
  }
}

async function assertPublicImagesHaveNoPrivateMetadata() {
  const imagePaths = (await listFiles(outputDirectory)).filter((file) => rasterImageExtensions.has(path.extname(file).toLowerCase()));

  for (const imagePath of imagePaths) {
    const extension = path.extname(imagePath).toLowerCase();
    if (!rasterImageExtensions.has(extension)) continue;

    const image = await readFile(imagePath);
    const label = path.relative(projectRoot, imagePath);
    if (extension === ".png") assertPngHasNoPrivateMetadata(image, label);
    else if (extension === ".jpg" || extension === ".jpeg") assertJpegHasNoPrivateMetadata(image, label);

    const metadata = await sharp(image).metadata();
    for (const metadataType of ["exif", "iptc", "xmp"]) {
      assert.ok(!metadata[metadataType], `${label} exposes ${metadataType} metadata.`);
    }
  }
}

async function assertFaviconMetadata() {
  const expected = [
    { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
    { rel: "icon", href: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png", type: undefined, sizes: "180x180" },
  ];
  for (const outputPath of (await listFiles(outputDirectory)).filter((file) => file.endsWith(".html"))) {
    const document = parse(await readFile(outputPath, "utf8"));
    const head = document.childNodes.find((node) => node.tagName === "html")?.childNodes.find((node) => node.tagName === "head");
    assert.ok(head, `${outputPath} has no head.`);
    const elements = head.childNodes.map((node) => ({
      tag: node.tagName,
      ...Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value])),
    }));
    // Astro's static redirect documents do not use the site's layouts.
    if (elements.some((element) => element.tag === "meta" && element["http-equiv"]?.toLowerCase() === "refresh")) continue;
    const icons = elements.filter((element) => element.tag === "link" && element.rel?.includes("icon"));
    assert.deepEqual(
      icons.map(({ rel, href, type, sizes }) => ({ rel, href, type, sizes })),
      expected,
      `${path.relative(projectRoot, outputPath)} must contain exactly the shared favicon set.`
    );
  }
}

async function assertIconPng(input, size, transparent, label, edgeAlphaLimit = 16) {
  const metadata = await sharp(input).metadata();
  assert.equal(metadata.format, "png", `${label} must be PNG.`);
  assert.equal(metadata.width, size, `${label} has the wrong width.`);
  assert.equal(metadata.height, size, `${label} has the wrong height.`);
  if (transparent) assert.ok(metadata.hasAlpha, `${label} must retain alpha transparency.`);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * size + x) * info.channels + info.channels - 1];
  for (const [x, y] of [
    [0, 0],
    [size - 1, 0],
    [0, size - 1],
    [size - 1, size - 1],
  ]) {
    assert.equal(alphaAt(x, y), transparent ? 0 : 255, `${label} has the wrong corner transparency.`);
  }
  let visiblePixels = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = alphaAt(x, y);
      if (alpha > 16) visiblePixels++;
      if (!transparent) assert.equal(alpha, 255, `${label} must be fully opaque.`);
      else if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
        assert.ok(alpha <= edgeAlphaLimit, `${label} clips visible artwork at its canvas edge.`);
      }
    }
  }
  assert.ok(visiblePixels > 0, `${label} has no visible artwork.`);
}

async function assertFaviconAssets() {
  const svg = await readFile(path.join(outputDirectory, "favicon.svg"), "utf8");
  const mark = JSON.parse(await readFile(path.join(projectRoot, "design/favicon/mark.json"), "utf8"));
  assert.ok(Buffer.byteLength(svg) < 2048, "The favicon SVG must remain smaller than 2KB.");
  assert.match(svg, /viewBox="0 0 32 32"/);
  assert.equal((svg.match(/<path\b/g) ?? []).length, 4, "Preserve the four-stroke monogram.");
  assert.doesNotMatch(svg, /<(?:rect|image|script|filter|foreignObject|text|linearGradient|radialGradient)\b|(?:href|url\(|@import|font-)/i);
  const circleSource = await readFile(path.join(projectRoot, "design/favicon/circle.svg"), "utf8");
  assert.equal(svg, circleSource, "Export the selected circle without changing its geometry.");
  assert.equal(await readFile(path.join(outputDirectory, "brand/mahad-circle.svg"), "utf8"), circleSource);
  assert.match(svg, /<circle cx="16" cy="16" r="14\.5" fill="#171717" stroke="#fff" stroke-width="1"\/>/);
  assert.ok(svg.includes('transform="translate(4 3) scale(.75)"'));
  assert.ok(svg.includes('stroke="#fff" stroke-width="4"'));
  assert.deepEqual(
    [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]),
    mark.paths
  );
  const svgMetadata = await sharp(Buffer.from(svg)).metadata();
  assert.equal(svgMetadata.width, 32);
  assert.equal(svgMetadata.height, 32);

  const ico = await readFile(path.join(outputDirectory, "favicon.ico"));
  assert.ok(ico.length >= 54, "The favicon ICO directory is truncated.");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3, "The favicon ICO must have three frames.");
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset >= 54 && length > 0 && offset + length <= ico.length, `Invalid ${size}px ICO frame bounds.`);
    // At 16px the circle has half a pixel of clearance; antialiasing may cover half an edge pixel.
    await assertIconPng(ico.subarray(offset, offset + length), size, true, `favicon.ico ${size}px frame`, size === 16 ? 128 : 16);
  }
  for (const [name, size, transparent] of [
    ["favicon-96x96.png", 96, true],
    ["apple-touch-icon.png", 180, false],
    ["brand/mahad-monogram-512.png", 512, true],
    ["brand/mahad-substack-512.png", 512, true],
  ]) {
    await assertIconPng(path.join(outputDirectory, name), size, transparent, name);
  }
}

const defaultImage = "https://www.mmahad.com/images/mahad-profile.jpg";

for (const relativePath of [
  "404.html",
  "index.html",
  "blog/index.html",
  "contact/index.html",
  "education/index.html",
  "open-source/index.html",
  "teaching/index.html",
  "volunteering/index.html",
  "notes/index.html",
  "notes/courses/index.html",
  "notes/tags/index.html",
  "notes/topics/index.html",
]) {
  await assertOpenGraphMetadata(relativePath, defaultImage);
}

for (const [relativePath, expected] of [
  [
    "volunteering/open-source-connect-pakistan-2026/index.html",
    "https://www.mmahad.com/workshops/open-source-connect-pakistan-2026/open-source-connect-pakistan-community-group.jpeg",
  ],
  ["volunteering/hacktoberfest-lahore-2025/index.html", "https://www.mmahad.com/workshops/hacktoberfest-lahore-2025/whole-group-picture.jpg"],
  ["volunteering/gsoc-lgu-2025/index.html", "https://www.mmahad.com/workshops/gsoc-lgu-2025/full-group-picture.jpg"],
]) {
  await assertOpenGraphMetadata(relativePath, expected);
}

// Keep the third-party signup confined to the two explicitly selected entry points.
const signupPages = new Set(["index.html", "contact/index.html"]);
for (const file of (await listFiles(outputDirectory)).filter((file) => file.endsWith(".html"))) {
  const relativePath = path.relative(outputDirectory, file);
  const html = await readFile(file, "utf8");
  const document = parse(html);
  const frames = [];
  function collectFrames(node) {
    if (node.tagName === "iframe") frames.push(Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])));
    for (const child of node.childNodes ?? []) collectFrames(child);
  }
  collectFrames(document);
  const signupFrames = frames.filter((frame) => [frame.src, frame["data-src"]].some((url) => url?.includes("substack.com")));
  assert.equal(signupFrames.length, signupPages.has(relativePath) ? 1 : 0, `${relativePath}: unexpected newsletter placement.`);
  for (const frame of signupFrames) {
    assert.equal(frame.src, "https://mmahad.substack.com/embed?transparent=1");
    assert.ok(frame.title?.includes("Until It Makes Sense"), `${relativePath}: newsletter frame needs an accessible title.`);
    assert.ok(html.includes('href="https://mmahad.substack.com/subscribe"'), `${relativePath}: signup needs a direct fallback link.`);
  }
}
const generatedHeaders = await readFile(path.join(outputDirectory, "_headers"), "utf8");
assert.match(generatedHeaders, /frame-src https:\/\/mmahad\.substack\.com;/, "Only the selected publication may be embedded.");
assert.ok(generatedHeaders.includes("form-action 'self';"), "Embedding must not relax parent form submissions.");
assert.ok(generatedHeaders.includes("connect-src 'self';"), "Embedding must not relax parent network access.");

await assertFaviconMetadata();
await assertFaviconAssets();
await assertPrivateDataStaysServerSide();
await assertPublicImagesHaveNoPrivateMetadata();

console.log(
  "Generated metadata and transparent favicon assets are valid, private configuration stays server-side, and images contain no identifying metadata."
);
