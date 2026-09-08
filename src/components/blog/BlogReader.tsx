import { navigate } from "astro:transitions/client";
import type { TOCItemType } from "fumadocs-core/toc";
import { TOCProvider } from "fumadocs-ui/components/toc";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";
import { LuArrowLeft, LuArrowUpRight, LuBookOpen, LuGithub, LuTag } from "react-icons/lu";

import { blogTagHref } from "../../lib/blog-tags";
import { BlogPostActions } from "./BlogPostActions";
import { BlogContents } from "./BlogContents";
import { useBlogReadingPreferences } from "./useBlogReadingPreferences";

interface Props {
  markdownContent?: string;
  markdownUrl?: string;
  canonicalUrl?: string;
  githubUrl?: string;
  title: string;
  description: string;
  pathname: string;
  article: boolean;
  toc?: TOCItemType[];
  date?: string;
  dateLabel?: string;
  updatedLabel?: string;
  readingMinutes?: number;
  tags?: string[];
  children: ReactNode;
}

export function BlogReader({
  title,
  markdownContent,
  markdownUrl,
  canonicalUrl,
  githubUrl,
  description,
  pathname,
  article,
  toc = [],
  date,
  dateLabel,
  updatedLabel,
  readingMinutes,
  tags = [],
  children,
}: Props) {
  const { serifText, largeText, updatePreferences } = useBlogReadingPreferences();
  return (
    <RootProvider pathname={pathname} navigate={navigate} search={{ enabled: false }} theme={{ enabled: false }}>
      <main>
        <TOCProvider toc={toc}>
          <article id="blog-content" tabIndex={-1} className={`blog-page ${article ? "blog-article" : "blog-index"}`}>
            <header className="blog-heading">
              <p className="blog-kicker">{article ? "From the notebook" : "Experiments & observations"}</p>
              <h1>{title}</h1>
              <p className="blog-deck">{description}</p>
              {article && (
                <div className="blog-metadata">
                  <p>
                    {date && dateLabel && (
                      <>
                        <time dateTime={date}>{dateLabel}</time>
                        <span aria-hidden="true"> / </span>
                      </>
                    )}
                    About {readingMinutes} min read{updatedLabel && <> / Updated {updatedLabel}</>}
                  </p>
                  <div className="blog-reading-options" role="group" aria-label="Reading preferences">
                    <fieldset className="blog-size-options">
                      <legend className="sr-only">Text size</legend>
                      <label className="blog-size-choice">
                        <input
                          type="radio"
                          name="blog-text-size"
                          aria-label="Standard text"
                          checked={!largeText}
                          onChange={() => updatePreferences({ largeText: false })}
                        />
                        <span>Standard</span>
                      </label>
                      <label className="blog-size-choice">
                        <input
                          type="radio"
                          name="blog-text-size"
                          aria-label="Larger text"
                          checked={largeText}
                          onChange={() => updatePreferences({ largeText: true })}
                        />
                        <span>Larger</span>
                      </label>
                    </fieldset>
                    <button
                      type="button"
                      className="blog-type-toggle"
                      aria-pressed={serifText}
                      onClick={() => updatePreferences({ serifText: !serifText })}
                    >
                      <LuBookOpen aria-hidden="true" /> Serif text
                    </button>
                  </div>
                </div>
              )}
              {article && markdownContent && markdownUrl && canonicalUrl && (
                <BlogPostActions
                  key={pathname}
                  title={title}
                  markdownContent={markdownContent}
                  markdownUrl={markdownUrl}
                  canonicalUrl={canonicalUrl}
                />
              )}
            </header>
            {article && toc.length > 0 && <BlogContents key={pathname} toc={toc} />}
            {article ? <div className="prose blog-body">{children}</div> : <div className="blog-archive">{children}</div>}
            <footer className="blog-end">
              {githubUrl && (
                <p>
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                    <LuGithub aria-hidden="true" /> View source on GitHub
                  </a>
                </p>
              )}
              {article && tags.length > 0 && (
                <ul className="blog-tags" aria-label="Topics">
                  {tags.map((tag) => (
                    <li key={tag}>
                      <a href={blogTagHref(tag)}>
                        <LuTag aria-hidden="true" /> {tag}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {article ? (
                <a href="/blog/">
                  <LuArrowLeft aria-hidden="true" /> Back to all posts
                </a>
              ) : (
                <p>
                  For step-by-step guides and reference material, explore{" "}
                  <a href="/notes/">
                    Notes <LuArrowUpRight aria-hidden="true" />
                  </a>
                  .
                </p>
              )}
            </footer>
          </article>
        </TOCProvider>
      </main>
    </RootProvider>
  );
}
