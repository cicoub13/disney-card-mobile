import { TOTAL } from './cards';

const KEY = 'disney-leclerc-2026';

// Nombre d'exemplaires possédés par numéro de carte (absent = 0).
export type Collection = Record<number, number>;

export function load(): Collection {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function save(c: Collection) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export function sanitize(raw: unknown): Collection {
  const out: Collection = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const num = Number(k);
    const count = Math.floor(Number(v));
    if (num >= 1 && num <= TOTAL && count > 0) out[num] = count;
  }
  return out;
}

export function exportJson(c: Collection) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cartes-disney-leclerc-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
