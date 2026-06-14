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
const CHORD_EXTRA   = /^[\(\)0-9xX\/]+$/; // repeat markers, bare parens

// Greedily parse a token as a sequence of concatenated chord names.
// e.g. "CEmCEm" → C + Em + C + Em  (all A-G uppercase)
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
    // optional quality suffix (m, maj, min, dim, aug, sus2, sus4, add)
    const qualMatch = s.slice(i).match(/^(m(aj)?|maj|min|dim|aug|sus[24]?|add)/);
    if (qualMatch) i += qualMatch[0].length;
    // optional number(s)
    while (i < s.length && /[0-9]/.test(s[i])) i++;
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
  return CHORD_STANDARD.test(tok) || CHORD_EXTRA.test(tok) || isConcatenatedChords(tok);
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

// ── Content parser ─────────────────────────────────────────────────────────
// Returns { bodyHTML, twoCol }
function parseContent(innerLines) {
  let html = '';
  let pendingChords = null; // raw line (spacing preserved for white-space:pre)

  function flushChords() {
    if (pendingChords !== null) {
      html += `    <div class="line">\n      <span class="chords">${esc(pendingChords)}</span>\n    </div>\n`;
      pendingChords = null;
    }
  }

  let twoCol = false;

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
      }
      continue;
    }

    if (isChordLine(line)) {
      flushChords();
      pendingChords = line; // preserve spacing for white-space:pre
    } else {
      // Lyric line
      html += `    <div class="line">\n`;
      if (pendingChords !== null) {
        html += `      <span class="chords">${esc(pendingChords)}</span>\n`;
        pendingChords = null;
      } else {
        html += `      <span class="chords"></span>\n`;
      }
      html += `      <span class="lyrics">${esc(trimmed)}</span>\n`;
      html += `    </div>\n`;
    }
  }

  flushChords();
  return { bodyHTML: html, twoCol };
}

// ── HTML template ──────────────────────────────────────────────────────────
function generateHTML(title, artist, bodyHTML, twoCol) {
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
    <h1 class="song-title">${esc(title)}</h1>
    <p class="song-artist">${esc(artist)}</p>
  </header>

  <main class="${mainClass}">

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
  const { bodyHTML, twoCol } = parseContent(innerLines);

  const artistSlug = slugify(artistName);
  const songSlug   = slugify(songTitle);
  const outDir     = join(songsDir, artistSlug);
  const outPath    = join(outDir, `${songSlug}.html`);

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, generateHTML(songTitle, artistName, bodyHTML, twoCol), 'utf-8');
  return { ok: true, twoCol, outPath };
}

// ── Main ───────────────────────────────────────────────────────────────────
const artistDirs = (await readdir(songsMDDir, { withFileTypes: true }))
  .filter(d => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

let total = 0, twoColCount = 0, errors = 0;

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
    } else {
      console.error(`  SKIP ${artistDir.name} / ${songTitle}: ${result.reason}`);
      errors++;
    }
  }
}

console.log(`\nDone: ${total} songs written (${twoColCount} two-col, ${total - twoColCount} single-col), ${errors} skipped`);
