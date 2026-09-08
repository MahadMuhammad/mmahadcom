import type { AstroProviderProps } from "fumadocs-core/framework/astro";
import type { Root } from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";
import { navigate } from "astro:transitions/client";
import { NotesPageActions } from "./NotesPageActions";
import { NotesSearchBoundary } from "./NotesSearchBoundary";

interface NotesDocsProps {
  tree: Root;
  navTitle: string;
  pathname: string;
  params: AstroProviderProps["params"];
  title: string;
  description?: string;
  toc: TOCItemType[];
  markdownUrl: string;
  markdownContent: string;
  githubUrl?: string;
  pageType: "index" | "note";
  children: ReactNode;
}

function NotesTocPopover({ items }: { items: TOCItemType[] }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className="sticky top-(--fd-docs-row-2) z-10 h-(--fd-toc-popover-height) border-b bg-fd-background/95 backdrop-blur-sm [grid-area:toc-popover] max-xl:layout:[--fd-toc-popover-height:--spacing(10)] xl:hidden"
    >
      <details
        className="group relative"
        onKeyDown={(event) => {
          if (event.key === "Escape" && event.currentTarget.open) {
            event.preventDefault();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-4 text-sm text-fd-muted-foreground md:px-6 [&::-webkit-details-marker]:hidden">
          On this page <span aria-hidden="true">⌄</span>
        </summary>
        <div
          className="absolute inset-x-0 top-full overflow-y-auto overscroll-contain border-b bg-fd-background p-3 shadow-lg"
          style={{ maxHeight: "calc(100dvh - var(--fd-docs-row-2, 0px) - 3.5rem)" }}
        >
          <ul className="grid gap-1 text-sm">
            {items.map((item) => (
              <li key={item.url}>
                <a
                  className="block rounded-md px-3 py-2 hover:bg-fd-accent hover:text-fd-accent-foreground"
                  href={item.url}
                  onClick={(event) => {
                    const details = event.currentTarget.closest("details") as HTMLDetailsElement | null;
                    if (details) details.open = false;
                  }}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </nav>
  );
}

export function NotesDocs({
  tree,
  navTitle,
  pathname,
  params,
  title,
  description,
  toc,
  markdownUrl,
  markdownContent,
  githubUrl,
  pageType,
  children,
}: NotesDocsProps) {
  return (
    <RootProvider
      pathname={pathname}
      params={params}
      navigate={navigate}
      theme={{
        storageKey: "mahad-theme",
        defaultTheme: "system",
        enableSystem: true,
        disableTransitionOnChange: true,
      }}
      search={{ SearchDialog: NotesSearchBoundary, preload: false }}
    >
      <DocsLayout tree={tree} nav={{ title: navTitle, url: "/" }}>
        <DocsPage
          toc={toc}
          tableOfContent={{ container: { role: "navigation", "aria-labelledby": "toc-title" } }}
          tableOfContentPopover={{ component: <NotesTocPopover items={toc} /> }}
          id="notes-content"
          tabIndex={-1}
          className={pageType === "index" ? "notes-index-page" : undefined}
        >
          <nav className="notes-context-nav" aria-label="Writing navigation">
            <a href="/">← Portfolio</a>
            <a href="/blog/">Blog</a>
            <a href="/notes/" aria-current="page">
              Notes
            </a>
          </nav>
          <header className="notes-page-header">
            <div className="notes-page-heading">
              <DocsTitle>{title}</DocsTitle>
              {description && <DocsDescription>{description}</DocsDescription>}
            </div>
            <NotesPageActions markdownContent={markdownContent} markdownUrl={markdownUrl} githubUrl={githubUrl} />
          </header>
          <DocsBody className="notes-docs-body w-full max-w-[68ch]">{children}</DocsBody>
        </DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}
