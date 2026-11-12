<?php
/**
 * Configuration utilisée par les tests automatiques (GitHub Actions ou poste local).
 * Copiée en inc/config.php par tests/lancer.sh ; jamais utilisée en production.
 */
if (PHP_SAPI !== 'cli' && PHP_SAPI !== 'cli-server') { exit; }
if (!defined('BD_HOTE')) {
define('BD_HOTE', getenv('BD_HOTE') ?: '127.0.0.1');
define('BD_NOM', getenv('BD_NOM') ?: 'appel_test');
define('BD_UTILISATEUR', getenv('BD_UTILISATEUR') ?: 'root');
define('BD_MOT_DE_PASSE', getenv('BD_MOT_DE_PASSE') === false ? '' : getenv('BD_MOT_DE_PASSE'));
define('BD_PORT', (int) (getenv('BD_PORT') ?: 3306));
define('APP_DEBUG', true);
}
