# stripe-lien-facture (déployée sur Supabase le 12/10/2026)

Crée le lien de paiement Stripe d'une facture émise, au montant exact du reste à payer.
Réservée à l'administrateur (`est_admin()`), la clé Stripe vit dans le secret
`STRIPE_SECRET_KEY`. Réutilise le lien si le montant n'a pas changé, désactive l'ancien sinon.
Écrit `paiements.stripe_lien_id`, `stripe_lien_url`, `stripe_lien_montant`.

Le code source fait foi sur Supabase (Edge Functions → stripe-lien-facture).
Appelée par l'application via `api.lienPaiementStripe` (`src/app/03-api-supabase.js`).

Le paiement revient par `stripe-webhook` (ce dossier voisin), qui enregistre un versement
« Carte bancaire » (`encaissements.stripe_ref` = id de session Stripe, unique).
