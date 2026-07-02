export default function TimelineBar({
  label,
  left,
  width,
  colorClass,
  onClick,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}) {
  return (
    <button
      type="button"
      className={`timeline-bar ${colorClass}`}
      style={{ left, width }}
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseMove={onHoverMove}
      onMouseLeave={onHoverEnd}
      title={label}
    >
      <span className="timeline-bar-label">{label}</span>
    </button>
  );
}
