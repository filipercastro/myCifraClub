import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));
const songsMDDir = join(root, 'songsMD');
const songsDir = join(root, 'songs');

// ── Slugify ────────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'e')
    .replace(/[^\w\s]/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ── Chord line detection ───────────────────────────────────────────────────
const ACCENTED = /[àáâãäçèéêíìïóòôõúùüñÀÁÂÃÄÇÈÉÊÍÌÏÓÒÔÕÚÙÜÑ]/;
const CHORD_STANDARD = /^[A-G][#b]?(m(aj)?|maj|min|dim|aug|sus[24]?|add)?[0-9]*(\/[A-G][#b]?)?$/;
const CHORD_EXTRA    = /^[\(\)0-9xX\/]+$/; // repeat markers, bare parens
// Brazilian extended chords: root + optional quality (incl. M for major) + digits
// + optional M/+ suffix + parenthetical voicing(s) + optional slash bass
// Handles: A7M, DM7, C7M, F7MG (as single), D5(7M/9), Bm7(9/11), G4+(6), etc.
const CHORD_EXTENDED = /^[A-G][#b]?(M|m(aj)?|maj|min|dim|aug|sus[24]?|add|\+)?[0-9]*(M|\+)?(\([^)]*\))*(\/[A-G][#b]?)?$/;

// Greedily parse a token as a sequence of concatenated chord names.
// Handles standard chords plus Brazilian M-suffix notation (A7M, DM7, C7M).
function isConcatenatedChords(s) {
  let i = 0;
  let count = 0;
  while (i < s.length) {
    // skip leading parens / digits
    while (i < s.length && /[\(\)0-9xX]/.test(s[i])) i++;
    if (i >= s.length) break;
    // must start with a note name A–G
    if (!/[A-G]/.test(s[i])) return false;
    i++;
    count++;
    // optional sharp / flat
    if (i < s.length && /[#b]/.test(s[i])) i++;
    // optional quality suffix: m, maj, min, dim, aug, sus2, sus4, add, or Brazilian M (major)
    const qualMatch = s.slice(i).match(/^(M(?!aj)|m(aj)?|maj|min|dim|aug|sus[24]?|add)/);
    if (qualMatch) i += qualMatch[0].length;
    // optional number(s)
    while (i < s.length && /[0-9]/.test(s[i])) i++;
    // optional Brazilian M suffix after digits (e.g. A7M, C7M)
    if (i < s.length && s[i] === 'M') i++;
    // optional augmented + suffix
    if (i < s.length && s[i] === '+') i++;
    // optional parenthetical extension (9/11), (13), (7M/9), etc. — consume as opaque block
    while (i < s.length && s[i] === '(') {
      i++;
      while (i < s.length && s[i] !== ')') i++;
      if (i < s.length) i++; // consume ')'
    }
    // optional slash chord  /[A-G][#b]?
    if (i < s.length && s[i] === '/') {
      i++;
      if (i < s.length && /[A-G]/.test(s[i])) {
        i++;
        if (i < s.length && /[#b]/.test(s[i])) i++;
      }
    }
    // skip trailing parens
    while (i < s.length && /[\)\(]/.test(s[i])) i++;
  }
  return count > 0 && i === s.length;
}

function isValidChordToken(tok) {
  return CHORD_STANDARD.test(tok) || CHORD_EXTRA.test(tok) || CHORD_EXTENDED.test(tok) || isConcatenatedChords(tok);
}

// Parse a concatenated chord token into space-separated individual chords.
// e.g. "CEmCEm" → "C Em C Em",  "EA5EA5" → "E A5 E A5"
function expandConcatenatedChords(s) {
  const parts = [];
  let i = 0;
  while (i < s.length) {
    // collect leading parens / digits as their own segment
    const prefStart = i;
    while (i < s.length && /[\(\)0-9xX]/.test(s[i])) i++;
    if (i > prefStart) parts.push(s.slice(prefStart, i));
    if (i >= s.length) break;
    if (!/[A-G]/.test(s[i])) break;
    const cStart = i;
    i++; // note letter
    if (i < s.length && /[#b]/.test(s[i])) i++; // sharp/flat
    const qual = s.slice(i).match(/^(M(?!aj)|m(aj)?|maj|min|dim|aug|sus[24]?|add)/);
    if (qual) i += qual[0].length;
    while (i < s.length && /[0-9]/.test(s[i])) i++; // numbers
    if (i < s.length && s[i] === 'M') i++;  // Brazilian M suffix (A7M)
    if (i < s.length && s[i] === '+') i++;  // augmented + suffix
    // parenthetical extension block (9/11), (13), etc.
    while (i < s.length && s[i] === '(') {
      i++;
      while (i < s.length && s[i] !== ')') i++;
      if (i < s.length) i++;
    }
    if (i < s.length && s[i] === '/') { // slash chord
      i++;
      if (i < s.length && /[A-G]/.test(s[i])) { i++; if (i < s.length && /[#b]/.test(s[i])) i++; }
    }
    while (i < s.length && /[\)\(]/.test(s[i])) i++; // trailing parens
    parts.push(s.slice(cStart, i));
  }
  return parts.join(' ');
}

// Expand concatenated chord tokens inside a chord line while preserving all whitespace.
function expandChordLine(line) {
  return line.replace(/\S+/g, tok => {
    if (CHORD_STANDARD.test(tok) || CHORD_EXTRA.test(tok) || CHORD_EXTENDED.test(tok)) return tok;
    if (isConcatenatedChords(tok)) return expandConcatenatedChords(tok);
    return tok;
  });
}

function isChordLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (ACCENTED.test(t)) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(isValidChordToken);
}

// ── HTML escaping ──────────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Per-song font size calculator ──────────────────────────────────────────
// Available height: 1280px viewport − 24px body padding − ~41px header ≈ 1215px ≈ 72rem (conservative).
const AVAILABLE_REM = 72;
// Column widths at 800px viewport, 0.75rem (12px) body padding each side.
const COL_PX_SINGLE = 776;  // 800 − 24
const COL_PX_TWOCOL = 372;  // (800 − 24 − 32 col-gap) / 2
// ui-monospace character advance ratio (fraction of font-size in px).
const CHAR_RATIO = 0.6;

// lineCountFull:      .line divs that have a .lyrics span (chord + lyric)
// lineCountChordOnly: .line divs with only a .chords span (intros, solos)
// lyricLengths:       raw char count of each lyric line (for wrap estimation)
function calcFontSize(lineCountFull, lineCountChordOnly, markerCount, twoCol, lyricLengths) {
  const totalLines = lineCountFull + lineCountChordOnly;
  if (totalLines === 0) return 1.0;

  const colPx    = twoCol ? COL_PX_TWOCOL : COL_PX_SINGLE;
  const effective = twoCol ? AVAILABLE_REM * 2 : AVAILABLE_REM;

  // Height per element (F-scaled rem + fixed rem):
  //   full line:       chords(1.3F) + lyrics(1.3F) + margin-bottom(0.15)
  //   chord-only line: chords(1.3F) only
  //   marker:          0.75em×1.5 body lh = 1.125F, plus 0.6+0.3 margins = 0.9 fixed
  const lF_full  = 2.6,  lFixed = 0.15;
  const lF_chord = 1.3;
  const mkrF     = 1.125, mkrFixed = 0.9;

  let F = 1.0;
  for (let i = 0; i < 30; i++) {
    const charsPerLine = colPx / (F * 16 * CHAR_RATIO);

    // Extra lines caused by lyric wrapping at current F
    let extraLines = 0;
    for (const len of lyricLengths) {
      if (len > charsPerLine) extraLines += Math.ceil(len / charsPerLine) - 1;
    }

    const fullLines = lineCountFull + extraLines;
    const num = effective - lFixed * fullLines - mkrFixed * markerCount;
    const den = lF_full * fullLines + lF_chord * lineCountChordOnly + mkrF * markerCount;
    const newF = Math.max(0.72, den > 0 ? num / den : 0.72);
    if (Math.abs(newF - F) < 0.001) { F = newF; break; }
    F = newF;
  }
  return Math.max(0.72, F);
}

// ── Content parser ─────────────────────────────────────────────────────────
// Returns { bodyHTML, twoCol, lineCountFull, lineCountChordOnly, markerCount, lyricLengths }
function parseContent(innerLines) {
  let html = '';
  let pendingChords = null; // raw line (spacing preserved for white-space:pre)
  let twoCol = false;
  let lineCountFull = 0;
  let lineCountChordOnly = 0;
  let markerCount = 0;
  const lyricLengths = [];

  function flushChords() {
    if (pendingChords !== null) {
      html += `    <div class="line">\n      <span class="chords">${esc(pendingChords)}</span>\n    </div>\n`;
      pendingChords = null;
      lineCountChordOnly++;
    }
  }

  for (const line of innerLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushChords();
      continue;
    }

    // Section markers  == ... ==  (including COLBREAK)
    if (/^== .+ ==$/.test(trimmed)) {
      flushChords();
      if (trimmed === '== COLBREAK ==') {
        twoCol = true;
        html += `\n    <p class="marker colbreak">${esc(trimmed)}</p>\n\n`;
      } else {
        html += `\n    <p class="marker">${esc(trimmed)}</p>\n\n`;
        markerCount++;
      }
      continue;
    }

    if (isChordLine(line)) {
      flushChords();
      pendingChords = expandChordLine(line); // preserve spacing; expand run-on chord tokens
    } else {
      // Lyric line
      const rawLyric = line.trimEnd();
      lyricLengths.push(rawLyric.length);
      html += `    <div class="line">\n`;
      if (pendingChords !== null) {
        html += `      <span class="chords">${esc(pendingChords)}</span>\n`;
        pendingChords = null;
      } else {
        html += `      <span class="chords"></span>\n`;
      }
      html += `      <span class="lyrics">${esc(rawLyric)}</span>\n`;
      html += `    </div>\n`;
      lineCountFull++;
    }
  }

  flushChords();
  return { bodyHTML: html, twoCol, lineCountFull, lineCountChordOnly, markerCount, lyricLengths };
}

// ── HTML template ──────────────────────────────────────────────────────────
function generateHTML(title, artist, bodyHTML, twoCol, fontSize) {
  const mainClass = twoCol ? 'song-body two-col' : 'song-body';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — ${esc(artist)}</title>
  <link rel="stylesheet" href="../../css/style.css">
</head>
<body>
  <header class="song-header">
    <h1 class="song-title">${esc(title)} · <span class="song-artist">${esc(artist)}</span></h1>
  </header>

  <main class="${mainClass}" style="font-size: ${fontSize.toFixed(3)}rem">

${bodyHTML}
  </main>
</body>
</html>
`;
}

// ── Process one MD file ────────────────────────────────────────────────────
async function processFile(mdPath, artistName, songTitle) {
  const raw = await readFile(mdPath, 'utf-8');
  const lines = raw.split('\n');

  // Find fenced code block
  const fenceStart = lines.findIndex(l => l.trim() === '```');
  const fenceEnd = lines.findLastIndex(l => l.trim() === '```');
  if (fenceStart === -1 || fenceEnd === fenceStart) {
    return { ok: false, reason: 'no fenced code block' };
  }

  const innerLines = lines.slice(fenceStart + 1, fenceEnd);
  const { bodyHTML, twoCol, lineCountFull, lineCountChordOnly, markerCount, lyricLengths } = parseContent(innerLines);
  const fontSize = calcFontSize(lineCountFull, lineCountChordOnly, markerCount, twoCol, lyricLengths);

  const artistSlug = slugify(artistName);
  const songSlug   = slugify(songTitle);
  const outDir     = join(songsDir, artistSlug);
  const outPath    = join(outDir, `${songSlug}.html`);

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, generateHTML(songTitle, artistName, bodyHTML, twoCol, fontSize), 'utf-8');
  return { ok: true, twoCol, outPath, fontSize };
}

// ── Main ───────────────────────────────────────────────────────────────────
const artistDirs = (await readdir(songsMDDir, { withFileTypes: true }))
  .filter(d => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

let total = 0, twoColCount = 0, errors = 0;
let minFont = Infinity, maxFont = 0;

for (const artistDir of artistDirs) {
  const songs = (await readdir(join(songsMDDir, artistDir.name)))
    .filter(f => f.endsWith('.md'))
    .sort();

  for (const songFile of songs) {
    const songTitle = songFile.replace(/\.md$/, '');
    const mdPath = join(songsMDDir, artistDir.name, songFile);
    const result = await processFile(mdPath, artistDir.name, songTitle);
    if (result.ok) {
      total++;
      if (result.twoCol) twoColCount++;
      if (result.fontSize < minFont) minFont = result.fontSize;
      if (result.fontSize > maxFont) maxFont = result.fontSize;
    } else {
      console.error(`  SKIP ${artistDir.name} / ${songTitle}: ${result.reason}`);
      errors++;
    }
  }
}

console.log(`\nDone: ${total} songs written (${twoColCount} two-col, ${total - twoColCount} single-col), ${errors} skipped`);
console.log(`Font range: ${minFont.toFixed(3)}rem – ${maxFont.toFixed(3)}rem`);
