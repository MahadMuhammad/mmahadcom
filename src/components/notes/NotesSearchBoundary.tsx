"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { SearchDialog, SearchDialogClose, SearchDialogContent, SearchDialogOverlay, type SharedProps } from "fumadocs-ui/components/dialog/search";
import { Component, lazy, type ReactNode } from "react";

const LazyNotesSearchDialog = lazy(() => import("./NotesSearchDialog"));

interface NotesSearchErrorBoundaryProps {
  children: ReactNode;
  dialogProps: SharedProps;
}

interface NotesSearchErrorBoundaryState {
  failed: boolean;
}

function NotesSearchFallback({ open, onOpenChange }: SharedProps) {
  return (
    <SearchDialog open={open} onOpenChange={onOpenChange} search="" onSearchChange={() => undefined}>
      <SearchDialogOverlay />
      <SearchDialogContent aria-describedby="notes-search-error-description">
        <div className="space-y-4 p-5" role="alert">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">Search unavailable</h2>
            <p id="notes-search-error-description" className="text-sm text-fd-muted-foreground">
              Search could not be loaded. Your Notes page is still available.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonVariants({ color: "primary", size: "sm" })} onClick={() => window.location.reload()}>
              Retry search
            </button>
            <SearchDialogClose>Close</SearchDialogClose>
          </div>
        </div>
      </SearchDialogContent>
    </SearchDialog>
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
