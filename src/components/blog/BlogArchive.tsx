import { LuTag } from "react-icons/lu";
import { useEffect, useState, type MouseEvent } from "react";
import { blogTagHref, blogTagKey } from "../../lib/blog-tags";

export interface BlogPreview {
  title: string;
  description: string;
  href: string;
  date: string;
  dateLabel: string;
  tags: string[];
}

export function BlogArchive({ posts }: { posts: BlogPreview[] }) {
  const [selected, setSelected] = useState("");
  const tags = new Map<string, { label: string; count: number }>();
  for (const post of posts) {
    for (const tag of new Set(post.tags.map(blogTagKey))) {
      const current = tags.get(tag);
      tags.set(tag, { label: current?.label ?? post.tags.find((label) => blogTagKey(label) === tag)!.trim(), count: (current?.count ?? 0) + 1 });
    }
  }
  const visible = selected ? posts.filter((post) => post.tags.some((tag) => blogTagKey(tag) === selected)) : posts;

  useEffect(() => {
    const readTag = () => setSelected(blogTagKey(new URLSearchParams(window.location.search).get("tag") ?? ""));
    readTag();
    window.addEventListener("popstate", readTag);
    return () => window.removeEventListener("popstate", readTag);
  }, []);

  function selectTag(event: MouseEvent<HTMLAnchorElement>, tag: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const key = blogTagKey(tag);
    if (key === selected) return;
    window.history.pushState(null, "", key ? blogTagHref(key) : "/blog/");
    setSelected(key);
  }

  return (
    <>
      <p className="blog-filter-status" role="status">
        {visible.length} {visible.length === 1 ? "post" : "posts"}
        {selected ? ` tagged “${tags.get(selected)?.label ?? selected}”` : ""}
      </p>
      {visible.map((post) => (
        <article key={post.href} className={`blog-post-preview${post === posts[0] ? " blog-post-preview--latest" : ""}`}>
          <div className="blog-preview-meta">
            <span>{post === posts[0] ? "Latest entry" : "From the archive"}</span>
            <time dateTime={post.date}>{post.dateLabel}</time>
          </div>
          <h2>
            <a href={post.href}>{post.title}</a>
          </h2>
          <p>{post.description}</p>
          <a className="blog-read-link" href={post.href}>
            Read the post <span aria-hidden="true">→</span>
            <span className="sr-only">: {post.title}</span>
          </a>
          {post.tags.length > 0 && (
            <ul className="blog-tags" aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <a href={blogTagHref(tag)} onClick={(event) => selectTag(event, tag)}>
                    <LuTag aria-hidden="true" /> {tag}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      {visible.length === 0 && (
        <section className="blog-empty">
          <h2>No posts for this topic yet</h2>
          <p>
            Try another topic, or{" "}
            <a href="/blog/" onClick={(event) => selectTag(event, "")}>
              see all posts
            </a>
            .
          </p>
        </section>
      )}
      {tags.size > 0 && (
        <nav className="blog-filters" aria-label="Filter posts by topic">
          <span className="blog-topics-label">
            <LuTag aria-hidden="true" /> Topics
          </span>
          <a href="/blog/" aria-current={!selected ? "true" : undefined} onClick={(event) => selectTag(event, "")}>
            All posts <span>{posts.length}</span>
          </a>
          {[...tags]
            .sort((a, b) => a[1].label.localeCompare(b[1].label))
            .map(([key, tag]) => (
              <a key={key} href={blogTagHref(key)} aria-current={selected === key ? "true" : undefined} onClick={(event) => selectTag(event, key)}>
                {tag.label} <span>{tag.count}</span>
              </a>
            ))}
        </nav>
      )}
    </>
  );
}
