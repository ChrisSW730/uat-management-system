export default function TimelineTooltip({ tooltip }) {
  if (!tooltip?.visible) return null;

  return (
    <div
      className="timeline-tooltip"
      style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
      role="status"
      aria-live="polite"
    >
      <div className="timeline-tooltip-name">{tooltip.name}</div>
      <div className="timeline-tooltip-row"><span>Start</span><strong>{tooltip.startDate}</strong></div>
      <div className="timeline-tooltip-row"><span>End</span><strong>{tooltip.endDate}</strong></div>
      <div className="timeline-tooltip-row"><span>Status</span><strong>{tooltip.status}</strong></div>
      <div className="timeline-tooltip-row"><span>Progress</span><strong>{tooltip.progress}%</strong></div>
    </div>
  );
}
