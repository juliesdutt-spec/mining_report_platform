import { useEffect, useState } from "react";

/**
 * Describes a pending action in a way that matches how long it actually takes.
 *
 * Two problems with showing a spinner the instant work starts:
 *
 * A dossier composes in about 340ms, so an indicator appears and vanishes
 * before it can be read. That flicker registers as jank, not as feedback —
 * the honest presentation of a fast action is to show nothing at all.
 *
 * And when something *is* slow, the usual cause here is not the work: it is a
 * sleeping container waking up, which takes tens of seconds and is otherwise
 * indistinguishable from a hang. Saying so is the difference between waiting
 * and giving up.
 */
export interface PendingState {
  /** Show an indicator at all — false for the common, fast case. */
  visible: boolean;
  /** Long enough that the delay needs explaining. */
  slow: boolean;
}

export function usePendingState(
  isPending: boolean,
  { showAfterMs = 250, slowAfterMs = 2500 } = {}
): PendingState {
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setVisible(false);
      setSlow(false);
      return;
    }
    const show = window.setTimeout(() => setVisible(true), showAfterMs);
    const warn = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(warn);
    };
  }, [isPending, showAfterMs, slowAfterMs]);

  return { visible, slow };
}
