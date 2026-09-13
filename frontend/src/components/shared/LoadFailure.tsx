import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Says a load failed, rather than letting it look like an empty corpus.
 *
 * Every page caught its fetch errors with `.catch(() => setThings([]))`, so a
 * backend that was unreachable rendered exactly like a database with nothing
 * in it. "No documents indexed" sends someone off to upload files; "cannot
 * reach the backend" sends them to check the service. Those are different
 * problems and the screen was reporting the wrong one.
 */
export function LoadFailure({
  message,
  onRetry,
  what = "this view",
}: {
  message?: string | null;
  onRetry?: () => void;
  /** Named in the fallback text, e.g. "the analytics". */
  what?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive-muted p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0">
          {message || `Could not load ${what}. The backend may be offline or still starting.`}
        </span>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
