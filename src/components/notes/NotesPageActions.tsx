"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ViewOptionsPopover } from "fumadocs-ui/layouts/docs/page";
import { useEffect, useRef, useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";

interface NotesPageActionsProps {
  markdownContent: string;
  markdownUrl: string;
  githubUrl?: string;
}

type CopyState = "idle" | "copying" | "copied" | "error";

export function NotesPageActions({ markdownContent, markdownUrl, githubUrl }: NotesPageActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | undefined>(undefined);
  const copyAttempt = useRef(0);

  useEffect(
    () => () => {
      copyAttempt.current += 1;
      if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const copyMarkdown = async () => {
    if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    resetTimer.current = undefined;

    const attempt = copyAttempt.current + 1;
    copyAttempt.current = attempt;
    setCopyState("copying");
    let clipboardTimer: number | undefined;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await Promise.race([
        navigator.clipboard.writeText(markdownContent),
        new Promise<never>((_, reject) => {
          clipboardTimer = window.setTimeout(() => reject(new Error("Clipboard did not respond.")), 8_000);
        }),
      ]);
      if (copyAttempt.current !== attempt) return;
      setCopyState("copied");
      resetTimer.current = window.setTimeout(() => {
        if (copyAttempt.current === attempt) setCopyState("idle");
      }, 2_000);
    } catch {
      if (copyAttempt.current !== attempt) return;
      setCopyState("error");
    } finally {
      if (clipboardTimer !== undefined) window.clearTimeout(clipboardTimer);
    }
  };

  const copyLabel = copyState === "copying" ? "Copying…" : copyState === "copied" ? "Copied" : copyState === "error" ? "Try again" : "Copy Markdown";
  const copyStatus =
    copyState === "copying"
      ? "Copying Markdown."
      : copyState === "copied"
        ? "Markdown copied to the clipboard."
        : copyState === "error"
          ? "Markdown could not be copied. Use Download Markdown instead."
          : "";

  return (
    <div className="notes-page-actions" role="group" aria-label="Page actions">
      <button
        type="button"
        className={buttonVariants({
          color: "secondary",
          size: "sm",
          className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
        })}
        aria-busy={copyState === "copying"}
        onClick={() => void copyMarkdown()}
      >
        {copyState === "copied" ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
        {copyLabel}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatus}
      </span>
      {copyState === "error" && (
        <a href={markdownUrl} data-astro-reload download className={buttonVariants({ color: "secondary", size: "sm" })}>
          Download Markdown
        </a>
      )}
      <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl}>
        Open with
      </ViewOptionsPopover>
    </div>
  );
}
