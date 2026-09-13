import { cn } from "@/lib/utils";

/**
 * The DataForge wordmark.
 *
 * Drawn as live text rather than shipped as an image, for three reasons that
 * matter more than fidelity to a PNG: it stays sharp at any size and pixel
 * density, a screen reader announces the product name instead of skipping a
 * graphic, and the dark half can follow the theme. A black "Data" burned into
 * an asset disappears against the dark canvas; `text-foreground` does not.
 *
 * Only the "forge" half carries the brand orange. That colour is reserved for
 * this mark alone — the interface itself stays on its blue, because a second
 * accent competing with the primary one would read as two products.
 */

interface WordmarkProps {
  /** Height of the mark. Type scales with it; nothing else needs tuning. */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * "auto" follows the theme, which is right everywhere the mark sits on the
   * app's own canvas. "light" is for a ground that is dark in both themes —
   * the sign-in backdrop — where `text-foreground` would put a near-black
   * "Data" on near-black strata.
   */
  tone?: "auto" | "light";
  className?: string;
}

const SIZES: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-4xl sm:text-5xl",
};

export function Wordmark({ size = "md", tone = "auto", className }: WordmarkProps) {
  return (
    <span
      // WCAG 1.4.3 exempts text that is part of a logo or brand name from the
      // contrast minimum. The orange half is 2.51:1 on the light canvas and
      // will stay there, because it is the mark. The audit reads this
      // attribute so the exemption is declared rather than assumed — and so
      // it applies here and nowhere else.
      data-logotype="DataForge"
      className={cn(
        "font-brand font-semibold leading-none tracking-[-0.02em] whitespace-nowrap",
        SIZES[size],
        className
      )}
    >
      <span className={tone === "light" ? "text-white" : "text-foreground"}>Data</span>
      {/* A hair narrower than a word space, which is how the mark is drawn. */}
      <span className="inline-block w-[0.18em]" aria-hidden="true" />
      <span className="text-brand">forge</span>
    </span>
  );
}

/**
 * The wordmark compressed to its initials, for places too narrow to hold it —
 * the collapsed sidebar rail at 64px, and the favicon.
 */
export function WordmarkGlyph({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="DataForge"
      data-logotype="DataForge"
      className={cn(
        "font-brand text-base font-semibold leading-none tracking-[-0.03em]",
        className
      )}
    >
      <span className="text-foreground">D</span>
      <span className="text-brand">f</span>
    </span>
  );
}
