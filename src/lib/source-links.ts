import { site } from "../data/site";

export function getRepositoryUrl(): string | undefined {
  return import.meta.env.DEV || site.sourceRepositoryPublic ? site.sourceRepositoryUrl : undefined;
}

export function getContentSourceUrl(entry: { filePath?: string }): string | undefined {
  const repositoryUrl = getRepositoryUrl();
  const filePath = entry.filePath?.replaceAll("\\", "/");
  if (!repositoryUrl || !filePath) return undefined;

  const contentRoot = "src/content/";
  const position = filePath.lastIndexOf(contentRoot);
  if (position < 0) return undefined;
  const segments = filePath.slice(position).split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return undefined;

  return `${repositoryUrl}/blob/${encodeURIComponent(site.sourceRepositoryBranch)}/${segments.map(encodeURIComponent).join("/")}`;
}
