<?php
/**
 * Suivi des finances (administration) : cotisations par famille, relances WhatsApp,
 * encaissements à venir. Les versements restent saisis sur le site clef-etampes.fr.
 */
declare(strict_types=1);

exiger_admin();
finances_installer();

$annee = annee_active();

/* ================================================================= */
/* Traitements                                                        */
/* ================================================================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifier_csrf();
    $action = post('action');
    $retour = url('finances', array_filter(['etat' => post('retour_etat'), 'q' => post('retour_q'), 'tri' => post('retour_tri')]));

    if ($action === 'connexion') {
        try {
            $config = [
                'hote' => post('hote', 'localhost'),
                'base' => post('base'),
                'utilisateur' => post('utilisateur'),
                'mot_de_passe' => $_POST['mot_de_passe'] ?? '',
                'port' => max(1, entier('port', 3306)),
            ];
            $src = connexion_pdo($config['hote'], $config['base'], $config['utilisateur'],
                                 $config['mot_de_passe'], $config['port']);
            $config['sessions'] = sessions_clef($src);
            $_SESSION['import_clef'] = $config;   // partagée avec Données → reprise C.L.E.F.
            definir_param('finances_source_base', $config['base']);
            definir_param('finances_source_utilisateur', $config['utilisateur']);
            $r = finances_actualiser($src, $annee);
            flash('succes', sprintf('Données du site chargées (session %s) : %d inscrits, %d familles, %d versements.',
                $r['session'], $r['inscrits'], $r['familles'], $r['versements']));
        } catch (Throwable $e) {
            flash('erreur', 'Connexion à la base du site impossible : ' . $e->getMessage());
        }
        redirection($retour);
    }

    if ($action === 'actualiser') {
        try {
            $src = finances_connexion_source();
            if ($src === null) {
                flash('attention', 'Connectez-vous d\'abord à la base du site.');
            } else {
                $r = finances_actualiser($src, $annee);
                flash('succes', sprintf('Actualisé : %d inscrits, %d familles, %d versements.',
                    $r['inscrits'], $r['familles'], $r['versements']));
            }
        } catch (Throwable $e) {
            flash('erreur', 'Actualisation impossible : ' . $e->getMessage());
        }
        redirection($retour);
    }

    if ($action === 'importer') {
        $fichier = function (string $champ): ?string {
            $f = $_FILES[$champ] ?? null;
            if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
                return null;
            }
            return (string) $f['tmp_name'];
        };
        $fv = $fichier('f_versements');
        $fi = $fichier('f_inscrits');
        if ($fv === null || $fi === null) {
            flash('erreur', 'Il faut les deux fichiers : l\'export des versements et l\'export des inscrits.');
            redirection($retour);
        }
        try {
            $r = finances_importer_csv($fv, $fi, $fichier('f_remboursements'), $annee, isset($_POST['forcer']));
            flash('succes', sprintf('Exports importés : %d inscrits, %d familles, %d versements, %d remboursement(s).',
                $r['inscrits'], $r['familles'], $r['versements'], $r['remboursements']));
        } catch (Throwable $e) {
            flash('erreur', 'Import impossible : ' . $e->getMessage());
        }
        redirection($retour);
    }

    if ($action === 'oublier') {
        unset($_SESSION['import_clef']);
        flash('info', 'Connexion à la base du site fermée. Le suivi reste consultable.');
        redirection($retour);
    }

    if ($action === 'relancer') {
        $payeur = entier('payeur');
        // 1) Données fraîches obligatoires : on relit le site juste avant d'ouvrir WhatsApp.
        $fraiche = false;
        try {
            $src = finances_connexion_source();
            if ($src !== null) {
                finances_actualiser($src, $annee);
                $fraiche = true;
            }
        } catch (Throwable $e) {
            error_log('[appel-clef] relance, actualisation : ' . $e->getMessage());
        }
        $maj = param('finances_maj');
        // Données importées par export phpMyAdmin : valables le jour même seulement.
        $import_du_jour = param('finances_source') === 'export phpMyAdmin' && $maj !== '' && substr($maj, 0, 10) === date('Y-m-d');
        if (!$fraiche && !$import_du_jour && ($maj === '' || strtotime($maj) < time() - 1800)) {
            flash('erreur', 'Relance bloquée : les données du site datent de plus de 30 minutes. '
                . 'Connectez-vous à la base du site (ou importez les exports phpMyAdmin du jour) puis recommencez.');
            redirection($retour);
        }
        // 2) Situation recalculée sur ces données.
        $familles = situations_familles($annee);
        $f = $familles[$payeur] ?? null;
        if ($f === null || !in_array($f['etat'], ETATS_A_RELANCER, true)) {
            flash('succes', 'Relance annulée : d\'après le site, ' . ($f ? nom_famille_fin($f) : 'cette famille')
                . ' n\'a plus rien à régler (ou un paiement est signalé / à vérifier).');
            redirection($retour);
        }
        $lien = lien_whatsapp((string) $f['telephone_whatsapp'], message_relance($f));
        if ($lien === '') {
            flash('erreur', 'Pas de numéro WhatsApp pour cette famille.');
            redirection($retour);
        }
        req('INSERT INTO fin_relances (annee, payeur_ref, date_relance, utilisateur_id, reste) VALUES (?, ?, ?, ?, ?)',
            [$annee, $payeur, date('Y-m-d H:i:s'), id_utilisateur() ?: null, max(0, $f['reste'])]);
        journaliser('relance_finances', nom_famille_fin($f) . ' — reste ' . $f['reste']);
        redirection($lien);
    }

    if ($action === 'signaler') {
        $payeur = entier('payeur');
        $montant = (float) str_replace([',', ' '], ['.', ''], post('montant'));
        req('INSERT INTO fin_signalements (annee, payeur_ref, date_signalement, montant, note, utilisateur_id)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$annee, $payeur, date('Y-m-d H:i:s'), $montant > 0 ? $montant : null,
             mb_substr(post('note'), 0, 255) ?: null, id_utilisateur() ?: null]);
        flash('succes', 'Paiement signalé : la famille ne sera plus relancée. Pensez à saisir ce versement sur le site, puis à actualiser.');
        redirection($retour);
    }

    if ($action === 'retirer_signalement') {
        req('DELETE FROM fin_signalements WHERE annee = ? AND payeur_ref = ?', [$annee, entier('payeur')]);
        flash('info', 'Signalement retiré.');
        redirection($retour);
    }

    if ($action === 'annuler_relance') {
        $payeur = entier('payeur');
        $id = (int) valeur('SELECT MAX(id) FROM fin_relances WHERE annee = ? AND payeur_ref = ?', [$annee, $payeur]);
        if ($id > 0) {
            req('DELETE FROM fin_relances WHERE id = ?', [$id]);
            flash('info', 'Dernière relance retirée de l\'historique.');
        }
        redirection($retour);
    }

    if ($action === 'modele') {
        $texte = trim(str_replace("\r\n", "\n", (string) ($_POST['modele'] ?? '')));
        definir_param('modele_relance_finances', isset($_POST['defaut']) || $texte === '' ? modele_relance_par_defaut() : $texte);
        flash('succes', 'Message de relance enregistré.');
        redirection($retour);
    }
}

/* ================================================================= */
/* Actualisation automatique si la connexion est permanente           */
/* ================================================================= */
$config_source = finances_config_source();
$derniere_maj = param('finances_maj');
if ($config_source !== null
    && ($derniere_maj === '' || strtotime($derniere_maj) < time() - 600)) {
    try {
        $src = finances_connexion_source();
        if ($src) {
            finances_actualiser($src, $annee);
            redirection(url('finances', $_GET ? array_diff_key($_GET, ['p' => 1]) : []));
        }
    } catch (Throwable $e) {
        flash('erreur', 'Actualisation automatique impossible : ' . $e->getMessage());
    }
}

