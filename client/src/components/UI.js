import React from "react";

export const inputStyle = {
  width: "100%", padding: "10px 14px",
  background: "var(--s2)", border: "1px solid var(--bd)",
  borderRadius: 8, color: "var(--t)", fontSize: 13,
  fontFamily: "var(--fs)", boxSizing: "border-box",
};

export function Btn({ children, primary, danger, disabled, small, style, ...p }) {
  return (
    <button disabled={disabled} style={{
      padding: small ? "6px 14px" : "10px 22px", borderRadius: 8, border: "1px solid",
      fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "var(--fm)", opacity: disabled ? 0.4 : 1,
      ...(primary ? { background: "var(--a)", borderColor: "var(--a)", color: "#fff" }
        : danger ? { background: "transparent", borderColor: "var(--r)", color: "var(--r)" }
        : { background: "transparent", borderColor: "var(--bd2)", color: "var(--td)" }),
      ...style,
    }} {...p}>{children}</button>
  );
}

export function Card({ children, style, glow, className, ...p }) {
  return (
    <div className={className} style={{
      background: "var(--s)", border: "1px solid var(--bd)", borderRadius: 12, padding: 20,
      animation: glow ? "glow 3s ease-in-out infinite" : undefined, ...style,
    }} {...p}>{children}</div>
  );
}

export function Label({ children, color }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, fontFamily: "var(--fm)",
      color: color || "var(--a)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10,
    }}>{children}</div>
  );
}

export function Bar({ value, color, h = 5 }) {
  return (
    <div style={{ height: h, background: "var(--s2)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, Math.max(0, value))}%`,
        background: color || "var(--a)", borderRadius: 4, transition: "width .6s ease",
      }} />
    </div>
  );
}

export function Spinner({ text, sub }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, border: "3px solid var(--bd)", borderTopColor: "var(--a)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
        <div style={{ color: "var(--a)", fontSize: 14, fontFamily: "var(--fm)", fontWeight: 600 }}>{text}</div>
        {sub && <div style={{ color: "var(--tm)", fontSize: 12, marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  );
}
