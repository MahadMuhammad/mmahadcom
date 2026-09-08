import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [sourceDirectory, outputDirectory] = process.argv.slice(2);

if (!sourceDirectory || !outputDirectory) {
  throw new Error("Usage: node scripts/optimize-workshop-images.mjs <source-directory> <output-directory>");
}

const supportedExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);
const targetWidths = [640, 1280, 1920];
const sourceEntries = await readdir(sourceDirectory, { withFileTypes: true });
const sourceFiles = sourceEntries
  .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
  .toSorted((a, b) => a.name.localeCompare(b.name));

if (sourceFiles.length === 0) {
  throw new Error(`No supported images found in ${sourceDirectory}`);
}

await mkdir(outputDirectory, { recursive: true });

function encoder(image, extension) {
  if (extension === ".jpeg" || extension === ".jpg") {
    return image.jpeg({ quality: 84, mozjpeg: true });
  }

  if (extension === ".png") {
    return image.png({ compressionLevel: 9, palette: true });
  }

  return image.webp({ quality: 84, smartSubsample: true });
}

for (const entry of sourceFiles) {
  const sourcePath = path.join(sourceDirectory, entry.name);
  const extension = path.extname(entry.name).toLowerCase();
  const basename = path.basename(entry.name, extension);
  const metadata = await sharp(sourcePath).metadata();

  if (!metadata.width || metadata.width < targetWidths.at(-1)) {
    throw new Error(`${entry.name} must be at least ${targetWidths.at(-1)} pixels wide`);
  }

  for (const width of targetWidths) {
    const suffix = width === targetWidths.at(-1) ? "" : `-${width}`;
    const outputPath = path.join(outputDirectory, `${basename}${suffix}${extension}`);
    const pipeline = sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true });

    await encoder(pipeline, extension).toFile(outputPath);
  }

  console.log(`Optimized ${entry.name} at ${targetWidths.join(", ")}px`);
}
