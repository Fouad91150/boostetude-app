# Tests automatiques

À chaque dépôt sur GitHub, l'onglet **Actions** installe l'application sur une base
vierge et lance toute la batterie (environ 30 secondes de tests) :

- **tests internes** (`integration.php`) : montants en lettres, exports CSV, décodage des
  libellés de classe, sauvegarde puis restauration complète, reprise C.L.E.F. sur une
  copie fictive du site (`site_clef.sql`) avec ses garde-fous ;
- **vérifications de bout en bout** (`verifier.py`) : toutes les pages pour les quatre
  rôles, tous les formulaires, cloisonnement entre professeurs, code injecté, limites
  de connexion, Finances (import, export périmé, relances, attestations), installation neuve.

Pastille verte : tout passe. Croix rouge : un e-mail indique la vérification en échec.

**Règle d'or** : chaque bug corrigé reçoit sa vérification ici, pour ne jamais revenir.

Lancer sur un poste : `BD_NOM=… BD_UTILISATEUR=… BD_MOT_DE_PASSE=… bash tests/lancer.sh`
(base de test vide uniquement : la base est entièrement effacée).
Ce dossier est interdit d'accès depuis le web (`.htaccess`) et ne contient aucun secret.
