import React from "react";
import { AlertCircle, ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/brand/Wordmark";
import { StrataBackdrop } from "@/components/brand/StrataBackdrop";
import {
  ApiError,
  SystemStatus,
  fetchDemoCredentials,
  fetchSystemStatus,
  login,
} from "@/services/api";
import { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { StatusTone, statusRows } from "@/lib/systemStatus";

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
 *
 * The status panel under the form reads /health, which needs no session. It
 * reports what the backend says, including when that is bad news — a status
 * display that cannot go amber is decoration, and this one is here precisely
 * because the platform's own claim is that it says when something is off.
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

/** Section headings on the form side. One style, so the column reads as a grid. */
const SECTION_LABEL =
  "text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-foreground";

const DOT: Record<StatusTone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  down: "bg-destructive",
  idle: "bg-muted-foreground/40",
};

const VALUE: Record<StatusTone, string> = {
  ok: "text-foreground",
  warn: "text-warning",
  down: "text-destructive",
  idle: "text-muted-foreground",
};

export function LoginPage({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [demo, setDemo] = React.useState<{ username: string; password: string } | null>(null);
  const [status, setStatus] = React.useState<SystemStatus | null>(null);

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
    // Never rejects: an unreachable backend is one of the states it reports.
    fetchSystemStatus().then((result) => {
      if (!cancelled) setStatus(result);
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
            {/* Bold rather than semibold, and tracked in a shade tighter. On a
                near-black ground a semibold headline loses weight to the
                backdrop; the hierarchy below it is held by size and colour, so
                the extra weight here does not flatten it. */}
            <h2 className="text-balance text-3xl font-bold leading-[1.18] tracking-[-0.022em] text-white xl:text-[2.6rem]">
              Mining reports that contradict each other,{" "}
              <span className="text-brand">reconciled</span> with the evidence
              still attached.
            </h2>

            <dl className="mt-10 space-y-5 border-t border-white/10 pt-8">
              {CAPABILITIES.map((claim) => (
                <div key={claim.title} className="flex gap-4">
                  {/* Bold and tracked wider: at 12px these are the smallest
                      type on the panel and they carry the orange, which the
                      backdrop otherwise swallows. */}
                  <dt className="w-[7.25rem] shrink-0 pt-px text-xs font-bold uppercase tracking-[0.1em] text-brand">
                    {claim.title}
                  </dt>
                  {/* 70% to 82%: still plainly secondary to the headline, and
                      readable on a projector, which 70% was not. */}
                  <dd className="min-w-0 flex-1 text-sm leading-relaxed text-white/[0.82]">
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

      {/* `items-center` centred the column and then, once it grew taller than
          a short viewport, pushed its top above the scroll origin where no
          amount of scrolling reaches it - the wordmark went missing at 390px.
          Auto margins centre the same way and collapse to zero instead. */}
      <main className="relative flex flex-1 justify-center overflow-y-auto px-4 py-10">
        {/* The column is narrow in a panel nearly twice its width, so the panel
            read as a blank sheet next to the brand side. One soft wash behind
            it gives the eye somewhere to land without putting anything in the
            way of the form. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_46%_at_50%_40%,hsl(var(--brand)/0.07),transparent_72%)]"
        />
        <div className="df-rise relative my-auto w-full max-w-[25rem]">
          {/* The brand panel is gone below `lg`, so the mark comes inline. */}
          <div className="mb-8 lg:hidden">
            <Wordmark size="lg" />
            <p className="mt-1.5 text-xs text-muted-foreground">CMPDI · Coal India</p>
          </div>

          <header>
            {/* Below `lg` the wordmark is already directly above this, and the
                product name twice in 60px reads as a mistake. */}
            <p className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:block">
              DataForge
            </p>
            <h1 className="mt-1.5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <ShieldCheck className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground" />
              Secure access
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Access the DataForge mining intelligence workspace. Accounts are
              issued by an administrator, and reports are readable only by an
              authorised account.
            </p>
          </header>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                className="h-10"
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
                className="h-10"
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

            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              <LogIn className="h-3.5 w-3.5" />
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {demo && (
            <section className="mt-7 overflow-hidden rounded-lg border border-border bg-card shadow-xs">
              {/* The orange is a 3px rule, not type: at 12px on this canvas the
                  brand colour measures 2.51:1, which is the mark's exemption
                  and not a licence to set words in it. */}
              <header className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
                <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-brand" />
                <h2 className={SECTION_LABEL}>Evaluator access</h2>
              </header>

              <div className="px-4 py-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Explore the workspace with read-only demo access. It opens every
                  document and asks every question, but cannot upload, delete or
                  resolve findings.
                </p>

                <dl className="mt-3.5 divide-y divide-border overflow-hidden rounded-md border border-border bg-muted/40 text-xs">
                  <div className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <dt className="text-muted-foreground">Username</dt>
                    <dd className="font-mono text-foreground">{demo.username}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <dt className="text-muted-foreground">Access</dt>
                    <dd className="text-foreground">Read-only</dd>
                  </div>
                </dl>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-3.5 h-10 w-full"
                  disabled={isSubmitting}
                  onClick={(e) => submit(e, demo)}
                >
                  Enter demo workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>

                {/* The password stays on the page — it is how someone types the
                    account in by hand, and hiding it would make the button the
                    only way in. It is not the headline it used to be. */}
                <p className="mt-2.5 text-center text-[0.6875rem] text-muted-foreground">
                  Or sign in manually with password{" "}
                  <code className="font-mono text-foreground">{demo.password}</code>
                </p>
              </div>
            </section>
          )}

          <section className="mt-7 border-t border-border pt-5">
            <h2 className={SECTION_LABEL}>System status</h2>
            <dl className="mt-3 space-y-2">
              {statusRows(status).map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 text-xs">
                  <span
                    aria-hidden
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[row.tone])}
                  />
                  <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                  <span aria-hidden className="h-px min-w-3 flex-1 bg-border" />
                  <dd
                    className={cn("shrink-0 font-medium", VALUE[row.tone])}
                    title={row.detail ?? undefined}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
