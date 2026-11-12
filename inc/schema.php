<?php
/**
 * Structure de la base de données.
 * Ce fichier est exécuté par install.php ; il est ré-exécutable sans danger
 * (toutes les tables sont créées « IF NOT EXISTS »).
 */
declare(strict_types=1);

function requetes_schema(): array
{
    return [

'parametres' => "
CREATE TABLE IF NOT EXISTS parametres (
  cle    VARCHAR(64) NOT NULL PRIMARY KEY,
  valeur TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'utilisateurs' => "
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nom               VARCHAR(80)  NOT NULL,
  prenom            VARCHAR(80)  NOT NULL,
  identifiant       VARCHAR(40)  NOT NULL,
  email             VARCHAR(160) NULL,
  telephone         VARCHAR(30)  NULL,
  mot_de_passe      VARCHAR(255) NOT NULL,
  role              ENUM('admin','superviseur','professeur') NOT NULL DEFAULT 'professeur',
  actif             TINYINT(1)   NOT NULL DEFAULT 1,
  ref_externe       VARCHAR(64)  NULL,
  derniere_connexion DATETIME    NULL,
  cree_le           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_identifiant (identifiant),
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'eleves' => "
CREATE TABLE IF NOT EXISTS eleves (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nom              VARCHAR(80)  NOT NULL,
  prenom           VARCHAR(80)  NOT NULL,
  date_naissance   DATE         NULL,
  niveau           VARCHAR(10)  NULL,
  responsable      VARCHAR(120) NULL,
  telephone        VARCHAR(30)  NULL,
  telephone2       VARCHAR(30)  NULL,
  email            VARCHAR(160) NULL,
  cotisation_due   DECIMAL(7,2) NOT NULL DEFAULT 0,
  cotisation_payee DECIMAL(7,2) NOT NULL DEFAULT 0,
  remarque         TEXT         NULL,
  ref_externe      VARCHAR(64)  NULL,
  famille_id       INT          NULL,
  actif            TINYINT(1)   NOT NULL DEFAULT 1,
  cree_le          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_nom (nom, prenom),
  KEY idx_ref (ref_externe),
  KEY idx_famille (famille_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'groupes' => "
CREATE TABLE IF NOT EXISTS groupes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(120) NOT NULL,
  niveau         VARCHAR(10)  NOT NULL DEFAULT 'N1',
  professeur_id  INT          NULL,
  jour           TINYINT      NOT NULL DEFAULT 3,
  heure_debut    TIME         NOT NULL DEFAULT '10:00:00',
  heure_fin      TIME         NOT NULL DEFAULT '12:00:00',
  salle          VARCHAR(60)  NULL,
  annee_scolaire VARCHAR(9)   NOT NULL,
  capacite       INT          NOT NULL DEFAULT 15,
  actif          TINYINT(1)   NOT NULL DEFAULT 1,
  ref_externe    VARCHAR(64)  NULL,
  KEY idx_prof (professeur_id),
  KEY idx_annee (annee_scolaire),
  CONSTRAINT fk_groupe_prof FOREIGN KEY (professeur_id)
      REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'inscriptions' => "
CREATE TABLE IF NOT EXISTS inscriptions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id   INT NOT NULL,
  groupe_id  INT NOT NULL,
  date_debut DATE NULL,
  actif      TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_inscription (eleve_id, groupe_id),
  KEY idx_groupe (groupe_id),
  CONSTRAINT fk_insc_eleve  FOREIGN KEY (eleve_id)  REFERENCES eleves(id)  ON DELETE CASCADE,
  CONSTRAINT fk_insc_groupe FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'seances' => "
CREATE TABLE IF NOT EXISTS seances (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  groupe_id       INT  NOT NULL,
  date_seance     DATE NOT NULL,
  heure_debut     TIME NULL,
  heure_fin       TIME NULL,
  professeur_id   INT  NULL,
  travail_a_faire TEXT NULL,
  observation     TEXT NULL,
  statut          ENUM('brouillon','validee') NOT NULL DEFAULT 'brouillon',
  validee_le      DATETIME NULL,
  validee_par     INT  NULL,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_seance (groupe_id, date_seance),
  KEY idx_date (date_seance),
  CONSTRAINT fk_seance_groupe FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE CASCADE,
  CONSTRAINT fk_seance_prof   FOREIGN KEY (professeur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'presences' => "
CREATE TABLE IF NOT EXISTS presences (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  seance_id         INT NOT NULL,
  eleve_id          INT NOT NULL,
  statut            ENUM('present','absent','justifie') NOT NULL DEFAULT 'present',
  commentaire       TEXT NULL,
  travail_perso     TEXT NULL,
  appreciation      ENUM('','acquis','en_cours','a_revoir') NOT NULL DEFAULT '',
  retard            TINYINT(1) NOT NULL DEFAULT 0,
  retard_minutes    SMALLINT UNSIGNED NULL,
  retard_justifie   TINYINT(1) NOT NULL DEFAULT 0,
  message_envoye    TINYINT(1) NOT NULL DEFAULT 0,
  message_envoye_le DATETIME NULL,
  maj_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_presence (seance_id, eleve_id),
  KEY idx_eleve (eleve_id),
  KEY idx_statut (statut),
  CONSTRAINT fk_pres_seance FOREIGN KEY (seance_id) REFERENCES seances(id) ON DELETE CASCADE,
  CONSTRAINT fk_pres_eleve  FOREIGN KEY (eleve_id)  REFERENCES eleves(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'progression_semaines' => "
CREATE TABLE IF NOT EXISTS progression_semaines (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  annee_scolaire  VARCHAR(9)   NOT NULL,
  niveau          VARCHAR(10)  NOT NULL,
  numero          SMALLINT     NOT NULL,
  date_lundi      DATE         NULL,
  type            ENUM('notion','revision','controle') NOT NULL DEFAULT 'notion',
  periode         TINYINT      NULL,
  periode_libelle VARCHAR(160) NULL,
  titre           VARCHAR(200) NOT NULL,
  arabe           VARCHAR(200) NULL,
  pages           VARCHAR(120) NULL,
  objectifs       TEXT NULL,
  vigilance       TEXT NULL,
  activite        TEXT NULL,
  devoirs         TEXT NULL,
  defi            TEXT NULL,
  remarque        TEXT NULL,
  maj_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_semaine (annee_scolaire, niveau, numero),
  KEY idx_date (niveau, date_lundi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'progression_suivi' => "
CREATE TABLE IF NOT EXISTS progression_suivi (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  groupe_id  INT NOT NULL,
  semaine_id INT NOT NULL,
  faite_le   DATE NULL,
  par        INT NULL,
  cree_le    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_suivi (groupe_id, semaine_id),
  KEY idx_semaine (semaine_id),
  CONSTRAINT fk_suivi_groupe  FOREIGN KEY (groupe_id)  REFERENCES groupes(id) ON DELETE CASCADE,
  CONSTRAINT fk_suivi_semaine FOREIGN KEY (semaine_id) REFERENCES progression_semaines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'progression_documents' => "
CREATE TABLE IF NOT EXISTS progression_documents (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  niveau   VARCHAR(10)  NOT NULL,
  titre    VARCHAR(160) NOT NULL,
  fichier  VARCHAR(120) NOT NULL,
  taille   INT          NOT NULL DEFAULT 0,
  cree_le  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_niveau (niveau)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'remplacements' => "
CREATE TABLE IF NOT EXISTS remplacements (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  groupe_id        INT NOT NULL,
  date_remplacement DATE NOT NULL,
  professeur_id    INT NOT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_remplacement (groupe_id, date_remplacement),
  KEY idx_prof_date (professeur_id, date_remplacement),
  CONSTRAINT fk_rempl_groupe FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE CASCADE,
  CONSTRAINT fk_rempl_prof   FOREIGN KEY (professeur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'familles' => "
CREATE TABLE IF NOT EXISTS familles (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nom                VARCHAR(120) NOT NULL,
  telephone          VARCHAR(30)  NOT NULL,
  email              VARCHAR(160) NULL,
  mot_de_passe       VARCHAR(255) NULL,
  jeton_hash         CHAR(64)     NULL,
  jeton_expire       DATETIME     NULL,
  notif_email        TINYINT(1)   NOT NULL DEFAULT 1,
  actif              TINYINT(1)   NOT NULL DEFAULT 1,
  derniere_connexion DATETIME     NULL,
  cree_le            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_telephone (telephone),
  KEY idx_email (email),
  KEY idx_jeton (jeton_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'conversations' => "
CREATE TABLE IF NOT EXISTS conversations (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  famille_id           INT          NOT NULL,
  utilisateur_id       INT          NULL COMMENT 'NULL = administration',
  eleve_id             INT          NULL,
  groupe_id            INT          NULL COMMENT 'message envoyé à tout un groupe',
  sujet                VARCHAR(160) NOT NULL,
  cree_par             ENUM('personnel','famille') NOT NULL,
  dernier_message_le   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dernier_msg_famille    INT        NOT NULL DEFAULT 0 COMMENT 'id du dernier message de la famille',
  dernier_msg_personnel  INT        NOT NULL DEFAULT 0 COMMENT 'id du dernier message du personnel',
  lu_famille_jusqua      INT        NOT NULL DEFAULT 0,
  lu_personnel_jusqua    INT        NOT NULL DEFAULT 0,
  cree_le              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_famille (famille_id, dernier_message_le),
  KEY idx_utilisateur (utilisateur_id, dernier_message_le),
  CONSTRAINT fk_conv_famille FOREIGN KEY (famille_id) REFERENCES familles(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_util    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT fk_conv_eleve   FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE SET NULL,
  CONSTRAINT fk_conv_groupe  FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'messages_familles' => "
CREATE TABLE IF NOT EXISTS messages_familles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT  NOT NULL,
  auteur_type     ENUM('personnel','famille') NOT NULL,
  auteur_id       INT  NOT NULL,
  texte           TEXT NOT NULL,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_conv (conversation_id, cree_le),
  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'devoirs' => "
CREATE TABLE IF NOT EXISTS devoirs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  groupe_id   INT  NOT NULL,
  seance_id   INT  NULL COMMENT 'devoir saisi comme « Travail à faire » de cette séance',
  donne_le    DATE NOT NULL,
  pour_le     DATE NULL,
  consigne    TEXT NOT NULL,
  document_id INT  NULL,
  semaine_id  INT  NULL COMMENT 'carte de la progression dont le devoir est tiré',
  cree_par    INT  NULL,
  cree_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  maj_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_seance (seance_id),
  KEY idx_groupe (groupe_id, pour_le),
  KEY idx_donne (groupe_id, donne_le),
  CONSTRAINT fk_dev_groupe FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE CASCADE,
  CONSTRAINT fk_dev_seance FOREIGN KEY (seance_id) REFERENCES seances(id) ON DELETE SET NULL,
  CONSTRAINT fk_dev_doc    FOREIGN KEY (document_id) REFERENCES progression_documents(id) ON DELETE SET NULL,
  CONSTRAINT fk_dev_sem    FOREIGN KEY (semaine_id) REFERENCES progression_semaines(id) ON DELETE SET NULL,
  CONSTRAINT fk_dev_auteur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'devoirs_faits' => "
CREATE TABLE IF NOT EXISTS devoirs_faits (
  devoir_id INT NOT NULL,
  eleve_id  INT NOT NULL,
  fait_le   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (devoir_id, eleve_id),
  KEY idx_eleve (eleve_id),
  CONSTRAINT fk_fait_devoir FOREIGN KEY (devoir_id) REFERENCES devoirs(id) ON DELETE CASCADE,
  CONSTRAINT fk_fait_eleve  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'evaluations' => "
CREATE TABLE IF NOT EXISTS evaluations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  groupe_id   INT          NOT NULL,
  date_eval   DATE         NOT NULL,
  periode     TINYINT      NOT NULL DEFAULT 1,
  titre       VARCHAR(160) NOT NULL,
  semaine_id  INT          NULL COMMENT 'semaine de contrôle de la progression',
  cree_par    INT          NULL,
  cree_le     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_eval (groupe_id, date_eval),
  KEY idx_periode (groupe_id, periode),
  CONSTRAINT fk_eval_groupe FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_sem    FOREIGN KEY (semaine_id) REFERENCES progression_semaines(id) ON DELETE SET NULL,
  CONSTRAINT fk_eval_auteur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'evaluations_notes' => "
CREATE TABLE IF NOT EXISTS evaluations_notes (
  evaluation_id INT NOT NULL,
  eleve_id      INT NOT NULL,
  a             DECIMAL(3,1) NULL,
  b             DECIMAL(3,1) NULL,
  c             DECIMAL(3,1) NULL,
  d             DECIMAL(3,1) NULL,
  absent        TINYINT(1)   NOT NULL DEFAULT 0,
  appreciation  VARCHAR(500) NULL,
  maj_le        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (evaluation_id, eleve_id),
  KEY idx_eleve (eleve_id),
  CONSTRAINT fk_note_eval  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_note_eleve FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'bulletins' => "
CREATE TABLE IF NOT EXISTS bulletins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id       INT        NOT NULL,
  groupe_id      INT        NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL,
  periode        TINYINT    NOT NULL,
  appreciation   TEXT       NULL,
  visa           TEXT       NULL,
  publie         TINYINT(1) NOT NULL DEFAULT 0,
  publie_le      DATETIME   NULL,
  publie_par     INT        NULL,
  maj_le         DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_bulletin (eleve_id, groupe_id, annee_scolaire, periode),
  KEY idx_groupe (groupe_id, annee_scolaire, periode),
  CONSTRAINT fk_bul_eleve  FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
  CONSTRAINT fk_bul_groupe FOREIGN KEY (groupe_id) REFERENCES groupes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'journal' => "
CREATE TABLE IF NOT EXISTS journal (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NULL,
  action         VARCHAR(60) NULL,
  details        TEXT NULL,
  ip             VARCHAR(45) NULL,
  date_action    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_date (date_action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",


// v3.12 : suivi du personnel (existait en ligne sans code de création dans le dépôt)
'intervenants' => "
CREATE TABLE IF NOT EXISTS intervenants (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT          NULL,
  prenom         VARCHAR(80)  NOT NULL,
  nom            VARCHAR(80)  NOT NULL,
  fonction       VARCHAR(80)  NULL,
  taux_horaire   DECIMAL(7,2) NOT NULL DEFAULT 0,
  prix_repas     DECIMAL(7,2) NOT NULL DEFAULT 0,
  prix_trajet    DECIMAL(7,2) NOT NULL DEFAULT 0,
  exterieur      TINYINT(1)   NOT NULL DEFAULT 0,
  actif          TINYINT(1)   NOT NULL DEFAULT 1,
  cree_le        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_utilisateur (utilisateur_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

'pointages' => "
CREATE TABLE IF NOT EXISTS pointages (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  intervenant_id INT          NOT NULL,
  date_jour      DATE         NOT NULL,
  heures         DECIMAL(5,2) NULL,
  repas          TINYINT(1)   NULL,
  trajet         TINYINT(1)   NULL,
  absent         TINYINT(1)   NOT NULL DEFAULT 0,
  note           VARCHAR(255) NULL,
  modifie_par    INT          NULL,
  modifie_le     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_jour (intervenant_id, date_jour),
  KEY idx_date (date_jour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// v3.12 : absences signalées par les familles depuis leur espace
'absences_signalees' => "
CREATE TABLE IF NOT EXISTS absences_signalees (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  eleve_id     INT          NOT NULL,
  date_absence DATE         NOT NULL,
  motif        VARCHAR(255) NOT NULL,
  famille_id   INT          NULL,
  cree_le      DATETIME     NOT NULL,
  applique_le  DATETIME     NULL,
  UNIQUE KEY uk_eleve_date (eleve_id, date_absence),
  KEY idx_date (date_absence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// v3.16 : appel des professeurs (preuve de présence pour la rémunération)
'presences_profs' => "
CREATE TABLE IF NOT EXISTS presences_profs (
  date_jour      DATE        NOT NULL,
  groupe_id      INT         NOT NULL,
  utilisateur_id INT         NOT NULL,
  statut         VARCHAR(10) NOT NULL,
  saisi_par      INT         NULL,
  saisi_le       DATETIME    NOT NULL,
  PRIMARY KEY (date_jour, groupe_id, utilisateur_id),
  KEY idx_utilisateur (utilisateur_id, date_jour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

// v3.12 : familles des absents prévenues par la supervision
'tentatives_connexion' => "
CREATE TABLE IF NOT EXISTS tentatives_connexion (
  cle        CHAR(64)  NOT NULL PRIMARY KEY,
  echecs     INT       NOT NULL DEFAULT 0,
  premier    DATETIME  NOT NULL,
  dernier    DATETIME  NOT NULL,
  KEY idx_dernier (dernier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
'suivi_absents' => "
CREATE TABLE IF NOT EXISTS suivi_absents (
  presence_id  INT      NOT NULL PRIMARY KEY,
  contacte_le  DATETIME NOT NULL,
  contacte_par INT      NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];
}

/**
 * Mises à jour appliquées aux installations déjà en place.
 * Chaque requête est jouée indépendamment : si elle a déjà été appliquée,
 * l'erreur est ignorée.
 */
function requetes_migration(): array
{
    return [
        // Identifiant de connexion distinct de l'adresse e-mail (v1.1)
        "ALTER TABLE utilisateurs ADD COLUMN identifiant VARCHAR(40) NULL AFTER prenom",
        "UPDATE utilisateurs SET identifiant = SUBSTRING_INDEX(email, '@', 1)
           WHERE identifiant IS NULL OR identifiant = ''",
        "ALTER TABLE utilisateurs ADD UNIQUE KEY uk_identifiant (identifiant)",
        "ALTER TABLE utilisateurs MODIFY email VARCHAR(160) NULL",

        // Trois statuts seulement : présent, absent, justifié (v1.1)
        "ALTER TABLE presences MODIFY statut
           ENUM('present','retard','absent','excuse','justifie') NOT NULL DEFAULT 'present'",
        "UPDATE presences SET statut = 'justifie' WHERE statut = 'excuse'",
        "UPDATE presences SET statut = 'present'  WHERE statut = 'retard'",
        "ALTER TABLE presences MODIFY statut
           ENUM('present','absent','justifie') NOT NULL DEFAULT 'present'",
        "ALTER TABLE presences DROP COLUMN minutes_retard",

        // Traçabilité des données reprises depuis la base du site (v1.1)
        "ALTER TABLE utilisateurs ADD COLUMN ref_externe VARCHAR(64) NULL",
        "ALTER TABLE groupes ADD COLUMN ref_externe VARCHAR(64) NULL",
        "ALTER TABLE groupes ADD KEY idx_ref (ref_externe)",
    ];
}

/** Version de la structure de la base attendue par ce code. */
const VERSION_SCHEMA = '3.28';

/**
 * Mises à jour de la version 1.3 : retards et progression.
 * Les tables nouvelles sont créées par requetes_schema() (« IF NOT EXISTS »).
 */
function requetes_migration_13(): array
{
    return [
        "ALTER TABLE presences ADD COLUMN retard TINYINT(1) NOT NULL DEFAULT 0 AFTER appreciation",
        "ALTER TABLE presences ADD COLUMN retard_minutes SMALLINT UNSIGNED NULL AFTER retard",
        "ALTER TABLE presences ADD COLUMN retard_justifie TINYINT(1) NOT NULL DEFAULT 0 AFTER retard_minutes",
    ];
}

/**
 * v2.1 : le « Travail à faire » des séances déjà validées de l'année devient
 * un devoir (une seule fois), pour que les familles le retrouvent dans leur espace.
 */
function reprendre_devoirs_existants(): void
{
    foreach (lignes(
        'SELECT s.id FROM seances s JOIN groupes g ON g.id = s.groupe_id
         WHERE g.annee_scolaire = ? AND s.statut = "validee"
           AND s.travail_a_faire IS NOT NULL AND TRIM(s.travail_a_faire) <> ""
           AND NOT EXISTS (SELECT 1 FROM devoirs d WHERE d.seance_id = s.id)',
        [annee_active()]
    ) as $s) {
        synchroniser_devoir_seance((int) $s['id']);
    }
}

/** Mises à jour de la version 2.0 : espace familles et messagerie. */
function requetes_migration_20(): array
{
    return [
        "ALTER TABLE eleves ADD COLUMN famille_id INT NULL AFTER ref_externe",
        "ALTER TABLE eleves ADD KEY idx_famille (famille_id)",
        // v2.6 : rôle superviseur (voit tous les appels et l'annuaire d'urgence)
        "ALTER TABLE utilisateurs MODIFY role ENUM('admin','superviseur','professeur') NOT NULL DEFAULT 'professeur'",
        // v2.9 : un compte créé « superviseur » avant que la base connaisse ce rôle a reçu un rôle vide.
        "UPDATE utilisateurs SET role = 'superviseur' WHERE role = ''",
        // v3.2 : professeur en binôme (mêmes élèves, mêmes appels que le titulaire)
        "ALTER TABLE groupes ADD COLUMN coprofesseur_id INT NULL AFTER professeur_id",
        "ALTER TABLE groupes ADD KEY idx_coprof (coprofesseur_id)",
        // v2.2 : lien entre un devoir et la carte de progression dont il est tiré
        "ALTER TABLE devoirs ADD COLUMN semaine_id INT NULL AFTER document_id",
        "ALTER TABLE devoirs ADD CONSTRAINT fk_dev_sem FOREIGN KEY (semaine_id)
           REFERENCES progression_semaines(id) ON DELETE SET NULL",
        // v3.12 : colonnes du suivi du personnel, présentes en ligne mais absentes du dépôt
        "ALTER TABLE seances ADD COLUMN assure_par INT NULL AFTER professeur_id",
        "ALTER TABLE seances ADD KEY idx_assure (assure_par)",
        "ALTER TABLE utilisateurs ADD COLUMN archive TINYINT(1) NOT NULL DEFAULT 0 AFTER actif",
        // v3.24 : qui a réellement validé l'appel (preuve de présence pour la paie)
        "ALTER TABLE seances ADD COLUMN validee_par INT NULL AFTER validee_le",
    ];
}

/**
 * Met la base à niveau automatiquement, une seule fois, au premier passage
 * après le dépôt des nouveaux fichiers. Aucun assistant à relancer.
 */
function migrer_si_besoin(): void
{
    if (!defined('BD_NOM')) {
        return;
    }
    try {
        $version = (string) valeur("SELECT valeur FROM parametres WHERE cle = 'version_schema'");
    } catch (Throwable $e) {
        // v3.22 : base vide (installation neuve) → on crée toutes les tables, puis on
        // poursuit comme une mise à niveau. Le premier compte administrateur se crée
        // ensuite depuis la page de connexion.
        try {
            foreach (requetes_schema() as $sql) {
                bd()->exec($sql);
            }
        } catch (Throwable $e2) {
            error_log('[appel-clef] installation : ' . $e2->getMessage());
            return;
        }
        $version = '';
    }
    if ($version !== '' && version_compare($version, VERSION_SCHEMA, '>=')) {
        return;
    }

    foreach (requetes_schema() as $sql) {
        try { bd()->exec($sql); } catch (Throwable $e) { /* déjà en place */ }
    }
    foreach (array_merge(requetes_migration_13(), requetes_migration_20()) as $sql) {
        try { bd()->exec($sql); } catch (Throwable $e) { /* déjà appliquée */ }
    }
    $ajout = bd()->prepare('INSERT IGNORE INTO parametres (cle, valeur) VALUES (?, ?)');
    foreach (parametres_par_defaut() as $cle => $valeur) {
        $ajout->execute([$cle, $valeur]);
    }
    // 2.5 : en 2026-2027, les absences des élèves comptent à partir du lundi 28 septembre
    // (semaine du 21 au 27 : mise en route, comptée pour les professeurs seulement).
    if (param('debut_decompte_absences') === '' && annee_active() === '2026-2027') {
        definir_param('debut_decompte_absences', '2026-09-28');
    }
    // 3.4 : décompte officiel des absences des élèves à partir du lundi 5 octobre 2026
    // (les appels d'avant restent en base et comptent toujours pour les heures des professeurs).
    if (annee_active() === '2026-2027' && (string) param('debut_decompte_absences') < '2026-10-05') {
        definir_param('debut_decompte_absences', '2026-10-05');
    }
    // 3.3 : plus de lien vers l'espace familles dans les messages WhatsApp (espace pas encore ouvert).
    // Coupé une fois ; l'option reste disponible dans Réglages pour plus tard.
    if ($version === '' || version_compare($version, '3.3', '<')) {
        definir_param('lien_espace_message', '0');
    }
    try {
        reprendre_devoirs_existants();
    } catch (Throwable $e) {
        error_log('[appel-clef] devoirs : ' . $e->getMessage());
    }
    try {
        synchroniser_familles();
    } catch (Throwable $e) {
        error_log('[appel-clef] familles : ' . $e->getMessage());
    }
    try {
        importer_progression_initiale();
    } catch (Throwable $e) {
        error_log('[appel-clef] progression initiale : ' . $e->getMessage());
    }

    // 3.12 : décision du 29/09 — pas de lien vers l'espace familles dans les messages (une seule fois).
    if (param('lien_espace_decoche_312') !== '1') {
        definir_param('lien_espace_message', '0');
        definir_param('lien_espace_decoche_312', '1');
    }

    // 3.28 : paiement en ligne HelloAsso retiré — on efface ses réglages (identifiants compris).
    try {
        bd()->exec("DELETE FROM parametres WHERE cle LIKE 'helloasso%'");
    } catch (Throwable $e) {
        error_log('[appel-clef] nettoyage HelloAsso : ' . $e->getMessage());
    }

    // 3.24 : reprise des appels déjà validés (une seule fois). Faute de savoir qui a cliqué
    // « Valider », on retient le professeur qui a ouvert l'appel ; un appel ouvert par
    // l'administration ou la supervision reste sans preuve (« à confirmer » dans Personnel).
    if (param('validee_par_init') !== '1') {
        try {
            bd()->exec("UPDATE seances s JOIN utilisateurs u ON u.id = s.professeur_id
                        SET s.validee_par = s.professeur_id
                        WHERE s.statut = 'validee' AND s.validee_par IS NULL AND u.role = 'professeur'");
            definir_param('validee_par_init', '1');
        } catch (Throwable $e) {
            error_log('[appel-clef] validee_par : ' . $e->getMessage());
        }
    }

    bd()->prepare(
        'INSERT INTO parametres (cle, valeur) VALUES (\'version_schema\', ?)
         ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)'
    )->execute([VERSION_SCHEMA]);
    journaliser('mise_a_jour', 'Base de données passée en version ' . VERSION_SCHEMA);
}

/** Paramètres par défaut créés à l'installation. */
function parametres_par_defaut(): array
{
    return [
        'association'        => 'Association C.L.E.F.',
        'annee_scolaire'     => annee_scolaire_courante(),
        'telephone_structure'=> '06 69 13 89 69',
        'indicatif_pays'     => '33',
        'seuil_alerte'       => '3',
        'seuil_exclusion'    => '5',
        'seuil_retard'       => '3',
        'deroule_N1'         => deroule_par_defaut(),
        'progression_intro_N1' => "Année 1 : 31 semaines, leçons 1 à 11 (pages 2 à 26). "
            . "Une semaine de contrôle avant chaque vacances scolaires (zone C). "
            . "Séances de 2 h 30, groupes de 12 élèves.",
        'cotisation_annuelle'=> '220',
        'email_expediteur'   => '',
        'email_administration' => '',
        'lien_espace_message' => '0',
        'debut_decompte_absences' => '',
        'appreciation_active'=> '0',
        'mention_presence'   => '0',
        'modele_message'     => "Assalamou alaykoum,\n"
            . "Compte rendu de la séance du {date} — {groupe}\n\n"
            . "{prenom_statut}\n"
            . "{commentaire}\n"
            . "Travail à faire : {travail}\n\n"
            . "Barak Allahou fikoum.\n"
            . "{association}",
        'phrases_types'      => "Très bon travail aujourd'hui, ma sha Allah\n"
            . "Bonne participation en classe\n"
            . "Lecture fluide, beaux progrès\n"
            . "A bien mémorisé sa leçon\n"
            . "Doit réviser davantage à la maison\n"
            . "Leçon non apprise pour aujourd'hui\n"
            . "Bavardages, doit rester concentré\n"
            . "N'avait pas son matériel",
    ];
}

/** Déroulé type d'une séance de 2 h 30 (une étape par ligne : « horaire | contenu »). */
function deroule_par_defaut(): string
{
    return "0:00 – 0:10 | Accueil, ouverture, appel des élèves\n"
         . "0:10 – 0:35 | Contrôle des devoirs : chaque élève lit 1 à 2 lignes de la semaine passée\n"
         . "0:35 – 1:05 | Nouvelle notion : lecture du professeur, répétition collective (talqîn), makharij\n"
         . "1:05 – 1:15 | Pause\n"
         . "1:15 – 1:55 | Lecture individuelle (≈ 3 min par élève) ; les autres travaillent en binômes\n"
         . "1:55 – 2:15 | Activité : {activite}\n"
         . "2:15 – 2:30 | Bilan, devoirs de la semaine, QR code de la page, message aux familles";
}
