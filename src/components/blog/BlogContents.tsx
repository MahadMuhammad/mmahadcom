import { BlogReference } from "./BlogReference";
import type { TOCItemType } from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { TOCScrollArea } from "fumadocs-ui/components/toc";
import { TOCItems, TOCItem } from "fumadocs-ui/components/toc/clerk";
import { useEffect, useRef, useState } from "react";

/** One reading aid, presented as a rail or a sticky disclosure at narrow widths. */
export function BlogContents({ toc }: { toc: TOCItemType[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(0);
  const mobileNav = useRef<HTMLElement>(null);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>(".blog-body");
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!body) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bounds = body.getBoundingClientRect();
      const top = (header?.getBoundingClientRect().height ?? 64) + 80;
      // Measure article position, excluding the title and footer. End = last line visible.
      const distance = Math.max(1, bounds.height - (window.innerHeight - top));
      setPosition(Math.round(Math.min(1, Math.max(0, (top - bounds.top) / distance)) * 100));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <nav ref={mobileNav} className="blog-toc-mobile" aria-label="Article contents">
        <InlineTOC
          items={toc}
          open={open}
          onOpenChange={setOpen}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              setOpen(false);
              mobileNav.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }
          }}
        >
          <span className="blog-contents-summary">
            Contents <span>{position}% through</span>
          </span>
        </InlineTOC>
        <progress className="blog-reading-progress" max={100} value={position} aria-label="Article position" />
      </nav>
      <aside className="blog-toc-rail">
        <div className="blog-rail-sticky">
          <nav className="blog-toc-sticky" aria-label="Article contents">
            <div className="blog-contents-summary">
              <span>On this page</span>
              <span>{position}% through</span>
            </div>
            <progress className="blog-reading-progress" max={100} value={position} aria-label="Article position" />
            <TOCScrollArea>
              <TOCItems>
                {toc.map((item) => (
                  <TOCItem key={item.url} item={item} />
                ))}
              </TOCItems>
            </TOCScrollArea>
          </nav>
          <BlogReference />
        </div>
      </aside>
    </>
  );
}
