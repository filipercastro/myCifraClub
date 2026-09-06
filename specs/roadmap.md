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

## Phase 9 — Colbreak Fix, New Songs & Codinome Beija-Flor ✅

### 9a — Column-break marker fix ✅

- `.marker.colbreak` had `display: none`, which removed the element from layout flow and made `break-before: column` inert. Fixed by keeping the element in flow with `height: 0; visibility: hidden; font-size: 0; line-height: 0; break-before: column`. Column splits now fire correctly.

### 9b — Capital Inicial additions ✅

- Added **O Passageiro** and **Tudo Que Vai** under Capital Inicial.
- Both linked from `index.html`.

### 9c — Codinome Beija-Flor fix ✅

- All chord lines (`A7M`, `DM7`, `F7M`, `C7M`) were landing in `.lyrics` spans because the old parser didn't recognise Brazilian M-suffix chords. Rewrote the HTML with correct structure. The updated `CHORD_EXTENDED` regex and `isConcatenatedChords` now handle these automatically on any rebuild.

---

## Phase 10 — Font-Size Formula Overhaul & HTML→MD Sync ✅

### 10a — Improved font-size formula ✅

Three flaws in the Phase-7 formula were identified from tablet review:

1. **Chord-only lines counted as full height** — solo/intro lines that have no lyric row (only a `.chords` span) are `1.3F rem` tall, not `2.6F + 0.15 rem`. Fixed by tracking `lineCountFull` vs `lineCountChordOnly` separately.
2. **Lyric wrapping not modelled** — long lyrics in narrow two-col columns wrap, adding extra height. Fixed by iterative convergence: estimate chars-per-line from column width and current `F`, compute extra wrapped lines, recalculate `F`, repeat until `|ΔF| < 0.001`.
3. **Available height slightly over-estimated** — reduced `AVAILABLE_REM` from 75 → 72.

New constants: `COL_PX_SINGLE = 776`, `COL_PX_TWOCOL = 372`, `CHAR_RATIO = 0.6`.
Result: 152 songs, font range **0.720 – 1.792 rem** (previously 0.720 – 1.879 rem with overflows).

### 10b — Extended Brazilian chord recognition ✅

Added `CHORD_EXTENDED` regex covering: `A7M`, `DM7`, `C7M`, `F7M` (M = major/maior), `A5+` (augmented), `D5(7M/9)`, `Bm7(9/11)`, `G4+(6)`, `Em7(13)`.

Updated `isConcatenatedChords` and `expandConcatenatedChords` to consume M-suffix after digits, augmented `+`, and parenthetical extension blocks `(...)` as opaque units (so `/` inside parens is not mistaken for a slash-chord separator).

Songs previously at floor (`primeiros-erros`, `codinome-beijaflor`) now compute correctly because chord lines are no longer mis-counted as lyric lines.

### 10c — MD fixes and COLBREAK additions ✅

- **Natasha.md** — removed O Passageiro + Tudo Que Vai content that had been accidentally appended inside the fence block (inflating line count to 76+). Added `== COLBREAK ==` to make it two-col.
- **Pra Você Guardei o Amor**, **Anjos**, **Tanto** — added `== COLBREAK ==` at natural section boundaries, moving these songs from floor (0.720 rem single-col) to 0.999 / 1.155 / 1.071 rem two-col.

### 10d — HTML → MD sync ✅

Manual chord-alignment edits made directly to HTML files were not reflected in the source `.md` files. Wrote `sync-html-to-md.mjs` (reverse-build script):

- Reads each song HTML, extracts chord content (`.chords` spans) and lyrics (`.lyrics` spans) in source order, preserving exact whitespace.
- Reconstructs the fenced code block in the corresponding `.md` file while keeping the `# Title / **Artist**` header unchanged.
- Created `.md` files for **O Passageiro** and **Tudo Que Vai** (previously hand-crafted HTML with no MD source).
- 152 MD files updated. Future `node build-songs.mjs` runs reproduce the same chord content including all manual alignment edits.

---

## Future (unscheduled)

- Transpose control (JS, per-page).
- Font-size adjustment (JS, localStorage).
- Print / PDF stylesheet.
- Dark mode via `prefers-color-scheme`.
