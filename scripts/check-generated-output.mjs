import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");
const publicDirectory = path.join(projectRoot, "public");
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
  const image = metaContent(html, "og:image");

  assert.equal(image, expectedImage, `${label} has the wrong og:image.`);

  const imageUrl = new URL(image);
  assert.equal(imageUrl.origin, siteOrigin, `${label} uses an OG image outside the canonical site.`);

  const assetPath = path.resolve(publicDirectory, `.${decodeURIComponent(imageUrl.pathname)}`);
  const assetRelativePath = path.relative(publicDirectory, assetPath);
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
  const imagePaths = await listFiles(publicDirectory);

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

const defaultImage = "https://www.mmahad.com/images/mahad-profile-960.jpg";

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

await assertPrivateDataStaysServerSide();
await assertPublicImagesHaveNoPrivateMetadata();

console.log("Generated metadata matches public assets, keeps private configuration server-side, and publishes no image-identifying metadata.");
