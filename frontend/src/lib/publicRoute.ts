import { useEffect, useState } from "react";

/**
 * The handful of screens that exist outside the sign-in wall.
 *
 * Everything else in DataForge is gated, which is right: the corpus is
 * departmental documents. But a privacy policy nobody can read without an
 * account is not a privacy policy, and a 404 that demands a password to see
 * is a worse 404 than the host's default. These three resolve before the
 * auth gate in App.tsx.
 *
 * Kept out of NavigationTab deliberately. That union drives the sidebar, the
 * breadcrumb and the command palette, and none of these belong in any of
 * them.
 */

export type PublicRoute = "privacy" | "terms" | "not-found";

const LEGAL: Record<string, PublicRoute> = {
  privacy: "privacy",
  terms: "terms",
};

/**
 * Which public screen this URL asks for, if any.
 *
 * Two different failures land on "not-found". A path other than `/` reaches
 * the app only because the host rewrites unknown paths to index.html, so the
 * address was wrong; and `#/nonsense` would otherwise fall through to the
 * dashboard, which silently rewrites the address someone typed. Routing is
 * hash-based, so the path check has to come first: `/privacy` is not a route
 * here, `/#/privacy` is.
 */
export function publicRouteFor(pathname: string, hash: string): PublicRoute | null {
  const head = hash.replace(/^#\/?/, "").trim().split("/")[0];

  if (pathname !== "/" && pathname !== "") {
    return "not-found";
  }
  return LEGAL[head] ?? null;
}

/**
 * The current public route, kept in step with the address bar.
 *
 * It needs its own listener rather than deriving from useHashRoute: that hook
 * maps every unrecognised hash to the dashboard, so #/privacy and #/terms are
 * the same value to it and moving between them re-renders nothing. Clicking
 * "Terms of use" from the privacy page did exactly nothing until this existed.
 */
export function usePublicRoute(): PublicRoute | null {
  const read = () => publicRouteFor(window.location.pathname, window.location.hash);
  const [route, setRoute] = useState<PublicRoute | null>(read);

  useEffect(() => {
    const onHashChange = () => setRoute(read());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return route;
}

/** Hash-only routes, for the links that point at them. */
export const PRIVACY_HREF = "#/privacy";
export const TERMS_HREF = "#/terms";
