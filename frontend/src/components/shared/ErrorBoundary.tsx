import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError } from "@/lib/staleChunk";

interface Props {
  children: React.ReactNode;
  /** Changing this resets the boundary — used to recover on navigation. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors from a page so one failure does not blank the whole
 * application. React unmounts the entire tree on an uncaught error, which in a
 * single-screen app means a white page with no way back.
 *
 * The message shown is the real error, not a generic apology — during a demo
 * knowing which page failed and why is more useful than hiding it.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    // Navigating to another page clears a previous page's failure.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Page failed to render:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    // A chunk that will not load is not a fault in this page's code: the build
    // it belongs to has been replaced, so the filename this tab is asking for
    // no longer exists. Resetting the boundary would request the same missing
    // file again, so the recovery offered has to be a reload.
    const staleBuild = isChunkLoadError(this.state.error);

    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive-muted p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-destructive">
              {staleBuild ? "This page is from an older version" : "This page failed to render"}
            </h2>
            <p className="mt-2 break-words font-mono text-xs text-destructive/90">
              {this.state.error.message}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {staleBuild
                ? "This tab was opened before the current version was deployed, so it is asking for files that have since been replaced. Reloading fetches the current ones."
                : "The rest of the application is unaffected — switch pages using the sidebar, or try again."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() =>
                staleBuild
                  ? window.location.reload()
                  : this.setState({ error: null })
              }
            >
              {staleBuild ? "Reload" : "Try again"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
