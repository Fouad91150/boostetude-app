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
src/app/04b-reseau.js       brouillons locaux, file des appels non transmis
src/app/07b-bandeaux.js     messages à l'écran, sans bloquer l'application
src/app/15-module-appel.js  feuille d'appel et compte rendu de séance
src/app/16b-facture-pdf.js  fabrique le PDF de la facture, sans dépendance
src/app/18-module-facturation.js
src/app/20-app.js           navigation, rôles, chargement des données
public/                     manifest, service worker, icônes
```

## L'appel, écran central

Tout le reste en découle : la facturation compte les séances pointées, les bilans
aux parents reprennent les comptes rendus. Trois partis pris le gouvernent.

**Le compte rendu se demande sur place.** Il a d'abord vécu dans un onglet séparé.
Résultat après un mois d'exploitation : zéro compte rendu écrit, alors que c'était
la fonction la plus demandée. Un professeur qui finit à 20 h range sa salle et
part ; il ne rouvre pas un onglet pour y resélectionner un groupe et une date. La
question se pose donc sur l'écran qui suit l'appel, et vaut pour tous les présents
d'un coup. La saisie élève par élève reste dans l'onglet Suivi pour qui veut nuancer.

**La saisie survit à la coupure.** Une salle de cours n'est pas un bureau. Chaque
geste est écrit dans le navigateur (`04b-reseau.js`) ; un envoi qui échoue pour
cause de réseau rejoint une file et repart tout seul au retour de la connexion. Un
refus du serveur, lui, remonte à l'utilisateur au lieu d'être rejoué en boucle —
la distinction est faite par `estPanneReseau`.

**Rien n'arrête l'écran.** Les messages passent par des bandeaux (`07b-bandeaux.js`),
jamais par `alert()`, qui recouvrait tout et figeait un appel en cours. Seules les
suppressions irréversibles gardent une confirmation bloquante, délibérément.

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

Les fonctions `SECURITY DEFINER` s'exécutent avec les droits de leur propriétaire :
leur `search_path` est figé (`public, pg_temp`) pour qu'un schéma interposé ne
puisse pas détourner ce qu'elles croient appeler. **Toute nouvelle fonction de ce
type doit l'être aussi** — `get_advisors` de Supabase le signale sinon.

## Envoyer une facture

Le PDF est **fabriqué à la main** (`16b-facture-pdf.js`) : une page A4, les polices
de base, la table de références calculée en octets. Une bibliothèque comme jsPDF
pèserait 350 Ko — plus que l'application entière — et mettrait un CDN sur le chemin
d'un geste qui doit marcher depuis un téléphone, en bas de l'immeuble. Le fichier
produit fait 5 Ko et son texte reste sélectionnable.

Le texte du document est en **WinAnsi**, seul encodage que lisent les polices PDF
de base ; le titre des métadonnées, lui, est en **UTF-16BE avec BOM**, sinon les
accents y partent en charabia. Les deux conversions sont dans le module.

Ce que le téléphone sait faire, et ce qu'il ne sait pas :

| | Texte | Pièce jointe |
|---|---|---|
| Partage natif (`navigator.share`) | ✅ | ✅ **le seul chemin pour le PDF** |
| WhatsApp par lien `wa.me` | ✅ | ❌ |
| SMS | ✅ | ❌ jamais, c'est le protocole |
| Mail par `mailto:` | ✅ | ❌ |

D'où deux boutons distincts : **Partager la facture PDF** ouvre le menu du système,
qui dépose le fichier dans WhatsApp ou un mail ; les boutons WhatsApp / SMS / Email
n'envoient que le message. Rien ne part de l'application elle-même : tout transite
par le téléphone de Fouad, depuis son propre numéro, sans service tiers ni
abonnement.

Le **rythme de facturation** (trois séances par défaut) se règle dans Réglages. Il
sert à deux choses : signaler dans Facturation les élèves qui l'ont atteint, et
annoncer au parent « message automatique envoyé toutes les N séances ». Rien n'est
émis tout seul — c'est un signalement, la décision reste humaine.

## Volumétrie

Le chargement initial est borné à **douze mois glissants** pour les cours, les
présences et les comptes rendus. Au-delà, les factures sont émises et figées, les
bilans envoyés : rien de ce que montrent les écrans ne remonte plus loin. Sans
cette borne, l'application téléchargeait tout l'historique à chaque ouverture —
sans effet à vingt élèves, plusieurs milliers de lignes après quelques années, en
4G, avant d'afficher le premier écran.
<!-- 3.1.0 -->
