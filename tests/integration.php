<?php
/**
 * Tests internes (sans navigateur) : calculs, sauvegarde/restauration, reprise C.L.E.F.
 * À lancer après preparer.php. Affiche OK/ÉCHEC par vérification ; code de sortie 1 si un échec.
 */
if (PHP_SAPI !== 'cli') { exit; }
$_SERVER['SCRIPT_NAME'] = 'integration.php';
require dirname(__DIR__) . '/inc/bootstrap.php';

$echecs = 0;
function verifier(bool $ok, string $libelle): void
{
    global $echecs;
    echo ($ok ? 'OK     ' : 'ÉCHEC  ') . $libelle . "\n";
    if (!$ok) { $echecs++; }
}
function base_annexe(string $suffixe): PDO
{
    $racine = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', BD_HOTE, BD_PORT), BD_UTILISATEUR, BD_MOT_DE_PASSE,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $nom = BD_NOM . '_' . $suffixe;
    $racine->exec("DROP DATABASE IF EXISTS `$nom`");
    $racine->exec("CREATE DATABASE `$nom` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    return connexion_pdo(BD_HOTE, $nom, BD_UTILISATEUR, BD_MOT_DE_PASSE, BD_PORT);
}

echo "== Calculs\n";
$attendus = [0 => 'zéro', 21 => 'vingt et un', 71 => 'soixante et onze', 80 => 'quatre-vingts', 81 => 'quatre-vingt-un',
    91 => 'quatre-vingt-onze', 200 => 'deux cents', 220 => 'deux cent vingt', 1980 => 'mille neuf cent quatre-vingts',
    80000 => 'quatre-vingt mille', 200000 => 'deux cent mille', 1000000 => 'un million'];
foreach ($attendus as $n => $texte) {
    verifier(nombre_en_lettres($n) === $texte, "en lettres : $n → $texte (obtenu : " . nombre_en_lettres($n) . ')');
}
verifier(montant_en_lettres(85.5) === 'quatre-vingt-cinq euros et cinquante centimes', 'montant avec centimes');
foreach (['=1+1' => "'=1+1", '@SUM(A1)' => "'@SUM(A1)", '-cmd' => "'-cmd", '+33 6 12' => '+33 6 12', '-12,5' => '-12,5', 'Bonjour' => 'Bonjour'] as $v => $att) {
    verifier(cellule_csv_sure($v) === $att, "cellule CSV « $v »");
}
$c = creneau_depuis_libelle('DIM_AP_KHAOULA_N4');
verifier($c['jour'] === 7 && $c['moment'] === 'apres-midi' && $c['niveau'] === 'N4', 'libellé DIM_AP_KHAOULA_N4');
$c = creneau_depuis_libelle('MALIKA_DIM_MAT_JEUNE_N2');
verifier($c['jour'] === 7 && $c['moment'] === 'matin' && $c['niveau'] === 'N2', 'libellé MALIKA_DIM_MAT_JEUNE_N2');
$c = creneau_depuis_libelle('MALIKA_DIM_SOIR_ADULT_N2');
verifier($c['jour'] === 7 && $c['moment'] === 'soir' && $c['niveau'] === 'N2', 'libellé MALIKA_DIM_SOIR_ADULT_N2');
$c = creneau_depuis_libelle('VEN_KASSI_N3');
verifier($c['jour'] === 5 && $c['debut'] === '18:30:00', 'libellé VEN_KASSI_N3 (vendredi soir)');

verifier(total_note(['a' => 6, 'b' => 5, 'c' => 4, 'd' => 5, 'absent' => 0]) === 20.0, 'note complète : 20/20');
verifier(total_note(['a' => 5, 'b' => null, 'c' => null, 'd' => null, 'absent' => 0]) === null, 'note incomplète : pas de total trompeur');
verifier(note_incomplete(['a' => 5, 'b' => null, 'c' => null, 'd' => null, 'absent' => 0]), 'note incomplète signalée « à compléter »');
verifier(total_note(['a' => 5, 'b' => 4, 'c' => 3, 'd' => 4, 'absent' => 1]) === null && !note_incomplete(['a' => 5, 'absent' => 1]),
    'élève absent au contrôle : ni total ni alerte');
verifier(niveau_resultat(15.0)['cle'] === 'bon' && niveau_resultat(14.5)['cle'] === 'moyen' && niveau_resultat(9.5)['cle'] === 'fragile',
    'seuils Bon 15 / Moyen 10 / Fragile');

echo "== Paie du personnel\n";
synchroniser_intervenants();
req('UPDATE intervenants SET taux_horaire = 15, prix_trajet = 5, exterieur = 1 WHERE utilisateur_id = 2');
$jours = [];
for ($t = strtotime('-35 days'); $t <= time(); $t += 86400) {
    if (date('N', $t) === '7' && jour_de_cours(date('Y-m-d', $t))) { $jours[] = date('Y-m-d', $t); }
}
req('DELETE FROM seances WHERE groupe_id = 1');
req('INSERT INTO seances (groupe_id, date_seance, professeur_id, assure_par, statut, validee_le, validee_par) VALUES (1, ?, 2, 2, "validee", NOW(), 2)', [$jours[0]]);
req('INSERT INTO seances (groupe_id, date_seance, professeur_id, assure_par, statut, validee_le, validee_par) VALUES (1, ?, 4, 2, "validee", NOW(), NULL)', [$jours[1]]);
$rel = releve_personnel($jours[0], $jours[1]);
$lat = array_values(array_filter($rel['lignes'], fn($l) => (int) $l['utilisateur_id'] === 2))[0] ?? null;
verifier($lat && $lat['totaux']['heures'] == duree_creneau() && $lat['totaux']['trajets'] === 1,
    'seul le créneau dont il a validé l\'appel est payé au professeur (heures et trajet)');
verifier($lat && (int) ($lat['jours'][$jours[1]]['a_confirmer'] ?? 0) === 1 && (float) $lat['jours'][$jours[1]]['heures'] === 0.0,
    'appel validé par la supervision : créneau « à confirmer », 0 h ce jour-là');
verifier(count(array_filter(controles_paie($rel), fn($c) => str_contains($c[1], 'pas par Latifa'))) === 1,
    'contrôle avant paiement : appel validé sans le professeur signalé');
installer_presences_profs();
req('INSERT INTO presences_profs (date_jour, groupe_id, utilisateur_id, statut, saisi_par, saisi_le) VALUES (?, 1, 2, "present", 4, NOW())', [$jours[1]]);
$rel = releve_personnel($jours[0], $jours[1]);
$lat = array_values(array_filter($rel['lignes'], fn($l) => (int) $l['utilisateur_id'] === 2))[0] ?? null;
verifier($lat && $lat['totaux']['heures'] == 2 * duree_creneau() && $lat['totaux']['trajets'] === 2,
    'présence confirmée par la supervision : créneau payé');
req('DELETE FROM presences_profs');
req('DELETE FROM seances WHERE groupe_id = 1');
// Cas Khaoula (11/10) : heures comptées mais taux horaire oublié → seuls les trajets payés.
req('UPDATE intervenants SET taux_horaire = 0, prix_trajet = 5, exterieur = 1 WHERE utilisateur_id = 3');
req('INSERT INTO seances (groupe_id, date_seance, professeur_id, assure_par, statut, validee_le, validee_par) VALUES (2, ?, 3, 3, "validee", NOW(), 3)',
    [date('Y-m-d', strtotime('last wednesday', strtotime($jours[1])))]);
$rel = releve_personnel($jours[0], $jours[1]);
verifier(count(array_filter(controles_paie($rel), fn($c) => str_contains($c[1], 'Meryem') && str_contains($c[1], 'aucun taux horaire'))) === 1,
    'professeur sans taux horaire signalé (payé seulement de ses trajets)');
definir_param('taux_horaire_defaut', '15');
req('INSERT INTO utilisateurs (nom, prenom, identifiant, mot_de_passe, role) VALUES ("NOUVELLE", "Prof", "n.prof", "x", "professeur")');
synchroniser_intervenants();
verifier((float) valeur('SELECT i.taux_horaire FROM intervenants i JOIN utilisateurs u ON u.id = i.utilisateur_id WHERE u.identifiant = "n.prof"') === 15.0,
    'nouveau professeur : taux horaire par défaut appliqué');
req('DELETE FROM seances WHERE groupe_id = 2 AND validee_par = 3 AND date_seance >= ?', [$jours[0]]);

echo "== Sauvegarde puis restauration\n";
attestations_installer();
$binaire = random_bytes(4000) . "\x00\xff'\\\"";
req('REPLACE INTO fichiers_association (cle, type, contenu, maj) VALUES (?, ?, ?, NOW())', ['signature', 'image/png', $binaire]);
$dump = export_sql();
$restau = base_annexe('restau');
$restau->exec($dump);
foreach (['utilisateurs', 'eleves', 'groupes', 'inscriptions', 'seances', 'presences', 'familles', 'journal'] as $t) {
    verifier((int) valeur("SELECT COUNT(*) FROM `$t`") === (int) $restau->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(),
        "restauration : table $t complète");
}
verifier(md5($binaire) === md5((string) $restau->query("SELECT contenu FROM fichiers_association WHERE cle = 'signature'")->fetchColumn()),
    'restauration : image de signature identique à l\'octet près');
verifier($restau->query('SELECT prenom FROM eleves WHERE id = 6')->fetchColumn() === (string) valeur('SELECT prenom FROM eleves WHERE id = 6'),
    'restauration : accents et apostrophes intacts');

echo "== Reprise C.L.E.F. (copie fictive du site)\n";
$site = base_annexe('site');
$site->exec((string) file_get_contents(__DIR__ . '/site_clef.sql'));
$opts = ['creer_professeurs' => true, 'professeurs_sans_classe' => true, 'inclure_preinscrits' => true,
         'synchroniser' => true, 'annee' => annee_active()];
$compte = fn() => (int) valeur("SELECT COUNT(*) FROM inscriptions i JOIN eleves e ON e.id = i.eleve_id
                                 WHERE i.actif = 1 AND e.ref_externe LIKE 'user-%'");
$r = reprise_clef($site, 2, $opts);
verifier($r['groupes'] === 3 && $r['eleves'] === 36 && $r['inscriptions'] === 36, 'première reprise : 3 classes, 36 élèves');
verifier((int) valeur("SELECT COUNT(*) FROM utilisateurs WHERE ref_externe LIKE 'user-%'") === 3, 'professeurs créés, y compris sans classe');
verifier((int) valeur("SELECT COUNT(*) FROM eleves e JOIN familles f ON f.id = e.famille_id WHERE e.ref_externe LIKE 'user-%'") === 36,
    'chaque élève rattaché à la famille de son parent');
$r = reprise_clef($site, 2, $opts);
verifier($r['groupes'] === 0 && $r['eleves'] === 0 && $r['inscriptions'] === 0 && $compte() === 36, 'seconde reprise : aucun doublon');
try {
    reprise_clef($site, 1, $opts);
    verifier(false, 'session d\'une autre année refusée');
} catch (RuntimeException $e) {
    verifier(str_contains($e->getMessage(), 'ne correspond pas'), 'session d\'une autre année refusée');
}
verifier($compte() === 36, 'refus de session : rien n\'a changé');
$site->exec('DELETE FROM inscription WHERE ses_id = 2 AND user_id = 1001');
$r = reprise_clef($site, 2, $opts);
verifier($r['retraits'] === 1 && $compte() === 35, 'départ d\'un élève sur le site : retiré de son groupe');
$site->exec('DELETE FROM inscription WHERE ses_id = 2');
$r = reprise_clef($site, 2, $opts);
verifier(!empty($r['synchro_suspendue']) && $compte() === 35, 'site vide : synchronisation suspendue, aucun élève retiré');

echo "\n" . ($echecs === 0 ? 'Tests internes : tout est vert.' : "Tests internes : $echecs échec(s).") . "\n";
exit($echecs === 0 ? 0 : 1);
