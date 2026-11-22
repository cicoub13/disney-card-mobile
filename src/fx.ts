// Effets visuels : confettis, toast et carte holographique. Désactivés si l'utilisateur
// a demandé de réduire les animations.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Les <dialog> modaux sont dans la « top layer » : on passe par l'API popover pour
// afficher confettis et toast au-dessus d'eux (ré-ouvrir le popover le remet au premier plan).
function toFront(el: HTMLElement) {
  if (el.matches(':popover-open')) el.hidePopover();
  el.showPopover();
}

// ---------- Confettis ----------

const COLORS = ['#ffd86b', '#f2a705', '#ffffff', '#8ea2ff', '#ff7eb6', '#4fd1c5'];

interface Bit { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string }

let bits: Bit[] = [];
let raf = 0;

/** Lance une gerbe de confettis depuis le bas de l'écran (`power` : nombre de particules). */
export function confetti(power = 80, colors: string[] = []) {
  if (reduced()) return;
  const canvas = document.getElementById('confetti') as HTMLCanvasElement;
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  toFront(canvas);
  const palette = [...COLORS, ...colors];
  for (let i = 0; i < power; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
    const speed = 9 + Math.random() * 9;
    bits.push({
      x: innerWidth * (0.3 + Math.random() * 0.4),
      y: innerHeight * 0.75,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      c: palette[(Math.random() * palette.length) | 0],
    });
  }
  const ctx = canvas.getContext('2d')!;
  const tick = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.35;
      b.vx *= 0.985;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.scale(1, Math.cos(b.r * 2)); // effet « papier qui tourne »
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    bits = bits.filter((b) => b.y < innerHeight + 20);
    if (bits.length) raf = requestAnimationFrame(tick);
    else canvas.hidePopover();
  };
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

// ---------- Toast ----------

let toastTimer = 0;

export function toast(text: string) {
  const el = document.getElementById('toast')!;
  el.textContent = text;
  toFront(el);
  el.classList.remove('show');
  void el.offsetWidth; // relance l'animation
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.hidePopover(), 2800);
}

// ---------- Carte holographique (fiche) ----------

/** La carte s'incline et le reflet suit le doigt (ou la souris). */
export function holo(el: HTMLElement) {
  const move = (e: PointerEvent) => {
    if (reduced()) return;
    const r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.classList.add('active');
    el.style.setProperty('--px', `${px * 100}%`);
    el.style.setProperty('--py', `${py * 100}%`);
    el.style.setProperty('--ry', `${(px - 0.5) * 28}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 28}deg`);
  };
  const leave = () => {
    el.classList.remove('active');
    for (const p of ['--px', '--py', '--rx', '--ry']) el.style.removeProperty(p);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerdown', move);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('pointercancel', leave);
  el.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && leave());
}

/** Relance une animation CSS portée par `cls` sur `el`. */
export function replay(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
