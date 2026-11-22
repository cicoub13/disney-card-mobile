// Génère les visuels du README et de l'aperçu social, à partir de l'app réelle :
//   - icônes PNG (depuis public/icon.svg)
//   - captures d'écran (docs/*.jpg)
//   - GIF du scan : Chrome reçoit une fausse caméra (vidéo y4m synthétique d'une vraie carte posée
//     sur une table) et c'est le vrai pipeline OCR de l'app qui lit le numéro
//   - GIF de la collection (filtres, carte holographique)
//   - bannière du README (docs/banner.jpg) et aperçu social (public/og.png)
//
// Prérequis : Google Chrome installé, accès réseau (visuels collexstash, moteur OCR sur jsDelivr).
// Usage : npm run demo
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync, writeSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { imageUrl } = await import(join(root, 'src/images.ts'));
const work = join(root, '.demo'); // fichiers intermédiaires (ignoré par git)
const docs = join(root, 'docs');
mkdirSync(work, { recursive: true });
mkdirSync(docs, { recursive: true });

const PHONE = { width: 390, height: 844 };
const SCAN_CARD = 39; // Dory : numéro bien lisible
const log = (msg) => console.log(`• ${msg}`);

// Collection de démo : Toy Story et Cars complets, le reste à ~60 %, quelques doublons, Dory manquante.
function demoCollection() {
  const col = {};
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 1; n <= 108; n++) if (n <= 13 || rnd() < 0.6) col[n] = 1;
  for (const n of [2, 5, 11, 28, 59, 94]) col[n] = 2 + (n % 2);
  delete col[SCAN_CARD];
  return col;
}
const seedCollection = (ctx) =>
  ctx.addInitScript((c) => localStorage.setItem('disney-leclerc-2026', JSON.stringify(c)), demoCollection());

// ---------- Serveur de dev et navigateur ----------

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, host: 'localhost' } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome' });
const phoneContext = (opts = {}) =>
  browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true, colorScheme: 'dark', ignoreHTTPSErrors: true, ...opts });

try {
  await icons();
  await stills();
  const video = await fakeCamera();
  await scan(video, 2, 'stills');
  await scan(video, 1.25, 'gif');
  await tour();
  await banner();
} finally {
  await browser.close();
  await server.close();
  rmSync(join(work, 'camera.y4m'), { force: true }); // ~130 Mo, inutile après coup
}
log('terminé');

// ---------- Icônes ----------

async function icons() {
  const svg = readFileSync(join(root, 'public/icon.svg'), 'utf8');
  for (const size of [192, 512]) {
    const p = await browser.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
    await p.screenshot({ path: join(root, `public/icon-${size}.png`) });
    await p.close();
  }
  log('icônes');
}

// ---------- Captures fixes : collection et fiche holographique ----------

async function stills() {
  const ctx = await phoneContext({ deviceScaleFactor: 2 });
  await seedCollection(ctx);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500); // fin des animations d'apparition
  await p.screenshot({ path: join(docs, 'collection-dark.jpg'), type: 'jpeg', quality: 82 });
  await p.click('.tile[data-num="59"]');
  await p.waitForTimeout(800);
  const box = await p.locator('#holo').boundingBox();
  await p.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3);
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(docs, 'sheet-dark.jpg'), type: 'jpeg', quality: 82 });
  await ctx.close();
  log('captures collection');
}

// ---------- Fausse caméra : vidéo y4m 720x1280 ----------
// Table vide 2,5 s, la carte glisse dans le cadre en 1,2 s, puis reste immobile 6 s (Chrome boucle).

