import React from "react";

/**
 * The sign-in panel's background: sedimentary strata with a mineral seam
 * running through them, and a borehole log reading down the left.
 *
 * Drawn rather than photographed, for three reasons. A coal-mine photograph
 * off the web is someone's copyright and this is a submission to a government
 * competition. A full-bleed hero image is 200 kB–2 MB on the one request that
 * decides whether the page feels instant — the same critical path the charts
 * chunk was just taken off. And the text has to sit on it: a photograph's
 * luminance varies across the frame, so contrast becomes something you hope
 * for, where here every value under the text is chosen.
 *
 * It is about 3 kB of markup, gradients only — no SVG filters, which are
 * expensive to rasterise at full-bleed size.
 */

/** Tilted bands, top to bottom. `drop` is how far the layer falls left to right. */
const STRATA: { y: number; drop: number; height: number; fill: string; opacity: number }[] = [
  { y: 96, drop: 54, height: 78, fill: "#111c33", opacity: 1 },
  { y: 174, drop: 54, height: 40, fill: "#0d1728", opacity: 1 },
  { y: 214, drop: 54, height: 96, fill: "#16233d", opacity: 1 },
  { y: 310, drop: 54, height: 26, fill: "#0a1120", opacity: 1 },
  // The seam. One warm band in a cold section is the whole image.
  { y: 336, drop: 54, height: 18, fill: "#ff791a", opacity: 0.5 },
  { y: 354, drop: 54, height: 62, fill: "#0f1a2e", opacity: 1 },
  { y: 416, drop: 54, height: 118, fill: "#131f36", opacity: 1 },
  { y: 534, drop: 54, height: 44, fill: "#0b1220", opacity: 1 },
  { y: 578, drop: 54, height: 150, fill: "#101a2d", opacity: 1 },
  { y: 728, drop: 54, height: 220, fill: "#070c17", opacity: 1 },
];

/** Depths marked down the borehole, as a core log would be. */
const CORE_MARKS = [150, 232, 318, 348, 430, 540, 640, 760];

export function StrataBackdrop({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="df-ground" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#0b1424" />
          <stop offset="55%" stopColor="#070d1a" />
          <stop offset="100%" stopColor="#04070f" />
        </linearGradient>

        {/* Warmth bleeding out of the seam, which is what stops the panel
            reading as a flat dark rectangle. */}
        <radialGradient id="df-seam-glow" cx="0.62" cy="0.38" r="0.55">
          <stop offset="0%" stopColor="#ff791a" stopOpacity="0.4" />
          <stop offset="45%" stopColor="#ff791a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ff791a" stopOpacity="0" />
        </radialGradient>

        {/* Pulls the bottom-left dark again, where the wordmark and the
            headline sit. Contrast there is chosen, not hoped for. */}
        <linearGradient id="df-scrim" x1="0" y1="1" x2="0.7" y2="0">
          <stop offset="0%" stopColor="#04070f" stopOpacity="0.92" />
          <stop offset="55%" stopColor="#04070f" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#04070f" stopOpacity="0.15" />
        </linearGradient>

        <pattern id="df-survey" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34 0 L0 0 0 34" fill="none" stroke="#93a4c4" strokeWidth="0.5" opacity="0.07" />
        </pattern>
      </defs>

      <rect width="600" height="900" fill="url(#df-ground)" />

      <g className="df-strata">
        {STRATA.map((band) => (
          <path
            key={band.y}
            d={`M0 ${band.y} L600 ${band.y - band.drop} L600 ${band.y - band.drop + band.height} L0 ${band.y + band.height} Z`}
            fill={band.fill}
            opacity={band.opacity}
          />
        ))}

        {/* Faults cutting across the bedding. */}
        <path d="M186 0 L214 900" stroke="#93a4c4" strokeWidth="0.75" opacity="0.12" fill="none" />
        <path d="M438 0 L402 900" stroke="#93a4c4" strokeWidth="0.75" opacity="0.09" fill="none" />
      </g>

      <rect width="600" height="900" fill="url(#df-survey)" />
      <rect width="600" height="900" fill="url(#df-seam-glow)" className="df-glow" />

      {/* Borehole log. CMPDI's own instrument, drawn at the edge of its own
          sign-in screen. */}
      <g opacity="0.5">
        <line x1="72" y1="60" x2="72" y2="840" stroke="#93a4c4" strokeWidth="1" opacity="0.45" />
        {CORE_MARKS.map((depth) => (
          <line
            key={depth}
            x1="64"
            y1={depth}
            x2="80"
            y2={depth}
            stroke="#93a4c4"
            strokeWidth="1"
            opacity="0.4"
          />
        ))}
        {/* The tick at the seam is the one that is picked out. */}
        <circle cx="72" cy="348" r="4.5" fill="#ff791a" opacity="0.9" />
        <circle cx="72" cy="348" r="9" fill="none" stroke="#ff791a" strokeWidth="1" opacity="0.4" />
      </g>

      <rect width="600" height="900" fill="url(#df-scrim)" />
    </svg>
  );
}
