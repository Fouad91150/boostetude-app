# Fonctions serveur Supabase (copie de sauvegarde)

Ces fonctions tournent dans Supabase (projet `boost-etude`), pas dans l'application.
Les déposer sur GitHub ne les met PAS à jour : un changement se redéploie dans Supabase.

| Fonction | Rôle | JWT |
|---|---|---|
| `stripe-lien-facture` | crée le lien Stripe d'une facture émise, au montant du reste dû (admin seulement) | exigé |
| `stripe-webhook` | appelée par Stripe à chaque paiement ; relit l'événement chez Stripe et inscrit un versement « Carte » | non (vérif. par relecture Stripe) |

Secret requis : `STRIPE_SECRET_KEY` (clé restreinte `rk_live_…` : Payment Links, Prices, Products en écriture ; Events, PaymentIntents en lecture).
Webhook Stripe : `we_1UPiL92ei0Xf7KTpRKm5SwVS` → `https://jcvvpzcczbewduiexuri.supabase.co/functions/v1/stripe-webhook`
(`checkout.session.completed`, `checkout.session.async_payment_succeeded`).
Migration : `stripe_liens_factures` (colonnes `paiements.stripe_lien_*`, `encaissements.stripe_ref` unique).