/* ================================================================= */
/* Données                                                            */
/* ================================================================= */
$familles = situations_familles($annee);
$aujourdhui = date('Y-m-d');

$etat_f = get('etat', 'a_relancer');
$q      = get('q');
$tri    = get('tri', 'reste');

$totaux = ['inscrits' => 0, 'adultes' => 0, 'preinscrits' => 0, 'du' => 0.0, 'verse' => 0.0,
           'encaisse' => 0.0, 'a_encaisser' => 0.0, 'reste' => 0.0, 'trop' => 0.0, 'autres' => 0.0];
$par_etat = array_fill_keys(array_keys(ETATS_PAIEMENT), 0);
$par_mode = [];
$sans_numero = [];
$relancees_recemment = 0;
foreach ($familles as $f) {
    $totaux['inscrits'] += $f['nb'];
    $totaux['preinscrits'] += $f['preinscrits'];
    foreach ($f['enfants'] as $e) {
        $totaux['adultes'] += (int) $e['adulte'];
    }
    $totaux['du'] += $f['du'];
    $totaux['verse'] += $f['verse'];
    $totaux['encaisse'] += $f['encaisse'];
    $totaux['a_encaisser'] += $f['a_encaisser'];
    $totaux['autres'] += $f['autres'];
    if ($f['reste'] > 0) {
        $totaux['reste'] += $f['reste'];
    } elseif ($f['etat'] === 'trop_percu') {
        $totaux['trop'] -= $f['reste'];
    }
    $par_etat[$f['etat']]++;
    foreach ($f['versements'] as $v) {
        if ((int) $v['type'] === 1) {
            $m = (int) $v['mode'];
            $par_mode[$m]['n'] = ($par_mode[$m]['n'] ?? 0) + 1;
            $par_mode[$m]['montant'] = ($par_mode[$m]['montant'] ?? 0) + (float) $v['montant'];
            $cle_enc = versement_a_encaisser($v) ? 'a_encaisser' : 'encaisse';
            $par_mode[$m][$cle_enc] = ($par_mode[$m][$cle_enc] ?? 0) + (float) $v['montant'];
        }
    }
    if (in_array($f['etat'], ETATS_A_RELANCER, true) && normaliser_telephone((string) $f['telephone_whatsapp']) === '') {
        $sans_numero[] = $f;
    }
    if ($f['derniere_relance'] && strtotime((string) $f['derniere_relance']) > time() - 7 * 86400) {
        $relancees_recemment++;
    }
}
ksort($par_mode);
$a_relancer = $par_etat['rien'] + $par_etat['partiel'];
$donnees_anciennes = $derniere_maj === '' || strtotime($derniere_maj) < time() - 1800;

