// ─── ATOMES ──────────────────────────────────────────────────
function Avatar({
  p,
  n,
  s
}) {
  const size = s || 38;
  const hue = ((p?.charCodeAt(0) || 0) * 37 + (n?.charCodeAt(0) || 0) * 13) % 360;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      flexShrink: 0,
      background: `hsl(${hue},45%,22%)`,
      border: `2px solid hsl(${hue},55%,40%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.33,
      fontWeight: 800,
      color: `hsl(${hue},75%,72%)`,
      fontFamily: FD
    }
  }, ((p || "")[0] + (n || "")[0]).toUpperCase());
}
function Lbl({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.gold,
      letterSpacing: "1px",
      textTransform: "uppercase",
      marginBottom: 6
    }
  }, text);
}
function StatutBadge({
  statut
}) {
  const cfg = {
    paye: {
      t: "Payé",
      cl: C.green,
      bg: "rgba(76,175,125,.15)",
      bd: "rgba(76,175,125,.4)"
    },
    en_attente: {
      t: "En attente",
      cl: C.orange,
      bg: "rgba(224,144,48,.15)",
      bd: "rgba(224,144,48,.4)"
    },
    impaye: {
      t: "Impayé",
      cl: C.red,
      bg: "rgba(224,85,85,.15)",
      bd: "rgba(224,85,85,.4)"
    }
  };
  const x = cfg[statut] || cfg.en_attente;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: ".2px",
      color: x.cl,
      background: x.bg,
      border: `1px solid ${x.bd}`,
      padding: "3px 9px",
      borderRadius: 20,
      whiteSpace: "nowrap"
    }
  }, x.t);
}
function BtnPrimary({
  label,
  onClick,
  disabled,
  full
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    style: {
      background: disabled ? "#555" : `linear-gradient(135deg,${C.gold},${C.goldD})`,
      border: "none",
      borderRadius: 12,
      padding: "13px 18px",
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: ".2px",
      color: C.navy,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      opacity: disabled ? 0.6 : 1,
      width: full ? "100%" : "auto",
      whiteSpace: "nowrap",
      boxShadow: disabled ? "none" : "0 4px 14px rgba(212,175,55,.35)"
    }
  }, label);
}
function BtnSecondary({
  label,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      background: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.15)",
      borderRadius: 12,
      padding: "13px 18px",
      fontSize: 14,
      fontWeight: 700,
      color: C.cream,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(0,0,0,.18)"
    }
  }, label);
}
function InputText({
  label,
  value,
  onChange,
  placeholder,
  type
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, label && /*#__PURE__*/React.createElement(Lbl, {
    text: label
  }), /*#__PURE__*/React.createElement("input", {
    type: type || "text",
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder || "",
    style: {
      width: "100%",
      background: "rgba(255,255,255,.06)",
      border: "1px solid rgba(212,175,55,.2)",
      borderRadius: 8,
      padding: "10px 12px",
      color: C.cream,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
      colorScheme: "dark"
    }
  }));
}
function InputArea({
  label,
  value,
  onChange,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, label && /*#__PURE__*/React.createElement(Lbl, {
    text: label
  }), /*#__PURE__*/React.createElement("textarea", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder || "",
    style: {
      width: "100%",
      background: "rgba(255,255,255,.06)",
      border: "1px solid rgba(212,175,55,.2)",
      borderRadius: 8,
      padding: "10px 12px",
      color: C.cream,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
      resize: "vertical",
      minHeight: 64
    }
  }));
}
function SelectInput({
  label,
  value,
  onChange,
  options
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, label && /*#__PURE__*/React.createElement(Lbl, {
    text: label
  }), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      width: "100%",
      background: "#0f1e38",
      border: "1px solid rgba(212,175,55,.2)",
      borderRadius: 8,
      padding: "10px 12px",
      color: C.cream,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      appearance: "none"
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.v ?? o,
    value: o.v ?? o
  }, o.l ?? o))));
}
function LoadingScreen({
  msg
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.navy,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fx-pulse-glow",
    style: {
      fontSize: 52,
      marginBottom: 16
    }
  }, "🎓"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.gold,
      fontSize: 22,
      fontWeight: 700,
      fontFamily: FD
    }
  }, "Boost'Étude"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.gray,
      fontSize: 14,
      marginTop: 8
    }
  }, msg || "Chargement…")));
}
