import './style.css';
import { CARDS, FILMS, TOTAL, pad, type Card } from './cards';
import { imageUrl } from './images';
import { NUMBER_ZONE, type Box } from './preprocess';
import { exportJson, load, sanitize, save } from './storage';
import { Scanner, type ScanState } from './scanner';
import { confetti, holo, replay, toast } from './fx';
import { playNewCard, playOwnedCard } from './sounds';

type Filter = 'all' | 'missing' | 'owned' | 'dupes';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let collection = load();
let filter: Filter = 'all';
let justAdded = 0; // carte à faire « apparaître » dans la grille au prochain rendu
const count = (n: number) => collection[n] ?? 0;
const ownedCount = () => CARDS.filter((c) => count(c.num) > 0).length;

function setCount(num: number, value: number) {
  const before = count(num);
  if (value > before) (before === 0 ? playNewCard : playOwnedCard)();
  const isNew = before === 0 && value > 0;
  if (value > 0) collection[num] = value;
  else delete collection[num];
  save(collection);
  if (isNew) {
    justAdded = num;
    celebrate(CARDS[num - 1]);
  }
  render();
}

// Nouvelle carte : confettis, plus gros si elle complète un film ou la collection.
function celebrate(card: Card) {
  const film = card.film;
  if (ownedCount() === TOTAL) {
    confetti(260);
    toast('🏆 Collection complète : 108 / 108 !');
  } else if (CARDS.every((c) => c.film !== film || count(c.num) > 0)) {
    confetti(160, [film.color]);
    toast(`🎉 ${film.name} : série complète !`);
  } else {
    confetti(70, [film.color]);
  }
}

// ---------- Collection ----------

const FILTERS: Record<Filter, { label: string; keep: (c: Card) => boolean }> = {
  all: { label: 'Toutes', keep: () => true },
  missing: { label: 'Manquantes', keep: (c) => count(c.num) === 0 },
  owned: { label: 'Possédées', keep: (c) => count(c.num) > 0 },
  dupes: { label: 'Doublons', keep: (c) => count(c.num) > 1 },
};

function tile(c: Card, i: number) {
  const n = count(c.num);
  const cls = `${n ? 'owned' : 'missing'}${c.num === justAdded ? ' just-added' : ''}`;
  return `<button class="tile ${cls}" data-num="${c.num}" style="--film:${c.film.color};--i:${Math.min(i, 14)}">
    <img src="${imageUrl(c.num)}" alt="#${pad(c.num)} ${c.name}" loading="lazy" />
    ${n ? '' : `<span class="tile-label"><b>#${pad(c.num)}</b>${c.name}</span>`}
    ${n > 1 ? `<span class="badge">×${n}</span>` : ''}
  </button>`;
}

// Compteur de progression animé (de la valeur affichée vers la nouvelle).
let shownOwned = 0;
let countRaf = 0;
function animateProgress(owned: number) {
  const from = shownOwned;
  const start = performance.now();
  cancelAnimationFrame(countRaf);
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / 700);
    const v = Math.round(from + (owned - from) * (1 - (1 - k) ** 3));
    $('progress-text').textContent = `${v} / ${TOTAL} cartes · ${TOTAL - v} manquantes`;
    $('progress-pct').textContent = `${Math.round((v / TOTAL) * 100)} %`;
    if (k < 1) countRaf = requestAnimationFrame(step);
  };
  shownOwned = owned;
  countRaf = requestAnimationFrame(step);
}

function render(animate = false) {
  const owned = ownedCount();
  $('progress-bar').style.width = `${(owned / TOTAL) * 100}%`;
  animateProgress(owned);

  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
    const f = b.dataset.filter as Filter;
    b.textContent = `${FILTERS[f].label} (${CARDS.filter(FILTERS[f].keep).length})`;
    b.classList.toggle('active', f === filter);
  });

  const html = FILMS.map((film) => {
    const cards = CARDS.filter((c) => c.film === film);
    const shown = cards.filter(FILTERS[filter].keep);
    if (!shown.length) return '';
    const have = cards.filter((c) => count(c.num) > 0).length;
    const done = have === cards.length;
    return `<h2 class="film${done ? ' done' : ''}" style="--film:${film.color}">${film.name}
        <small>${done ? '✦ Complet' : `${have}/${cards.length}`}</small></h2>
      <div class="tiles">${shown.map(tile).join('')}</div>`;
  }).join('');
  const grid = $('grid');
  grid.classList.toggle('animate', animate);
  grid.innerHTML = html || '<p class="empty">Aucune carte ici.</p>';
  justAdded = 0;
}

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    filter = b.dataset.filter as Filter;
    render(true);
  }),
);

$('grid').addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  if (t) openSheet(Number(t.dataset.num), false);
});

// ---------- Fiche carte ----------

const sheet = $<HTMLDialogElement>('sheet');
holo($('holo'));
let sheetNum = 0;
let sheetFromScan = false;

function openSheet(num: number, fromScan: boolean) {
  sheetNum = num;
  sheetFromScan = fromScan;
  $('sheet-add').hidden = !fromScan;
  $<HTMLButtonElement>('sheet-add').disabled = false;
  $('holo').classList.remove('reveal');
  $('sheet-close').textContent = fromScan ? 'Pas la bonne carte' : 'Fermer';
  const img = $<HTMLImageElement>('sheet-img');
  img.src = imageUrl(num);
  img.alt = `#${pad(num)} ${CARDS[num - 1].name}`;
  refreshSheet();
  sheet.showModal();
}