async function fakeCamera() {
  const W = 720, H = 1280, FPS = 10;
  const file = join(work, 'camera.y4m');
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<style>
    body{margin:0;width:${W}px;height:${H}px;overflow:hidden;
      background:radial-gradient(ellipse at 50% 40%,transparent 40%,rgb(0 0 0/.55)),
      repeating-linear-gradient(92deg,#6b4a30 0 14px,#5e4029 14px 31px,#73513a 31px 40px),#5e4029}
    img{position:absolute;left:83px;top:1400px;width:554px;height:776px;border-radius:22px;
      box-shadow:0 30px 60px rgb(0 0 0/.55)}
  </style><img src="${imageUrl(SCAN_CARD)}">`);
  await p.waitForFunction(() => document.querySelector('img').complete);

  // RGB → YUV 4:2:0
  const frame = async () => {
    const { data } = PNG.sync.read(await p.screenshot());
    const Y = Buffer.alloc(W * H), U = Buffer.alloc((W * H) / 4), V = Buffer.alloc((W * H) / 4);
    for (let i = 0; i < W * H; i++) Y[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    for (let y = 0; y < H / 2; y++) {
      for (let x = 0; x < W / 2; x++) {
        const i = (y * 2 * W + x * 2) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        U[(y * W) / 2 + x] = Math.max(0, Math.min(255, 128 - 0.1687 * r - 0.3313 * g + 0.5 * b));
        V[(y * W) / 2 + x] = Math.max(0, Math.min(255, 128 + 0.5 * r - 0.4187 * g - 0.0813 * b));
      }
    }
    return Buffer.concat([Buffer.from('FRAME\n'), Y, U, V]);
  };
  const place = (top, rot) =>
    p.evaluate(([t, r]) => Object.assign(document.querySelector('img').style, { top: `${t}px`, transform: `rotate(${r}deg)` }), [top, rot]);

  const fd = openSync(file, 'w');
  const put = (buf, n) => { for (let i = 0; i < n; i++) writeSync(fd, buf); };
  writeSync(fd, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`);
  put(await frame(), 25);
  for (let i = 1; i <= 12; i++) {
    const k = 1 - (1 - i / 12) ** 3; // ease-out
    await place(1400 - (1400 - 166) * k, 1.2 + 8 * (1 - k));
    put(await frame(), 1);
  }
  put(await frame(), 60);
  closeSync(fd);
  await p.close();
  log('fausse caméra');
  return file;
}

// ---------- Scan ----------
// mode 'stills' : captures nettes (carte en cours de vérification, révélation) ; mode 'gif' : docs/scan.gif.

async function scan(video, dsf, mode) {
  const ctx = await chromium.launchPersistentContext(join(work, 'chrome-profile'), {
    channel: 'chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
    viewport: PHONE, deviceScaleFactor: dsf, isMobile: true, hasTouch: true,
    colorScheme: 'dark', ignoreHTTPSErrors: true, permissions: ['camera'],
  });
  await seedCollection(ctx);
  const p = ctx.pages()[0] ?? (await ctx.newPage());
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.click('[data-view="scan"]');

  // On démarre quand l'OCR tourne sur la table vide (si la carte a déjà été lue, on l'écarte).
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("l'OCR ne démarre pas (réseau ?)");
    if (await p.locator('#sheet[open]').count()) await p.click('#sheet-close');
    if ((await p.textContent('#scan-title')).startsWith('Place la carte')) break;
    await p.waitForTimeout(100);
  }

  const frames = [];
  const shot = async (step) => {
    const buf = await p.screenshot();
    frames.push({ buf, t: Date.now(), step, phase: await p.getAttribute('#card-frame', 'data-phase') });
  };
  const t0 = Date.now();
  while (!(await p.locator('#sheet[open]').count())) {
    if (Date.now() - t0 > 30_000) throw new Error('carte non reconnue');
    await shot('scan');
  }
  await p.waitForTimeout(300); // fiche ouverte
  for (let i = 0; i < 8; i++) await shot('sheet');
  await p.click('#sheet-add');
  const t1 = Date.now();
  while (Date.now() - t1 < 2600) await shot('reveal');
  await ctx.close();

  if (mode === 'stills') {
    const candidates = frames.filter((f) => f.step === 'scan' && f.phase === 'candidate');
    const pick = candidates.at(-1) ?? frames.filter((f) => f.step === 'scan').at(-1);
    await saveJpeg(pick.buf, join(docs, 'scan-candidate.jpg'), dsf);
    // Image la plus proche du pic de l'éclat doré (~40 % de l'animation .reveal de 0,9 s).
    const reveal = frames.filter((f) => f.step === 'reveal');
    const peak = reveal.reduce((a, b) => (Math.abs(b.t - t1 - 360) < Math.abs(a.t - t1 - 360) ? b : a));
    await saveJpeg(peak.buf, join(docs, 'scan-reveal.jpg'), dsf);
    log('captures scan');
  } else {
    writeGif(frames, join(docs, 'scan.gif'), 1500);
    log('GIF scan');
  }
}

