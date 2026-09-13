import { RefObject, useEffect } from "react";

/**
 * Keep keyboard focus inside a panel that covers the page.
 *
 * The mobile navigation drawer is an <aside> with a transform on it, not a
 * Radix dialog, so it had none of a dialog's behaviour: opening it left focus
 * on the toggle, and Tab then walked eleven controls on the page behind it —
 * Upload, Ingest, the activity tabs, table rows — every one of them under the
 * drawer and its backdrop. Closing it dropped focus on <body>, so the next Tab
 * restarted from the top of the page.
 *
 * Only for panels that cover the page. A docked sidebar must not trap
 * anything, which is why `active` is the drawer's open state and not its
 * presence.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // A control scrolled out of the panel's own overflow is still reachable by
    // Tab; one that is genuinely hidden has no box at all.
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
  );
}

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement>,
  onEscape?: () => void
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    // Where the reader was standing, so closing can put them back rather than
    // starting them again at the top of the page.
    const previous = document.activeElement as HTMLElement | null;

    const items = focusableWithin(container);
    (items[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;

      // Read the list on every press: the drawer's own content changes as the
      // corpus loads, so a list captured on open goes stale.
      const focusable = focusableWithin(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (!current || !container.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [active, containerRef, onEscape]);
}
