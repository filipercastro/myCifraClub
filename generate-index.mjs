import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));
const songsMDDir = join(root, 'songsMD');

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

const artists = (await readdir(songsMDDir, { withFileTypes: true }))
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort((a, b) => a.localeCompare(b, 'pt'));

let sections = '';
let totalSongs = 0;

for (const artist of artists) {
  const artistSlug = slugify(artist);
  const songs = (await readdir(join(songsMDDir, artist)))
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'pt'));

  const entries = songs.map(f => {
    const title = f.replace(/\.md$/, '');
    const songSlug = slugify(title);
    return `          <li><a href="songs/${artistSlug}/${songSlug}.html">${title}</a></li>`;
  }).join('\n');

  sections += `
        <section class="artist-group">
          <h2 class="artist-heading">${artist}</h2>
          <ul class="song-entries">
${entries}
          </ul>
        </section>`;

  totalSongs += songs.length;
}

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Chords Directory</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header class="site-header">
    <h1 class="site-title">My Chords Directory</h1>
    <p class="site-subtitle">${totalSongs} songs · ${artists.length} artists</p>
  </header>
  <main class="index-body">${sections}
  </main>
</body>
</html>`;

await writeFile(join(root, 'index.html'), html, 'utf-8');
console.log(`Generated index.html — ${artists.length} artists, ${totalSongs} songs`);
