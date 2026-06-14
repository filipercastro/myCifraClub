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

## Phase 6 — Hosting ✅

- Initialize a git repository.
- Push to GitHub and enable GitHub Pages.
- Live at https://filipercastro.github.io/myCifraClub/

---

## Phase 7 — Layout Tightening & Font Maximisation

Goal: use the available 800 × 1280 px viewport as fully as possible so songs are easier to read without scrolling.

### 7a — Compact header

- Title and artist on **one line**, separated by a `·` (middle dot): e.g. `Tocando Em Frente · Almir Sater`
- `.song-title` stays bold; `.song-artist` rendered inline in muted colour at a slightly smaller weight.
- Reduce `padding-bottom` and `margin-bottom` on `.song-header` — target total header height ≈ 1.5 rem (currently ~3.5 rem).

### 7b — Reduced page padding

- Shrink `body` padding from `1.5rem` to `0.75rem` on all sides — recovers ~1.5 rem (≈ 24 px) of vertical space.

### 7c — Per-song font size (build-time)

Font size varies per song because each song has a different line count.

- `build-songs.mjs` counts the number of `.line` divs and `.marker` elements produced for each song.
- Using the known line-height and fixed viewport geometry (1280 px − header − padding), it calculates the largest `font-size` (in rem) at which the song's total content height fits exactly within the song-body area.
- The calculated size is written as an inline `style="font-size: Xrem"` on the `<main>` element.
- Two-col songs have twice the effective content height available (`columns: 2` halves the rendered height), so they are calculated separately.
- Floor at `0.72rem` (minimum readable on the target device); no ceiling — if a song is short, it gets a large font.

### 7d — Centered text

- Add `text-align: center` to `.song-body`.
- This centers each lyric line and each chord line independently within the column.
- **Trade-off:** `white-space: pre` preserves the internal spacing of chord lines (so `G` is still 30 chars before `F9`), but centering shifts each line as a whole, which means a chord at column 30 may no longer appear directly above its syllable. This is an accepted trade-off — the colour coding (orange chords) makes the intent readable even without pixel-perfect vertical alignment.
- `.marker` elements are also centered.

---

## Future (unscheduled)

- Transpose control (JS, per-page).
- Font-size adjustment (JS, localStorage).
- Print / PDF stylesheet.
- Dark mode via `prefers-color-scheme`.