// Filtre et tri.
$liste = array_filter($familles, function (array $f) use ($etat_f, $q): bool {
    if ($etat_f === 'a_relancer' && !in_array($f['etat'], ETATS_A_RELANCER, true)) {
        return false;
    }
    if ($etat_f !== 'a_relancer' && $etat_f !== 'tous' && $f['etat'] !== $etat_f) {
        return false;
    }
    if ($q !== '') {
        $botte = mb_strtolower(nom_famille_fin($f) . ' ' . implode(' ', array_map(
            fn($e) => $e['prenom'] . ' ' . $e['nom'] . ' ' . $e['classes'], $f['enfants'])) . ' ' . $f['telephone'] . ' ' . $f['payeur_ref']);
        if (!str_contains($botte, mb_strtolower($q))) {
            return false;
        }
    }
    return true;
});
$ordres = [
    'reste'   => fn($a, $b) => $b['reste'] <=> $a['reste'] ?: strcmp((string) $a['nom'], (string) $b['nom']),
    'nom'     => fn($a, $b) => strcmp(mb_strtolower((string) $a['nom']), mb_strtolower((string) $b['nom'])),
    'relance' => fn($a, $b) => strcmp((string) $a['derniere_relance'], (string) $b['derniere_relance']) ?: $b['reste'] <=> $a['reste'],
    'versement' => fn($a, $b) => strcmp((string) $a['dernier_versement'], (string) $b['dernier_versement']),
];
uasort($liste, $ordres[$tri] ?? $ordres['reste']);

/* ---- Export CSV ---- */
if (get('export') === 'csv') {
    $lignes_csv = [];
    foreach ($liste as $f) {
        $lignes_csv[] = [
            (string) $f['payeur_ref'], nom_famille_fin($f), telephone_lisible((string) $f['telephone_whatsapp']), $f['nb'],
            implode(', ', array_map(fn($e) => trim($e['prenom'] . ' ' . $e['nom']) . ' (' . $e['classes'] . ')', $f['enfants'])),
            number_format($f['du'], 2, ',', ''), number_format($f['verse'], 2, ',', ''),
            number_format($f['a_encaisser'], 2, ',', ''), number_format($f['reste'], 2, ',', ''),
            ETATS_PAIEMENT[$f['etat']][0] ?? $f['etat'],
            $f['dernier_versement'] ? date_fr($f['dernier_versement'], true) : '',
            $f['derniere_relance'] ? date_fr(substr((string) $f['derniere_relance'], 0, 10), true) : '', $f['relances'],
        ];
    }
    telecharger_csv('finances-' . $annee . '-' . date('Ymd') . '.csv',
        ['Réf. parent', 'Famille', 'WhatsApp', 'Inscrits', 'Élèves', 'Dû', 'Versé', 'Dont à encaisser', 'Reste',
         'État', 'Dernier versement', 'Dernière relance', 'Nb relances'], $lignes_csv);
}

$echeancier = echeancier_encaissements($familles);
$maj_txt = $derniere_maj !== '' ? date('d/m/Y à H\hi', strtotime($derniere_maj)) : '';
$garder = ['retour_etat' => $etat_f, 'retour_q' => $q, 'retour_tri' => $tri];
$champs_retour = '';
foreach ($garder as $k => $v) {
    $champs_retour .= '<input type="hidden" name="' . h($k) . '" value="' . h($v) . '">';
}

/* ================================================================= */
/* Affichage                                                          */
/* ================================================================= */
entete('Finances', ['large' => true]);

$actions = '';
if ($config_source !== null) {
    $actions .= '<form method="post">' . champ_csrf() . $champs_retour
        . '<input type="hidden" name="action" value="actualiser">'
        . '<button class="bouton bouton-principal" type="submit">Actualiser depuis le site</button></form>';
}
if ($familles) {
    $actions .= '<a class="bouton" href="' . h(url('finances', ['etat' => $etat_f, 'q' => $q, 'tri' => $tri, 'export' => 'csv'])) . '">Export CSV</a>';
}
titre_page('Suivi des finances', $actions,
    'Cotisations ' . $annee
    . ($maj_txt !== '' ? ' · données du site du ' . $maj_txt : ' · aucune donnée chargée')
    . (param('finances_session') !== '' ? ' (session ' . param('finances_session') . ')' : ''));
?>

<?php if ($config_source === null): ?>
<section class="bloc-section">
  <h2><?= $familles ? 'Actualiser depuis le site' : 'Charger les versements du site' ?></h2>
  <p class="aide">Les versements restent saisis sur clef-etampes.fr (Situation de compte → Gestion des versements) :
    l'application les lit sans rien modifier. Le mot de passe n'est pas enregistré ; il reste en mémoire
    jusqu'à la déconnexion. <?= $familles ? 'Le suivi ci-dessous reste consultable sans connexion.' : '' ?></p>
  <form method="post" class="form-grille">
    <?= champ_csrf() ?><?= $champs_retour ?>
    <input type="hidden" name="action" value="connexion">
    <div><label>Nom de la base</label>
      <input type="text" name="base" required value="<?= h(param('finances_source_base', 'u171702491_clef')) ?>"></div>
    <div><label>Utilisateur</label>
      <input type="text" name="utilisateur" required value="<?= h(param('finances_source_utilisateur', 'u171702491_admin')) ?>"></div>
    <div><label>Mot de passe de la base</label>
      <input type="password" name="mot_de_passe" autocomplete="off" required></div>
    <div><label>Hôte</label><input type="text" name="hote" value="localhost" required>
      <input type="hidden" name="port" value="3306"></div>
    <div class="pleine-largeur">
      <button class="bouton bouton-principal" type="submit">Se connecter et charger</button></div>
  </form>
