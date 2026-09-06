/**
 * Recovery for a page chunk that no longer exists on the server.
 *
 * Every build gives its chunks new content-hashed filenames, and index.html is
 * what maps a page to its current filename. A browser holding an older
 * index.html - a tab left open across a deploy, or a cached copy - therefore
 * asks for a filename the current deployment does not have. The request comes
 * back as the host's 404 page, so the dynamic import rejects and the page never
 * renders. Nothing about the running tab can fix that: the name it is asking
 * for is simply gone.
 *
 * Reloading is the fix, because it fetches the current index.html and with it
 * the current chunk names.
 */

/** Set once a reload has been spent, so a failure that a reload cannot fix
 *  surfaces as an error instead of looping. */
const RELOAD_KEY = "dataforge-chunk-reloaded";

/** sessionStorage throws in some privacy modes; a blocked read must not break
 *  page loading, so it is treated as "a reload has already been spent". */
function reloadAlreadySpent(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === "1";
  } catch {
    return true;
  }
}

function markReloadSpent(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    /* Nothing to do — the guard above already fails closed. */
  }
}

function clearReloadMark(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* Ignored for the same reason. */
  }
}

/**
 * True for the failure this module exists to handle.
 *
 * Browsers word it differently — Chrome and Firefox say "Failed to fetch
 * dynamically imported module", Safari "Importing a module script failed" — and
 * a genuinely offline browser produces the same words, which is why the reload
 * is spent at most once rather than retried.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

/**
 * Wrap a lazy import so a stale chunk reloads the page once.
 *
 * Anything that is not a chunk-load failure is rethrown untouched, so a real
 * error inside a page still reaches the error boundary and is still shown.
 */
export function retryOnStaleChunk<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().then(
      (loaded) => {
        // The current build loads, so a future skew is allowed its own reload.
        clearReloadMark();
        return loaded;
      },
      (error: unknown) => {
        if (!isChunkLoadError(error) || reloadAlreadySpent()) throw error;

        markReloadSpent();
        window.location.reload();

        // Deliberately never settles: the document is being replaced, so
        // Suspense keeps showing the skeleton rather than flashing an error
        // the viewer would not have time to read.
        return new Promise<T>(() => {});
      }
    );
}
