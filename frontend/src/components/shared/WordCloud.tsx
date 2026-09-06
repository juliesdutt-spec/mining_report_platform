import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFile } from "@/services/api";
import { cn } from "@/lib/utils";

/**
 * Renders GET /reports/{id}/wordcloud.
 *
 * The image is fetched rather than set as a bare <img src>. That endpoint now
 * requires a signed-in account, and a browser cannot attach an Authorization
 * header to an <img> - it would simply be refused. Fetching the bytes and
 * showing them through an object URL keeps the token in a header instead of
 * putting it in a URL that ends up in logs.
 *
 * The backend returns 400/404 when there is nothing to render. Both are treated
 * as "unavailable" - no placeholder graphic stands in for a cloud that does not
 * exist.
 */
export function WordCloud({ reportId, className }: { reportId: number; className?: string }) {
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">("loading");
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let revoke: (() => void) | null = null;

    setState("loading");
    setSrc(null);

    fetchFile(`/reports/${reportId}/wordcloud`)
      .then((file) => {
        if (cancelled) {
          // The report changed while this was in flight; releasing the blob
          // here avoids leaking one per switch.
          file.revoke();
          return;
        }
        revoke = file.revoke;
        setSrc(file.url);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });

    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [reportId]);

  return (
    <div className={cn("relative min-h-[120px]", className)}>
      {state === "loading" && <Skeleton className="h-[120px] w-full" />}

      {state === "unavailable" && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No word cloud available for this document.
        </p>
      )}

      {state === "ready" && src && (
        <img
          src={src}
          alt={`Word frequency cloud generated from the text of report ${reportId}`}
          className="w-full rounded-md"
        />
      )}
    </div>
  );
}
