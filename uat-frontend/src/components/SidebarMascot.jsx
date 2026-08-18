import mascotImage from "../../public/peekqa-mascot-peeko.gif";
import "../styles/SidebarMascot.css";

export default function SidebarMascot({ size = 60, edgeAligned = false }) {
  return (
    <div
      className={[
        "sidebar-mascot",
        edgeAligned && "sidebar-mascot--edge-aligned"
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
      style={{ "--mascot-size": `${size}px` }}
    >
      <img
        src={mascotImage}
        className="sidebar-mascot__image"
        alt=""
        draggable={false}
      />
    </div>
  );
}
