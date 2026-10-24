# Cromiqa brand assets (provisional)

- `cromiqa-icon.svg` — app icon / favicon (ink tile, white Q, lime check tail).
- `cromiqa-q-mark.svg` — standalone Q mark on white.
- The wordmark is rendered by `src/brand/Wordmark.tsx` (Manrope ExtraBold "CROMI" + Q mark + "A").

These are placeholders designed to be swapped. Replace the files here and the
component in `src/brand/` — no other part of the app depends on logo internals.
Lime (#C7FF2F) is only used for the tail on dark backgrounds (contrast on white is too low).
