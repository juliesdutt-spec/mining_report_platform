import React from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/brand/Wordmark";
import { StrataBackdrop } from "@/components/brand/StrataBackdrop";
import { ApiError, fetchDemoCredentials, login } from "@/services/api";
import { SessionUser } from "@/lib/session";

/**
 * The sign-in screen.
 *
 * The demo credentials are shown on the page on purpose. An evaluator opening
 * the link has not been given an account, and a wall with no way through reads
 * as a broken deployment rather than a secured one. The account they are handed
 * is read-only, so publishing it cannot cost the corpus anything.
 *
 * Laid out as a brand panel beside the form from `lg` up. Below that the panel
 * is dropped rather than stacked — on a phone it would push the password field
 * under the fold, and the form is what the page is for.
 *
 * The panel is dark in both themes and the form is not. That is deliberate:
 * the ground under the headline is then a value this file chooses rather than
 * one the viewer's theme chooses, so the contrast holds either way, and the
 * form stays on the same canvas the application opens on.
 */

/** Claims on the brand panel. Each one is a thing the platform actually does. */
const CAPABILITIES = [
  {
    title: "Traceable",
    body: "Every figure resolves to the line of the document it was read from.",
  },
  {
    title: "Reconciled",
    body: "Reports that disagree are surfaced side by side, never averaged into one number.",
  },
  {
    title: "Period-aware",
    body: "Production is compared within a reporting period, so Q1 and Q2 are not a conflict.",
  },
];

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
    // `body` is overflow-hidden for the app shell, so this screen has to own
    // its own scroll or a short viewport hides the demo panel with no way down.
    <div className="flex h-screen bg-background">
      <aside className="relative hidden w-[52%] max-w-[780px] shrink-0 overflow-hidden border-r border-white/10 bg-[#04070f] lg:flex">
        <StrataBackdrop className="absolute inset-0 h-full w-full" />

        <div className="relative z-10 flex w-full flex-col p-12 xl:p-16">
          <Wordmark size="xl" tone="light" />
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
            CMPDI · Coal India · Ministry of Coal
          </p>

          <div className="mt-auto max-w-lg pt-20">
            <h2 className="text-balance text-3xl font-semibold leading-[1.2] tracking-tight text-white xl:text-[2.6rem]">
              Mining reports that contradict each other,{" "}
              <span className="text-brand">reconciled</span> with the evidence
              still attached.
            </h2>

            <dl className="mt-10 space-y-5 border-t border-white/10 pt-8">
              {CAPABILITIES.map((claim) => (
                <div key={claim.title} className="flex gap-4">
                  <dt className="w-[7.25rem] shrink-0 pt-px text-xs font-semibold uppercase tracking-wider text-brand">
                    {claim.title}
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm leading-relaxed text-white/70">
                    {claim.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="mt-12 text-xs text-white/35">
            Smart India Hackathon · Problem statement SIH26023
          </p>
        </div>
      </aside>

      <main className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-10">
        {/* The card is 24rem wide in a column nearly twice that, so the panel
            read as a blank sheet next to the brand side. One soft wash behind
            it gives the eye somewhere to land without putting anything in the
            way of the form - the card itself is already centred. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_46%_at_50%_40%,hsl(var(--brand)/0.07),transparent_72%)]"
        />
        <div className="df-rise relative w-full max-w-sm">
          {/* The brand panel is gone below `lg`, so the mark comes inline. */}
          <div className="mb-8 lg:hidden">
            <Wordmark size="lg" />
            <p className="mt-1.5 text-xs text-muted-foreground">CMPDI · Coal India</p>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Accounts are issued by an administrator. Mining reports are only
            readable by an authorised account.
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
            <div className="mt-6 rounded-lg border border-brand/30 bg-brand/5 p-4">
              {/* The tint and the border carry the emphasis. The orange itself
                  is 2.51:1 on this canvas — it is the wordmark's colour, and
                  the interface stays on its blue precisely so that the mark
                  keeps meaning something. */}
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
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
      </main>
    </div>
  );
}
