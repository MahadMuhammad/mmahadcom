import type { IconType } from "react-icons";
import { LuCheck } from "react-icons/lu";

/** Keep both glyphs and label widths mounted so feedback can transition in either direction. */
export function BlogActionFeedback({
  icon: Icon,
  state,
  labels,
}: {
  icon: IconType;
  state: "idle" | "pending" | "success" | "error";
  labels: { idle: string; pending?: string; success?: string; error?: string };
}) {
  const current = labels[state] ?? labels.idle;
  return (
    <span className="blog-action-feedback" data-state={state} aria-hidden="true">
      <span className="blog-feedback-icon">
        <Icon className="blog-feedback-original" />
        <LuCheck className="blog-copy-check" />
      </span>
      <span className="blog-feedback-label">
        {[...new Set(Object.values(labels))].map((label) => (
          <span key={label} data-visible={label === current}>
            {label}
          </span>
        ))}
      </span>
    </span>
  );
}
