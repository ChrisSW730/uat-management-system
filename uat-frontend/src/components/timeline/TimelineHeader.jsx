import TimelineMonthHeader from "./TimelineMonthHeader";
import TimelineWeekHeader from "./TimelineWeekHeader";
import TimelineTodayIndicator from "./TimelineTodayIndicator";

export default function TimelineHeader({ layout, columns, monthSegments, todayColumnIndex }) {
  return (
    <div className="timeline-axis-header" style={{ width: layout.chartWidth }}>
      <TimelineMonthHeader layout={layout} monthSegments={monthSegments} />
      <TimelineWeekHeader layout={layout} columns={columns} />
      <TimelineTodayIndicator
        mode="header"
        show={todayColumnIndex >= 0}
        left={(todayColumnIndex + 0.5) * layout.columnWidth}
      />
    </div>
  );
}
