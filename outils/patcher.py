"""Applique une série de remplacements exacts sur les modules source.

Chaque ancre doit apparaître exactement une fois : si le code a bougé, le script
s'arrête au lieu de produire un fichier à moitié modifié.
"""
import pathlib, sys

def appliquer(chemin, edits, etiquette=""):
    p = pathlib.Path(chemin)
    s = p.read_text(encoding="utf-8")
    for i, (avant, apres) in enumerate(edits, 1):
        n = s.count(avant)
        if n != 1:
            sys.exit(f"❌ {chemin} — ancre {i} trouvée {n} fois :\n{avant[:160]!r}")
        s = s.replace(avant, apres, 1)
    p.write_text(s, encoding="utf-8")
    print(f"✅ {chemin} — {len(edits)} modification(s) {etiquette}")
