import TimelineBar from "./TimelineBar";

export default function TimelineGrid({
  row,
  layout,
  columns,
  onRowClick,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}) {
  return (
    <div className="timeline-row-track" style={{ width: layout.chartWidth }}>
      <div className="timeline-row-grid" style={{ gridTemplateColumns: layout.gridTemplateColumns }}>
        {columns.map((column) => (
          <span
            key={`${row.id}-${column.key}`}
            className={[
              "timeline-row-grid-cell",
              column.isWeekend ? "weekend" : "",
              column.isMonthStart ? "month-start" : "",
              column.isCurrentMonth ? "current-month" : "",
            ].filter(Boolean).join(" ")}
            aria-hidden="true"
          />
        ))}
      </div>

      {row.bar?.visible ? (
        <TimelineBar
          label={row.name}
          left={row.bar.left}
          width={row.bar.width}
          colorClass={row.bar.colorClass}
          onClick={() => onRowClick(row)}
          onHoverStart={(event) => onHoverStart(event, row)}
          onHoverMove={onHoverMove}
          onHoverEnd={onHoverEnd}
        />
      ) : (
        <div className="timeline-no-range">No timeline</div>
      )}
    </div>
  );
}
