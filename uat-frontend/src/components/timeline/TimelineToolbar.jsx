import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export default function TimelineToolbar({ zoom, onToday, onPrevious, onNext, onZoomChange }) {
  return (
    <div className="timeline-modal-header">
      <div className="timeline-modal-title-wrap">
        <CalendarDays size={18} />
        <h3 className="timeline-modal-title">Projects Timeline</h3>
      </div>

      <div className="timeline-header-controls">
        <button type="button" className="timeline-btn timeline-btn-ghost" onClick={onToday}>Today</button>
        <button type="button" className="timeline-btn" onClick={onPrevious}>
          <ChevronLeft size={14} />
          Previous
        </button>
        <button type="button" className="timeline-btn" onClick={onNext}>
          Next
          <ChevronRight size={14} />
        </button>

        <div className="timeline-zoom-switch" role="tablist" aria-label="Timeline zoom level">
          <button
            type="button"
            className={`timeline-zoom-btn ${zoom === "month" ? "active" : ""}`}
            role="tab"
            aria-selected={zoom === "month"}
            onClick={() => onZoomChange("month")}
          >
            Month
          </button>
          <button
            type="button"
            className={`timeline-zoom-btn ${zoom === "quarter" ? "active" : ""}`}
            role="tab"
            aria-selected={zoom === "quarter"}
            onClick={() => onZoomChange("quarter")}
          >
            Quarter
          </button>
          <button
            type="button"
            className={`timeline-zoom-btn ${zoom === "week" ? "active" : ""}`}
            role="tab"
            aria-selected={zoom === "week"}
            onClick={() => onZoomChange("week")}
          >
            Week
          </button>
        </div>
      </div>
    </div>
  );
}
