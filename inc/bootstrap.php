<?php
/**
 * Démarrage de l'application : configuration, session, dépendances.
 */
declare(strict_types=1);

define('APP_RACINE', dirname(__DIR__));
define('APP_NOM', 'Appel & Suivi');
define('APP_VERSION', '3.28');

date_default_timezone_set('Europe/Paris');
mb_internal_encoding('UTF-8');
setlocale(LC_ALL, 'fr_FR.UTF-8', 'fr_FR', 'fr');

require APP_RACINE . '/inc/fonctions.php';
require APP_RACINE . '/inc/db.php';

if (!is_file(APP_RACINE . '/inc/config.php')) {
    // Première utilisation (v3.22) : l'assistant install.php n'existe plus.
    http_response_code(503);
    exit('Application non configurée : copiez inc/config.exemple.php en inc/config.php '
       . 'et renseignez la base de données (voir docs/GUIDE-INSTALLATION.md).');
} else {
    require APP_RACINE . '/inc/config.php';
}

require APP_RACINE . '/inc/schema.php';
require APP_RACINE . '/inc/auth.php';
require APP_RACINE . '/inc/message.php';
require APP_RACINE . '/inc/seances.php';
require APP_RACINE . '/inc/reprise_clef.php';
require APP_RACINE . '/inc/progression.php';
require APP_RACINE . '/inc/videos.php';
require APP_RACINE . '/inc/familles.php';
require APP_RACINE . '/inc/messagerie.php';
require APP_RACINE . '/inc/devoirs.php';
require APP_RACINE . '/inc/evaluations.php';
require APP_RACINE . '/inc/personnel.php';
require APP_RACINE . '/inc/finances.php';
require APP_RACINE . '/inc/communication.php';
require APP_RACINE . '/inc/echanges.php';
require APP_RACINE . '/inc/attestations.php';
require APP_RACINE . '/inc/sauvegarde.php';

// ---- Session ----------------------------------------------------------
if (session_status() !== PHP_SESSION_ACTIVE) {
    $securise = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'secure'   => $securise,
        'samesite' => 'Lax',
    ]);
    session_name('clef_appel');
    session_start();
}

// ---- En-têtes de sécurité (v3.22) ---------------------------------------
// Aucune page de l'application ne peut être affichée dans le cadre d'un autre site
// (protection contre le « clickjacking »), et le navigateur ne devine pas les types.
if (PHP_SAPI !== 'cli' && !headers_sent()) {
    header('X-Frame-Options: SAMEORIGIN');
    header("Content-Security-Policy: frame-ancestors 'self'");
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
}

// ---- Erreurs ----------------------------------------------------------
// En production on masque les détails techniques aux utilisateurs.
$mode_debug = defined('APP_DEBUG') && APP_DEBUG;
ini_set('display_errors', $mode_debug ? '1' : '0');
error_reporting(E_ALL);

set_exception_handler(function (Throwable $e) use ($mode_debug) {
    http_response_code(500);
    error_log('[appel-clef] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    echo '<!doctype html><meta charset="utf-8"><title>Erreur</title>';
    echo '<div style="font-family:system-ui;max-width:640px;margin:60px auto;padding:24px;'
       . 'border:1px solid #e5e7eb;border-radius:12px">';
    echo '<h2 style="margin-top:0">Une erreur est survenue</h2>';
    if ($mode_debug) {
        echo '<pre style="white-space:pre-wrap;color:#b91c1c">' . h($e->getMessage()) . "\n"
           . h($e->getFile() . ':' . $e->getLine()) . '</pre>';
    } else {
        echo '<p>L\'opération n\'a pas pu être terminée. Revenez en arrière et réessayez. '
           . 'Si le problème persiste, prévenez l\'administrateur.</p>';
    }
    echo '<p><a href="index.php">Retour à l\'accueil</a></p></div>';
    exit;
});

// ---- Mise à niveau automatique de la base ------------------------------
// Au premier passage après le dépôt d'une nouvelle version, les tables et
// colonnes manquantes sont ajoutées. Sans effet les fois suivantes.
if (defined('BD_NOM')) {
    migrer_si_besoin();
    try {
        charger_progressions_fournies();
        recaler_pages_livre_n1();
    } catch (Throwable $e) {
        error_log('[appel-clef] progression : ' . $e->getMessage());
    }
}
