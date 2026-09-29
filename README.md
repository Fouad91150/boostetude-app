# Boost'Étude — application de gestion

Élèves, feuille d'appel, suivi de séance, bilans aux parents et facturation.
Un outil interne, utilisé surtout depuis un téléphone en fin de séance.

- **En ligne** : https://applicationboostetude.netlify.app
- **Base de données** : Supabase, projet `boost-etude` (région eu-west-1)

## Comment c'est fait

L'application est **une seule page HTML** : React 18 et le client Supabase sont
chargés par CDN, le code est déjà transpilé (`React.createElement`, pas de JSX à
compiler dans le navigateur). Pas de serveur, pas d'étape d'installation : le
fichier se dépose tel quel chez l'hébergeur.

Ce fichier unique est pratique à déployer mais illisible à relire. Le dépôt garde
donc le code **découpé en modules** dans `src/app/`, que `build.mjs` recolle dans
l'ordre de `src/ordre.json` entre les deux moitiés de la coquille HTML
(`src/shell-haut.html`, `src/shell-bas.html`).

```
src/app/00-supabase.js      connexion, clé anon
src/app/01-couleurs.js      charte : bleu nuit, or, crème
src/app/03-api-supabase.js  toutes les lectures et écritures en base
src/app/15-module-appel.js  feuille d'appel
src/app/18-module-facturation.js
src/app/20-app.js           navigation, rôles, chargement des données
public/                     manifest, service worker, icônes
```

## Construire et vérifier

```bash
npm run build        # écrit dist/ (index.html + fichiers de public/)
npm run verifier     # recolle sans estampille et compare à reference.sha256
npm test             # tests de la logique métier
```

`reference.sha256` est l'empreinte du fichier qui tournait en production au
moment de la mise sous Git. `npm run verifier` garantit que le découpage n'a rien
altéré : tant qu'on n'a pas voulu changer le code, la sortie est identique à
l'octet près.

## Déployer

`dist/` est **versionné** et publié tel quel par Netlify, sans build côté
hébergeur (`netlify.toml`) : le plan gratuit facture les builds en crédits, et
recoller des fichiers n'en vaut pas la dépense. Pousser sur `main` suffit à
mettre le site à jour.

En contrepartie, **il faut lancer `npm run build` avant de commiter** — sinon le
dossier publié ne correspond plus aux sources. Le test « Cohérence du dossier
publié » échoue dans ce cas ; `npm test` avant chaque commit suffit à s'en
prémunir.

La version (`package.json`) et la date de build sont injectées dans la page et
affichées dans l'application. **C'est ce qui manquait** le jour où un déploiement
parti d'une vieille copie a effacé un mois de travail sans que personne le voie.

## Sécurité

La clé `anon` de Supabase est en clair dans le fichier : c'est normal, elle est
faite pour ça. La sécurité repose entièrement sur les politiques RLS en base :
l'administrateur voit tout, un professeur ne voit que ses groupes, un parent que
ses enfants. **Toute nouvelle table doit avoir ses politiques RLS avant d'être
utilisée par l'application.**
