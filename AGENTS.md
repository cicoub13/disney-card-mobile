# AGENTS.md

Guide pour les agents de code travaillant sur ce dépôt.

## Projet

**Album 108** : PWA mobile (Vite + TypeScript, **sans framework**) pour scanner et suivre les 108 cartes Disney Leclerc 2026.
Tout tourne dans le navigateur : pas de backend, pas de compte. Interface et commentaires **en français**.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev HTTPS (`--host`, accessible depuis le téléphone) |
| `npm test` | Tests unitaires vitest (`src/*.test.ts`) |
| `npm run build` | `tsc --noEmit` puis build Vite + service worker |
| `npm run bench` | Précision de l'OCR sur les 108 visuels (`-- jitter` pour cadrages décalés) |
| `npm run demo` | Régénère `docs/`, `public/og.png` et les icônes PNG (Chrome headless + fausse caméra) |

Avant de terminer une modification : `npm test` et `npm run build` doivent passer.
Toute modification de `preprocess.ts`, `parse.ts` ou `NUMBER_ZONE` : lancer `npm run bench -- jitter`
et comparer avant/après (référence actuelle : ~66 % de lectures correctes, ~5 % fausses, cadrage décalé).

## Architecture

```
src/
  cards.ts       Référentiel : 108 cartes (numéro, nom), 21 films (plages de numéros, couleur)
  images.ts      URL des visuels sur img.collexstash.com (fichier + version ?v= par carte)
  storage.ts     Collection { numéro: nb d'exemplaires } dans localStorage, export/import JSON
  parse.ts       Texte OCR → numéro de carte (priorité "#NNN", puis 3 chiffres, puis 3 derniers chiffres)
  preprocess.ts  Traitement d'image pur (testable sous Node) : seuil local "texte blanc",
                 détection des lignes de texte (composantes connexes), NUMBER_ZONE
  scanner.ts     Caméra + boucle OCR (Tesseract.js) + vote sur fenêtre glissante → ScanState
  main.ts        UI : grille collection, filtres, fiche carte (<dialog>), écran scan, menu sauvegarde
  fx.ts          Effets : confettis (canvas), toast, carte holographique (popovers au-dessus des <dialog>)
  sounds.ts      Sons synthétisés (Web Audio) quand on ajoute une carte
  style.css      Styles (thème clair/sombre via prefers-color-scheme)
docs/            Bannière, captures et GIFs du README
scripts/
  ocr-bench.mjs  Banc OCR (télécharge les visuels dans .bench/, ignoré par git)
  ts-ext.mjs     Hook Node pour importer les .ts sans extension
  demo/          Génération des visuels du README (index.mjs) et gabarit de la bannière (banner.html)
```

## Pipeline de scan

1. Le cadre `.card-frame` (format 5/7) contient `.number-zone`, positionnée avec `NUMBER_ZONE`
   (fractions de la carte). Le numéro est imprimé **en blanc, en bas à gauche, au format `#039`**.
2. `Scanner.grabZone()` copie les pixels vidéo sous la zone (conversion écran → vidéo en `object-fit: cover`),
   redimensionnés à 120 px de haut.
3. `whiteText()` : pixels nettement plus clairs que leur voisinage → noir sur blanc.
   `findTextLines()` : regroupe les composantes alignées, garde les lignes de proportions proches de `#NNN`.
4. Chaque ligne candidate passe dans Tesseract (whitelist `#0123456789`, PSM ligne unique), puis `parseCardNumber`.
5. Vote : une carte est détectée quand un numéro est lu **2 fois en 2,5 s**. L'utilisateur confirme toujours
   (l'image affichée permet de repérer une erreur). La carte confirmée est ignorée tant qu'elle reste devant la caméra.

## Points d'attention

- **HTTPS obligatoire** pour `getUserMedia` (d'où `@vitejs/plugin-basic-ssl` en dev).
- **Safari iOS** : ne pas utiliser `ctx.filter` sur canvas (non fiable) ; traiter les pixels à la main.
  `<video>` doit garder `playsinline muted`.
- **Visuels** : chargés depuis `img.collexstash.com` (pas d'en-tête CORS) → affichables en `<img>`, mais
  **pixels illisibles** dans un canvas. Ne pas committer les images dans le dépôt.
- **Tesseract** : worker, cœur WASM et données `eng` viennent de `cdn.jsdelivr.net` ; mis en cache par le
  service worker (`vite.config.ts`, `runtimeCaching`), comme les visuels.
- **GitHub Pages** : le chemin de base vient de `BASE_PATH` (défini par le workflow) ; utiliser des chemins
  relatifs pour les assets de `public/`.
- Données utilisateur uniquement en `localStorage` (clé `disney-leclerc-2026`) : tout changement de format
  doit rester compatible avec `sanitize()` et les exports JSON existants.

## Style

- TypeScript strict, DOM natif, pas de dépendance d'UI.
- Changements minimaux et ciblés ; pas d'abstraction sans besoin.
- Textes visibles et commentaires en français.
