# PDF font

`ZenKakuGothicNew-Regular.ttf` is the unmodified static TrueType Zen Kaku Gothic
New Regular font. Copyright 2022 The Zen Kaku Gothic Project Authors
(https://github.com/googlefonts/zen-kakugothic).

- Source: https://github.com/google/fonts/tree/main/ofl/zenkakugothicnew
- File: https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/ZenKakuGothicNew-Regular.ttf
- License: SIL Open Font License 1.1; complete upstream license in
  `OFL-ZenKakuGothicNew.txt`.
- SHA-256: `b840cd07a67d89cacca44249ae49aa99ee7640eb5ce623be8d8983d6aabac801`.

The server loads this font from `public/fonts` relative to the application
working directory, in development and the compiled Docker application. Each
PDF embeds the complete font: fontkit subset output was found to omit glyph
outlines during real rendering. This reliable fallback adds approximately
1.5 MB per PDF. The bounded acceptance fixture covers Japanese names and text,
accented Latin text, digits, and a long tracking URL. It is not a universal
Unicode/shaping solution. Unsupported characters cause an explicit export error
instead of replacement or silent text loss. Arabic, Hebrew, emoji, and complex
bidirectional layout need a separate tested expansion.

The existing Helvetica Bold headings are fixed application labels; customer
and merchant values use the bundled Unicode font, including the raw snapshot.
