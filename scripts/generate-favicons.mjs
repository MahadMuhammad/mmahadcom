/**
 * Mahad favicon export tool. Run from a repository with the existing sharp dependency:
 *   node scripts/generate-favicons.mjs
 * Sources: design/favicon/circle.svg (selected badge), mark.json (four-path geometry and standalone variants).
 * No network requests, browser JavaScript, font files, or extra dependencies.
 * Writes only the explicitly listed generated files under public/ and previews/.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "public");
const brand = path.join(out, "brand");
const preview = path.join(root, "previews");
const spec = JSON.parse(await readFile(path.join(root, "design/favicon/mark.json"), "utf8"));

if (
  JSON.stringify(spec.viewBox) !== "[0,0,32,32]" ||
  !Array.isArray(spec.paths) ||
  spec.paths.length !== 4 ||
  ![spec.strokeWidth, spec.faviconStrokeWidth].every((x) => typeof x === "number" && x > 0 && x < 5) ||
  !spec.paths.every((d) => typeof d === "string" && /^[MC0-9.,\s-]+$/.test(d)) ||
  !Object.values(spec.colors).every((c) => /^#[0-9a-f]{6}$/i.test(c))
) {
  throw new Error("Invalid mark.json: expected the documented four-path, 32-unit mark.");
}
for (const directory of [out, brand, preview]) await mkdir(directory, { recursive: true });

function svg(color, width = spec.strokeWidth, adaptive = false) {
  const style = adaptive ? `<style>@media(prefers-color-scheme:dark){.mark{stroke:${spec.colors.darkSurface}}}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">${style}<g class="mark" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${spec.paths.map((d) => `<path d="${d}"/>`).join("")}</g></svg>\n`;
}

async function png(svgText, size) {
  // Render each target directly from vectors at 4x, then reduce with Lanczos3.
  // Avoid resizing a screenshot or repeatedly reducing an already small bitmap.
  const high = await sharp(Buffer.from(svgText), { density: ((72 * size) / 32) * 4 })
    .resize(size * 4, size * 4)
    .png()
    .toBuffer();
  return sharp(high).resize(size, size, { kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9, palette: false }).toBuffer();
}

function icoFromPngs(entries) {
  // ICO directory + 32-bit RGBA PNG payloads. No ICO-specific dependency required.
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  for (const [index, { size, buffer }] of entries.entries()) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error("Invalid ICO frame size.");
    const p = 6 + index * 16;
    header[p] = size === 256 ? 0 : size;
    header[p + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(buffer.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...entries.map((x) => x.buffer)]);
}

const circle = await readFile(path.join(root, "design/favicon/circle.svg"), "utf8");
const primary = svg(spec.colors.primary);
const faviconLight = circle;
const faviconDark = circle;
const fallback = circle;
await writeFile(path.join(out, "favicon.svg"), circle);
await writeFile(path.join(brand, "mahad-circle.svg"), circle);
for (const [name, data] of [
  ["mahad-monogram.svg", primary],
  ["mahad-monogram-dark.svg", svg(spec.colors.darkSurface)],
  ["mahad-monogram-ink.svg", svg(spec.colors.ink)],
  ["mahad-monogram-white.svg", svg(spec.colors.reverse)],
])
  await writeFile(path.join(brand, name), data);
await writeFile(path.join(brand, "mahad-monogram-512.png"), await png(primary, 512));
// The selected black-and-white badge keeps the same contrast in static Substack and ICO exports.
await writeFile(path.join(brand, "mahad-substack-512.png"), await png(fallback, 512));
await writeFile(path.join(out, "favicon-96x96.png"), await png(fallback, 96));
const frames = [];
for (const size of [16, 32, 48]) {
  const buffer = await png(fallback, size);
  frames.push({ size, buffer });
  await writeFile(path.join(preview, `fallback-${size}.png`), buffer);
  await writeFile(path.join(preview, `light-${size}.png`), await png(faviconLight, size));
  await writeFile(path.join(preview, `dark-${size}.png`), await png(faviconDark, size));
}
await writeFile(path.join(out, "favicon.ico"), icoFromPngs(frames));
// Apple home-screen art is a separate opaque square. Do not use it as the browser favicon.
const touchMark = await png(circle, 156);
await sharp({ create: { width: 180, height: 180, channels: 3, background: spec.colors.touchBackground } })
  .composite([{ input: touchMark, left: 12, top: 12 }])
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(path.join(out, "apple-touch-icon.png"));
console.log("Generated favicon.svg, 16/32/48 ICO, 96px PNG, 180px touch icon, brand assets and previews.");
