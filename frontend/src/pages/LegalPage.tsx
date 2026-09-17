import React from "react";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { PRIVACY_HREF, TERMS_HREF, PublicRoute } from "@/lib/publicRoute";

/**
 * Privacy policy, terms of use, and the page for an address that is not one.
 *
 * Outside the sign-in wall on purpose: a data-handling statement that needs
 * an account to read answers nobody's question. The three share a frame so
 * the platform does not appear to end at the edge of the application.
 *
 * Everything below is checked against the code rather than adapted from a
 * template. Where a template would say "we may collect certain information",
 * this names the columns. A policy that describes a different system than the
 * one running is worse than none: it is a claim, made to an auditor, that
 * happens to be false.
 */

const UPDATED = "17 September 2026";

function Frame({ title, kicker, children }: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[46rem] px-6 py-12 sm:py-16">
        <header className="border-b border-border pb-8">
          <a
            href="#/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to DataForge
          </a>

          <div className="mt-6">
            <Wordmark size="lg" />
            <p className="mt-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              CMPDI · Coal India · Ministry of Coal
            </p>
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{kicker}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Last updated {UPDATED} · Smart India Hackathon, problem statement
            SIH26023
          </p>
        </header>

        <div className="df-prose py-10">{children}</div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
          <a className="hover:text-foreground" href={PRIVACY_HREF}>Privacy</a>
          <a className="hover:text-foreground" href={TERMS_HREF}>Terms of use</a>
          <a className="hover:text-foreground" href="#/">Sign in</a>
        </footer>
      </div>
    </div>
  );
}

function Privacy() {
  return (
    <Frame
      title="Privacy and data handling"
      kicker="What DataForge stores, what leaves the deployment, and what it never keeps."
    >
      <p>
        DataForge is an internal tool for reconciling mining reports. It holds
        departmental documents, so this page states plainly what happens to
        them. Every claim here describes the code as deployed; where something
        is a choice an operator makes, it says so.
      </p>

      <h2>What is stored</h2>
      <p>
        When a report is uploaded, the platform extracts its text and stores
        <strong> the text, not the file</strong>. The uploaded PDF is parsed in
        memory and discarded; there is no file store and the backend runs with
        no disk of its own. What persists in the database is:
      </p>
      <ul>
        <li>the filename, and the date it was uploaded;</li>
        <li>the document&rsquo;s extracted text, and its text page by page, so a
          figure can cite the page it was read from;</li>
        <li>the structured fields extraction produced &mdash; mine, operator,
          period, production, method, and the rest;</li>
        <li>passages of that text with their embeddings, in a separate database,
          which is what makes semantic search work;</li>
        <li>questions asked of the corpus and the answers given, with the
          reports each answer drew on.</li>
      </ul>
      <p>
        Deleting a report removes its row and its passages. Nothing is retained
        for analytics, because there are none.
      </p>

      <h2>Accounts</h2>
      <p>
        There is no sign-up. Accounts exist only because an administrator
        configured them, and are created when the service starts. Passwords are
        never stored &mdash; only a PBKDF2 hash, which cannot be read back into
        the password that produced it. A sign-in returns a signed token that
        the browser keeps.
      </p>
      <p>
        The evaluation account (<code>demo</code>) is published on the sign-in
        page on purpose, so that someone assessing this project can open it
        without being issued credentials. It is read-only: it cannot upload,
        delete, resolve a finding, or rebuild the search index. That is enforced
        by the server, not by hiding buttons.
      </p>

      <h2>What leaves the deployment</h2>
      <p>
        Extraction, question answering and search embeddings are produced by an
        AI provider. On this deployment that is <strong>Google Gemini</strong>,
        and document text is sent to it for those three purposes and no other.
        No account details, passwords or tokens are ever included.
      </p>
      <p>
        The provider is a configuration choice, not an architectural one. The
        same platform runs against a model hosted inside the deployment
        (Ollama), in which case no document text leaves the network at all, and
        against no provider whatsoever, in which case it reports that its
        answers are stand-ins rather than presenting them as real. A ministry
        deployment that may not send text to an external service is a supported
        configuration, not a future one.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        <strong>DataForge sets no cookies.</strong> There is no analytics, no
        tracking pixel, no advertising network, no third-party script of any
        kind, and no profiling of anyone who uses it.
      </p>
      <p>
        The browser&rsquo;s local storage holds three things, all first-party and
        all strictly functional: the session token that keeps you signed in,
        your light or dark theme preference, and your display settings. They
        never leave your browser, and signing out clears the token. Because none
        of this is used to track anyone, no consent banner is shown &mdash; one
        would imply a choice that is not being made about you.
      </p>

      <h2>Transport and access</h2>
      <p>
        All traffic is served over HTTPS. Every document endpoint refuses an
        unauthenticated caller. The two databases are reachable only over the
        deployment&rsquo;s private network and are not exposed to the internet.
        Paid model calls are rate-limited per account, and the public evaluation
        account is limited more tightly than a named one.
      </p>

      <h2>Retention and removal</h2>
      <p>
        Documents stay until someone with a writing account deletes them. There
        is no automatic expiry, because a reporting corpus is meant to be
        compared across years. An operator wanting a record gone deletes the
        report; that removes its text, its fields and its indexed passages.
      </p>

      <h2>Where to ask</h2>
      <p>
        This is a hackathon prototype built for problem statement SIH26023, not
        a commissioned system. Questions about it go to the team that built it,
        through the channel you were given this deployment on.
      </p>
    </Frame>
  );
}

