import { useEffect, useRef, useState } from "react";
import { LuX } from "react-icons/lu";

type Reference = { link: HTMLAnchorElement; note: HTMLElement; number: string };

/** Enhance native footnotes on wide screens. Endnotes remain the source and mobile fallback. */
export function BlogReference() {
  const [active, setActive] = useState<Reference | null>(null);
  const panel = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusRequested = useRef(false);
  const dismissed = useRef(new Set<HTMLAnchorElement>());

  useEffect(() => {
    const body = document.querySelector(".blog-body");
    if (!body) return;
    const wide = window.matchMedia("(min-width: 68rem)");
    const references = [...body.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")].flatMap((link) => {
      const note = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      return note ? [{ link, note, number: link.textContent ?? "" }] : [];
    });
    const visible = new Set<Element>();
    const showNearby = () => {
      // Never replace a reference while someone is following its links with the keyboard.
      if (panel.current?.contains(document.activeElement)) return;
      setActive(wide.matches ? (references.find((ref) => visible.has(ref.link) && !dismissed.current.has(ref.link)) ?? null) : null);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else {
            visible.delete(entry.target);
            dismissed.current.delete(entry.target as HTMLAnchorElement);
          }
        }
        showNearby();
      },
      { rootMargin: "-160px 0px -20% 0px" }
    );
    references.forEach((ref) => observer.observe(ref.link));
    const onClick = (event: MouseEvent) => {
      if (!wide.matches || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as Element).closest("a[data-footnote-ref]");
      const ref = references.find((ref) => ref.link === target);
      if (!ref) return;
      event.preventDefault();
      focusRequested.current = true;
      dismissed.current.delete(ref.link);
      setActive({ ...ref });
    };
    const onResize = () => {
      if (!wide.matches && panel.current?.contains(document.activeElement)) {
        references.find((ref) => content.current?.dataset.source === ref.note.id)?.link.focus({ preventScroll: true });
      }
      if (!wide.matches) setActive(null);
      else showNearby();
    };
    body.addEventListener("click", onClick as EventListener);
    wide.addEventListener("change", onResize);
    return () => {
      observer.disconnect();
      body.removeEventListener("click", onClick as EventListener);
      wide.removeEventListener("change", onResize);
    };
  }, []);

  useEffect(() => {
    if (!active || !content.current) return;
    // Clone the rendered source, preserving rich links without duplicating IDs or return controls.
    const source = active.note.cloneNode(true) as HTMLElement;
    source.querySelectorAll("[data-footnote-backref]").forEach((node) => node.remove());
    source.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    content.current.replaceChildren(...source.childNodes);
    content.current.dataset.source = active.note.id;
    if (focusRequested.current) {
      focusRequested.current = false;
      panel.current?.focus({ preventScroll: true });
    }
  }, [active]);

  function close() {
    if (!active) return;
    dismissed.current.add(active.link);
    active.link.focus({ preventScroll: true });
    setActive(null);
  }

  if (!active) return null;
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="blog-reference"
      aria-label={`Reference ${active.number}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="blog-reference-heading">
        <span>Reference {active.number}</span>
        <button type="button" onClick={close} aria-label="Close reference">
          <LuX aria-hidden="true" />
        </button>
      </div>
      <div ref={content} className="blog-reference-content" />
      <a className="blog-reference-endnote" href={`#${active.note.id}`}>
        View in footnotes
      </a>
    </section>
  );
}
