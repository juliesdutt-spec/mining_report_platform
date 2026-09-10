import type { Plugin } from "vite";

/**
 * Build-time SEO output: canonical/Open Graph tags in the document head, plus
 * robots.txt and sitemap.xml written into the bundle.
 *
 * Everything absolute derives from one value, CANONICAL_SITE, because a
 * canonical tag, a share-card URL and a sitemap that disagree about the domain
 * are worse than none at all.
 *
 * The sitemap lists a single URL, and that is not an oversight. Navigation is
 * hash-based (`#/documents`), and a crawler discards everything from the `#`
 * on, so those are not separate URLs to Google. Every one of them is behind
 * the sign-in wall besides. `/` is the only address that exists here.
 */

const DESCRIPTION =
  "Reconcile conflicting mining reports. DataForge extracts production figures " +
  "from CMPDI and Coal India documents, flags disagreements, and cites every source.";

const TITLE = "DataForge — CMPDI / CIL Mining Intelligence";

/**
 * Where this app lives. Baked in rather than left to an environment variable
 * so a plain redeploy produces correct tags with no dashboard step — a
 * canonical that silently depends on someone remembering to set a variable is
 * a canonical that is missing. `VITE_SITE_URL` still overrides it if the site
 * ever moves.
 */
const CANONICAL_SITE = "https://getdataforge.online";

/** Trailing slashes make `${site}/path` produce a double slash. */
function normalise(url: string): string {
  return url.replace(/\/+$/, "");
}

export function seo(): Plugin {
  // Only the production deployment should be indexed. Two previews and a
  // production build competing for the same query is how a site ranks itself
  // down. Vercel also sends X-Robots-Tag on previews; this agrees with it.
  const env = process.env.VERCEL_ENV;
  const indexable = !env || env === "production";

  const explicit = process.env.VITE_SITE_URL || process.env.SITE_URL;
  const deployment = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";

  // Production speaks as the canonical domain, never as VERCEL_URL. That
  // variable holds the *per-deployment* hostname even in production, so
  // deriving the canonical from it would have every deploy claim a different
  // one and split the ranking between them. A preview has no canonical
  // identity of its own, so there it is exactly the right value to use.
  const site = normalise(
    explicit || (indexable ? CANONICAL_SITE : deployment || CANONICAL_SITE)
  );

  const verification = process.env.VITE_GSC_VERIFICATION || "";

  return {
    name: "dataforge-seo",
    apply: "build",

    transformIndexHtml(html) {
      const tags: string[] = [
        `<meta name="description" content="${DESCRIPTION}">`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:site_name" content="DataForge">`,
        `<meta property="og:title" content="${TITLE}">`,
        `<meta property="og:description" content="${DESCRIPTION}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:title" content="${TITLE}">`,
        `<meta name="twitter:description" content="${DESCRIPTION}">`,
      ];

      {
        // Crawlers will not resolve a relative og:image, so every one of
        // these has to carry the origin.
        tags.push(
          `<link rel="canonical" href="${site}/">`,
          `<meta property="og:url" content="${site}/">`,
          `<meta property="og:image" content="${site}/og-card.png">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta property="og:image:alt" content="DataForge — conflicting mining reports, reconciled with the evidence attached.">`,
          `<meta name="twitter:image" content="${site}/og-card.png">`
        );
      }

      if (!indexable) tags.push(`<meta name="robots" content="noindex, nofollow">`);
      if (verification) {
        tags.push(`<meta name="google-site-verification" content="${verification}">`);
      }

      return html.replace("</head>", `  ${tags.join("\n    ")}\n  </head>`);
    },

    generateBundle() {
      const robots = indexable
        ? ["User-agent: *", "Allow: /", "", `Sitemap: ${site}/sitemap.xml`]
        : ["# Preview deployment — not the canonical site.", "User-agent: *", "Disallow: /"];

      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: robots.join("\n") + "\n",
      });

      // A preview has no business advertising a sitemap: it would name the
      // canonical domain's pages from a host that should not be indexed.
      if (indexable) {
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source:
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            `  <url>\n` +
            `    <loc>${site}/</loc>\n` +
            `    <changefreq>weekly</changefreq>\n` +
            `    <priority>1.0</priority>\n` +
            `  </url>\n` +
            `</urlset>\n`,
        });
      }
    },
  };
}
