// ─── CONNEXION ───────────────────────────────────────────────
// Le seul écran qui garde le bleu nuit en pleine page : une carte blanche posée
// dessus, comme une enseigne. C'est aussi le seul moment où l'application n'a
// rien à montrer — autant qu'elle se présente.
function LoginScreen({ onLogin, error, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const pret = !loading && email && password;

  return h("div", {
    style: {
      minHeight: "100vh", background: C.navy, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20
    }
  },
    h("div", {
      style: {
        width: "100%", maxWidth: 400, background: C.surface, borderRadius: 16,
        padding: "28px 24px", boxShadow: "0 12px 40px rgba(0,0,0,.22)"
      }
    },
      h("div", {
        style: {
          width: 52, height: 52, borderRadius: 14, background: C.navyPale,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, marginBottom: 14
        }
      }, "🎓"),
      h("div", { style: { fontSize: 22, fontWeight: 700, color: C.texte, fontFamily: FD, lineHeight: 1.2 } },
        "Boost'Étude"),
      h("div", { style: { fontSize: 13.5, color: C.gray, marginTop: 3, marginBottom: 20 } },
        "Espace professeur"),

      h("form", {
        onSubmit: e => { e.preventDefault(); if (pret) onLogin(email, password); }
      },
        h(InputText, { label: "Email", value: email, onChange: setEmail, placeholder: "prenom@boostetude.fr", type: "email" }),
        h(InputText, { label: "Mot de passe", value: password, onChange: setPassword, placeholder: "••••••••", type: "password" }),
        error
          ? h("div", {
              style: {
                background: C.redPale, border: `1px solid ${C.redBord}`, borderRadius: 10,
                padding: "10px 12px", color: C.red, fontSize: 13.5, marginBottom: 14
              }
            }, error)
          : null,
        h(BtnPrimary, {
          label: loading ? "Connexion…" : "Se connecter",
          onClick: () => pret && onLogin(email, password),
          disabled: !pret, full: true
        })),

      h("div", { style: { fontSize: 12.5, color: C.grisClair, marginTop: 18, textAlign: "center", lineHeight: 1.5 } },
        "Mot de passe oublié ? Demandez-le à Fouad.")));
}