</section>
<?php elseif (empty($config_source['permanente'])): ?>
<div class="aide form-inline">Connecté à la base « <?= h($config_source['base']) ?> » pour cette session.
  <form method="post"><?= champ_csrf() ?><?= $champs_retour ?>
    <input type="hidden" name="action" value="oublier">
    <button class="bouton petit" type="submit">Fermer la connexion</button></form></div>
<?php endif; ?>


<details class="bloc-section depliant-section" <?= $familles ? '' : 'open' ?>>
  <summary><strong>Importer les exports phpMyAdmin (CSV)</strong>
    <span class="gris">— sans mot de passe de la base<?= param('finances_source') === 'export phpMyAdmin' ? ' · source actuelle' : '' ?></span></summary>
  <p class="aide">Dans phpMyAdmin (base <code>u171702491_clef</code>), onglet SQL : exécuter chaque requête ci-dessous,
    puis <strong>Exporter → CSV</strong> et déposer les fichiers ici. Les règles sont les mêmes que la lecture directe
    du site (chèques en attente jamais relancés, écart ≤ 5 €, même numéro à vérifier, paiements signalés).
    <strong>Les relances ne sont possibles que le jour de l'import</strong> : refaites les exports avant chaque série de relances.</p>
  <form method="post" enctype="multipart/form-data" class="form-grille">
    <?= champ_csrf() ?><?= $champs_retour ?>
    <input type="hidden" name="action" value="importer">
    <div><label>1. Versements (obligatoire)</label><input type="file" name="f_versements" accept=".csv,text/csv" required></div>
    <div><label>2. Inscrits (obligatoire)</label><input type="file" name="f_inscrits" accept=".csv,text/csv" required></div>
    <div><label>3. Remboursements (facultatif)</label><input type="file" name="f_remboursements" accept=".csv,text/csv"></div>
    <div class="pleine-largeur"><label class="case"><input type="checkbox" name="forcer" value="1">
      Importer quand même si des versements déjà connus manquent au fichier (suppression réelle sur le site)</label></div>
    <div class="pleine-largeur"><button class="bouton bouton-principal" type="submit">Importer et recalculer</button></div>
  </form>
  <p class="aide"><strong>Requête 1 — versements</strong></p>
  <pre class="code-sql">SELECT v.vers_id, v.vers_date, v.vers_montant, v.vers_type, v.vers_mode, v.vers_date_encaisser,
       v.vers_encaisser, v.vers_info, v.user_id, v.ses_id, u.user_nom, u.user_prenom, u.user_phone, u.user_phone2
FROM versement v LEFT JOIN user u ON u.user_id = v.user_id
WHERE v.ses_id = 2;</pre>
  <p class="aide"><strong>Requête 2 — inscrits</strong></p>
  <pre class="code-sql">SELECT e.user_id AS eleve_id, e.user_nom, e.user_prenom, e.user_adulte, e.user_id_affilier,
       p.user_nom AS parent_nom, p.user_prenom AS parent_prenom, p.user_phone, p.user_phone2,
       c.clas_libelle, f.fil_cout, e.user_phone AS eleve_phone, e.user_phone2 AS eleve_phone2
FROM inscription i JOIN user e ON e.user_id = i.user_id
LEFT JOIN user p ON p.user_id = e.user_id_affilier AND p.user_id <> e.user_id
LEFT JOIN classe c ON c.clas_id = i.clas_id LEFT JOIN filiere f ON f.fil_id = c.fil_id
WHERE i.ses_id = 2;</pre>
  <p class="aide"><strong>Requête 3 — remboursements</strong> : <code>SELECT * FROM remboursement;</code></p>
</details>

<?php if (!$familles): ?>
  <p class="vide">Aucune donnée pour l'année <?= h($annee) ?>. Chargez les versements du site ou importez les exports ci-dessus.</p>
<?php pied(); return; endif; ?>

<div class="tuiles">
  <?= tuile((string) $totaux['inscrits'], 'inscrits · ' . count($familles) . ' familles') ?>
  <?= tuile(euros($totaux['du']), 'cotisations attendues') ?>
  <?= tuile(euros($totaux['verse']), 'versé · ' . str_replace('.', ',', (string) pourcentage($totaux['verse'], $totaux['du'])) . ' %', 'vert') ?>
  <?= tuile(euros($totaux['reste']), 'reste à percevoir', $totaux['reste'] > 0 ? 'rouge' : 'vert') ?>
  <?= tuile(euros($totaux['encaisse']), 'déjà encaissé') ?>
  <?= tuile(euros($totaux['a_encaisser']), 'chèques et versements à encaisser', 'orange') ?>
  <?= tuile($par_etat['a_jour'] . ' / ' . (count($familles) - $par_etat['sans_inscrit']), 'familles à jour', 'vert',
            url('finances', ['etat' => 'a_jour'])) ?>
  <?= tuile((string) $a_relancer, 'familles à relancer', $a_relancer > 0 ? 'rouge' : '',
            url('finances', ['etat' => 'a_relancer'])) ?>
</div>

