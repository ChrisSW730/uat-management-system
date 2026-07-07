export default function TimelineWeekHeader({ layout, columns }) {
  return (
    <div
      className="timeline-week-header"
      style={{
        width: layout.chartWidth,
        gridTemplateColumns: layout.gridTemplateColumns,
      }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={[
            "timeline-week-cell",
            column.isWeekend ? "weekend" : "",
            column.isMonthStart ? "month-start" : "",
            column.isCurrentMonth ? "current-month" : "",
          ].filter(Boolean).join(" ")}
        >
          <span className="timeline-weekday">{column.labelTop}</span>
          <span className="timeline-date">{column.labelBottom}</span>
        </div>
      ))}
    </div>
  );
}
