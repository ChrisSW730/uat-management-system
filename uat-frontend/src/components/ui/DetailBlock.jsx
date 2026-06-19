export default function DetailBlock({ label, value, pre, accent, danger }) {
  const bg = accent ? "#eff6ff" : danger ? "#fff1f2" : "#f8fafc";
  const bd = accent ? "#bfdbfe" : danger ? "#fecdd3" : "#f1f5f9";
  const cl = accent ? "#1d4ed8" : danger ? "#be123c" : "#334155";
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      {pre
        ? <pre style={{ background: bg, border: `1.5px solid ${bd}`, borderRadius: 8, padding: "10px 14px", color: cl, fontSize: 14, whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace,monospace", lineHeight: 1.6 }}>{value}</pre>
        : <span style={{ display: "block", background: bg, border: `1.5px solid ${bd}`, borderRadius: 8, padding: "10px 14px", color: cl, fontSize: 14, lineHeight: 1.5 }}>{value || "-"}</span>}
    </div>
  );
}