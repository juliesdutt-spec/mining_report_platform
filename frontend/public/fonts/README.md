# Wordmark font

`poppins-600-wordmark.woff2` is Poppins SemiBold, subset to the eight glyphs
the DataForge wordmark draws — `D a t f o r g e` — which is why it is 1.1 kB
rather than ~35 kB.

It is self-hosted rather than pulled from a font CDN because the wordmark is
the logo: if that request is slow, blocked, or fails, the mark falls back to
Inter, whose double-storey `a` and `g` draw a visibly different logo. See the
`@font-face` in `src/index.css` and `src/components/brand/Wordmark.tsx`.

## Regenerating

If the mark ever needs another glyph, change the `text=` parameter and the
`unicode-range` in `src/index.css` to match:

    curl -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0" \
      "https://fonts.googleapis.com/css2?family=Poppins:wght@600&text=Datforge"

That returns a `@font-face` block; download the URL inside its `src:` and
replace this file.

## Licence

Poppins is licensed under the SIL Open Font License 1.1 — see `OFL.txt`,
which is distributed alongside the font as the licence requires. The OFL
permits self-hosting, subsetting and redistribution.
