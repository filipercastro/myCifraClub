# Roadmap

Phases are intentionally tiny — each one produces something openable in a browser.

---

## Phase 1 — Skeleton ✅

- Create `index.html` with a heading and an empty song list.
- Create `css/style.css` with CSS custom properties and base typography.
- Verify the page opens correctly in a browser.

## Phase 2 — First Song Page ✅

- Convert one song from `songsMD/<Artist Name>/<Song Title>.md` to `songs/<artist-slug>/<song-slug>.html`.
- Style `.chords` span with `white-space: pre` so character-column chord positions are preserved above their lyrics.
- Style `.marker` for section labels (`== Refrão ==`, etc.).
- Link the song from `index.html`.

## Phase 3 — Fit-to-Screen Layout ✅

- `.song-body` is single-column by default at `font-size: 0.65rem`.
- `.song-body.two-col` adds `columns: 2; column-gap: 2rem` for songs that contain `== COLBREAK ==`.
- `break-inside: avoid` on `.line` and `.marker` prevents chord/lyric pairs and section labels from splitting across columns.
- Verified: "Tocando Em Frente" content ends at 806 px in a 1280 px viewport (single column, ~474 px of headroom).

## Phase 4 — Index Polish ✅

- `generate-index.mjs` scans `songsMD/`, sorts artists with `localeCompare('pt')`, slugifies names, and emits `index.html` with 60 `<section class="artist-group">` blocks.
- Index uses a 3-column CSS `columns` layout; artist headings are small-caps labels; song entries link to the (future) HTML paths under `songs/`.
- Header shows total count: "150 songs · 60 artists".

## Phase 5 — Batch Conversion

- Write a conversion script that reads each `songsMD/<Artist Name>/<Song Title>.md`, slugifies the names, and produces `songs/<artist-slug>/<song-slug>.html`.
- The script must parse the fenced code block, identify chord lines vs. lyric lines, and emit the `.line` / `.chords` / `.lyrics` HTML structure.
- Handle `== Section Name ==` markers as `<p class="marker">` elements.
- If the file contains `== COLBREAK ==`, emit `<main class="song-body two-col">` instead of `<main class="song-body">`. Render the marker itself as `<p class="marker colbreak">` (used for future forced column-break CSS if needed).
- Validate a sample of the generated pages fit the one-screen constraint.

## Phase 6 — Hosting

- Initialize a git repository.
- Push to GitHub and enable GitHub Pages.
- Confirm both pages render correctly on the live URL.

---

## Future (unscheduled)

- Transpose control (JS, per-page).
- Font-size adjustment (JS, localStorage).
- Print / PDF stylesheet.
- Dark mode via `prefers-color-scheme`.
