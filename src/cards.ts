export interface Film {
  name: string;
  from: number;
  to: number;
  color: string;
}

export interface Card {
  num: number;
  name: string;
  film: Film;
}

// Référentiel : https://www.collexstash.com/fr/collections/cards/cartes-disney-leclerc-2026
export const FILMS: Film[] = [
  { name: 'Toy Story', from: 1, to: 9, color: '#c9831f' },
  { name: 'Cars', from: 10, to: 13, color: '#d8382f' },
  { name: 'Les Indestructibles', from: 14, to: 18, color: '#b0362a' },
  { name: 'Coco', from: 19, to: 23, color: '#d0701c' },
  { name: 'Encanto', from: 24, to: 27, color: '#8e44ad' },
  { name: 'Vaiana', from: 28, to: 36, color: '#13897a' },
  { name: 'Le Monde de Nemo', from: 37, to: 41, color: '#2e78c8' },
  { name: 'Lilo & Stitch', from: 42, to: 45, color: '#3b5fc8' },
  { name: 'Mulan', from: 46, to: 50, color: '#a8322a' },
  { name: 'Le Livre de la Jungle', from: 51, to: 54, color: '#4a8a2a' },
  { name: 'Aladdin', from: 55, to: 58, color: '#6c4bb4' },
  { name: 'Le Roi Lion', from: 59, to: 63, color: '#bf7a22' },
  { name: 'Ratatouille', from: 64, to: 68, color: '#a0522d' },
  { name: 'Les Aristochats', from: 69, to: 72, color: '#c2508a' },
  { name: 'La Belle et la Bête', from: 73, to: 77, color: '#a8871c' },
  { name: 'Raiponce', from: 78, to: 81, color: '#9149ad' },
  { name: '101 Dalmatiens', from: 82, to: 86, color: '#555e68' },
  { name: 'Peter Pan', from: 87, to: 90, color: '#23974f' },
  { name: 'La Reine des Neiges', from: 91, to: 99, color: '#3a8cc4' },
  { name: 'Zootopie', from: 100, to: 104, color: '#c96a2c' },
  { name: 'Monstres & Cie', from: 105, to: 108, color: '#139a80' },
];

const NAMES = [
  'Woody', "Buzz l'Éclair", 'Fourchette', 'Jessie', 'Rex', 'Lilypad', 'Snappy', 'Rouleau Pote', 'Atlas',
  'Flash McQueen', 'Cruz Ramirez', 'Martin', 'Sally Carrera',
  'M. Indestructible', 'Elastigirl', 'Flèche Parr', 'Violette Parr', 'Jack-Jack Parr',
  'Miguel', 'Dante', 'Héctor', 'Ernesto de la Cruz', 'Coco Rivera',
  'Mirabel', 'Abuela Alma', 'Isabela', 'Antonio et Parce',
  'Vaiana', 'Maui', 'Simea', 'Pua', 'Heihei', 'Kotu', 'Loto', 'Kele', 'Moni',
  'Nemo', 'Marin', 'Dory', 'Hank', 'Crush et Squiz',
  'Lilo et Stitch', 'Jumba Jookiba', 'Pikly', 'Angel',
  'Mulan et Cri-Kee', 'Mushu', 'Mulan et Li Shang', 'Petit Frère', 'Mulan et Khan',
  'Mowgli', 'Baloo et Bagheera', 'Junior', 'Kaa',
  'Aladdin', 'Jasmine', 'Abu', 'Génie',
  'Simba', 'Nala', 'Mufasa et Rafiki', 'Scar', 'Timon et Pumbaa',
  'Rémy', 'Émile', 'Linguini', 'Colette', 'Gusteau',
  'Marie', "Thomas O'Malley", 'Duchesse', 'Marie et Berlioz',
  'Belle', 'La Bête', 'Big Ben', 'Lumière', 'Mme Samovar et Zip',
  'Raiponce', 'Flynn Rider', 'Maximus', 'Pascal',
  'Pongo', 'Perdita', 'Patch', 'Rolly', 'Lucky',
  'Peter Pan', 'La Fée Clochette', 'Capitaine Crochet', 'Monsieur Mouche',
  'Elsa', 'Anna', 'Kristoff', 'Olaf', 'Bruni', 'Elsa et Nokk', 'Sven', 'Anna et Elsa', 'Olaf',
  'Nick Wilde', 'Judy Hopps', 'Chef Bogo', "Gary De'Snake", 'Nibbles Maplestick',
  'Bob', 'Sulli', 'Bouh', 'Germaine',
];

export const TOTAL = NAMES.length;

export const CARDS: Card[] = NAMES.map((name, i) => {
  const num = i + 1;
  const film = FILMS.find((f) => num >= f.from && num <= f.to)!;
  return { num, name, film };
});

export const pad = (n: number) => String(n).padStart(3, '0');
