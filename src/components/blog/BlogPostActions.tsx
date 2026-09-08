import { useEffect, useRef, useState } from "react";
import { LuCopy, LuDownload, LuLink, LuShare2 } from "react-icons/lu";

import { BlogActionFeedback } from "./BlogActionFeedback";

interface Props {
  title: string;
  canonicalUrl: string;
  markdownUrl: string;
  markdownContent: string;
}

export function BlogPostActions({ title, canonicalUrl, markdownUrl, markdownContent }: Props) {
  const [pending, setPending] = useState<"markdown" | "link" | "share" | "share-copy" | null>(null);
  const [status, setStatus] = useState({ message: "", success: false });
  const inFlight = useRef(false);
  const operation = useRef(0);
  const clipboardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [copiedControl, setCopiedControl] = useState<"markdown" | "link" | "share" | null>(null);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    if (!status.success) return;
    const timer = setTimeout(() => setStatus({ message: "", success: false }), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(
    () => () => {
      operation.current++;
      clearTimeout(clipboardTimer.current);
    },
    []
  );

  async function copy(format: "markdown" | "link", control: "markdown" | "link" | "share" = format) {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++operation.current;
    setPending(control === "share" ? "share-copy" : control);
    setCopiedControl(null);
    setStatus({ message: "", success: false });
    setShowLink(false);
    try {
      await Promise.race([
        navigator.clipboard.writeText(format === "markdown" ? markdownContent : canonicalUrl),
        new Promise<never>((_, reject) => {
          clipboardTimer.current = setTimeout(() => reject(new Error("Clipboard did not respond")), 8000);
        }),
      ]);
      if (request !== operation.current) return;
      setCopiedControl(control);
      setStatus({ message: format === "markdown" ? "Markdown copied" : "Link copied", success: true });
    } catch {
      if (request !== operation.current) return;
      setStatus({
        message: format === "markdown" ? "Could not copy. Use Download Markdown instead." : "Could not copy. Select the link below instead.",
        success: false,
      });
      if (format === "link") setShowLink(true);
    } finally {
      clearTimeout(clipboardTimer.current);
      if (request === operation.current) {
        inFlight.current = false;
        setPending(null);
      }
    }
  }

  async function share() {
    if (!navigator.share) return copy("link", "share");
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++operation.current;
    setPending("share");
    setCopiedControl(null);
    setStatus({ message: "", success: false });
    setShowLink(false);
    try {
      await navigator.share({ title, url: canonicalUrl });
    } catch (error) {
      if (request === operation.current && !(error instanceof DOMException && error.name === "AbortError")) {
        setStatus({ message: "Sharing is unavailable. Use Copy link instead.", success: false });
      }
    } finally {
      if (request === operation.current) {
        inFlight.current = false;
        setPending(null);
      }
    }
  }

  return (
    <div className="blog-post-actions">
      <div className="blog-action-buttons" role="group" aria-label="Save or share this post">
        <button
          type="button"
          aria-label={pending === "markdown" ? "Copying Markdown…" : "Copy Markdown"}
          disabled={pending !== null}
          onClick={() => void copy("markdown")}
        >
          <BlogActionFeedback
            icon={LuCopy}
            state={pending === "markdown" ? "pending" : status.success && copiedControl === "markdown" ? "success" : "idle"}
            labels={{ idle: "Copy Markdown", success: "Copied" }}
          />
        </button>
        <a href={markdownUrl} data-astro-reload download aria-label="Download Markdown">
          <LuDownload aria-hidden="true" /> Download .md
        </a>
        <button
          type="button"
          aria-label={pending === "link" ? "Copying link…" : "Copy link"}
          disabled={pending !== null}
          onClick={() => void copy("link")}
        >
          <BlogActionFeedback
            icon={LuLink}
            state={pending === "link" ? "pending" : status.success && copiedControl === "link" ? "success" : "idle"}
            labels={{ idle: "Copy link", success: "Copied" }}
          />
        </button>
        <button
          type="button"
          aria-label={pending === "share" ? "Share sheet open…" : pending === "share-copy" ? "Copying link…" : "Share"}
          disabled={pending !== null}
          onClick={() => void share()}
        >
          <BlogActionFeedback
            icon={LuShare2}
            state={pending === "share" || pending === "share-copy" ? "pending" : status.success && copiedControl === "share" ? "success" : "idle"}
            labels={{ idle: "Share" }}
          />
        </button>
      </div>
      <p className="blog-action-status" data-visible={Boolean(status.message) && !status.success} role="status" aria-atomic="true">
        {status.message}
      </p>
      {showLink && (
        <label className="blog-share-fallback">
          Article link
          <input readOnly value={canonicalUrl} onFocus={(event) => event.target.select()} />
        </label>
      )}
    </div>
  );
}
