#!/usr/bin/env python3
"""
Vérifications de bout en bout de l'application « Appel & suivi », par le navigateur
(HTTP) : toutes les pages et tous les formulaires pour les quatre rôles, cloisonnement
entre professeurs, injection de code, sécurité des connexions, Finances, installation neuve.

Prérequis : serveur PHP lancé sur l'application (voir tests/lancer.sh), base préparée.
Usage : python3 tests/verifier.py [http://127.0.0.1:8080/]
Code de sortie 1 si une vérification échoue.
"""
import csv, os, random, re, subprocess, sys, tempfile, time
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8080/'
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = sorted(f[:-4] for f in os.listdir(os.path.join(RACINE, 'pages')) if f.endswith('.php'))
ERREUR_PHP = re.compile(r'(Warning|Notice|Deprecated|Fatal error|Uncaught|Une erreur est survenue)[^<]{0,250}', re.I)
PIEGES = re.compile(r'<img src=x onerror|<script>alert|<svg onload|<i onmouseover')
ROLES = ['admin', 'l.aitbelk', 'superviseur', 'm.zerrouki']
echecs = 0


def verifier(ok, libelle):
    global echecs
    print(('OK     ' if ok else 'ÉCHEC  ') + libelle, flush=True)
    if not ok:
        echecs += 1


def preparer(*options):
    subprocess.run(['php', os.path.join(RACINE, 'tests', 'preparer.php'), *options], check=True,
                   stdout=subprocess.DEVNULL)


def jeton(texte):
    m = re.search(r'name="csrf" value="([^"]+)"', texte)
    return m.group(1) if m else ''


def connexion(ident, mdp='motdepasse'):
    s = requests.Session()
    r = s.get(BASE + 'index.php?p=connexion')
    s.post(BASE + 'index.php?p=connexion', data={'email': ident, 'mot_de_passe': mdp, 'csrf': jeton(r.text)})
    return s


def essai_connexion(ident, mdp):
    s = requests.Session()
    r = s.get(BASE + 'index.php?p=connexion')
    return s.post(BASE + 'index.php?p=connexion', data={'email': ident, 'mot_de_passe': mdp, 'csrf': jeton(r.text)}).text


def essai_famille(ident, mdp):
    s = requests.Session()
    r = s.get(BASE + 'famille.php?p=connexion')
    r = s.post(BASE + 'famille.php?p=connexion', data={'identifiant': ident, 'mot_de_passe': mdp, 'csrf': jeton(r.text)})
    return s, r.text


VARIANTES = ['', '&id=1', '&groupe=1', '&seance=1', '&eleve=1', '&id=2', '&eleve=2', '&tous=1']


def section_pages():
    print('\n== Toutes les pages, quatre rôles')
    for ident in ROLES:
        s = connexion(ident)
        verifier('p=connexion' not in s.get(BASE + 'index.php').url, f'connexion de {ident}')
        anomalies = []
        for p in PAGES:
            if p in ('deconnexion', 'export'):
                continue
            for q in VARIANTES:
                r = s.get(BASE + 'index.php?p=' + p + q, timeout=60)
                m = ERREUR_PHP.search(r.text)
                if r.status_code >= 500 or m:
                    anomalies.append(f'{p}{q} → {r.status_code} {m.group(0)[:120] if m else ""}')
                x = PIEGES.search(r.text)
                if x:
                    anomalies.append(f'{p}{q} → code injecté non échappé : {r.text[x.start()-60:x.end()]!r}')
        verifier(not anomalies, f'{ident} : {len(PAGES) * len(VARIANTES)} affichages sans erreur ni code injecté'
                 + (''.join('\n         ' + a for a in anomalies[:10])))


