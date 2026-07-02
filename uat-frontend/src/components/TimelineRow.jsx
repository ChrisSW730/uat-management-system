import { ChevronDown, ChevronRight, FolderKanban, ClipboardList } from "lucide-react";
import TimelineBar from "./TimelineBar";

export default function TimelineRow({
  row,
  timelineConfig,
  onToggleProject,
  onRowClick,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}) {
  const rowClass = row.type === "project" ? "timeline-row project" : "timeline-row test-plan";

  return (
    <div className={rowClass} style={{ gridTemplateColumns: timelineConfig.rowTemplateColumns }}>
      <button
        type="button"
        className="timeline-row-label"
        onClick={() => onRowClick(row)}
      >
        <span className={`timeline-row-indent level-${row.level}`} />

        {row.type === "project" ? (
          <span
            className="timeline-expand-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleProject(row.project.id);
            }}
          >
            {row.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </span>
        ) : (
          <span className="timeline-expand-toggle placeholder" />
        )}

        <span className="timeline-row-icon" aria-hidden="true">
          {row.type === "project" ? <FolderKanban size={14} /> : <ClipboardList size={14} />}
        </span>

        <span className="timeline-row-text-wrap">
          <span className="timeline-row-title">{row.name}</span>
          <span className="timeline-row-subtitle">{row.status} • {row.progress}%</span>
        </span>
      </button>

      <div
        className="timeline-row-track"
        style={{
          width: timelineConfig.chartWidth,
        }}
      >
        <div className="timeline-row-grid" style={{ gridTemplateColumns: timelineConfig.gridTemplateColumns }}>
          {(timelineConfig.dayLabels || []).map((day) => (
            <span
              key={day.key}
              className={`timeline-row-grid-cell ${day.isWeekend ? "weekend" : ""}`}
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
            onHoverStart={onHoverStart}
            onHoverMove={onHoverMove}
            onHoverEnd={onHoverEnd}
          />
        ) : (
          <div className="timeline-no-range">No timeline</div>
        )}
      </div>
    </div>
  );
}
