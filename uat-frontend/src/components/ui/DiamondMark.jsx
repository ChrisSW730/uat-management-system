export default function DiamondMark({ size = 32, outer = "#ffffff", inner = "#4f46e5", stroke = 6 }) {
  return (
    <span style={{ width: size, height: size, transform: "rotate(45deg)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `${stroke}px solid ${outer}`, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: "48%", height: "48%", background: inner, borderRadius: 1 }} />
      </span>
    </span>
  );
}