// ---------- Tour de la collection ----------

async function tour() {
  const ctx = await phoneContext({ deviceScaleFactor: 1.25, isMobile: false, hasTouch: false });
  await seedCollection(ctx);
  const p = await ctx.newPage();
  // Précharge les visuels pour que l'apparition filmée ne montre pas de cartes vides.
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => Promise.all([...document.images].map((i) => ((i.loading = 'eager'), i.decode().catch(() => {})))));
  await p.reload({ waitUntil: 'networkidle' });

  const frames = [];
  const shot = async () => frames.push({ buf: await p.screenshot(), t: Date.now() });
  const film = async (ms) => { const t = Date.now(); while (Date.now() - t < ms) await shot(); };
  await p.click('[data-filter="all"]');
  await film(1200);
  await p.click('[data-filter="missing"]');
  await film(1400);
  await p.click('[data-filter="all"]');
  await film(500);
  await p.click('.tile[data-num="59"]');
  await film(500);
  const box = await p.locator('#holo').boundingBox();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    await p.mouse.move(box.x + box.width * (0.5 + 0.42 * Math.cos(a)), box.y + box.height * (0.5 + 0.42 * Math.sin(a)));
    await shot();
  }
  await ctx.close();
  writeGif(frames, join(docs, 'collection.gif'), 1200);
  log('GIF collection');
}

// ---------- Bannière et aperçu social ----------

async function banner() {
  const page = pathToFileURL(join(root, 'scripts/demo/banner.html')).href;
  for (const [dsf, file, opts] of [
    [2, join(docs, 'banner.jpg'), { type: 'jpeg', quality: 88 }],
    [1, join(root, 'public/og.png'), {}],
  ]) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: dsf });
    await p.goto(page, { waitUntil: 'load' });
    await p.screenshot({ path: file, ...opts });
    await p.close();
  }
  log('bannière et aperçu social');
}

// ---------- Utilitaires ----------

// Ré-encode une capture PNG en JPEG (via Chrome, sans dépendance d'image).
async function saveJpeg(png, file, dsf) {
  const { width, height } = PNG.sync.read(png);
  const p = await browser.newPage({ viewport: { width: width / dsf, height: height / dsf }, deviceScaleFactor: dsf });
  await p.setContent(`<style>body{margin:0}</style><img style="width:100vw;display:block" src="data:image/png;base64,${png.toString('base64')}">`);
  await p.screenshot({ path: file, type: 'jpeg', quality: 82 });
  await p.close();
}

// GIF avec une palette de 128 couleurs par image et les délais réels entre captures.
function writeGif(frames, file, holdLastMs) {
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const gif = GIFEncoder();
  frames.forEach((fr, i) => {
    const { data, width, height } = PNG.sync.read(fr.buf);
    const palette = quantize(data, 128);
    const delay = i < frames.length - 1 ? Math.min(400, frames[i + 1].t - fr.t) : holdLastMs;
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay });
  });
  gif.finish();
  writeFileSync(file, gif.bytes());
}
