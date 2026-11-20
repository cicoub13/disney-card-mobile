# Cartes Disney Leclerc 2026 📚

Application web mobile (PWA) pour **scanner** et **répertorier** les 108 cartes de la collection
Disney E.Leclerc 2026, et voir d'un coup d'œil celles qui manquent.

- 📷 **Scan par la caméra** : le numéro imprimé sur la carte (`#039`, en bas à gauche) est lu directement
  sur le téléphone (OCR [Tesseract.js](https://github.com/naptha/tesseract.js)), sans serveur.
- 📚 **Collection** : les 108 cartes groupées par film, filtres *Toutes / Manquantes / Possédées / Doublons*,
  compteur d'exemplaires pour les échanges.
- 💾 **Données locales** : la collection reste dans le navigateur du téléphone ; export/import JSON via le menu ⋯.
- 📲 **Installable** et utilisable hors ligne après une première visite.

## Utilisation

1. Ouvrir le site sur le téléphone, puis *Ajouter à l'écran d'accueil*.
2. Onglet **Scanner** : placer la carte dans le cadre, le numéro dans la zone pointillée en bas à gauche.
   - cadre **blanc** : recherche du numéro ;
   - cadre **jaune** + rectangle vert : numéro repéré, lecture en cours ;
   - cadre **orange** + vignette : carte probable, ne plus bouger ;
   - cadre **vert** : carte reconnue → confirmer l'ajout (ou *Pas la bonne carte*).
3. Si la lecture échoue, saisir le numéro dans le champ sous la caméra.
4. Onglet **Collection** : toucher une carte pour ajuster le nombre d'exemplaires.

## Développement

Prérequis : Node.js ≥ 24.

```bash
npm install
npm run dev     # https://<ip-de-la-machine>:5173 depuis le téléphone (même Wi-Fi)
npm test        # tests unitaires (vitest)
npm run build   # build de production dans dist/
npm run bench   # précision de l'OCR sur les 108 visuels (macOS : utilise `sips`)
```

Le serveur de dev est en HTTPS auto-signé (la caméra exige un contexte sécurisé) : accepter
l'avertissement de certificat sur le téléphone.

## Déploiement sur GitHub Pages

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) teste, construit et publie
le site à chaque push sur `main`.

1. *Settings → Pages → Build and deployment → Source* : **GitHub Actions**.
2. Pousser sur `main` (ou lancer le workflow manuellement depuis l'onglet *Actions*).
3. Le site est publié sur `https://<utilisateur>.github.io/<repo>/`.

## Sources et crédits

- Liste des cartes : [collexstash.com](https://www.collexstash.com/fr/collections/cards/cartes-disney-leclerc-2026).
- Les visuels des cartes sont chargés depuis les serveurs de collexstash ; ils ne sont pas inclus dans ce dépôt.
- Projet personnel non officiel, sans lien avec Disney, Pixar ou E.Leclerc. Les personnages et visuels
  sont la propriété de leurs ayants droit.
