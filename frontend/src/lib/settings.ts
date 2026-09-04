/**
 * Client-side persistence for the Settings page.
 *
 * There is no backend settings endpoint, so these preferences live in
 * localStorage on the viewer's own machine. Only non-sensitive display
 * preferences are stored here — never an API key. CLAUDE_API_KEY is a
 * server-side environment variable and must never reach the browser.
 */
export interface DataForgeSettings {
  apiUrl: string;
  modelName: string;
  ocrConfidence: number;
}

const STORAGE_KEY = "dataforge-settings";

export const DEFAULT_SETTINGS: DataForgeSettings = {
  apiUrl: "http://localhost:8000",
  modelName: "claude-opus-5",
  ocrConfidence: 85,
};

/** Read saved settings, falling back to defaults for anything missing or invalid. */
export function loadSettings(): DataForgeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<DataForgeSettings>;
    return {
      apiUrl: typeof parsed.apiUrl === "string" ? parsed.apiUrl : DEFAULT_SETTINGS.apiUrl,
      modelName:
        typeof parsed.modelName === "string" ? parsed.modelName : DEFAULT_SETTINGS.modelName,
      ocrConfidence:
        typeof parsed.ocrConfidence === "number" && Number.isFinite(parsed.ocrConfidence)
          ? parsed.ocrConfidence
          : DEFAULT_SETTINGS.ocrConfidence,
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
