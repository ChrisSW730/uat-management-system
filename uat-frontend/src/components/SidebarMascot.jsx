import { useState } from "react";
import mascotImage from "../../public/peekqa-mascot-peeko.gif";
import "../styles/SidebarMascot.css";

export default function SidebarMascot({ size = 60, edgeAligned = false }) {
  const [isBouncing, setIsBouncing] = useState(false);

  const handleClick = () => {
    setIsBouncing(false);

    requestAnimationFrame(() => {
      setIsBouncing(true);

      setTimeout(() => {
        setIsBouncing(false);
      }, 450);
    });
  };

  return (
    <button
      type="button"
      className={[
        "sidebar-mascot",
        edgeAligned && "sidebar-mascot--edge-aligned",
        isBouncing && "is-bouncing"
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      aria-label="PeekQA mascot"
      title="PeekQA mascot"
      style={{ "--mascot-size": `${size}px` }}
    >

      <img
        src={mascotImage}
        className="sidebar-mascot__image"
        alt=""
        draggable={false}
      />
    </button>
  );
}
