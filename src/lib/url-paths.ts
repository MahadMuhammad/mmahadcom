import type { Node, Root } from "fumadocs-core/page-tree";

export function withTrailingSlash(url: string): string {
  if (!url.startsWith("/")) return url;

  const suffixIndex = url.search(/[?#]/);
  const pathname = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : url.slice(suffixIndex);
  const finalSegment = pathname.split("/").at(-1) ?? "";

  if (pathname === "/" || pathname.endsWith("/") || finalSegment.includes(".")) {
    return url;
  }

  return `${pathname}/${suffix}`;
}

export function withTrailingSlashPageTree(tree: Root): Root {
  return {
    ...tree,
    children: tree.children.map(withTrailingSlashNode),
    fallback: tree.fallback ? withTrailingSlashPageTree(tree.fallback) : undefined,
  };
}

function withTrailingSlashNode(node: Node): Node {
  if (node.type === "page") {
    return { ...node, url: withTrailingSlash(node.url) };
  }

  if (node.type === "folder") {
    return {
      ...node,
      index: node.index ? { ...node.index, url: withTrailingSlash(node.index.url) } : undefined,
      children: node.children.map(withTrailingSlashNode),
    };
  }

  return node;
}
