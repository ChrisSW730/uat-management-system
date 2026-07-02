export default function TimelineMonthHeader({ layout, monthSegments }) {
  return (
    <div
      className="timeline-month-header"
      style={{
        width: layout.chartWidth,
        gridTemplateColumns: layout.gridTemplateColumns,
      }}
    >
      {monthSegments.map((segment) => (
        <div
          key={segment.key}
          className={`timeline-month-segment ${segment.isCurrentMonth ? "current" : ""}`}
          style={{
            gridColumn: `${segment.start + 1} / span ${segment.span}`,
          }}
        >
          <span className="timeline-month-segment-label">{segment.label}</span>
        </div>
      ))}
    </div>
  );
}