function Terms() {
  return (
    <Frame
      title="Terms of use"
      kicker="What this system is, what it is not, and what it expects of the person using it."
    >
      <p>
        These terms cover the DataForge prototype as deployed for Smart India
        Hackathon problem statement SIH26023. Using it means accepting them.
      </p>

      <h2>What this is</h2>
      <p>
        A prototype. It is a working system &mdash; it ingests real documents,
        reads them, and reconciles them &mdash; but it has not been commissioned,
        certified or accepted by CMPDI, Coal India Limited or the Ministry of
        Coal, and it is not an official system of any of them. Those names
        appear because they are the subject of the problem statement, not
        because the system speaks for them.
      </p>

      <h2>Accounts</h2>
      <p>
        Accounts are issued by an administrator. Keep yours to yourself; actions
        taken with it are attributed to it, including who resolved which
        finding. The published <code>demo</code> account is for evaluation, is
        read-only, and may be reset or withdrawn at any time.
      </p>

      <h2>What you may upload</h2>
      <p>
        Mining and geological reports, as PDFs, that you are entitled to hold
        and process. Do not upload personal data, classified material, or
        documents you have no right to share. The platform is built to read
        production figures out of departmental reporting; nothing about it is
        designed to hold personal information, and it should not be given any.
      </p>

      <h2>On the figures it produces</h2>
      <p>
        This matters more here than the rest of this page.
      </p>
      <p>
        <strong>Extraction is performed by a language model and is not
        guaranteed to be correct.</strong> Every figure DataForge reports is a
        reading of a document, and a reading can be wrong. That is why each one
        cites the page it came from, why reports that disagree are shown side by
        side rather than averaged, and why the dashboard says
        &ldquo;not measured&rdquo; rather than inventing an accuracy figure it
        has not earned.
      </p>
      <p>
        Nothing here is a substitute for the source document or for a
        qualified person reading it. Do not file, publish or decide on a figure
        from this system without checking the citation it gives you. The
        citation exists precisely so that check is cheap.
      </p>

      <h2>Availability</h2>
      <p>
        The prototype runs on free hosting tiers. It may be slow to wake, may be
        rate-limited by its AI provider, and may be taken down or reset without
        notice. It comes with no warranty and no service commitment of any kind.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not attempt to access documents or accounts that are not yours, do
        not try to exhaust the platform&rsquo;s rate limits or its provider quota,
        and do not use it to process material it was not built for. The limits
        in place exist to keep a shared prototype usable by everyone evaluating
        it.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as the prototype does. The date at the top says
        when they last did.
      </p>
    </Frame>
  );
}

function NotFound() {
  return (
    <Frame
      title="That address does not exist"
      kicker="No page is served here. The link may be mistyped, or it may have pointed at something that has since moved."
    >
      <p>
        DataForge is a single application behind a sign-in, and every screen
        inside it lives after the <code>#</code> in the address &mdash;
        <code> /#/documents</code>, not <code>/documents</code>. If you followed
        a link from elsewhere, that is the likely difference.
      </p>
      <p>
        <a href="#/">Go to DataForge</a>, or read the{" "}
        <a href={PRIVACY_HREF}>privacy policy</a> or the{" "}
        <a href={TERMS_HREF}>terms of use</a>.
      </p>
    </Frame>
  );
}

export function LegalPage({ route }: { route: PublicRoute }) {
  if (route === "privacy") return <Privacy />;
  if (route === "terms") return <Terms />;
  return <NotFound />;
}
