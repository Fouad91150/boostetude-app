# Version 3.28 — paiement en ligne HelloAsso retiré (12/10/2026)

À la demande de l'association, le paiement en ligne de la v3.27 est retiré :
- plus de section « Paiement en ligne (HelloAsso) » ni de bouton « Lien de paiement »
  dans Finances ; plus de lien dans les messages de relance (une marque
  `{lien_paiement}` restée dans un modèle enregistré est simplement ignorée) ;
- fichiers supprimés : `paiement.php` et `inc/helloasso.php` ;
- les réglages HelloAsso éventuellement enregistrés (identifiants compris) sont effacés
  de la base à la mise à jour. Les tables `paiements_en_ligne` et `liens_paiement`,
  vides, restent sans effet.
Les autres améliorations (paie du personnel, tests, etc.) sont conservées.
