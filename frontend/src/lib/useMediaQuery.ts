import React from "react";

/**
 * Tracks a CSS media query from React.
 *
 * The layout needs this rather than CSS alone because two behaviours differ by
 * more than styling: the sidebar toggle collapses a docked rail on a desktop
 * but opens a drawer on a phone, and the collapsed rail hides its labels by not
 * rendering them. Both are decisions React has to make, so the breakpoint has
 * to be readable from JavaScript and stay in step with the Tailwind one.
 */
export function useMediaQuery(query: string): boolean {
  const get = React.useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = React.useState(get);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);

    // Re-read on mount: the value can have changed between first render and
    // this effect, and older Safari only supports addListener.
    onChange();
    if (list.addEventListener) {
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    }
    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `md` breakpoint — where the sidebar docks instead of sliding over. */
export const DESKTOP_QUERY = "(min-width: 768px)";
