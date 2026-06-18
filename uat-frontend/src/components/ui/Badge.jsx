import {
  EXEC_STATUS,
  DEFECT_STATUS,
  PRIORITY_META
} from "../../constants";

/* -----------------------------------------
   SMALL UI COMPONENTS
----------------------------------------- */
export function Dot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

export function ExecBadge({ status }) {
  const c = EXEC_STATUS[status] || EXEC_STATUS["Not Run"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, border: `1.5px solid ${c.border}`, padding: "3px 10px 3px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Dot color={c.dot} />{status}
    </span>
  );
}

export function DefBadge({ status }) {
  const c = DEFECT_STATUS[status] || DEFECT_STATUS.New;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, border: `1.5px solid ${c.border}`, padding: "3px 10px 3px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Dot color={c.dot} />{status || "New"}
    </span>
  );
}

export function PriBadge({ label }) {
  const m = PRIORITY_META[label] || { bg: "#e2e8f0", text: "#334155", shadow: "#0000001a" };
  return <span style={{ background: m.bg, color: m.text, padding: "3px 10px", borderRadius: 6, fontSize: 14, fontWeight: 700, textTransform: "uppercase", boxShadow: `0 2px 8px ${m.shadow}`, whiteSpace: "nowrap" }}>{label}</span>;
}