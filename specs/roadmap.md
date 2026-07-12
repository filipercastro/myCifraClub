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

## Phase 5 — Batch Conversion ✅

- `build-songs.mjs` reads each `songsMD/<Artist Name>/<Song Title>.md`, slugifies the names, and produces `songs/<artist-slug>/<song-slug>.html`.
- Parser identifies chord lines vs. lyric lines and emits the `.line` / `.chords` / `.lyrics` HTML structure.
- Three-tier chord detection: standard regex → parentheses/repeat tokens → concatenated chord parser for run-on tokens like `CEmCEm`.
- `== Section Name ==` markers emitted as `<p class="marker">` elements; `== COLBREAK ==` triggers `<main class="song-body two-col">`.
- Results: 150 songs written, 53 two-col, 97 single-col, 0 errors.

## Phase 6 — Hosting ✅

- Initialize a git repository.
- Push to GitHub and enable GitHub Pages.
- Live at https://filipercastro.github.io/myCifraClub/

---

## Phase 7 — Layout Tightening & Font Maximisation ✅

Goal: use the available 800 × 1280 px viewport as fully as possible so songs are easier to read without scrolling.

### 7a — Compact header ✅

- Title and artist on **one line**, separated by a `·` (middle dot): `<h1 class="song-title">Title · <span class="song-artist">Artist</span></h1>`.
- `.song-header` padding-bottom reduced to `0.25rem`, margin-bottom to `0.4rem`. Total header height ≈ 1.5 rem.

### 7b — Reduced page padding ✅

- `--spacing-page` reduced from `1.5rem` to `0.75rem` — recovers ~24 px of vertical space on each side.

### 7c — Per-song font size (build-time) ✅

- `build-songs.mjs` counts `.line` divs and non-colbreak `.marker` elements per song.
- Font size calculated as: `F = (available − fixed_margins) / (line_height_multiplier × count)` where available ≈ 75 rem (1280 px viewport minus padding and header).
- Two-col songs use `available × 2` (both columns each fit within 75 rem).
- Written as `style="font-size: Xrem"` on `<main>`. Floor at `0.72rem`.
- Result across 150 songs: range **0.72 rem – 1.88 rem**. "Tocando Em Frente" → 1.19 rem (up from 0.65 rem).
- `.marker` font-size changed to `0.75em` (scales with the song body).

### 7d — Centered text ✅

- `text-align: center` added to `.song-body`.
- Each lyric line and chord line is centered independently within the column.
- Accepted trade-off: centering shifts chord and lyric lines by different amounts (their lengths differ), so chords may not sit pixel-perfectly above their syllables. Orange colour coding keeps chords readable regardless.

## Phase 8 — Concatenated Chord Expansion ✅

Intro/solo lines in the source `.md` files sometimes contain chord sequences written without spaces (e.g. `CEmCEm`, `EA5EA5`, `A9D9A9EE4E`). These rendered as unreadable run-on tokens.

- Added `expandConcatenatedChords(s)` to `build-songs.mjs`: mirrors the existing greedy chord parser and re-joins individual chords with spaces.
- Added `expandChordLine(line)`: replaces each non-whitespace token that is a concatenated sequence (but not already a valid single chord) with its expanded form, preserving all inter-token whitespace so existing chord-lyric column alignment is unaffected.
- Applied in `parseContent` when `pendingChords` is set.
- Fixed 142 chord spans across the 150 songs.

---

## Future (unscheduled)

- Transpose control (JS, per-page).
- Font-size adjustment (JS, localStorage).
- Print / PDF stylesheet.
- Dark mode via `prefers-color-scheme`.
