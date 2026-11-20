// Traitements d'image avant OCR (fonctions pures, testables hors navigateur).

export interface Pixels {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

// Position du numéro "#039" sur la carte (fractions de la carte), avec de la marge
// pour tolérer un cadrage imprécis.
export const NUMBER_ZONE = { x: 0.03, y: 0.83, w: 0.45, h: 0.16 };

// Niveaux de gris (dans le canal R) avec étirement du contraste.
function luminance(p: Pixels): Float32Array {
  const d = p.data;
  const y = new Float32Array(p.width * p.height);
  let min = 255;
  let max = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    y[j] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const k = 255 / Math.max(1, max - min);
  for (let j = 0; j < y.length; j++) y[j] = (y[j] - min) * k;
  return y;
}

function write(p: Pixels, y: Float32Array, f: (v: number) => number): Pixels {
  const out = new Uint8ClampedArray(p.data.length);
  for (let i = 0, j = 0; i < out.length; i += 4, j++) {
    out[i] = out[i + 1] = out[i + 2] = f(y[j]);
    out[i + 3] = 255;
  }
  return { data: out, width: p.width, height: p.height };
}

// Le numéro est imprimé en blanc : on garde les pixels nettement plus clairs que leur voisinage
// (seuil local, car le fond peut être clair), rendus en noir sur blanc.
export function whiteText(p: Pixels): Pixels {
  const { width: W, height: H } = p;
  const y = luminance(p);
  const r = Math.max(4, Math.round(H * 0.12));

  // Image intégrale pour la moyenne locale.
  const sum = new Float64Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) {
    let row = 0;
    for (let i = 0; i < W; i++) {
      row += y[j * W + i];
      sum[(j + 1) * (W + 1) + i + 1] = sum[j * (W + 1) + i + 1] + row;
    }
  }

  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const y0 = Math.max(0, j - r), y1 = Math.min(H, j + r + 1);
    for (let i = 0; i < W; i++) {
      const x0 = Math.max(0, i - r), x1 = Math.min(W, i + r + 1);
      const s = sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0];
      const mean = s / ((x1 - x0) * (y1 - y0));
      const v = y[j * W + i];
      out[j * W + i] = v > mean + LOCAL_CONTRAST && v > MIN_BRIGHTNESS ? 0 : 255;
    }
  }
  return write(p, out, (v) => v);
}

const LOCAL_CONTRAST = 15;
const MIN_BRIGHTNESS = 130;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Composantes connexes de pixels noirs (texte) dans une image binarisée par whiteText.
function components(p: Pixels): (Box & { area: number })[] {
  const { width: W, height: H, data } = p;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  const out: (Box & { area: number })[] = [];
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || data[start * 4] !== 0) continue;
    let minX = W, minY = H, maxX = 0, maxY = 0, area = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i - x) / W;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j] || data[j * 4] !== 0) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
  return out;
}

// Cherche des lignes de texte de la forme de "#039" (glyphes alignés, éventuellement collés)
// et renvoie leurs cadres, les plus probables d'abord.
export function findTextLines(bin: Pixels): Box[] {
  const H = bin.height;
  const glyphs = components(bin)
    .filter((c) => c.h >= 0.12 * H && c.h <= 0.65 * H && c.w >= 0.15 * c.h && c.w <= 4 * c.h)
    .filter((c) => c.area / (c.w * c.h) > 0.15 && c.area / (c.w * c.h) < 0.9)
    .sort((a, b) => a.x - b.x);

  const lines: Box[][] = [];
  for (const g of glyphs) {
    const line = lines.find((l) => {
      const last = l[l.length - 1];
      const gap = g.x - (last.x + last.w);
      const sameRow = Math.abs(g.y + g.h / 2 - (last.y + last.h / 2)) < 0.3 * last.h;
      const sameSize = g.h > 0.7 * last.h && g.h < 1.4 * last.h;
      return sameRow && sameSize && gap > -0.1 * last.h && gap < 0.8 * last.h;
    });
    if (line) line.push(g);
    else lines.push([g]);
  }

  // "#039" fait environ 3 fois sa hauteur en largeur ("039" seul, environ 2 fois).
  const ratio = (b: Box) => b.w / b.h;
  return lines
    .filter((l) => l.length <= 6)
    .map((l) => {
      const x = l[0].x;
      const y = Math.min(...l.map((g) => g.y));
      const w = l[l.length - 1].x + l[l.length - 1].w - x;
      const h = Math.max(...l.map((g) => g.y + g.h)) - y;
      return { x, y, w, h };
    })
    .filter((b) => ratio(b) >= 1.5 && ratio(b) <= 5)
    .sort((a, b) => Math.abs(ratio(a) - 3) - Math.abs(ratio(b) - 3))
    .slice(0, 3)
    .map(({ x, y, w, h }) => {
      const pad = Math.round(h * 0.35);
      const bx = Math.max(0, x - pad);
      const by = Math.max(0, y - pad);
      return {
        x: bx,
        y: by,
        w: Math.min(bin.width, x + w + pad) - bx,
        h: Math.min(bin.height, y + h + pad) - by,
      };
    });
}

// Pipeline complet : zone du numéro → images binarisées serrées sur chaque ligne de texte candidate.
export function numberCandidates(zone: Pixels): { box: Box; pixels: Pixels }[] {
  const bin = whiteText(zone);
  return findTextLines(bin).map((box) => ({ box, pixels: cropPixels(bin, box) }));
}

function cropPixels(p: Pixels, b: Box): Pixels {
  const out = new Uint8ClampedArray(b.w * b.h * 4);
  for (let y = 0; y < b.h; y++) {
    const from = ((b.y + y) * p.width + b.x) * 4;
    out.set(p.data.subarray(from, from + b.w * 4), y * b.w * 4);
  }
  return { data: out, width: b.w, height: b.h };
}
