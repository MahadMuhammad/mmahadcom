import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

const images = import.meta.glob<ImageMetadata>(["../assets/**/*.{jpg,jpeg,png,webp}", "!../assets/**/*-{480,640,960,1280}.*"], {
  eager: true,
  import: "default",
});

export function getSourceImage(path: string) {
  const src = images[`../assets${path}`];
  if (!src) throw new Error(`Missing source image: ${path}`);
  return src;
}

export function getResponsiveImage(path: string, widths?: number[]) {
  const src = getSourceImage(path);
  const candidates = [...new Set((widths ?? [480, 640, 960, 1280, 1920, src.width]).map((width) => Math.min(width, src.width)))].sort(
    (a, b) => a - b
  );
  return getImage({
    src,
    width: Math.min(1280, candidates.at(-1)!),
    widths: candidates,
    format: "webp",
    quality: 90,
  });
}
