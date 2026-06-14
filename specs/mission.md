# Mission

**My Chords Directory** is a personal, static web page collection for displaying song lyrics alongside their chord charts.

## Core Goal

Every song page must fit entirely within a single screen — no vertical scrolling. The reader should be able to see the full song, chords and lyrics together, at a glance.

## Non-Goals

- No user accounts, authentication, or server-side logic.
- No audio playback or MIDI generation.
- No editing UI — content is managed directly in source files.
- No third-party chord databases or external APIs.

## Guiding Principles

1. **One screen, one song.** If it doesn't fit, the layout is wrong — not the screen.
2. **Static first.** Plain HTML/CSS. No build step required to open a page.
3. **Readable offline.** No external fonts, CDN dependencies, or runtime fetches.
4. **Minimal friction.** Adding a new song should require editing one file and one line in the index.
