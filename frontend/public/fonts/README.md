# Fonts

All three faces are served from this directory rather than a font CDN.

| file | face | size |
|---|---|---|
| `inter-latin-variable.woff2` | Inter, weights 100–900, Latin | 48 kB |
| `geist-mono-latin-variable.woff2` | Geist Mono, weights 100–900, Latin | 23 kB |
| `poppins-600-wordmark.woff2` | Poppins SemiBold, eight glyphs | 1.1 kB |

## Why self-hosted

Inter sets every word in the app and Geist Mono sets every figure in it, and
both were fetched from Google at runtime through a render-blocking
stylesheet: nothing painted until a third party answered, and every visitor's
address went to Google to get a typeface. Vendored here they are one
same-origin request each, preloaded in `index.html`, and the app renders the
same with no network at all.

Poppins is separate and older: the wordmark is the logo, and if that request
is slow or blocked the mark falls back to Inter, whose double-storey `a` and
`g` draw a visibly different logo. It is subset to the eight glyphs the mark
draws — `D a t f o r g e` — which is why it is 1.1 kB rather than ~35 kB.

The two variable files cover the whole weight range in one file each, so
adding a weight to the design needs no new asset. Their `unicode-range` is
the same Latin range Google serves, so a Hindi or Telugu summary falls
through to a system face exactly as it did before.

## Regenerating

Inter and Geist Mono come from the Fontsource packages:

    npm install --no-save @fontsource-variable/inter @fontsource-variable/geist-mono
    cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 \
       public/fonts/inter-latin-variable.woff2
    cp node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2 \
       public/fonts/geist-mono-latin-variable.woff2

`unicode.json` in each package holds the range to copy into the `@font-face`
in `src/index.css` if it ever changes.

For the wordmark, if the mark needs another glyph, change the `text=`
parameter and the `unicode-range` in `src/index.css` to match:

    curl -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0" \
      "https://fonts.googleapis.com/css2?family=Poppins:wght@600&text=Datforge"

That returns a `@font-face` block; download the URL inside its `src:` and
replace the file.

## Licences

All three are licensed under the SIL Open Font License 1.1, which permits
self-hosting, subsetting and redistribution provided the licence travels with
the font: `OFL-Inter.txt`, `OFL-GeistMono.txt` and `OFL-Poppins.txt`.