def section_cloisonnement():
    print('\n== Cloisonnement : Latifa (groupes 1 et 3) face au groupe 2')
    s = connexion('l.aitbelk')
    essais = ['appel&seance=7', 'appel&groupe=2', 'envoi&seance=7', 'bulletin&eleve=10', 'historique&groupe=2',
              'eleve&id=10', 'liste_groupe&groupe=2', 'appel_profs&groupe=2', 'echanges&eleve=10', 'export&seance=7',
              'courrier&eleve=10', 'familles&eleve=10', 'bulletins_groupe&groupe=2', 'urgence', 'export&type=eleves',
              'export&type=suivi', 'export&type=journal', 'finances', 'attestation&payeur=1', 'personnel', 'parametres',
              'sauvegarde', 'import', 'professeurs', 'suivi', 'pilotage', 'seances&groupe=2', 'devoirs&groupe=2',
              'evaluations&groupe=2', 'liste_groupe&tous=1', 'groupe&id=2']
    fuites = []
    for q in essais:
        r = s.get(BASE + 'index.php?p=' + q)
        vus = [n for n in range(9, 17) if re.search(rf'Prénom{n}\b', r.text)]
        if vus:
            fuites.append(f'{q} → élèves {vus}')
    verifier(not fuites, f'{len(essais)} tentatives d\'accès à un autre groupe, aucune fuite'
             + ''.join('\n         ' + f for f in fuites))
    for t in ('eleves', 'suivi', 'journal'):
        verifier(s.get(BASE + 'index.php?p=export&type=' + t).status_code == 403, f'export « {t} » refusé au professeur')
    b = connexion('m.zerrouki')
    verifier('Prénom10' in b.get(BASE + 'index.php?p=groupe&id=2').text, 'le professeur en binôme voit son groupe')


def remplir(form):
    data = []
    for el in form.find_all(['input', 'select', 'textarea']):
        n = el.get('name')
        if not n:
            continue
        t = (el.get('type') or 'text').lower()
        if el.name == 'select':
            opts = [o.get('value', o.text) for o in el.find_all('option')]
            data.append((n, opts[1] if len(opts) > 1 else (opts[0] if opts else '')))
        elif el.name == 'textarea':
            data.append((n, el.text or "Test <b>x</b> l'élève"))
        elif t in ('checkbox', 'radio'):
            if el.has_attr('checked') or t == 'checkbox':
                data.append((n, el.get('value', 'on')))
        elif t in ('submit', 'button', 'file'):
            pass
        elif t == 'date':
            data.append((n, el.get('value') or time.strftime('%Y-%m-%d')))
        elif t == 'time':
            data.append((n, el.get('value') or '10:00'))
        elif t == 'number':
            data.append((n, el.get('value') or '3'))
        elif t == 'password':
            data.append((n, 'motdepasse'))
        else:
            data.append((n, el.get('value') or "Test l'élève"))
    return data


def section_formulaires():
    print('\n== Tous les formulaires, chaque rôle sur une base neuve')
    for ident in ROLES:
        preparer()
        s = connexion(ident)
        vus, anomalies = set(), []
        for p in PAGES:
            if p in ('deconnexion', 'connexion', 'sauvegarde', 'import', 'compte'):
                continue
            for q in ['', '&id=1', '&groupe=1', '&seance=1', '&eleve=1']:
                r = s.get(BASE + 'index.php?p=' + p + q)
                for form in BeautifulSoup(r.text, 'html.parser').find_all('form'):
                    if (form.get('method') or 'get').lower() != 'post':
                        continue
                    action = urljoin(r.url, form.get('action') or r.url)
                    boutons = [b for b in form.find_all(['button', 'input'])
                               if (b.get('type') or 'submit').lower() == 'submit' and b.get('name')]
                    for v in ([[(b['name'], b.get('value', ''))] for b in boutons] or [[]]):
                        cle = (p, action.split('?')[-1][:50], tuple(v), tuple(sorted(i.get('name', '') for i in form.find_all('input'))))
                        if cle in vus:
                            continue
                        vus.add(cle)
                        rr = s.post(action, data=remplir(form) + v, timeout=60)
                        m = ERREUR_PHP.search(rr.text)
                        if rr.status_code >= 500 or m or rr.status_code == 400:
                            anomalies.append(f'{p}{q} {v} → {rr.status_code} {m.group(0)[:120] if m else rr.text[:80]}')
        verifier(not anomalies and len(vus) > 10, f'{ident} : {len(vus)} formulaires soumis sans erreur'
                 + ''.join('\n         ' + a for a in anomalies[:10]))


