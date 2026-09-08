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

export function getResponsiveImage(path: string) {
  const src = getSourceImage(path);
  return getImage({
    src,
    width: Math.min(1280, src.width),
    widths: [...new Set([480, 640, 960, 1280, 1920].filter((width) => width < src.width).concat(src.width))],
    format: "webp",
    quality: 90,
  });
}
