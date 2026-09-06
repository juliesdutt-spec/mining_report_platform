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

/** Where the backend lives when the viewer has not chosen otherwise. */
export const BUILT_IN_API_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

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