function refreshSheet() {
  const c = CARDS[sheetNum - 1];
  const n = count(c.num);
  $('sheet-info').textContent = sheetFromScan
    ? n === 0
      ? `✨ Nouvelle carte : #${pad(c.num)} ${c.name}`
      : `Doublon : #${pad(c.num)} ${c.name} (déjà ×${n})`
    : `#${pad(c.num)} ${c.name} · ${c.film.name}`;
  const countEl = $('sheet-count');
  if (countEl.textContent !== String(n) && sheet.open) replay(countEl, 'bump');
  countEl.textContent = String(n);
  $('holo').classList.toggle('owned', n > 0);
}

$('sheet-plus').addEventListener('click', () => {
  setCount(sheetNum, count(sheetNum) + 1);
  refreshSheet();
});
$('sheet-minus').addEventListener('click', () => {
  setCount(sheetNum, count(sheetNum) - 1);
  refreshSheet();
});
// La carte « se révèle » dans la fiche, puis la fiche se ferme.
$('sheet-add').addEventListener('click', () => {
  $<HTMLButtonElement>('sheet-add').disabled = true;
  setCount(sheetNum, count(sheetNum) + 1);
  refreshSheet();
  const c = CARDS[sheetNum - 1];
  const n = count(sheetNum);
  $('sheet-info').textContent = n === 1 ? `✨ ${c.name} rejoint ta collection !` : `Doublon ajouté : ${c.name} ×${n}`;
  replay($('holo'), 'reveal');
  setTimeout(() => sheet.close(), 1100);
});
$('sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => {
  if (sheetFromScan) scanner.resume(sheetNum);
});

// ---------- Scanner ----------

const zoneEl = $('number-zone');
Object.assign(zoneEl.style, {
  left: `${NUMBER_ZONE.x * 100}%`,
  top: `${NUMBER_ZONE.y * 100}%`,
  width: `${NUMBER_ZONE.w * 100}%`,
  height: `${NUMBER_ZONE.h * 100}%`,
});

function showScan(state: ScanState) {
  const frame = $('card-frame');
  const thumb = $<HTMLImageElement>('scan-thumb');
  let phase = 'search';
  let title = '';
  let hint = '';
  let dots = '';
  let candidate: number | null = null;
  let lines: Box[] = [];

  switch (state.kind) {
    case 'loading':
      title = state.message;
      break;
    case 'error':
      phase = 'error';
      title = state.message;
      break;
    case 'detected':
      phase = 'detected';
      candidate = state.num;
      title = `#${pad(state.num)} ${CARDS[state.num - 1].name} ✓`;
      break;
    case 'scanning':
      lines = state.lines;
      if (state.candidate !== null) {
        phase = 'candidate';
        candidate = state.candidate;
        title = `#${pad(state.candidate)} ${CARDS[state.candidate - 1].name} ?`;
        hint = 'Ne bouge plus, je vérifie…';
        dots = '●'.repeat(state.votes) + '○'.repeat(Math.max(0, 2 - state.votes));
      } else if (state.lines.length) {
        phase = 'text';
        title = 'Numéro repéré, lecture…';
        hint = 'Garde la carte immobile';
      } else if (state.idleMs > 2500) {
        title = 'Je ne trouve pas le numéro';
        hint = 'Rapproche la carte pour qu’elle remplisse le cadre, évite les reflets';
      } else {
        title = 'Place la carte dans le cadre';
        hint = 'Le numéro (#000) doit être dans la zone en bas à gauche';
      }
  }

  frame.dataset.phase = phase;
  $('scan-title').textContent = title;
  $('scan-hint').textContent = hint;
  $('scan-dots').textContent = dots;
  thumb.hidden = candidate === null;
  if (candidate !== null) thumb.src = imageUrl(candidate);
  $('hits').innerHTML = lines
    .map((b) => `<i style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"></i>`)
    .join('');
}

const scanner = new Scanner($<HTMLVideoElement>('video'), zoneEl, (state) => {
  showScan(state);
  if (state.kind === 'detected') {
    navigator.vibrate?.(80);
    setTimeout(() => openSheet(state.num, true), 350);
  }
});

$('manual').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('manual-num');
  const num = Number(input.value);
  if (num >= 1 && num <= TOTAL) {
    scanner.pause();
    openSheet(num, true);
    input.value = '';
    input.blur();
  }
});

// ---------- Navigation ----------

function show(view: string) {
  $('view-collection').hidden = view !== 'collection';
  $('view-scan').hidden = view !== 'scan';
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view),
  );
  if (view === 'scan') scanner.start();
  else scanner.stop();
}

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
  b.addEventListener('click', () => show(b.dataset.view!)),
);

// Coupe la caméra quand l'app passe en arrière-plan.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) scanner.stop();
  else if (!$('view-scan').hidden) scanner.start();
});

// ---------- Sauvegarde ----------

const menu = $<HTMLDialogElement>('menu');
$('menu-btn').addEventListener('click', () => menu.showModal());
$('menu-close').addEventListener('click', () => menu.close());
$('export-btn').addEventListener('click', () => exportJson(collection));
$<HTMLInputElement>('import-input').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    collection = sanitize(JSON.parse(await file.text()));
    save(collection);
    render();
    menu.close();
  } catch {
    menu.querySelector('.hint')!.textContent = 'Fichier invalide.';
  }
});
$('clear-btn').addEventListener('click', () => {
  if (!confirm('Vider toute la collection ? Pense à exporter avant, cette action est définitive.')) return;
  collection = {};
  save(collection);
  render();
  menu.close();
});

navigator.storage?.persist?.();
render(true);
