import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { LuCopy } from "react-icons/lu";

import { BlogActionFeedback } from "./BlogActionFeedback";

// MDX arrives as static Astro content. This small island hydrates the copy
// control explicitly, while Fumadocs continues to own the code presentation.
export function BlogCodeBlock({ children, ...props }: ComponentProps<typeof CodeBlock>) {
  const content = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clipboardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const operation = useRef(0);
  const inFlight = useRef(false);
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  useEffect(
    () => () => {
      operation.current++;
      clearTimeout(timer.current);
      clearTimeout(clipboardTimer.current);
    },
    []
  );
  async function copy() {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++operation.current;
    clearTimeout(timer.current);
    setState("copying");
    try {
      const text = content.current?.querySelector("pre")?.textContent;
      if (text === undefined) throw new Error("No code to copy");
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) => {
          clipboardTimer.current = setTimeout(() => reject(new Error("Clipboard did not respond")), 8000);
        }),
      ]);
      if (request !== operation.current) return;
      setState("copied");
    } catch {
      if (request !== operation.current) return;
      setState("error");
    } finally {
      clearTimeout(clipboardTimer.current);
      if (request === operation.current) inFlight.current = false;
    }
    timer.current = setTimeout(() => setState("idle"), 4000);
  }
  return (
    <CodeBlock
      {...props}
      ref={content}
      allowCopy={false}
      Actions={({ className }) => (
        <div className={className}>
          <button type="button" className="blog-code-copy" aria-label="Copy code" disabled={state === "copying"} onClick={() => void copy()}>
            <BlogActionFeedback
              icon={LuCopy}
              state={state === "copied" ? "success" : state === "copying" ? "pending" : state}
              labels={{ idle: "Copy", pending: "Copying…", success: "Copied", error: "Try again" }}
            />
          </button>
          <span className="sr-only" role="status">
            {state === "copied" ? "Code copied" : state === "error" ? "Could not copy code" : ""}
          </span>
        </div>
      )}
    >
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
