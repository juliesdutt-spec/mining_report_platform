import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive-muted p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-destructive">
              This page failed to render
            </h2>
            <p className="mt-2 break-words font-mono text-xs text-destructive/90">
              {this.state.error.message}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The rest of the application is unaffected — switch pages using the
              sidebar, or try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
