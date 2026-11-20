import { createWorker, PSM, type Worker } from 'tesseract.js';
import { parseCardNumber } from './parse';
import { numberCandidates, type Box, type Pixels } from './preprocess';

export type ScanState =
  | { kind: 'loading'; message: string }
  | { kind: 'error'; message: string }
  // lines : lignes de texte repérées, en fractions de la zone du numéro.
  // candidate : numéro lu, votes : nombre de lectures concordantes récentes.
  | { kind: 'scanning'; lines: Box[]; candidate: number | null; votes: number; idleMs: number }
  | { kind: 'detected'; num: number };

const VOTES_NEEDED = 2;
const VOTE_WINDOW_MS = 2500;
const ZONE_HEIGHT = 120;

// Lit en continu le numéro situé dans `zone` (élément posé sur la vidéo).
export class Scanner {
  private worker?: Promise<Worker>;
  private stream?: MediaStream;
  private running = false;
  private session = 0;
  private paused = false;
  private reads: { num: number; at: number }[] = [];
  private lastHit = 0;
  private handled: number | null = null;
  private canvas = document.createElement('canvas');
  private lineCanvas = document.createElement('canvas');

  constructor(
    private video: HTMLVideoElement,
    private zone: HTMLElement,
    private onState: (s: ScanState) => void,
  ) {}

  async start() {
    if (this.running) return;
    this.running = true;
    const session = ++this.session;
    this.onState({ kind: 'loading', message: 'Ouverture de la caméra…' });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch {
      if (session === this.session) this.running = false;
      this.onState({ kind: 'error', message: 'Caméra inaccessible. Autorise la caméra (le site doit être en HTTPS).' });
      return;
    }
    // stop() appelé pendant l'attente : on libère ce flux.
    if (session !== this.session) return stream.getTracks().forEach((t) => t.stop());
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();

    this.onState({ kind: 'loading', message: 'Préparation de la lecture du numéro…' });
    this.worker ??= createWorker('eng').then(async (w) => {
      await w.setParameters({
        tessedit_char_whitelist: '#0123456789',
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      });
      return w;
    });
    const worker = await this.worker;
    if (session !== this.session) return;
    this.reset();
    this.loop(worker, session);
  }

  stop() {
    this.session++;
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.video.srcObject = null;
  }

  pause() {
    this.paused = true;
  }

  // Reprend après une détection ; `num` est ignoré tant qu'il reste devant la caméra.
  resume(num: number) {
    this.handled = num;
    this.reset();
    this.paused = false;
  }

  private reset() {
    this.reads = [];
    this.lastHit = Date.now();
  }

  private async loop(worker: Worker, session: number) {
    while (session === this.session) {
      if (!this.paused && this.video.readyState >= 2) {
        const { lines, num } = await this.read(worker);
        if (session !== this.session || this.paused) continue;
        this.vote(lines, num);
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  private vote(lines: Box[], num: number | null) {
    const now = Date.now();
    if (lines.length) this.lastHit = now;
    // La carte déjà traitée a quitté le cadre dès qu'on lit autre chose ou plus rien pendant 1,5 s.
    if (this.handled !== null && ((num !== null && num !== this.handled) || now - this.lastHit > 1500)) {
      this.handled = null;
    }
    if (num !== null && num !== this.handled) this.reads.push({ num, at: now });
    this.reads = this.reads.filter((r) => now - r.at < VOTE_WINDOW_MS);

    const counts = new Map<number, number>();
    for (const r of this.reads) counts.set(r.num, (counts.get(r.num) ?? 0) + 1);
    const [candidate, votes] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    if (candidate !== null && votes >= VOTES_NEEDED) {
      this.paused = true;
      this.onState({ kind: 'detected', num: candidate });
    } else {
      this.onState({ kind: 'scanning', lines, candidate, votes, idleMs: now - this.lastHit });
    }
  }

  private async read(worker: Worker): Promise<{ lines: Box[]; num: number | null }> {
    const zone = this.grabZone();
    const candidates = numberCandidates(zone);
    const lines = candidates.map(({ box: b }) => ({
      x: b.x / zone.width,
      y: b.y / zone.height,
      w: b.w / zone.width,
      h: b.h / zone.height,
    }));
    for (const { pixels } of candidates) {
      this.lineCanvas.width = pixels.width;
      this.lineCanvas.height = pixels.height;
      this.lineCanvas.getContext('2d')!.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
      const num = parseCardNumber((await worker.recognize(this.lineCanvas)).data.text);
      if (num !== null) return { lines, num };
    }
    return { lines, num: null };
  }

  // Pixels de la vidéo situés sous l'élément `zone`, redimensionnés à ZONE_HEIGHT de haut.
  private grabZone(): Pixels {
    const v = this.video;
    const box = v.getBoundingClientRect();
    const z = this.zone.getBoundingClientRect();
    // La vidéo est affichée en object-fit: cover.
    const scale = Math.max(box.width / v.videoWidth, box.height / v.videoHeight);
    const ox = (v.videoWidth * scale - box.width) / 2;
    const oy = (v.videoHeight * scale - box.height) / 2;
    const sx = (z.left - box.left + ox) / scale;
    const sy = (z.top - box.top + oy) / scale;
    const sw = z.width / scale;
    const sh = z.height / scale;

    const h = ZONE_HEIGHT;
    const w = Math.round((sw / sh) * h);
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }
}
