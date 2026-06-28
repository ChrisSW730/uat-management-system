import { useEffect } from "react";

export default function Modal({ children, onClose, wide, zIndex = 1000, onPaste }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(5px)", zIndex, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} onPaste={onPaste} style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: wide ? 900 : 700, maxHeight: "93vh", overflowY: "visible", overscrollBehavior: "contain", boxShadow: "0 32px 80px rgba(0,0,0,0.18)", border: "1px solid #f1f5f9" }}>
        {children}
      </div>
    </div>
  );
}