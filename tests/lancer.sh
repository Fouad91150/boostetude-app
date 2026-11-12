#!/usr/bin/env bash
# Lance toute la batterie de tests sur une base MariaDB/MySQL de test.
# Utilisé par GitHub Actions (.github/workflows/tests.yml) ; utilisable aussi sur un poste.
# Variables : BD_HOTE, BD_PORT, BD_NOM, BD_UTILISATEUR, BD_MOT_DE_PASSE (base de TEST uniquement).
set -euo pipefail
SERVEUR=""
cd "$(dirname "$0")/.."

if [ -f inc/config.php ] && ! grep -q "config.ci.php\|Configuration utilisée par les tests" inc/config.php; then
  echo "inc/config.php existe déjà (configuration réelle ?) : arrêt par prudence." >&2
  exit 2
fi
cp tests/config.ci.php inc/config.php
cp -r documents /tmp/documents-sauves-$$          # les tests peuvent supprimer un PDF de progression
trap 'rm -f inc/config.php; rm -rf documents; mv /tmp/documents-sauves-$$ documents; kill $SERVEUR 2>/dev/null || true' EXIT

echo "== Vérification de la syntaxe PHP"
find . -name '*.php' -not -path './tests/*' -print0 | xargs -0 -n1 php -l > /dev/null

echo "== Préparation de la base"
php tests/preparer.php

echo "== Tests internes"
php tests/integration.php

echo "== Serveur PHP de test"
php -S 127.0.0.1:8080 > /tmp/serveur-tests.log 2>&1 &
SERVEUR=$!
sleep 2

echo "== Vérifications de bout en bout"
python3 tests/verifier.py http://127.0.0.1:8080/

if python3 -c "import playwright" 2>/dev/null; then
  echo "== Tests dans un navigateur (format téléphone)"
  python3 tests/navigateur.py http://127.0.0.1:8080/
fi
