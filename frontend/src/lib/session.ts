/**
 * The signed-in session, held in the browser.
 *
 * The token lives in localStorage so a refresh does not sign you out. That is a
 * deliberate trade: localStorage is readable by any script on the origin, so a
 * cross-site scripting hole would expose it. The app renders no user-supplied
 * HTML anywhere - checked as part of the security pass - and the alternative,
 * a cookie, would need credentialed CORS across two origins, which is a wider
 * change with its own failure modes.
 *
 * No password is ever stored here, only the short-lived token the server
 * issued, and never an API key of any kind.
 */
const TOKEN_KEY = "dataforge-session";

export interface SessionUser {
  username: string;
  display_name: string;
  readonly: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Storage can throw in private modes; a session is a convenience, not a must. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* Sign-in still works for this tab; it just will not survive a reload. */
  }
  notify();
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Nothing more to do - the in-memory listeners still fire below. */
  }
  notify();
}

/**
 * Called when the session appears or disappears.
 *
 * The API layer clears the token on any 401, which can happen mid-request long
 * after sign-in - an expired token, or an account deleted server-side. Without
 * this the app would keep rendering a signed-in shell over an API that refuses
 * every call.
 */
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}
