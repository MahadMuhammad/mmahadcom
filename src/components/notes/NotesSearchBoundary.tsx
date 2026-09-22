"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { Component, lazy, useEffect, useRef, type ReactNode } from "react";

const LazyNotesSearchDialog = lazy(() => import("./NotesSearchDialog"));

interface NotesSearchErrorBoundaryProps {
  children: ReactNode;
  dialogProps: SharedProps;
}

interface NotesSearchErrorBoundaryState {
  failed: boolean;
}

function NotesSearchFallback({ open, onOpenChange }: SharedProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    // An index failure removes the search input before this fallback mounts.
    const active = document.activeElement;
    const returnFocus =
      active instanceof HTMLElement && active !== document.body && !element.contains(active)
        ? active
        : [...document.querySelectorAll<HTMLElement>("button[data-search], button[data-search-full]")].find(
            (button) => button.getClientRects().length > 0
          );
    element.showModal();
    return () => {
      element.close();
      returnFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="notes-search-fallback"
      aria-labelledby="notes-search-error-title"
      aria-describedby="notes-search-error-description"
      onCancel={() => onOpenChange(false)}
      onClose={(event) => {
        // A queued close event must not dismiss a dialog that has already reopened.
        if (!event.currentTarget.open) onOpenChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
          onOpenChange(false);
        }
      }}
    >
      <div className="space-y-4 p-5" role="alert">
        <div className="space-y-1.5">
          <h2 id="notes-search-error-title" className="text-lg font-semibold">
            Search unavailable
          </h2>
          <p id="notes-search-error-description" className="text-sm text-fd-muted-foreground">
            Search could not be loaded. Your Notes page is still available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonVariants({ color: "primary", size: "sm" })} onClick={() => window.location.reload()}>
            Retry search
          </button>
          <button type="button" className={buttonVariants({ color: "secondary", size: "sm" })} onClick={() => onOpenChange(false)}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}

class NotesSearchErrorBoundary extends Component<NotesSearchErrorBoundaryProps, NotesSearchErrorBoundaryState> {
  state: NotesSearchErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): NotesSearchErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <NotesSearchFallback {...this.props.dialogProps} />;
    return this.props.children;
  }
}

export function NotesSearchBoundary(props: SharedProps) {
  return (
    <NotesSearchErrorBoundary dialogProps={props}>
      <LazyNotesSearchDialog {...props} />
    </NotesSearchErrorBoundary>
  );
}