def section_securite():
    print('\n== Sécurité des connexions et des exports')
    preparer()
    a = connexion('admin')
    r = a.get(BASE + 'index.php?p=tableau')
    verifier(r.headers.get('X-Frame-Options') == 'SAMEORIGIN', 'en-tête anti-clickjacking présent')
    r = a.get(BASE + 'index.php?p=export&type=presences&seance=1')
    verifier("'=HYPERLINK" in r.text, 'formule Excel neutralisée dans l\'export CSV')
    for _ in range(8):
        essai_connexion('m.ouchen', 'mauvais')
    verifier('Trop de tentatives' in essai_connexion('m.ouchen', 'motdepasse'), 'compte bloqué après 8 échecs (cookie effacé à chaque essai)')
    verifier('Trop de tentatives' not in essai_connexion('l.aitbelk', 'motdepasse'), 'les autres comptes restent accessibles')
    tel = '0600000001'
    s, t = essai_famille(tel, 'famille123')
    verifier('Aucun' not in t and 'incorrect' not in t and 'Trop' not in t, 'connexion à l\'espace familles')
    for _ in range(8):
        essai_famille(tel, 'faux')
    verifier('Trop de tentatives' in essai_famille(tel, 'famille123')[1], 'espace familles bloqué après 8 échecs')
    p = connexion('l.aitbelk')
    c = jeton(p.get(BASE + 'index.php?p=groupe&id=1').text)
    r = p.post(BASE + 'index.php?p=groupe&id=1', data={'csrf': c, 'action': 'transferer', 'eleve_id': 10, 'groupe_cible': 3})
    verifier('pas inscrit' in r.text, 'transfert refusé pour un élève d\'un autre groupe')
    r = p.post(BASE + 'index.php?p=groupe&id=1', data={'csrf': c, 'action': 'transferer', 'eleve_id': 2, 'groupe_cible': 3})
    verifier('rejoint' in r.text, 'transfert normal accepté')
    r = requests.post(BASE + 'index.php?p=groupe&id=1', data={'action': 'desinscrire', 'eleve_id': 3})
    verifier('p=connexion' in r.url, 'action refusée sans connexion')
    r = p.post(BASE + 'index.php?p=groupe&id=1', data={'action': 'desinscrire', 'eleve_id': 3, 'csrf': 'faux'})
    verifier(r.status_code == 400, 'formulaire refusé sans jeton anti-CSRF valide')


