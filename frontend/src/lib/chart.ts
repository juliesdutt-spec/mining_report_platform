import * as React from "react";

/**
 * Recharts sets colours as SVG presentation attributes, which do not resolve
 * CSS `var()`. So we read the design tokens off the document and hand Recharts
 * concrete colours — re-reading whenever the theme class flips so charts stay
 * correct in both light and dark.
 */
const TOKENS = [
  "primary",
  "teal",
  "border",
  "muted-foreground",
  "success",
  "warning",
  "destructive",
  "card",
  "foreground",
] as const;

export type ChartColors = Record<(typeof TOKENS)[number], string>;

function readTokens(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  return TOKENS.reduce((acc, token) => {
    const raw = styles.getPropertyValue(`--${token}`).trim();
    acc[token] = raw ? `hsl(${raw})` : "currentColor";
    return acc;
  }, {} as ChartColors);
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = React.useState<ChartColors>(readTokens);

  React.useEffect(() => {
    const observer = new MutationObserver(() => setColors(readTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

/** Shared Recharts tooltip styling so every chart reads the same. */
export function tooltipStyle(colors: ChartColors) {
  return {
    contentStyle: {
      backgroundColor: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: "0.5rem",
      fontSize: "12px",
      color: colors.foreground,
      boxShadow: "0 2px 8px rgb(0 0 0 / 0.08)",
    },
    labelStyle: { color: colors["muted-foreground"], marginBottom: 4 },
  };
}
