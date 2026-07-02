import { ChevronDown, ChevronRight, FolderKanban, ClipboardList } from "lucide-react";
import TimelineGrid from "./TimelineGrid";

export default function TimelineRows({
  rows,
  layout,
  columns,
  collapsedProjectIds,
  onToggleProject,
  onRowClick,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}) {
  return (
    <div className="timeline-body-rows">
      {rows.map((row) => {
        const rowClass = row.type === "project" ? "timeline-body-row project" : "timeline-body-row test-plan";
        const labelClass = row.type === "project" ? "timeline-row-label project-row" : "timeline-row-label testplan-row";

        return (
          <div key={row.id} className={rowClass} style={{ gridTemplateColumns: layout.rowTemplateColumns }}>
            <button
              type="button"
              className={labelClass}
              onClick={() => onRowClick(row)}
            >
              {row.type === "project" ? (
                <span
                  className="timeline-expand-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleProject(row.project.id);
                  }}
                >
                  {collapsedProjectIds[row.project.id] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </span>
              ) : null}

              <span className="timeline-row-icon" aria-hidden="true">
                {row.type === "project" ? <FolderKanban size={14} /> : <ClipboardList size={14} />}
              </span>

              <span className="timeline-row-text-wrap">
                <span className="timeline-row-title">{row.name}</span>
                <span className="timeline-row-subtitle">{row.status} • {row.progress}%</span>
              </span>
            </button>

            <TimelineGrid
              row={row}
              layout={layout}
              columns={columns}
              onRowClick={onRowClick}
              onHoverStart={onHoverStart}
              onHoverMove={onHoverMove}
              onHoverEnd={onHoverEnd}
            />
          </div>
        );
      })}
    </div>
  );
}
