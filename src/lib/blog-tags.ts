export const blogTagKey = (tag: string) => tag.trim().toLowerCase();

export function blogTagHref(tag: string) {
  return `/blog/?${new URLSearchParams({ tag: blogTagKey(tag) })}`;
}
