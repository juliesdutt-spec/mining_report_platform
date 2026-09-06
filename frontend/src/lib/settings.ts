/**
 * Client-side persistence for the Settings page.
 *
 * There is no backend settings endpoint, so these preferences live in
 * localStorage on the viewer's own machine. Only non-sensitive display
 * preferences are stored here — never an API key. Provider keys are
 * server-side environment variables and must never reach the browser.
 *
 * The model is deliberately absent: which provider answers is decided by the
 * backend's .env, so storing a choice here would let the page claim a model
 * it has no way to select. Settings reads the live one from /health instead.
 */
export interface DataForgeSettings {
  apiUrl: string;
}

const STORAGE_KEY = "dataforge-settings";

/**
 * The deployed backend, used when a build carries no VITE_API_URL.
 *
 * Not a secret - it is a public URL every visitor's browser requests anyway.
 * VITE_API_URL still wins wherever it is set; this only decides what a build
 * without one does.
 */
const DEPLOYED_API_URL = "https://miningreportplatform-production.up.railway.app";

/** True when the page is being served from the developer's own machine. */
function servedLocally(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

/**
 * Where the backend lives when the viewer has not chosen otherwise.
 *
 * Vite inlines VITE_API_URL at build time, so a build that ran without it can
 * never learn the value later. Vercel scopes environment variables per
 * environment, so a variable added only to Production leaves every Preview
 * build without one - and the old fallback then shipped "http://localhost:8000"
 * inside the bundle. On a phone that address is the phone, which runs no
 * backend, so the app reported the backend unreachable on a deployment that was
 * running perfectly.
 *
 * A page served from a real host therefore cannot mean localhost: nothing is
 * listening there. It falls back to the deployed backend instead. localhost
 * stays the default only when the page is itself served locally, which is the
 * one case where `uvicorn backend.api:app --reload` is the right answer.
 */
export const BUILT_IN_API_URL: string =
  import.meta.env.VITE_API_URL ||
  (servedLocally() ? "http://localhost:8000" : DEPLOYED_API_URL);

export const DEFAULT_SETTINGS: DataForgeSettings = {
  apiUrl: BUILT_IN_API_URL,
};

/**
 * The viewer's own API base URL, or null when they have not set one.
 *
 * `loadSettings` fills in the default, which cannot distinguish "unset" from
 * "deliberately set to the default" — the API client needs that difference so
 * an unset value still falls through to VITE_API_URL.
 */
export function savedApiUrl(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DataForgeSettings>;
    const url = typeof parsed.apiUrl === "string" ? parsed.apiUrl.trim() : "";
    return url ? url.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

/** Read saved settings, falling back to defaults for anything missing or invalid. */
export function loadSettings(): DataForgeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<DataForgeSettings>;
    return {
      apiUrl: typeof parsed.apiUrl === "string" ? parsed.apiUrl : DEFAULT_SETTINGS.apiUrl,
    };
  } catch {
    // Private browsing, blocked storage or corrupt JSON — defaults are fine.
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings. Returns false when storage is unavailable. */
export function saveSettings(settings: DataForgeSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
