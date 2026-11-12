<?php
/**
 * Suivi des finances (v3.0) — cotisations des familles.
 *
 * Les versements restent saisis sur le site clef-etampes.fr (Situation de compte →
 * Gestion des versements) : l'application ne fait que les LIRE, sans rien modifier
 * dans la base du site. Une « actualisation » recopie les inscriptions et les
 * versements de l'année dans des tables locales (fin_*), ce qui permet de
 * consulter le suivi et de relancer les familles sans se reconnecter à chaque fois.
 *
 * Famille = le parent rattaché sur le site (user.user_id_affilier), comme pour la
 * reprise des élèves. Un élève adulte sans parent est sa propre « famille ».
 */
declare(strict_types=1);

/** Codes du site (listes déroulantes de spv_versements.php). */
const MODES_PAIEMENT = [
    1 => 'Carte bancaire',
    2 => 'Chèque',
    3 => 'Espèces',
    4 => 'Mandat',
    5 => 'Prélèvement',
    6 => 'Virement',
    7 => 'Autre',
];

const TYPES_VERSEMENT = [
    1 => 'Cotisation',
    2 => 'Prestation',
    3 => 'Coopérative',
    9 => 'Remboursement',
];

/** Tables locales du suivi financier (créées au premier passage). */
function finances_installer(): void
{
    if (param('finances_schema') === '2') {
        finances_points_audit();
        return;
    }
    $tables = [
        "CREATE TABLE IF NOT EXISTS fin_familles (
           annee       VARCHAR(9)   NOT NULL,
           payeur_ref  INT          NOT NULL,
           nom         VARCHAR(120) NULL,
           prenom      VARCHAR(120) NULL,
           telephone   VARCHAR(40)  NULL,
           telephone2  VARCHAR(40)  NULL,
           email       VARCHAR(160) NULL,
           PRIMARY KEY (annee, payeur_ref)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS fin_inscrits (
           annee       VARCHAR(9)   NOT NULL,
           eleve_ref   INT          NOT NULL,
           payeur_ref  INT          NOT NULL,
           nom         VARCHAR(120) NULL,
           prenom      VARCHAR(120) NULL,
           classes     VARCHAR(255) NULL,
           cout        DECIMAL(8,2) NOT NULL DEFAULT 0,
           adulte      TINYINT(1)   NOT NULL DEFAULT 0,
           preinscrit  TINYINT(1)   NOT NULL DEFAULT 0,
           sans_parent TINYINT(1)   NOT NULL DEFAULT 0,
           PRIMARY KEY (annee, eleve_ref),
           KEY idx_payeur (annee, payeur_ref)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS fin_versements (
           annee             VARCHAR(9)   NOT NULL,
           vers_id           INT          NOT NULL,
           payeur_ref        INT          NOT NULL,
           compte_ref        INT          NULL,
           date_versement    DATE         NULL,
           date_encaissement DATE         NULL,
           montant           DECIMAL(10,2) NOT NULL DEFAULT 0,
           mode              TINYINT      NOT NULL DEFAULT 0,
           type              TINYINT      NOT NULL DEFAULT 1,
           encaisse          TINYINT(1)   NOT NULL DEFAULT 0,
           info              VARCHAR(255) NULL,
           PRIMARY KEY (annee, vers_id),
           KEY idx_payeur (annee, payeur_ref)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS fin_relances (
           id              INT AUTO_INCREMENT PRIMARY KEY,
           annee           VARCHAR(9)   NOT NULL,
           payeur_ref      INT          NOT NULL,
           date_relance    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
           utilisateur_id  INT          NULL,
           reste           DECIMAL(10,2) NOT NULL DEFAULT 0,
           KEY idx_payeur (annee, payeur_ref)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        // v3.1 : paiement signalé par la famille ou l'accueil, pas encore saisi sur le site.
        "CREATE TABLE IF NOT EXISTS fin_signalements (
           id              INT AUTO_INCREMENT PRIMARY KEY,
           annee           VARCHAR(9)   NOT NULL,
           payeur_ref      INT          NOT NULL,
           date_signalement DATETIME    NOT NULL,
           montant         DECIMAL(10,2) NULL,
           note            VARCHAR(255) NULL,
           utilisateur_id  INT          NULL,
           KEY idx_payeur (annee, payeur_ref)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];
    foreach ($tables as $sql) {
        bd()->exec($sql);
    }
    // v3.1 : le message d'origine (sans « d'après nos registres ») est remplacé.
    $actuel = str_replace("\r\n", "\n", param('modele_relance_finances'));
    if ($actuel === '' || $actuel === modele_relance_v30()) {
        definir_param('modele_relance_finances', modele_relance_par_defaut());
    }
    definir_param('finances_schema', '2');
    finances_points_audit();
}

/**
 * Points relevés lors de l'audit du 05/10/2026 (exports phpMyAdmin) : ces familles ne doivent
 * pas être relancées tant que l'administration n'a pas vérifié. Posé une seule fois ;
 * on les retire avec le bouton « Retirer » une fois le point réglé sur le site.
 */
function finances_points_audit(): void
{
    if (param('finances_audit_20261005') === '1') {
        return;
    }
    $points = [
        [503828, 340.0, 'Audit 05/10 : paiement CB de 340 € non saisi sur le site — à saisir dans Gestion des versements.'],
        [617926, null, 'Audit 05/10 : remboursement de 220 € à vérifier (table remboursement) avant toute relance.'],
    ];
    foreach ($points as [$payeur, $montant, $note]) {
        req('INSERT INTO fin_signalements (annee, payeur_ref, date_signalement, montant, note, utilisateur_id)
             VALUES (?, ?, ?, ?, ?, NULL)', ['2026-2027', $payeur, date('Y-m-d H:i:s'), $montant, $note]);
    }
    definir_param('finances_audit_20261005', '1');
}

/** Repère ajouté aux classes sans tarif sur le site (ancienne classe…). */
const TARIF_A_VERIFIER = '(tarif à vérifier)';

/** Texte de la v3.0, conservé pour le remplacer automatiquement. */
function modele_relance_v30(): string
{
    return "Assalamou alaykoum {parent},\n\n"
        . "Nous nous permettons de revenir vers vous au sujet de la cotisation {annee} "
        . "de l'association pour {enfants}.\n\n"
        . "{liste}\n"
        . "Cotisation totale : {du}\n"
        . "Déjà réglé : {verse}\n"
        . "*Reste à régler : {reste}*\n\n"
        . "Le règlement peut se faire par chèque, en espèces ou par carte bancaire lors de votre "
        . "passage à l'association. Un paiement en plusieurs fois reste possible : "
        . "n'hésitez pas à nous en parler.\n"
        . "Si vous avez déjà réglé ce montant, merci de ne pas tenir compte de ce message et de nous le signaler.\n\n"
        . "Barak Allahou fikoum.\n"
        . "{association}";
}

function modele_relance_par_defaut(): string
{
    return "Assalamou alaykoum {parent},\n\n"
        . "Nous revenons vers vous au sujet de la cotisation {annee} de l'association pour {enfants}.\n\n"
        . "D'après nos registres au {date_maj} :\n"
        . "{liste}\n"
        . "Cotisation totale : {du}\n"
        . "Déjà enregistré : {verse}\n"
        . "*Reste à régler : {reste}*\n\n"
        . "Si vous avez réglé récemment, merci de nous envoyer simplement une photo de votre reçu : "
        . "nous mettrons votre dossier à jour, avec toutes nos excuses pour ce message.\n\n"
        . "Sinon, le règlement peut se faire par chèque, en espèces ou par carte bancaire lors de votre "
        . "passage à l'association, et un paiement en plusieurs fois reste possible.\n\n"
        . "Barak Allahou fikoum.\n"
        . "{association}";
}

/** Montant en euros à la française : « 1 220 € », « 85,50 € ». */
function euros(float $montant): string
{
    $decimales = abs($montant - round($montant)) < 0.005 ? 0 : 2;
    return number_format($montant, $decimales, ',', "\u{202F}") . "\u{00A0}€";
}

/* ------------------------------------------------------------------ */
/* Connexion à la base du site                                         */
/* ------------------------------------------------------------------ */

/**
 * Connexion en lecture à la base du site.
 * 1) constantes CLEF_BD_* si l'administrateur les a ajoutées dans inc/config.php ;
 * 2) sinon, la connexion ouverte pendant la session (page Finances ou Données → reprise C.L.E.F.).
 * Le mot de passe n'est jamais enregistré par l'application.
 */
function finances_config_source(): ?array
{
    if (defined('CLEF_BD_NOM') && defined('CLEF_BD_UTILISATEUR') && defined('CLEF_BD_MOT_DE_PASSE')) {
        return [
            'hote' => defined('CLEF_BD_HOTE') ? (string) CLEF_BD_HOTE : 'localhost',
            'base' => (string) CLEF_BD_NOM,
            'utilisateur' => (string) CLEF_BD_UTILISATEUR,
            'mot_de_passe' => (string) CLEF_BD_MOT_DE_PASSE,
            'port' => defined('CLEF_BD_PORT') ? (int) CLEF_BD_PORT : 3306,
            'permanente' => true,
        ];
    }
    $c = $_SESSION['import_clef'] ?? null;
    return is_array($c) && !empty($c['base']) ? $c + ['permanente' => false] : null;
}

function finances_connexion_source(): ?PDO
{
    $c = finances_config_source();
    if ($c === null) {
        return null;
    }
    return connexion_pdo($c['hote'], $c['base'], $c['utilisateur'], $c['mot_de_passe'], (int) $c['port']);
}

/** Session du site correspondant à l'année scolaire de l'application (« 2026-2027 » ↔ « 2026/2027 »). */
function finances_session_source(PDO $src, string $annee): ?array
{
    $sessions = sessions_clef($src);
    $cible = str_replace('-', '/', $annee);
    foreach ($sessions as $s) {
        if (str_replace(' ', '', (string) $s['ses_libelle']) === $cible) {
            return $s;
        }
    }
    $aujourdhui = date('Y-m-d');
    foreach ($sessions as $s) {
        if ($aujourdhui >= (string) $s['ses_debut'] && $aujourdhui <= (string) $s['ses_fin']) {
            return $s;
        }
    }
    return $sessions[0] ?? null;
}

/** Colonnes d'une table de la base du site. */
function colonnes_source(PDO $src, string $table): array
{
    try {
        return $src->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        return [];
    }
}

/** Date valide AAAA-MM-JJ, ou null. */
function date_ou_null($v): ?string
{
    $v = substr(trim((string) ($v ?? '')), 0, 10);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && $v !== '0000-00-00' ? $v : null;
}

/**
 * Recopie les inscriptions et les versements de l'année depuis la base du site.
 * Rien n'est écrit dans la base du site. Les relances déjà faites sont conservées.
 */
function finances_actualiser(PDO $src, ?string $annee = null): array
{
    finances_installer();
    $annee = $annee ?? annee_active();
    $session = finances_session_source($src, $annee);
    if ($session === null) {
        throw new RuntimeException('Aucune session trouvée dans la base du site.');
    }
    $ses_id = (int) $session['ses_id'];
    $tarif_defaut = (float) param('cotisation_annuelle', '220');

    // ---- Inscriptions : chaque élève avec SON parent (user_id_affilier) ----
    $preinsc = colonne_preinscription($src) ? 'i.insc_pre_insc' : '0';
    $st = $src->prepare(
        "SELECT u.user_id, u.user_nom, u.user_prenom, u.user_adulte,
                u.user_phone AS el_tel, u.user_phone2 AS el_tel2, u.user_email AS el_email,
                c.clas_libelle, f.fil_cout, $preinsc AS preinscription,
                p.user_id AS parent_id, p.user_nom AS parent_nom, p.user_prenom AS parent_prenom,
                p.user_phone AS parent_tel, p.user_phone2 AS parent_tel2, p.user_email AS parent_email
         FROM inscription i
         JOIN user u        ON u.user_id = i.user_id
         LEFT JOIN classe c  ON c.clas_id = i.clas_id
         LEFT JOIN filiere f ON f.fil_id = c.fil_id
         LEFT JOIN user p    ON p.user_id = u.user_id_affilier AND p.user_id <> u.user_id
         WHERE i.ses_id = ?
         ORDER BY u.user_nom, u.user_prenom"
    );
    $st->execute([$ses_id]);

    $familles = [];   // payeur_ref → coordonnées
    $inscrits = [];   // eleve_ref  → fiche
    $payeur_de = [];  // compte du site → payeur (un versement saisi sur le compte d'un enfant revient à son parent)
    foreach ($st as $e) {
        $eleve = (int) $e['user_id'];
        $parent = (int) ($e['parent_id'] ?? 0);
        $payeur = $parent > 0 ? $parent : $eleve;
        $payeur_de[$eleve] = $payeur;
        if (!isset($familles[$payeur])) {
            $familles[$payeur] = $parent > 0
                ? [$e['parent_nom'], $e['parent_prenom'], $e['parent_tel'], $e['parent_tel2'], $e['parent_email']]
                : [$e['user_nom'], $e['user_prenom'], $e['el_tel'], $e['el_tel2'], $e['el_email']];
        }
        $cout = (float) ($e['fil_cout'] ?? 0) > 0 ? (float) $e['fil_cout'] : $tarif_defaut;
        $classe = trim((string) ($e['clas_libelle'] ?? ''));
        if ((float) ($e['fil_cout'] ?? 0) <= 0) {
            $classe = trim($classe . ' ' . TARIF_A_VERIFIER);   // classe sans tarif sur le site
        }
        if (isset($inscrits[$eleve])) {
            // Élève inscrit dans deux classes : une seule cotisation (la plus élevée).
            $inscrits[$eleve]['cout'] = max($inscrits[$eleve]['cout'], $cout);
            if ($classe !== '' && !str_contains($inscrits[$eleve]['classes'], $classe)) {
                $inscrits[$eleve]['classes'] .= ' · ' . $classe;
            }
            $inscrits[$eleve]['preinscrit'] = min($inscrits[$eleve]['preinscrit'], (int) $e['preinscription']);
            continue;
        }
        $inscrits[$eleve] = [
            'payeur' => $payeur,
            'nom' => trim((string) $e['user_nom']),
            'prenom' => trim((string) $e['user_prenom']),
            'classes' => $classe,
            'cout' => $cout,
            'adulte' => (int) $e['user_adulte'] === 1 ? 1 : 0,
            'preinscrit' => (int) $e['preinscription'] === 1 ? 1 : 0,
            'sans_parent' => $parent === 0 && (int) $e['user_adulte'] !== 1 ? 1 : 0,
        ];
    }

    // ---- Versements de la session ----
    $cols = colonnes_source($src, 'versement');
    $col_date_enc = null;
    foreach ($cols as $col) {
        $c = strtolower((string) $col);
        if ($c !== 'vers_encaisser' && str_contains($c, 'encaiss') && str_contains($c, 'date')) {
            $col_date_enc = (string) $col;
            break;
        }
    }
    if ($col_date_enc === null) {
        foreach ($cols as $col) {
            $c = strtolower((string) $col);
            if ($c !== 'vers_date' && str_contains($c, 'date')) {
                $col_date_enc = (string) $col;
                break;
            }
        }
    }
    $sel_enc = $col_date_enc !== null ? 'v.`' . $col_date_enc . '`' : 'NULL';
    $sel_info = in_array('vers_info', $cols, true) ? 'v.vers_info' : 'NULL';
    $st = $src->prepare(
        "SELECT v.vers_id, v.user_id, v.vers_date, $sel_enc AS date_enc, v.vers_montant,
                v.vers_type, v.vers_mode, v.vers_encaisser, $sel_info AS vers_info,
                u.user_nom, u.user_prenom, u.user_phone, u.user_phone2, u.user_email
         FROM versement v
         LEFT JOIN user u ON u.user_id = v.user_id
         WHERE v.ses_id = ?"
    );
    $st->execute([$ses_id]);
    $versements = [];
    foreach ($st as $v) {
        $compte = (int) $v['user_id'];
        $payeur = $payeur_de[$compte] ?? $compte;
        if (!isset($familles[$payeur])) {
            // Versement d'une personne sans inscription cette année (acompte, préinscription supprimée…).
            $familles[$payeur] = [$v['user_nom'], $v['user_prenom'], $v['user_phone'], $v['user_phone2'], $v['user_email']];
        }
        $versements[] = [
            (int) $v['vers_id'], $payeur, $compte,
            date_ou_null($v['vers_date']), date_ou_null($v['date_enc']),
            round((float) $v['vers_montant'], 2), (int) $v['vers_mode'], (int) ($v['vers_type'] ?: 1),
            (int) $v['vers_encaisser'] === 1 ? 1 : 0,
            valeur_ou_null(mb_substr((string) ($v['vers_info'] ?? ''), 0, 255)),
        ];
    }

    // ---- Remboursements (table du site « remboursement », si elle existe) ----
    // Ils sont déduits du versé, comme dans la Synthèse des cotisations du site.
    foreach (remboursements_source($src, $ses_id) as $r) {
        $compte = (int) $r['user_id'];
        $payeur = $payeur_de[$compte] ?? $compte;
        if (!isset($familles[$payeur])) {
            continue;
        }
        $versements[] = [
            900000000 + (int) $r['id'], $payeur, $compte, $r['date'], $r['date'],
            round(abs((float) $r['montant']), 2), 0, 9, 1, null,
        ];
    }

    finances_enregistrer($annee, $familles, $inscrits, $versements, (string) $session['ses_libelle'], 'base du site');

    return ['inscrits' => count($inscrits), 'familles' => count($familles),
            'versements' => count($versements), 'session' => (string) $session['ses_libelle']];
}

/** Remplace la photo locale de l'année (familles, inscrits, versements). */
function finances_enregistrer(string $annee, array $familles, array $inscrits, array $versements, string $session, string $source): void
{
    // ---- Écriture locale (remplace la photo précédente de l'année) ----
    $pdo = bd();
    $pdo->beginTransaction();
    try {
        foreach (['fin_familles', 'fin_inscrits', 'fin_versements'] as $t) {
            $pdo->prepare("DELETE FROM $t WHERE annee = ?")->execute([$annee]);
        }
        $ins = $pdo->prepare('INSERT INTO fin_familles (annee, payeur_ref, nom, prenom, telephone, telephone2, email)
                              VALUES (?, ?, ?, ?, ?, ?, ?)');
        foreach ($familles as $ref => [$nom, $prenom, $tel, $tel2, $email]) {
            $ins->execute([$annee, $ref, valeur_ou_null($nom), valeur_ou_null($prenom),
                           valeur_ou_null($tel), valeur_ou_null($tel2), valeur_ou_null($email)]);
        }
        $ins = $pdo->prepare('INSERT INTO fin_inscrits (annee, eleve_ref, payeur_ref, nom, prenom, classes, cout,
                                                        adulte, preinscrit, sans_parent)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($inscrits as $ref => $i) {
            $ins->execute([$annee, $ref, $i['payeur'], $i['nom'], $i['prenom'], mb_substr($i['classes'], 0, 255),
                           $i['cout'], $i['adulte'], $i['preinscrit'], $i['sans_parent']]);
        }
        $ins = $pdo->prepare('INSERT INTO fin_versements (annee, vers_id, payeur_ref, compte_ref, date_versement,
                                date_encaissement, montant, mode, type, encaisse, info)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($versements as $v) {
            $ins->execute(array_merge([$annee], $v));
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    definir_param('finances_maj', date('Y-m-d H:i:s'));
    definir_param('finances_session', $session);
    definir_param('finances_source', $source);
    journaliser('finances', sprintf('Actualisation (' . $source . ') : %d inscrits, %d familles, %d versements',
        count($inscrits), count($familles), count($versements)));

}

/* ------------------------------------------------------------------ */
/* Import des exports phpMyAdmin (CSV) — sans mot de passe de la base   */
/* ------------------------------------------------------------------ */

/** Lit un CSV exporté par phpMyAdmin (virgule ou point-virgule, NULL = vide). */
function lire_csv_export(string $chemin): array
{
    $contenu = (string) file_get_contents($chemin);
    $contenu = preg_replace('/^\xEF\xBB\xBF/', '', $contenu) ?? $contenu;
    if (!mb_check_encoding($contenu, 'UTF-8')) {
        $contenu = mb_convert_encoding($contenu, 'UTF-8', 'Windows-1252');
    }
    $premiere = strtok($contenu, "\n") ?: '';
    $sep = substr_count($premiere, ';') > substr_count($premiere, ',') ? ';' : ',';
    $f = fopen('php://memory', 'r+');
    fwrite($f, $contenu);
    rewind($f);
    $entetes = null;
    $lignes = [];
    while (($r = fgetcsv($f, 0, $sep, '"', '\\')) !== false) {
        if ($r === [null] || $r === ['']) {
            continue;
        }
        if ($entetes === null) {
            $entetes = array_map(fn($h) => strtolower(trim((string) $h)), $r);
            continue;
        }
        $l = [];
        foreach ($entetes as $i => $h) {
            $v = isset($r[$i]) ? trim((string) $r[$i]) : '';
            $l[$h] = ($v === 'NULL') ? '' : ltrim($v, "'");
        }
        $lignes[] = $l;
    }
    fclose($f);
    return $lignes;
}

/**
 * Remplit l'onglet Finances à partir des deux exports phpMyAdmin :
 *  - versements : SELECT v.*, u.user_nom, u.user_prenom, u.user_phone, u.user_phone2 FROM versement v ... WHERE v.ses_id = 2
 *  - inscrits   : eleve_id, user_nom, user_prenom, user_adulte, user_id_affilier, parent_nom, parent_prenom,
 *                 user_phone, user_phone2 (du parent), clas_libelle, fil_cout [, eleve_phone, eleve_phone2]
 *  - remboursements (facultatif) : SELECT * FROM remboursement
 * Mêmes règles que la lecture directe de la base du site.
 */
function finances_importer_csv(string $f_versements, string $f_inscrits, ?string $f_remb = null, ?string $annee = null, bool $forcer = false): array
{
    finances_installer();
    $annee = $annee ?? annee_active();
    $tarif_defaut = (float) param('cotisation_annuelle', '220');
    $V = lire_csv_export($f_versements);
    $I = lire_csv_export($f_inscrits);
    if (!$V || !isset($V[0]['vers_id'], $V[0]['vers_montant'], $V[0]['user_id'])) {
        throw new RuntimeException('Le fichier des versements ne contient pas les colonnes attendues (vers_id, vers_montant, user_id…).');
    }
    if (!$I || !isset($I[0]['eleve_id'], $I[0]['user_id_affilier'])) {
        throw new RuntimeException('Le fichier des inscrits ne contient pas les colonnes attendues (eleve_id, user_id_affilier…).');
    }
    $sessions = array_unique(array_filter(array_column($V, 'ses_id')));
    if (count($sessions) > 1) {
        throw new RuntimeException('Le fichier des versements mélange plusieurs sessions (' . implode(', ', $sessions) . ').');
    }

    $familles = [];
    $inscrits = [];
    $payeur_de = [];
    foreach ($I as $e) {
        $eleve = (int) $e['eleve_id'];
        $parent = (int) ($e['user_id_affilier'] ?? 0);
        if ($parent === $eleve) {
            $parent = 0;
        }
        $payeur = $parent > 0 ? $parent : $eleve;
        $payeur_de[$eleve] = $payeur;
        if (!isset($familles[$payeur])) {
            $familles[$payeur] = $parent > 0
                ? [$e['parent_nom'] ?? '', $e['parent_prenom'] ?? '', $e['user_phone'] ?? '', $e['user_phone2'] ?? '', '']
                : [$e['user_nom'] ?? '', $e['user_prenom'] ?? '', $e['eleve_phone'] ?? '', $e['eleve_phone2'] ?? '', ''];
        }
        $libelle = trim((string) ($e['clas_libelle'] ?? ''));
        $cout = (float) ($e['fil_cout'] ?? 0) > 0 ? (float) $e['fil_cout'] : $tarif_defaut;
        if ((float) ($e['fil_cout'] ?? 0) <= 0) {
            $libelle = trim($libelle . ' ' . TARIF_A_VERIFIER);
        }
        $preinscrit = stripos($libelle, 'preinscrit') !== false || stripos($libelle, 'préinscrit') !== false ? 1 : 0;
        if (isset($inscrits[$eleve])) {
            $inscrits[$eleve]['cout'] = max($inscrits[$eleve]['cout'], $cout);
            if ($libelle !== '' && !str_contains($inscrits[$eleve]['classes'], $libelle)) {
                $inscrits[$eleve]['classes'] .= ' · ' . $libelle;
            }
            continue;
        }
        $inscrits[$eleve] = [
            'payeur' => $payeur, 'nom' => trim((string) $e['user_nom']), 'prenom' => trim((string) $e['user_prenom']),
            'classes' => $libelle, 'cout' => $cout, 'adulte' => (int) ($e['user_adulte'] ?? 0) === 1 ? 1 : 0,
            'preinscrit' => $preinscrit,
            'sans_parent' => $parent === 0 && (int) ($e['user_adulte'] ?? 0) !== 1 ? 1 : 0,
        ];
    }

    $versements = [];
    foreach ($V as $v) {
        $compte = (int) $v['user_id'];
        $payeur = $payeur_de[$compte] ?? $compte;
        $tel = $v['user_phone'] ?? '';
        $tel2 = $v['user_phone2'] ?? '';
        if (!isset($familles[$payeur])) {
            $familles[$payeur] = [$v['user_nom'] ?? '', $v['user_prenom'] ?? '', $tel, $tel2, ''];
        } elseif ($familles[$payeur][2] === '' && $payeur === $compte) {
            // Adulte sans parent : son numéro vient de sa fiche de versement.
            $familles[$payeur][2] = $tel;
            $familles[$payeur][3] = $familles[$payeur][3] ?: $tel2;
        }
        $date_enc = $v['vers_date_encaisser'] ?? ($v['vers_date_encaissement'] ?? '');
        $versements[] = [
            (int) $v['vers_id'], $payeur, $compte, date_ou_null($v['vers_date'] ?? ''), date_ou_null($date_enc),
            round((float) $v['vers_montant'], 2), (int) ($v['vers_mode'] ?? 0), (int) (($v['vers_type'] ?? '') ?: 1),
            (int) ($v['vers_encaisser'] ?? 0) === 1 ? 1 : 0,
            valeur_ou_null(mb_substr((string) ($v['vers_info'] ?? ''), 0, 255)),
        ];
    }
    // Numéro au format e-mail ou vide : on n'invente rien.
    foreach ($familles as &$fa) {
        foreach ([2, 3] as $k) {
            if (normaliser_telephone((string) $fa[$k]) === '') {
                $fa[$k] = '';
            }
        }
    }
    unset($fa);

    $nb_remb = 0;
    if ($f_remb !== null && is_file($f_remb)) {
        $ses = $sessions ? (string) reset($sessions) : '';
        foreach (lire_csv_export($f_remb) as $i => $r) {
            if ($ses !== '' && isset($r['ses_id']) && (string) $r['ses_id'] !== $ses) {
                continue;
            }
            $montant = null;
            $date = null;
            $id = $i + 1;
            foreach ($r as $col => $val) {
                if ($montant === null && str_contains($col, 'montant')) { $montant = abs((float) $val); }
                if ($date === null && str_contains($col, 'date')) { $date = date_ou_null($val); }
                if (str_ends_with($col, '_id') && !in_array($col, ['user_id', 'ses_id', 'vers_id'], true) && (int) $val > 0) { $id = (int) $val; }
            }
            $compte = (int) ($r['user_id'] ?? 0);
            if (!$montant || !$compte) {
                continue;
            }
            $payeur = $payeur_de[$compte] ?? $compte;
            if (!isset($familles[$payeur])) {
                continue;
            }
            $versements[] = [900000000 + $id, $payeur, $compte, $date, $date, round($montant, 2), 0, 9, 1, null];
            $nb_remb++;
        }
    }

    // v3.22 : garde-fou contre un export ANCIEN. Un versement saisi sur le site n'en
    // disparaît normalement jamais ; s'il en manque par rapport à la photo actuelle,
    // le fichier est sans doute périmé et des familles à jour seraient relancées.
    if (!$forcer) {
        $nouveaux = [];
        foreach ($versements as $v) {
            $nouveaux[(int) $v[0]] = true;
        }
        $manquants = lignes(
            'SELECT vers_id, montant FROM fin_versements WHERE annee = ? AND vers_id < 900000000',
            [$annee]
        );
        $manquants = array_filter($manquants, fn($m) => !isset($nouveaux[(int) $m['vers_id']]));
        if ($manquants) {
            $total = array_sum(array_map(fn($m) => (float) $m['montant'], $manquants));
            throw new RuntimeException(sprintf(
                'Import arrêté : %d versement(s) déjà connus (%s) sont absents de ce fichier. '
                . 'C\'est le signe d\'un export ancien. Refaites l\'export dans phpMyAdmin, '
                . 'ou cochez « Importer quand même » si ces versements ont réellement été supprimés du site.',
                count($manquants), euros($total)
            ));
        }
    }

    $libelle = param('finances_session') !== '' ? param('finances_session') : str_replace('-', '/', $annee);
    finances_enregistrer($annee, $familles, $inscrits, $versements, $libelle, 'export phpMyAdmin');
    return ['inscrits' => count($inscrits), 'familles' => count($familles), 'versements' => count($versements) - $nb_remb,
            'remboursements' => $nb_remb];
}

/**
 * Remboursements de la session, lus dans la table du site si elle existe
 * (colonnes repérées automatiquement : identifiant, compte, session, montant, date).
 */
function remboursements_source(PDO $src, int $ses_id): array
{
    try {
        $tables = $src->query("SHOW TABLES LIKE 'rembours%'")->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        return [];
    }
    foreach ($tables as $table) {
        $cols = colonnes_source($src, (string) $table);
        $trouver = function (callable $test) use ($cols): ?string {
            foreach ($cols as $c) {
                if ($test(strtolower((string) $c))) {
                    return (string) $c;
                }
            }
            return null;
        };
        $col_id = $trouver(fn($c) => str_ends_with($c, '_id') && !in_array($c, ['user_id', 'ses_id', 'vers_id'], true)) ?? null;
        $col_montant = $trouver(fn($c) => str_contains($c, 'montant'));
        $col_date = $trouver(fn($c) => str_contains($c, 'date'));
        if (!in_array('user_id', $cols, true) || !in_array('ses_id', $cols, true) || $col_montant === null) {
            continue;
        }
        $sql = 'SELECT ' . ($col_id ? '`' . $col_id . '`' : '0') . ' AS id, user_id, `' . $col_montant . '` AS montant, '
             . ($col_date ? '`' . $col_date . '`' : 'NULL') . ' AS date FROM `' . $table . '` WHERE ses_id = ?';
        try {
            $st = $src->prepare($sql);
            $st->execute([$ses_id]);
            $lignes = [];
            foreach ($st as $i => $r) {
                $r['id'] = (int) $r['id'] ?: $i + 1;
                $r['date'] = date_ou_null($r['date']);
                $lignes[] = $r;
            }
            return $lignes;
        } catch (Throwable $e) {
            error_log('[appel-clef] remboursements : ' . $e->getMessage());
        }
    }
    return [];
}

/* ------------------------------------------------------------------ */
/* Lecture du suivi                                                    */
/* ------------------------------------------------------------------ */

/**
 * Situation de chaque famille pour l'année : dû, versé, à encaisser, reste, relances.
 * Seuls les versements de type « Cotisation » entrent dans le solde.
 */
function situations_familles(?string $annee = null): array
{
    $annee = $annee ?? annee_active();
    $familles = [];
    foreach (lignes('SELECT * FROM fin_familles WHERE annee = ?', [$annee]) as $f) {
        $familles[(int) $f['payeur_ref']] = $f + [
            'enfants' => [], 'nb' => 0, 'du' => 0.0, 'verse' => 0.0, 'encaisse' => 0.0,
            'a_encaisser' => 0.0, 'autres' => 0.0, 'versements' => [], 'dernier_versement' => null,
            'relances' => 0, 'derniere_relance' => null, 'sans_parent' => 0, 'preinscrits' => 0,
            'rembourse' => 0.0, 'signalement' => null, 'meme_numero' => [],
        ];
    }
    foreach (lignes('SELECT * FROM fin_inscrits WHERE annee = ? ORDER BY prenom', [$annee]) as $i) {
        $p = (int) $i['payeur_ref'];
        if (!isset($familles[$p])) {
            continue;
        }
        $familles[$p]['enfants'][] = $i;
        $familles[$p]['nb']++;
        $familles[$p]['du'] += (float) $i['cout'];
        $familles[$p]['sans_parent'] += (int) $i['sans_parent'];
        $familles[$p]['preinscrits'] += (int) $i['preinscrit'];
        if (str_contains((string) $i['classes'], TARIF_A_VERIFIER)) {
            $familles[$p]['tarif_inconnu'] = true;
        }
    }
    $aujourdhui = date('Y-m-d');
    foreach (lignes('SELECT * FROM fin_versements WHERE annee = ? ORDER BY date_versement, vers_id', [$annee]) as $v) {
        $p = (int) $v['payeur_ref'];
        if (!isset($familles[$p])) {
            continue;
        }
        $m = (float) $v['montant'];
        $familles[$p]['versements'][] = $v;
        if ((int) $v['type'] === 9) {
            $familles[$p]['rembourse'] += $m;
            $familles[$p]['verse'] -= $m;
            $familles[$p]['encaisse'] -= $m;
            continue;
        }
        if ((int) $v['type'] !== 1) {
            $familles[$p]['autres'] += $m;
            continue;
        }
        $familles[$p]['verse'] += $m;
        if (versement_a_encaisser($v, $aujourdhui)) {
            $familles[$p]['a_encaisser'] += $m;
        } else {
            $familles[$p]['encaisse'] += $m;
        }
        $familles[$p]['dernier_versement'] = max((string) $familles[$p]['dernier_versement'], (string) $v['date_versement']) ?: null;
    }
    foreach (lignes('SELECT payeur_ref, COUNT(*) AS n, MAX(date_relance) AS derniere
                     FROM fin_relances WHERE annee = ? GROUP BY payeur_ref', [$annee]) as $r) {
        $p = (int) $r['payeur_ref'];
        if (isset($familles[$p])) {
            $familles[$p]['relances'] = (int) $r['n'];
            $familles[$p]['derniere_relance'] = $r['derniere'];
        }
    }
    foreach (lignes('SELECT * FROM fin_signalements WHERE annee = ? ORDER BY date_signalement', [$annee]) as $s) {
        $p = (int) $s['payeur_ref'];
        if (isset($familles[$p])) {
            $familles[$p]['signalement'] = $s;   // le plus récent l'emporte
        }
    }
    foreach ($familles as &$f) {
        $f['du'] = round($f['du'], 2);
        $f['verse'] = round($f['verse'], 2);
        $f['reste'] = round($f['du'] - $f['verse'], 2);
        $f['telephone_whatsapp'] = $f['telephone'] ?: $f['telephone2'];
    }
    unset($f);

    // Même numéro WhatsApp sur plusieurs comptes du site : un versement a pu être saisi
    // sur l'autre compte (deux parents, fiche en double). On vérifie avant de relancer.
    $par_numero = [];
    foreach ($familles as $ref => $f) {
        $n = normaliser_telephone((string) $f['telephone_whatsapp']);
        if ($n !== '') {
            $par_numero[$n][] = $ref;
        }
    }
    foreach ($par_numero as $refs) {
        if (count($refs) < 2) {
            continue;
        }
        foreach ($refs as $ref) {
            $familles[$ref]['meme_numero'] = array_values(array_diff($refs, [$ref]));
        }
    }

    foreach ($familles as &$f) {
        $f['etat'] = etat_paiement($f, $familles);
    }
    unset($f);
    return $familles;
}

/** Un versement est « à encaisser » s'il n'est pas marqué encaissé ou si sa date d'encaissement est à venir. */
function versement_a_encaisser(array $v, ?string $aujourdhui = null): bool
{
    $aujourdhui = $aujourdhui ?? date('Y-m-d');
    return (int) $v['encaisse'] !== 1
        || ($v['date_encaissement'] !== null && (string) $v['date_encaissement'] > $aujourdhui);
}

/**
 * a_jour · partiel · rien · trop_percu · sans_inscrit · signale · a_verifier
 * « signale » et « a_verifier » ne sont JAMAIS relancés : il faut d'abord régler la question sur le site.
 */
function etat_paiement(array $f, array $toutes = []): string
{
    if ($f['nb'] === 0) {
        return 'sans_inscrit';
    }
    if ($f['reste'] < -0.009) {
        return 'trop_percu';
    }
    if ($f['reste'] <= 0.009) {
        return 'a_jour';
    }
    if ($f['reste'] <= 5.0) {
        return 'ecart';            // quelques euros d'écart : jamais de relance
    }
    if ($f['signalement'] !== null) {
        return 'signale';
    }
    // Règle de l'association : une famille qui a remis des chèques encore en attente
    // d'encaissement n'est JAMAIS relancée automatiquement, même s'il reste un solde.
    if ($f['a_encaisser'] > 0.009) {
        return 'cheques_attente';
    }
    if (!empty($f['tarif_inconnu'])) {
        return 'a_verifier';       // un enfant est dans une classe sans tarif : dû incertain
    }
    foreach ($f['meme_numero'] as $autre) {
        $o = $toutes[$autre] ?? null;
        if ($o && ($o['nb'] === 0 || $o['reste'] < -0.009) && ($o['verse'] + $o['autres']) > 0) {
            return 'a_verifier';
        }
    }
    return $f['verse'] > 0 ? 'partiel' : 'rien';
}

/** États pour lesquels une relance est proposée. */
const ETATS_A_RELANCER = ['rien', 'partiel'];

const ETATS_PAIEMENT = [
    'rien'         => ['Rien versé', 'rouge-plein'],
    'partiel'      => ['Acompte versé', 'orange'],
    'signale'      => ['Paiement signalé', 'bleu'],
    'cheques_attente' => ['Chèques en attente', 'bleu'],
    'ecart'        => ['Écart ≤ 5 €', 'gris'],
    'a_verifier'   => ['À vérifier', 'gris'],
    'a_jour'       => ['À jour', 'vert'],
    'trop_percu'   => ['Trop-perçu', 'bleu'],
    'sans_inscrit' => ['Sans inscription', 'gris'],
];

function badge_paiement(string $etat): string
{
    [$libelle, $couleur] = ETATS_PAIEMENT[$etat] ?? [$etat, 'gris'];
    return '<span class="badge ' . h($couleur) . '">' . h($libelle) . '</span>';
}

/** Nom affiché d'une famille : « Prénom NOM ». */
function nom_famille_fin(array $f): string
{
    $txt = trim(((string) $f['prenom']) . ' ' . mb_strtoupper((string) $f['nom']));
    return $txt !== '' ? $txt : 'Compte n° ' . $f['payeur_ref'];
}

/** Message de relance WhatsApp personnalisé. */
function message_relance(array $f): string
{
    $prenoms = array_map(fn($e) => trim((string) $e['prenom']), $f['enfants']);
    $prenoms = array_values(array_filter($prenoms));
    if (count($prenoms) > 1) {
        $dernier = array_pop($prenoms);
        $enfants = implode(', ', $prenoms) . ' et ' . $dernier;
    } else {
        $enfants = $prenoms[0] ?? 'votre inscription';
    }
    $liste = '';
    foreach ($f['enfants'] as $e) {
        $liste .= '• ' . trim($e['prenom'] . ' ' . mb_strtoupper((string) $e['nom'])) . ' : ' . euros((float) $e['cout']) . "\n";
    }
    $parent = trim((string) $f['prenom'] . ' ' . (string) $f['nom']);
    $remplacements = [
        '{parent}' => $parent,
        '{enfants}' => $enfants,
        '{liste}' => rtrim($liste),
        '{nb}' => (string) $f['nb'],
        '{du}' => euros($f['du']),
        '{verse}' => euros($f['verse']),
        '{a_encaisser}' => euros($f['a_encaisser']),
        '{reste}' => euros(max(0, $f['reste'])),
        '{annee}' => annee_active(),
        '{date_maj}' => param('finances_maj') !== '' ? date('d/m/Y', strtotime(param('finances_maj'))) : date('d/m/Y'),
        '{association}' => param('association', 'Association C.L.E.F.'),
        '{telephone}' => param('telephone_structure', ''),
    ];
    $remplacements['{lien_paiement}'] = '';   // v3.28 : paiement en ligne retiré (modèles enregistrés en v3.27)
    $modele = param('modele_relance_finances', modele_relance_par_defaut());
    return trim(preg_replace("/\n{3,}/", "\n\n", strtr($modele, $remplacements)) ?? '');
}

/** Échéancier des chèques et versements non encore encaissés, par mois d'encaissement. */
function echeancier_encaissements(array $familles): array
{
    $mois = [];
    $aujourdhui = date('Y-m-d');
    foreach ($familles as $f) {
        foreach ($f['versements'] as $v) {
            if (!versement_a_encaisser($v, $aujourdhui)) {
                continue;
            }
            $date = $v['date_encaissement'] ?: null;
            $cle = $date !== null && $date > $aujourdhui ? substr($date, 0, 7) : 'maintenant';
            $mois[$cle]['total'] = ($mois[$cle]['total'] ?? 0) + (float) $v['montant'];
            $mois[$cle]['lignes'][] = $v + ['famille' => nom_famille_fin($f)];
        }
    }
    uksort($mois, fn($a, $b) => $a === 'maintenant' ? -1 : ($b === 'maintenant' ? 1 : strcmp($a, $b)));
    return $mois;
}

function mois_fr(string $aaaa_mm): string
{
    static $noms = [1 => 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    [$a, $m] = array_map('intval', explode('-', $aaaa_mm));
    return ucfirst($noms[$m] ?? '') . ' ' . $a;
}
