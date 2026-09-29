"""Découpe le fichier unique déployé en modules source versionnables.

Le fichier de production est un seul index.html : lisible par personne, impossible
à relire dans un diff Git. On le découpe sur ses propres marqueurs de section
(// ─── NOM ───), sans toucher à une seule ligne de code. Le build les recolle
dans le même ordre ; la sortie doit être identique à l'octet près.
"""
import pathlib, re, unicodedata, hashlib, json

RACINE = pathlib.Path("/home/claude/boostetude")
src = (RACINE / "reference.html").read_text(encoding="utf-8")

# Le script inline est le seul <script> sans attribut src.
m = re.search(r'<script>(// ─── SUPABASE[\s\S]*?)</script>', src)
if not m:
    raise SystemExit("script inline introuvable")
code = m.group(1)
haut = src[:m.start()] + "<script>"
bas = "</script>" + src[m.end():]

def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")

# Positions des marqueurs de section.
marqueurs = [(mm.start(), mm.group(1).strip(" ─"))
             for mm in re.finditer(r'^// ─── ([^\n]*?)[ ─]*$', code, re.M)]
if not marqueurs:
    raise SystemExit("aucune section trouvée")

app = RACINE / "src" / "app"
app.mkdir(parents=True, exist_ok=True)
for f in app.glob("*.js"):
    f.unlink()

morceaux = []
for i, (debut, nom) in enumerate(marqueurs):
    fin = marqueurs[i + 1][0] if i + 1 < len(marqueurs) else len(code)
    morceaux.append((f"{i:02d}-{slug(nom)}.js", code[debut:fin]))

# Ce qui précède la première section (rien, en principe) reste en tête du premier module.
if marqueurs[0][0] > 0:
    nom, contenu = morceaux[0]
    morceaux[0] = (nom, code[:marqueurs[0][0]] + contenu)

for nom, contenu in morceaux:
    (app / nom).write_text(contenu, encoding="utf-8")

(RACINE / "src").mkdir(exist_ok=True)
(RACINE / "src" / "shell-haut.html").write_text(haut, encoding="utf-8")
(RACINE / "src" / "shell-bas.html").write_text(bas, encoding="utf-8")

(RACINE / "src" / "ordre.json").write_text(
    json.dumps([n for n, _ in morceaux], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

print(f"{len(morceaux)} modules écrits")
for nom, contenu in morceaux:
    print(f"  {nom:36} {len(contenu):>7} caractères")
print("\nempreinte de référence :", hashlib.sha256(src.encode()).hexdigest())
(RACINE / "reference.sha256").write_text(hashlib.sha256(src.encode()).hexdigest() + "\n")