<div class="deux-colonnes">
  <section class="bloc-section">
    <h2>Par mode de paiement</h2>
    <?php $nb_v = array_sum(array_column($par_mode, 'n')); $tot_v = array_sum(array_column($par_mode, 'montant')); ?>
    <table class="tableau tableau-dense">
      <thead><tr><th>Mode</th><th class="num">Versements</th><th class="num">Montant</th><th class="num">Encaissé</th>
        <th class="num">À encaisser</th><th class="num">Part</th></tr></thead>
      <tbody>
      <?php foreach ($par_mode as $m => $d): ?>
        <tr><td><?= h(MODES_PAIEMENT[$m] ?? 'Mode ' . $m) ?></td><td class="num"><?= (int) $d['n'] ?></td>
          <td class="num"><?= h(euros((float) $d['montant'])) ?></td>
          <td class="num"><?= h(euros((float) ($d['encaisse'] ?? 0))) ?></td>
          <td class="num"><?= ($d['a_encaisser'] ?? 0) > 0 ? h(euros((float) $d['a_encaisser'])) : '—' ?></td>
          <td class="num"><?= str_replace('.', ',', (string) pourcentage((float) $d['montant'], $totaux['verse'])) ?> %</td></tr>
      <?php endforeach; ?>
        <tr class="ligne-total"><td><strong>Total</strong></td><td class="num"><strong><?= (int) $nb_v ?></strong></td>
          <td class="num"><strong><?= h(euros((float) $tot_v)) ?></strong></td>
          <td class="num"><?= h(euros((float) array_sum(array_column($par_mode, 'encaisse')))) ?></td>
          <td class="num"><?= h(euros((float) array_sum(array_column($par_mode, 'a_encaisser')))) ?></td><td></td></tr>
      </tbody>
    </table>
    <p class="aide controle-import"><strong>Contrôle :</strong> <?= (int) $nb_v ?> versements de cotisation lus
      <?= $derniere_maj ? 'le ' . h(date_fr(substr($derniere_maj, 0, 10), true)) . ' à ' . h(substr($derniere_maj, 11, 5)) : '' ?>.
      Ce nombre doit être égal au « total de … » affiché par phpMyAdmin pour la requête des versements
      (et le montant au total « Perçues » de la Synthèse du site). S'il est plus petit, l'export était incomplet :
      refaites-le avant toute relance.</p>
    <p class="aide">
      <?= $totaux['inscrits'] ?> inscrits dont <?= $totaux['adultes'] ?> adulte(s)<?= $totaux['preinscrits'] ? ' et ' . $totaux['preinscrits'] . ' préinscrit(s)' : '' ?>.
      <?php if ($totaux['autres'] > 0): ?>Autres versements (prestations, coopérative), hors cotisations : <?= h(euros($totaux['autres'])) ?>.<?php endif; ?>
      <?php if ($totaux['trop'] > 0): ?>Trop-perçus : <?= h(euros($totaux['trop'])) ?>.<?php endif; ?>
    </p>
  </section>

  <section class="bloc-section">
    <h2>Encaissements à venir</h2>
    <?php if (!$echeancier): ?>
      <p class="vide">Tout est encaissé.</p>
    <?php else: ?>
      <p class="aide">Chèques différés et versements pas encore marqués « encaissé » sur le site.</p>
      <?php foreach ($echeancier as $cle => $mois): ?>
        <details class="depliant-section">
          <summary><strong><?= h($cle === 'maintenant' ? 'À encaisser dès maintenant' : mois_fr($cle)) ?></strong>
            — <?= h(euros((float) $mois['total'])) ?> · <?= count($mois['lignes']) ?> versement(s)</summary>
          <table class="tableau tableau-dense">
            <tbody>
            <?php foreach ($mois['lignes'] as $v): ?>
              <tr><td><?= h($v['date_encaissement'] ? date_fr($v['date_encaissement'], true) : '—') ?></td>
                <td><?= h($v['famille']) ?></td>
                <td class="gris"><?= h(MODES_PAIEMENT[(int) $v['mode']] ?? '') ?><?= $v['info'] ? ' · ' . h($v['info']) : '' ?></td>
                <td class="num"><?= h(euros((float) $v['montant'])) ?></td></tr>
            <?php endforeach; ?>
            </tbody>
          </table>
        </details>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>
</div>

<form class="barre-filtres" method="get">
  <input type="hidden" name="p" value="finances">
  <input type="search" name="q" value="<?= h($q) ?>" placeholder="Rechercher une famille, un élève, une classe, une réf. parent…">
  <select name="etat">
    <option value="a_relancer" <?= $etat_f === 'a_relancer' ? 'selected' : '' ?>>À relancer (<?= $a_relancer ?>)</option>
    <option value="tous" <?= $etat_f === 'tous' ? 'selected' : '' ?>>Toutes les familles (<?= count($familles) ?>)</option>
    <?php foreach (ETATS_PAIEMENT as $cle => [$libelle]): ?>
      <option value="<?= h($cle) ?>" <?= $etat_f === $cle ? 'selected' : '' ?>><?= h($libelle) ?> (<?= $par_etat[$cle] ?>)</option>
    <?php endforeach; ?>
  </select>
  <select name="tri">
    <option value="reste" <?= $tri === 'reste' ? 'selected' : '' ?>>Trier par reste à payer</option>
    <option value="relance" <?= $tri === 'relance' ? 'selected' : '' ?>>Jamais relancées d'abord</option>
    <option value="versement" <?= $tri === 'versement' ? 'selected' : '' ?>>Dernier versement le plus ancien</option>
    <option value="nom" <?= $tri === 'nom' ? 'selected' : '' ?>>Trier par nom</option>
  </select>
  <button class="bouton" type="submit">Afficher</button>
</form>

