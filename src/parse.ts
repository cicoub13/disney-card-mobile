import { TOTAL } from './cards';

// Extrait un numéro de carte (1..TOTAL) depuis le texte brut de l'OCR.
// Les cartes portent "#039" : priorité au "#" suivi de 3 chiffres, sinon à un nombre de 3 chiffres,
// sinon aux 3 derniers chiffres d'un nombre plus long (le "#" est souvent lu comme un chiffre : "4039").
export function parseCardNumber(text: string): number | null {
  const clean = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');

  const hash = clean.match(/#\s*(\d{3})/);
  if (hash) return valid(Number(hash[1]));

  const tokens = clean.match(/\d+/g) ?? [];
  const three = tokens.find((n) => n.length === 3);
  if (three) return valid(Number(three));

  const longer = tokens.find((n) => n.length > 3);
  return longer ? valid(Number(longer.slice(-3))) : null;
}

function valid(n: number): number | null {
  return n >= 1 && n <= TOTAL ? n : null;
}
