import React from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, fetchDemoCredentials, login } from "@/services/api";
import { SessionUser } from "@/lib/session";

/**
 * The sign-in screen.
 *
 * The demo credentials are shown on the page on purpose. An evaluator opening
 * the link has not been given an account, and a wall with no way through reads
 * as a broken deployment rather than a secured one. The account they are handed
 * is read-only, so publishing it cannot cost the corpus anything.
 */
export function LoginPage({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [demo, setDemo] = React.useState<{ username: string; password: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchDemoCredentials()
      .then((result) => {
        if (!cancelled && result.enabled && result.username && result.password) {
          setDemo({ username: result.username, password: result.password });
        }
      })
      .catch(() => {
        /* No demo panel is a fine outcome; the form still works. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent, credentials?: { username: string; password: string }) {
    event.preventDefault();
    const creds = credentials ?? { username, password };
    if (!creds.username || !creds.password) {
      setError("Enter a username and password.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      onSignedIn(await login(creds.username, creds.password));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the DataForge backend. It may be starting up - try again in a moment."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
            DF
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">DataForge</h1>
            <p className="truncate text-xs text-muted-foreground">CMPDI · Coal India</p>
          </div>
        </div>

        <h2 className="text-sm font-medium text-foreground">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mining reports are only readable by an authorised account.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive-muted p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            <LogIn className="h-3.5 w-3.5" />
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {demo && (
          <div className="mt-6 rounded-md border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evaluating this project?
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the read-only demo account. It can open every document and ask
              every question, but cannot upload, delete or resolve findings.
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">user</dt>
              <dd className="text-foreground">{demo.username}</dd>
              <dt className="text-muted-foreground">pass</dt>
              <dd className="text-foreground">{demo.password}</dd>
            </dl>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              disabled={isSubmitting}
              onClick={(e) => submit(e, demo)}
            >
              Sign in as demo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