<?php if ($a_relancer > 0): ?>
<div class="flash <?= $donnees_anciennes ? 'flash-attention' : 'flash-info' ?>">
  <strong>Avant toute relance</strong> : saisissez sur le site tous les paiements reçus (carte, espèces, chèques),
  y compris ceux du jour. À chaque clic sur « Relancer », l'application relit le site et annule la relance si la famille est à jour.
  <?= $donnees_anciennes ? '<br>Les données affichées datent du ' . h($maj_txt ?: '—') . ' : les relances seront bloquées tant que la connexion au site n\'est pas ouverte.' : '' ?>
</div>
<?php endif; ?>

<section class="bloc-section">
  <div class="entete-section">
    <h2><?= count($liste) ?> famille(s)</h2>
    <?php if ($relancees_recemment): ?><span class="gris"><?= $relancees_recemment ?> relancée(s) ces 7 derniers jours</span><?php endif; ?>
  </div>
  <?php if (!$liste): ?>
    <p class="vide">Aucune famille ne correspond à ces critères.</p>
  <?php else: ?>
  <div class="tableau-enveloppe">
    <table class="tableau tableau-finances">
      <thead><tr>
        <th>Famille</th><th>Réf. parent</th><th>Inscrits</th><th class="num">Dû</th><th class="num">Versé</th>
        <th class="num">Reste</th><th>État</th><th>Relance</th><th></th>
      </tr></thead>
      <tbody>
      <?php foreach ($liste as $f):
          $recente = $f['derniere_relance'] && strtotime((string) $f['derniere_relance']) > time() - 7 * 86400;
          $tel = normaliser_telephone((string) $f['telephone_whatsapp']); ?>
        <tr>
          <td>
            <details class="detail-famille">
              <summary><strong><?= h(nom_famille_fin($f)) ?></strong>
                <span class="gris"><?= h($tel !== '' ? telephone_lisible((string) $f['telephone_whatsapp']) : 'pas de numéro') ?></span></summary>
              <ul class="liste-fin">
                <?php foreach ($f['enfants'] as $e): ?>
                  <li><?= h(trim($e['prenom'] . ' ' . mb_strtoupper((string) $e['nom']))) ?>
                    <span class="gris"><?= h($e['classes']) ?><?= (int) $e['adulte'] ? ' · adulte' : '' ?><?= (int) $e['preinscrit'] ? ' · préinscrit' : '' ?></span>
                    — <?= h(euros((float) $e['cout'])) ?></li>
                <?php endforeach; ?>
              </ul>
              <?php if ($f['versements']): ?>
                <table class="tableau tableau-dense">
                  <?php foreach ($f['versements'] as $v): ?>
                    <tr><td><?= h(date_fr($v['date_versement'], true)) ?></td>
                      <td><?= (int) $v['type'] === 9 ? '<strong>Remboursement</strong>' : h(MODES_PAIEMENT[(int) $v['mode']] ?? '') . ((int) $v['type'] !== 1 ? ' · ' . h(TYPES_VERSEMENT[(int) $v['type']] ?? '') : '') ?>
                        <?= $v['info'] ? '<span class="gris"> · ' . h($v['info']) . '</span>' : '' ?></td>
                      <td class="gris"><?= versement_a_encaisser($v, $aujourdhui)
                          ? 'à encaisser' . ($v['date_encaissement'] ? ' le ' . h(date_fr($v['date_encaissement'], true)) : '')
                          : 'encaissé' ?></td>
                      <td class="num"><?= (int) $v['type'] === 9 ? '−' : '' ?><?= h(euros((float) $v['montant'])) ?></td></tr>
                  <?php endforeach; ?>
                </table>
              <?php else: ?>
                <p class="gris">Aucun versement enregistré sur le site.</p>
              <?php endif; ?>
              <?php if ($f['verse'] > 0 && $f['nb'] > 0): ?>
                <p class="liens-attestation">Attestation de paiement :
                  <a class="bouton petit" href="<?= h(url('attestation', ['payeur' => (int) $f['payeur_ref']])) ?>" target="_blank" rel="noopener">famille</a>
                  <?php if ($f['nb'] > 1): foreach ($f['enfants'] as $e): ?>
                    <a class="bouton petit" href="<?= h(url('attestation', ['payeur' => (int) $f['payeur_ref'], 'eleve' => (int) $e['eleve_ref']])) ?>" target="_blank" rel="noopener"><?= h(trim((string) $e['prenom'])) ?></a>
                  <?php endforeach; endif; ?>
                </p>
              <?php endif; ?>
              <?php if ($f['signalement']): $sg = $f['signalement']; ?>
                <p class="petit-texte"><span class="badge bleu">Paiement signalé</span>
                  le <?= h(date_fr(substr((string) $sg['date_signalement'], 0, 10), true)) ?>
                  <?= $sg['montant'] !== null ? ' · ' . h(euros((float) $sg['montant'])) : '' ?>
                  <?= $sg['note'] ? ' · ' . h($sg['note']) : '' ?> — à saisir sur le site.</p>
              <?php endif; ?>
              <?php if ($f['meme_numero']): ?>
                <p class="petit-texte gris">Même numéro que : <?= h(implode(', ', array_map(
                    fn($r) => isset($familles[$r]) ? nom_famille_fin($familles[$r]) : (string) $r, $f['meme_numero']))) ?>.</p>
              <?php endif; ?>
            </details>
          </td>
          <td class="ref-parent"><a href="https://clef-etampes.fr/apps/com_user_cotis.php?update_user_id=<?= (int) $f['payeur_ref'] ?>#oModal"
                 target="_blank" rel="noopener" title="Ouvrir la gestion des versements de cette famille sur le site"><?= h(str_pad((string) (int) $f['payeur_ref'], 6, '0', STR_PAD_LEFT)) ?></a></td>
          <td><?= $f['nb'] ?> <span class="gris petit-texte"><?= h(implode(', ', array_map(fn($e) => $e['prenom'], $f['enfants']))) ?></span></td>
          <td class="num"><?= h(euros($f['du'])) ?></td>
          <td class="num"><?= h(euros($f['verse'])) ?>
            <?php if ($f['a_encaisser'] > 0): ?><br><span class="gris petit-texte">dont <?= h(euros($f['a_encaisser'])) ?> à encaisser</span><?php endif; ?></td>
          <td class="num"><strong class="<?= $f['reste'] > 0 ? 'rouge-texte' : 'vert-texte' ?>"><?= h(euros($f['reste'])) ?></strong></td>
          <td><?= badge_paiement($f['etat']) ?></td>
          <td class="petit-texte">
            <?php if ($f['derniere_relance']): ?>
              <span class="<?= $recente ? 'orange-texte' : 'gris' ?>"><?= h(date_fr(substr((string) $f['derniere_relance'], 0, 10), true)) ?></span>
              <?= $f['relances'] > 1 ? '<span class="gris">(' . $f['relances'] . ' fois)</span>' : '' ?>
            <?php else: ?><span class="gris">jamais</span><?php endif; ?>
          </td>
          <td>
            <div class="actions">
            <?php if ($f['verse'] > 0 && $f['nb'] > 0): ?>
              <a class="bouton petit" href="<?= h(url('attestation', ['payeur' => (int) $f['payeur_ref']])) ?>" target="_blank" rel="noopener"
                 title="Attestation de paiement à imprimer ou enregistrer en PDF">Attestation</a>
            <?php endif; ?>
            <?php if (in_array($f['etat'], ETATS_A_RELANCER, true)): ?>
              <?php if ($tel !== ''): ?>
                <form method="post" target="_blank" onsubmit="setTimeout(function(){ location.reload(); }, 2500)"><?= champ_csrf() ?><?= $champs_retour ?>
                  <input type="hidden" name="action" value="relancer">
                  <input type="hidden" name="payeur" value="<?= (int) $f['payeur_ref'] ?>">
                  <?php
                  $question = ($recente ? "Famille déjà relancée il y a moins de 7 jours.\n\n" : '')
                      . 'Selon le site : ' . euros($f['verse']) . ' enregistrés, reste ' . euros($f['reste']) . ".\n"
                      . "Le dernier paiement de cette famille est-il bien saisi sur le site ?\n\nOK = relancer";
                  ?>
                  <button class="bouton bouton-whatsapp petit" type="submit"
                    onclick="return confirm(<?= h((string) json_encode($question, JSON_UNESCAPED_UNICODE)) ?>)">Relancer</button>
                </form>
                <details class="signaler">
                  <summary class="bouton petit" title="La famille dit avoir payé : ne plus la relancer">Payé ?</summary>
                  <form method="post" class="form-signaler"><?= champ_csrf() ?><?= $champs_retour ?>
                    <input type="hidden" name="action" value="signaler">
                    <input type="hidden" name="payeur" value="<?= (int) $f['payeur_ref'] ?>">
                    <input type="text" name="montant" inputmode="decimal" placeholder="Montant (€)">
                    <input type="text" name="note" placeholder="Ex. CB du 04/10, reçu reçu par WhatsApp">
                    <button class="bouton petit bouton-principal" type="submit">Signaler le paiement</button>
                  </form>
                </details>
              <?php else: ?>
                <span class="badge gris">sans numéro</span>
              <?php endif; ?>
            <?php endif; ?>
            <?php if ($f['signalement']): ?>
              <form method="post"><?= champ_csrf() ?><?= $champs_retour ?>
                <input type="hidden" name="action" value="retirer_signalement">
                <input type="hidden" name="payeur" value="<?= (int) $f['payeur_ref'] ?>">
                <button class="bouton petit" type="submit" title="Retirer le signalement de paiement">Retirer le signalement</button>
              </form>
            <?php endif; ?>
            <?php if ($f['relances'] > 0): ?>
              <form method="post"><?= champ_csrf() ?><?= $champs_retour ?>
                <input type="hidden" name="action" value="annuler_relance">
                <input type="hidden" name="payeur" value="<?= (int) $f['payeur_ref'] ?>">
                <button class="bouton petit" type="submit" title="Retirer la dernière relance de l'historique (message non envoyé)">↺</button>
              </form>
            <?php endif; ?>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <p class="aide">« Relancer » ouvre WhatsApp avec un message prêt pour la famille ; vous pouvez le modifier avant
    de l'envoyer. La relance est notée avec sa date. Si vous ne l'avez finalement pas envoyée, le bouton ↺ la retire.</p>
  <?php endif; ?>
