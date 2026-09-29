// ─── CONNEXION ───────────────────────────────────────────────
function LoginScreen({
  onLogin,
  error,
  loading
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.navy,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 340
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 52,
      marginBottom: 12
    }
  }, "🎓"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.gold,
      fontSize: 24,
      fontWeight: 800,
      fontFamily: FD
    }
  }, "Boost'Étude"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.gray,
      fontSize: 13,
      marginTop: 4
    }
  }, "Espace professeur")), /*#__PURE__*/React.createElement(InputText, {
    label: "Email",
    value: email,
    onChange: setEmail,
    placeholder: "prenom@boostetude.fr",
    type: "email"
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Mot de passe",
    value: password,
    onChange: setPassword,
    placeholder: "••••••••",
    type: "password"
  }), error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(224,85,85,.12)",
      border: "1px solid rgba(224,85,85,.3)",
      borderRadius: 10,
      padding: "10px 12px",
      color: C.red,
      fontSize: 13,
      marginBottom: 14
    }
  }, error), /*#__PURE__*/React.createElement(BtnPrimary, {
    label: loading ? "Connexion…" : "Se connecter",
    onClick: () => onLogin(email, password),
    disabled: loading || !email || !password,
    full: true
  })));
}
