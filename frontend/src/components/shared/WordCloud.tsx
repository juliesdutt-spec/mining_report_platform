import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { reportWordCloudUrl } from "@/services/api";
import { cn } from "@/lib/utils";

/**
 * Renders GET /reports/{id}/wordcloud.
 *
 * The backend builds the PNG from the report's stored text and returns 400/404
 * when there is nothing to render. Both are treated as "unavailable" — no
 * placeholder graphic stands in for a cloud that does not exist.
 */
export function WordCloud({ reportId, className }: { reportId: number; className?: string }) {
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">("loading");

  // Reset whenever the report changes, so the previous image is not shown.
  React.useEffect(() => {
    setState("loading");
  }, [reportId]);

  return (
    <div className={cn("relative min-h-[120px]", className)}>
      {state === "loading" && <Skeleton className="h-[120px] w-full" />}

      {state === "unavailable" && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No word cloud available for this document.
        </p>
      )}

      <img
        key={reportId}
        src={reportWordCloudUrl(reportId)}
        alt={`Word frequency cloud generated from the text of report ${reportId}`}
        onLoad={() => setState("ready")}
        onError={() => setState("unavailable")}
        className={cn("w-full rounded-md", state === "ready" ? "block" : "hidden")}
      />
    </div>
  );
}