</section>

<?php
$anomalies_sans_inscrit = array_filter($familles, fn($f) => $f['etat'] === 'sans_inscrit');
$anomalies_trop = array_filter($familles, fn($f) => $f['etat'] === 'trop_percu');
$signales = array_filter($familles, fn($f) => $f['etat'] === 'signale');
$cheques_reste = array_filter($familles, fn($f) => $f['etat'] === 'cheques_attente');
$a_verifier = array_filter($familles, fn($f) => $f['etat'] === 'a_verifier');
// Relancées alors qu'elles sont à jour aujourd'hui : un mot d'excuse s'impose.
$relancees_a_jour = array_filter($familles, fn($f) => $f['relances'] > 0 && in_array($f['etat'], ['a_jour', 'trop_percu'], true));
if ($sans_numero || $anomalies_sans_inscrit || $anomalies_trop || $signales || $a_verifier || $relancees_a_jour || $cheques_reste): ?>
<section class="bloc-section encadre-alerte">
  <h2>Points à vérifier sur le site</h2>
  <?php if ($cheques_reste): ?>
    <p><strong>Chèques en attente mais solde restant</strong> (jamais relancées automatiquement, à voir avec la famille) :
      <?= h(implode(', ', array_map(fn($f) => nom_famille_fin($f) . ' (reste ' . euros($f['reste']) . ')', $cheques_reste))) ?>.</p>
  <?php endif; ?>
  <?php if ($signales): ?>
    <p><strong>Paiements signalés, pas encore saisis sur le site</strong> (ces familles ne sont pas relancées) :
      <?= h(implode(', ', array_map(fn($f) => nom_famille_fin($f)
          . ($f['signalement']['montant'] !== null ? ' (' . euros((float) $f['signalement']['montant']) . ')' : ''), $signales))) ?>.
      <span class="gris">Saisir le versement dans Gestion des versements, puis Actualiser.</span></p>
  <?php endif; ?>
  <?php if ($a_verifier): ?>
    <p><strong>À vérifier avant toute relance</strong> :
      <?= h(implode(', ', array_map('nom_famille_fin', $a_verifier))) ?>.
      <span class="gris">Soit le même numéro WhatsApp porte un autre compte qui a des versements en trop ou sans inscription
        (paiement sans doute saisi sur l'autre fiche), soit un enfant est dans une classe sans tarif sur le site
        (mention « <?= h(TARIF_A_VERIFIER) ?> »).</span></p>
  <?php endif; ?>
  <?php if ($relancees_a_jour): ?>
    <p><strong>Relancées mais à jour aujourd'hui</strong> :</p>
    <ul class="liste-fin">
    <?php foreach ($relancees_a_jour as $f):
        $excuse = 'Assalamou alaykoum ' . trim($f['prenom'] . ' ' . $f['nom']) . ",\n\n"
            . "Vous avez reçu de notre part un rappel au sujet de la cotisation. Votre règlement est bien enregistré : "
            . "merci de ne pas tenir compte de ce message, et toutes nos excuses pour ce désagrément.\n\n"
            . "Barak Allahou fikoum.\n" . param('association', 'Association C.L.E.F.');
        $lien_excuse = lien_whatsapp((string) $f['telephone_whatsapp'], $excuse); ?>
      <li><?= h(nom_famille_fin($f)) ?> <span class="gris">— relancée le <?= h(date_fr(substr((string) $f['derniere_relance'], 0, 10), true)) ?></span>
        <?php if ($lien_excuse !== ''): ?><a class="bouton petit" target="_blank" rel="noopener" href="<?= h($lien_excuse) ?>">Message d'excuse</a><?php endif; ?></li>
    <?php endforeach; ?>
    </ul>
  <?php endif; ?>
  <?php if ($sans_numero): ?>
    <p><strong><?= count($sans_numero) ?> famille(s) à relancer sans numéro WhatsApp</strong> :
      <?= h(implode(', ', array_map('nom_famille_fin', $sans_numero))) ?>.
      <span class="gris">Souvent un élève sans parent rattaché sur le site : compléter sa fiche.</span></p>
  <?php endif; ?>
  <?php if ($anomalies_sans_inscrit): ?>
    <p><strong>Versements sans inscription cette année</strong> :
      <?= h(implode(', ', array_map(fn($f) => nom_famille_fin($f) . ' (' . euros($f['verse'] + $f['autres']) . ')', $anomalies_sans_inscrit))) ?>.
      <span class="gris">Enfant pas encore inscrit, versement saisi sur le mauvais compte, ou remboursement à prévoir.</span></p>
  <?php endif; ?>
  <?php if ($anomalies_trop): ?>
    <p><strong>Trop-perçus</strong> :
      <?= h(implode(', ', array_map(fn($f) => nom_famille_fin($f) . ' (+' . euros(-$f['reste']) . ')', $anomalies_trop))) ?>.</p>
  <?php endif; ?>
</section>
<?php endif; ?>

<details class="bloc-section depliant-section">
  <summary><strong>Message de relance</strong> <span class="gris">— modifier le texte envoyé aux familles</span></summary>
  <form method="post">
    <?= champ_csrf() ?><?= $champs_retour ?>
    <input type="hidden" name="action" value="modele">
    <textarea name="modele" rows="16"><?= h(param('modele_relance_finances', modele_relance_par_defaut())) ?></textarea>
    <p class="aide">Repères remplacés automatiquement : {parent} · {enfants} (prénoms) · {liste} (un élève par ligne avec son tarif)
      · {nb} · {du} · {verse} · {a_encaisser} · {reste} · {annee} · {association} · {telephone}.
      Les *astérisques* mettent le texte en gras dans WhatsApp.</p>
    <div class="barre-actions gauche">
      <button class="bouton bouton-principal" type="submit">Enregistrer</button>
      <button class="bouton" type="submit" name="defaut" value="1">Revenir au texte d'origine</button>
    </div>
  </form>
</details>

<?php pied();