def ecrire_csv(chemin, entetes, lignes):
    with open(chemin, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(entetes)
        w.writerows(lignes)


def section_finances():
    print('\n== Finances : import des exports phpMyAdmin et relances')
    preparer()
    random.seed(3)
    dossier = tempfile.mkdtemp()
    ins, vers, vid = [], [], 1000
    for f in range(1, 41):
        parent, n = 500000 + f, 1 + (f % 3)
        for k in range(n):
            ins.append([600000 + f * 10 + k, f'FAM{f}', f'Enfant{k}', 0, parent, f'FAM{f}', 'Parent', f'06{f:08d}', '',
                        f'DIM_MAT_X_N{1 + k}', '220' if f != 7 else 'NULL'])
        paye = 220 * n if f % 4 else (0 if f % 8 == 0 else 100)
        while paye > 0:
            m = min(paye, random.choice([85, 110, 220, 100]))
            paye -= m
            vid += 1
            vers.append([vid, '2026-09-%02d' % random.randint(1, 30), m, 1, 1, 1, '', parent, 2, '',
                         f'FAM{f}', 'Parent', f'06{f:08d}', ''])
    HI = ['eleve_id', 'user_nom', 'user_prenom', 'user_adulte', 'user_id_affilier', 'parent_nom', 'parent_prenom',
          'user_phone', 'user_phone2', 'clas_libelle', 'fil_cout']
    HV = ['vers_id', 'vers_date', 'vers_montant', 'vers_type', 'vers_mode', 'vers_encaisser', 'vers_info', 'user_id',
          'ses_id', 'vers_date_encaisser', 'user_nom', 'user_prenom', 'user_phone', 'user_phone2']
    fi, fv, fa = (os.path.join(dossier, n) for n in ('inscrits.csv', 'versements.csv', 'ancien.csv'))
    ecrire_csv(fi, HI, ins)
    ecrire_csv(fv, HV, vers)
    ecrire_csv(fa, HV, vers[:-10])
    a = connexion('admin')

    def importer(versements, forcer=False):
        c = jeton(a.get(BASE + 'index.php?p=finances').text)
        r = a.post(BASE + 'index.php?p=finances', data={'csrf': c, 'action': 'importer', **({'forcer': '1'} if forcer else {})},
                   files={'f_versements': open(versements, 'rb'), 'f_inscrits': open(fi, 'rb')})
        return r.text

    t = importer(fv)
    verifier('Exports importés' in t and not ERREUR_PHP.search(t), 'import des exports CSV')
    verifier('Import arrêté' in importer(fa), 'ancien export refusé (versements manquants)')
    verifier('Exports importés' in importer(fa, forcer=True), 'ancien export accepté si on le confirme')
    importer(fv)
    c = jeton(a.get(BASE + 'index.php?p=finances').text)
    for payeur, attendu, libelle in [(500008, 'wa.me', 'famille débitrice : relance WhatsApp'),
                                     (500001, 'finances', 'famille à jour : relance annulée'),
                                     (500007, 'finances', 'classe sans tarif : jamais relancée')]:
        r = a.post(BASE + 'index.php?p=finances', data={'csrf': c, 'action': 'relancer', 'payeur': payeur}, allow_redirects=False)
        verifier(attendu in r.headers.get('Location', ''), libelle)
    for q in ['payeur=500001', 'payeur=500001&eleve=600010', 'payeur=500004&eleve=600040']:
        r = a.get(BASE + 'index.php?p=attestation&' + q)
        verifier(r.status_code == 200 and not ERREUR_PHP.search(r.text) and re.search(r'\d{4}-\d{4}', r.text),
                 f'attestation {q}')
    r = a.get(BASE + 'index.php?p=attestation&payeur=500008')
    verifier(not re.search(r'N°\s*\d{4}-\d{4}', r.text), 'pas de numéro d\'attestation pour 0 €')


def section_souci():
    print('\n== Lien « Signaler un souci »')
    preparer()
    p = connexion('l.aitbelk')
    verifier('souci=groupe' in p.get(BASE + 'index.php?p=groupe&id=1').text, 'lien présent en bas d\'une page')
    r = p.get(BASE + 'index.php?p=communication&souci=groupe')
    verifier('value="application" selected' in r.text and 'page « groupe »' in r.text, 'catégorie et objet pré-remplis')
    verifier('souci=' not in p.get(BASE + 'index.php?p=communication&souci=<script>').text.split('Souci sur la page')[0][-5:]
             and '&lt;script' not in p.get(BASE + 'index.php?p=communication&souci=<script>').text, 'nom de page piégé ignoré')
    r = p.post(BASE + 'index.php?p=communication', data={'csrf': jeton(r.text), 'action': 'nouveau', 'categorie': 'application',
               'sujet': 'Souci sur la page « groupe »', 'texte': 'Le bouton ne répond pas'})
    a = connexion('admin')
    verifier('Souci sur la page' in a.get(BASE + 'index.php?p=communication&statut=tous').text, 'signalement reçu par l\'administration')


def section_usage():
    print('\n== Pilotage : usage de l\'application')
    preparer()
    a = connexion('admin')
    url = BASE + 'index.php?p=pilotage&du=2026-01-01&au=2030-12-31'
    t = a.get(url).text
    m = re.search(r'<strong>(\d+) %</strong><span>familles d.absents prévenues \((\d+) sur (\d+)\)', t.replace('&#039;', "'"))
    verifier(m is not None and m.group(1) == '0', 'section « Usage » affichée (aucune famille prévenue au départ)')
    c = jeton(a.get(BASE + 'index.php?p=envoi&seance=1').text)
    a.post(BASE + 'index.php?p=envoi&seance=1', data={'csrf': c, 'action': 'tout_marquer'})
    t = a.get(url).text.replace('&#039;', "'")
    m2 = re.search(r'familles d.absents prévenues \((\d+) sur', t)
    verifier(m2 is not None and int(m2.group(1)) > 0, 'messages marqués envoyés : familles prévenues comptées')
    verifier('jamais' in t, 'professeurs jamais connectés repérés')


def section_paie():
    print('\n== Paie du personnel : présence prouvée uniquement')
    preparer()
    import datetime
    jour = datetime.date.today()
    # Dernier samedi de cours (groupe 3) : test indépendant du jour et des vacances.
    def jour_de_cours(d):
        out = subprocess.run(['php', '-r', '$_SERVER["SCRIPT_NAME"]="x"; require "inc/bootstrap.php"; '
                              f'echo jour_de_cours("{d}") ? 1 : 0;'], cwd=RACINE, capture_output=True, text=True)
        return out.stdout.strip().endswith('1')
    while jour.isoweekday() != 6 or not jour_de_cours(jour.isoformat()):
        jour -= datetime.timedelta(days=1)
    samedi = jour.isoformat()

    def valider(sess, groupe, date=''):
        r = sess.get(BASE + f'index.php?p=appel&groupe={groupe}&onglet=appel' + (f'&date={date}' if date else ''))
        m = re.search(r'data-seance="(\d+)"', r.text)
        sess.post(BASE + f'index.php?p=appel&seance={m.group(1)}', data={'csrf': jeton(r.text), 'action': 'valider'})
        return int(m.group(1))
    def validee_par(seance):
        out = subprocess.run(['php', '-r', '$_SERVER["SCRIPT_NAME"]="x"; require "inc/bootstrap.php"; '
                              f'echo (string) valeur("SELECT validee_par FROM seances WHERE id = {seance}");'],
                             cwd=RACINE, capture_output=True, text=True)
        return out.stdout.strip()
    s1 = valider(connexion('l.aitbelk'), 1)
    verifier(validee_par(s1) == '2', 'appel validé par le professeur : présence prouvée')
    valider(connexion('admin'), 1)
    verifier(validee_par(s1) == '2', 'nouvelle validation par l\'administration : la preuve du professeur est gardée')
    s3 = valider(connexion('superviseur'), 3, samedi)
    verifier(validee_par(s3) == '', 'appel validé par la supervision : aucune preuve pour le titulaire')
    t = connexion('admin').get(BASE + 'index.php?p=personnel&m=' + samedi[:7]).text
    verifier('Contrôles avant paiement' in t and 'pas par Latifa' in t, 'contrôle affiché : appel validé sans le professeur')


def section_installation():
    print('\n== Installation neuve')
    preparer('--vide')
    s = requests.Session()
    r = s.get(BASE + 'index.php?p=connexion')
    verifier('premier_admin' in r.text, 'base vide : formulaire du premier administrateur')
    r = s.post(BASE + 'index.php?p=connexion', data={'csrf': jeton(r.text), 'action': 'premier_admin', 'nom': 'test',
               'prenom': 'A', 'identifiant': 'admin', 'mot_de_passe': '0123456789'})
    verifier('p=tableau' in r.url, 'premier administrateur créé et connecté')
    verifier('premier_admin' not in requests.get(BASE + 'index.php?p=connexion').text, 'formulaire fermé ensuite')
    preparer()


if __name__ == '__main__':
    debut = time.time()
    preparer()
    section_pages()
    section_cloisonnement()
    section_formulaires()
    section_securite()
    section_finances()
    section_souci()
    section_usage()
    section_paie()
    section_installation()
    print(f'\nDurée : {time.time() - debut:.0f} s — ' + ('tout est vert.' if echecs == 0 else f'{echecs} échec(s).'))
    sys.exit(1 if echecs else 0)
