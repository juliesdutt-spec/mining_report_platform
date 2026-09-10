import type { Plugin } from "vite";

/**
 * Build-time SEO output: canonical/Open Graph tags in the document head, plus
 * robots.txt and sitemap.xml written into the bundle.
 *
 * Everything absolute derives from one value, SITE_URL, because a canonical
 * tag, a share-card URL and a sitemap that disagree about the domain are worse
 * than none at all. When it is unset the absolute tags are skipped rather than
 * guessed — a canonical pointing at the wrong host de-indexes the right one.
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

/** Trailing slashes make `${site}/path` produce a double slash. */
function normalise(url: string): string {
  return url.replace(/\/+$/, "");
}

export function seo(): Plugin {
  // Vercel exposes the deployment host, so a preview gets correct tags too
  // without anyone setting anything.
  const explicit = process.env.VITE_SITE_URL || process.env.SITE_URL;
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const site = normalise(explicit || vercel || "");

  // Only the production deployment should be indexed. Two previews and a
  // production build competing for the same query is how a site ranks itself
  // down. Vercel also sends X-Robots-Tag on previews; this agrees with it.
  const env = process.env.VERCEL_ENV;
  const indexable = !env || env === "production";

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

      if (site) {
        // Crawlers will not resolve a relative og:image, so the card only
        // appears once the site URL is known.
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
        ? ["User-agent: *", "Allow: /", ...(site ? ["", `Sitemap: ${site}/sitemap.xml`] : [])]
        : ["# Preview deployment — not the canonical site.", "User-agent: *", "Disallow: /"];

      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: robots.join("\n") + "\n",
      });

      // Without a host there is no valid <loc>, and an invalid sitemap is a
      // Search Console error rather than a no-op.
      if (site && indexable) {
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
