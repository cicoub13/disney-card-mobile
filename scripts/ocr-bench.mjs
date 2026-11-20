// Banc de précision OCR sur les 108 visuels de référence.
// Télécharge les visuels dans .bench/ (ignoré par git, conversion webp → png via `sips`, macOS),
// recadre la zone du numéro (avec décalages simulant un cadrage imprécis), lance le même
// pipeline que l'app (preprocess.ts + parse.ts) et affiche la précision.
//
// Usage : npm run bench            (cadrage centré)
//         npm run bench -- jitter  (5 cadrages décalés de ±3 %)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createWorker, PSM } from 'tesseract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pre = await import(join(root, 'src/preprocess.ts'));
const { parseCardNumber } = await import(join(root, 'src/parse.ts'));
const { imageUrl } = await import(join(root, 'src/images.ts'));
const mode = process.argv[2] ?? 'center';

// ---------- Téléchargement ----------
const dir = join(root, '.bench', 'cards');
mkdirSync(dir, { recursive: true });
for (let n = 1; n <= 108; n++) {
  const png = join(dir, `${String(n).padStart(3, '0')}.png`);
  if (existsSync(png)) continue;
  const webp = png.replace('.png', '.webp');
  writeFileSync(webp, Buffer.from(await (await fetch(imageUrl(n))).arrayBuffer()));
  execFileSync('sips', ['-s', 'format', 'png', webp, '--out', png], { stdio: 'ignore' });
}

// ---------- Recadrage (équivalent du drawImage de l'app) ----------
const H = 120;
function crop(img, zone, dx, dy) {
  const sx = (zone.x + dx) * img.width;
  const sy = (zone.y + dy) * img.height;
  const sw = zone.w * img.width;
  const sh = zone.h * img.height;
  const w = Math.round((sw / sh) * H);
  const data = new Uint8ClampedArray(w * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < w; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, sx + (x / w) * sw));
      const fy = Math.min(img.height - 1, Math.max(0, sy + (y / H) * sh));
      const x0 = fx | 0, y0 = fy | 0;
      const x1 = Math.min(x0 + 1, img.width - 1), y1 = Math.min(y0 + 1, img.height - 1);
      const ax = fx - x0, ay = fy - y0;
      for (let c = 0; c < 4; c++) {
        const p = (xx, yy) => img.data[(yy * img.width + xx) * 4 + c];
        data[(y * w + x) * 4 + c] =
          p(x0, y0) * (1 - ax) * (1 - ay) + p(x1, y0) * ax * (1 - ay) + p(x0, y1) * (1 - ax) * ay + p(x1, y1) * ax * ay;
      }
    }
  }
  return { data, width: w, height: H };
}

function toPng(p) {
  const png = new PNG({ width: p.width, height: p.height });
  png.data = Buffer.from(p.data.buffer);
  return PNG.sync.write(png);
}

// ---------- Banc ----------
const offsets = mode === 'jitter'
  ? [[0, 0], [-0.03, -0.03], [0.03, 0.03], [0.03, -0.03], [-0.03, 0.03]]
  : [[0, 0]];

const worker = await createWorker('eng', 1, { cachePath: join(root, '.bench') });
await worker.setParameters({ tessedit_char_whitelist: '#0123456789', tessedit_pageseg_mode: PSM.SINGLE_LINE });

let ok = 0;
const wrong = [];
const readOnce = new Set();
for (let n = 1; n <= 108; n++) {
  const img = PNG.sync.read(readFileSync(join(dir, `${String(n).padStart(3, '0')}.png`)));
  for (const [dx, dy] of offsets) {
    let got = null;
    for (const { pixels } of pre.numberCandidates(crop(img, pre.NUMBER_ZONE, dx, dy))) {
      got = parseCardNumber((await worker.recognize(toPng(pixels))).data.text);
      if (got !== null) break;
    }
    if (got === n) {
      ok++;
      readOnce.add(n);
    } else if (got !== null) wrong.push(`#${n} [${dx},${dy}] lu ${got}`);
  }
}
await worker.terminate();

const total = 108 * offsets.length;
const never = [...Array(108).keys()].map((i) => i + 1).filter((n) => !readOnce.has(n));
console.log(`Lectures correctes : ${ok}/${total} (${Math.round((ok / total) * 100)} %)`);
console.log(`Lectures fausses   : ${wrong.length}/${total}`);
console.log(`Cartes lues au moins une fois : ${readOnce.size}/108`);
if (never.length) console.log(`Jamais lues : ${never.join(', ')}`);
if (wrong.length) console.log(`Erreurs :\n  ${wrong.join('\n  ')}`);
