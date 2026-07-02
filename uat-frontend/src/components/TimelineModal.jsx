import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import TimelineToolbar from "./TimelineToolbar";
import TimelineHeader from "./TimelineHeader";
import TimelineLegend from "./TimelineLegend";
import TimelineRows from "./TimelineRows";
import TimelineTodayIndicator from "./TimelineTodayIndicator";
import TimelineTooltip from "./TimelineTooltip";
import "../styles/Timeline.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toStartOfDay(value) {
  const source = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(source.getTime())) return null;
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

function addDays(date, amount) {
  return new Date(date.getTime() + amount * DAY_MS);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date) {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function endOfQuarter(date) {
  const start = startOfQuarter(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

function startOfWeekMonday(date) {
  const day = date.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  return addDays(date, shift);
}

function clampDate(date, minDate, maxDate) {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function normalizeState(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed") return "Completed";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "not started") return "Not Started";
  if (normalized === "overdue") return "Overdue";
  return "Not Started";
}

function resolvePlanStatus(item, timelineMeta) {
  if (item?.status) {
    return normalizeState(item.status);
  }

  if (timelineMeta?.status) {
    return normalizeState(timelineMeta.status);
  }

  const start = toStartOfDay(item?.startDate);
  const end = toStartOfDay(item?.endDate);
  const today = toStartOfDay(new Date());

  if (!start || !end || start > end) return "Not Started";
  if (today < start) return "Not Started";
  if (today > end) return "Overdue";
  if ((timelineMeta?.progress ?? 0) >= 100) return "Completed";
  return "In Progress";
}

function getBarGeometry(startDate, endDate, layout, columns) {
  const start = toStartOfDay(startDate);
  const end = toStartOfDay(endDate);

  if (!start || !end || start > end || columns.length === 0) {
    return { visible: false, left: 0, width: 0 };
  }

  const endExclusive = addDays(end, 1);
  let firstIndex = -1;
  let lastIndex = -1;

  columns.forEach((column, index) => {
    const overlaps = start < column.end && endExclusive > column.start;
    if (!overlaps) return;
    if (firstIndex === -1) firstIndex = index;
    lastIndex = index;
  });

  if (firstIndex < 0 || lastIndex < 0) {
    return { visible: false, left: 0, width: 0 };
  }

  const left = firstIndex * layout.columnWidth + 2;
  const width = Math.max((lastIndex - firstIndex + 1) * layout.columnWidth - 4, 8);
  return { visible: true, left, width };
}

function monthKeyForDate(date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function buildColumns(range, zoom, today) {
  const columns = [];

  if (zoom === "quarter") {
    let cursor = startOfWeekMonday(range.start);
    while (cursor <= range.end) {
      const weekStart = cursor;
      const weekEnd = addDays(weekStart, 7);
      const bucket = clampDate(weekStart, range.start, range.end);
      const keyMonth = monthKeyForDate(bucket);
      const isCurrentMonth = bucket.getFullYear() === today.getFullYear() && bucket.getMonth() === today.getMonth();

      columns.push({
        key: `${weekStart.toISOString()}-week`,
        start: weekStart,
        end: weekEnd,
        labelTop: "Mon",
        labelBottom: weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        isWeekend: false,
        monthKey: keyMonth,
        monthLabel: bucket.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase(),
        isCurrentMonth,
      });

      cursor = weekEnd;
    }
  } else {
    let cursor = range.start;
    while (cursor <= range.end) {
      const dayNumber = cursor.getDay();
      const nextDay = addDays(cursor, 1);
      const keyMonth = monthKeyForDate(cursor);
      const isCurrentMonth = cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

      columns.push({
        key: cursor.toISOString(),
        start: cursor,
        end: nextDay,
        labelTop: WEEKDAY_LABELS[dayNumber],
        labelBottom: cursor.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        isWeekend: dayNumber === 0 || dayNumber === 6,
        monthKey: keyMonth,
        monthLabel: cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase(),
        isCurrentMonth,
      });

      cursor = nextDay;
    }
  }

  return columns.map((column, index) => {
    const previous = columns[index - 1];
    return {
      ...column,
      isMonthStart: index === 0 || !previous || previous.monthKey !== column.monthKey,
    };
  });
}

function buildMonthSegments(columns) {
  if (columns.length === 0) return [];

  const segments = [];
  let startIndex = 0;

  for (let i = 1; i <= columns.length; i += 1) {
    const current = columns[i];
    const previous = columns[i - 1];
    const crossedMonth = current && current.monthKey !== previous.monthKey;

    if (i === columns.length || crossedMonth) {
      segments.push({
        key: `${previous.monthKey}-${startIndex}`,
        label: previous.monthLabel,
        start: startIndex,
        span: i - startIndex,
        isCurrentMonth: previous.isCurrentMonth,
      });
      startIndex = i;
    }
  }

  return segments;
}

export default function TimelineModal({
  isOpen,
  onClose,
  projects,
  getTimelineMeta,
  onProjectClick,
  onTestPlanClick,
}) {
  const [zoom, setZoom] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => toStartOfDay(new Date()));
  const [collapsedProjectIds, setCollapsedProjectIds] = useState({});
  const [tooltip, setTooltip] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollAreaRef = useRef(null);

  const today = useMemo(() => toStartOfDay(new Date()), []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setTooltip(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const element = scrollAreaRef.current;
    if (!element) return undefined;

    const update = () => setViewportWidth(element.clientWidth || 0);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [isOpen]);

  const periodRange = useMemo(() => {
    const anchor = toStartOfDay(anchorDate || new Date());

    if (zoom === "week") {
      const start = startOfWeekMonday(anchor);
      const end = addDays(start, 6);
      return { start, end };
    }

    if (zoom === "quarter") {
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
    }

    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }, [anchorDate, zoom]);

  const columns = useMemo(() => buildColumns(periodRange, zoom, today), [periodRange, zoom, today]);
  const monthSegments = useMemo(() => buildMonthSegments(columns), [columns]);

  const layout = useMemo(() => {
    const safeViewportWidth = Math.max(viewportWidth, 600);
    const labelColumnWidth = Math.round(Math.min(340, Math.max(230, safeViewportWidth * 0.29)));
    const timelineViewportWidth = Math.max(safeViewportWidth - labelColumnWidth, 300);
    const columnCount = Math.max(columns.length, 1);
    const minColumnWidth = zoom === "week" ? 78 : zoom === "month" ? 30 : 74;
    const fitColumnWidth = timelineViewportWidth / columnCount;
    const columnWidth = Math.max(minColumnWidth, fitColumnWidth);
    const chartWidth = columnWidth * columnCount;

    return {
      labelColumnWidth,
      timelineViewportWidth,
      columnCount,
      columnWidth,
      chartWidth,
      rowTemplateColumns: `${labelColumnWidth}px ${chartWidth}px`,
      gridTemplateColumns: `repeat(${columnCount}, ${columnWidth}px)`,
    };
  }, [columns.length, viewportWidth, zoom]);

  const todayColumnIndex = useMemo(
    () => columns.findIndex((column) => today >= column.start && today < column.end),
    [columns, today],
  );

  const timelineRows = useMemo(() => {
    const rows = [];

    (projects || []).forEach((project) => {
      const projectMeta = getTimelineMeta(project.startDate, project.endDate);
      rows.push({
        id: `project-${project.id}`,
        type: "project",
        level: 0,
        name: project.name,
        status: projectMeta.status,
        progress: projectMeta.progress,
        project,
        bar: {
          ...getBarGeometry(project.startDate, project.endDate, layout, columns),
          colorClass: "project",
        },
      });

      if (collapsedProjectIds[project.id]) {
        return;
      }

      (project.testPlans || []).forEach((plan) => {
        const planMeta = getTimelineMeta(plan.startDate, plan.endDate);
        const planStatus = resolvePlanStatus(plan, planMeta);
        const colorClassMap = {
          Completed: "completed",
          "In Progress": "in-progress",
          "Not Started": "not-started",
          Overdue: "overdue",
        };

        rows.push({
          id: `plan-${project.id}-${plan.id}`,
          type: "plan",
          level: 1,
          name: plan.name,
          status: planStatus,
          progress: planMeta.progress,
          project,
          plan,
          bar: {
            ...getBarGeometry(plan.startDate, plan.endDate, layout, columns),
            colorClass: colorClassMap[planStatus] || "not-started",
          },
        });
      });
    });

    return rows;
  }, [projects, getTimelineMeta, layout, columns, collapsedProjectIds]);

  const shiftAnchorByZoom = (direction) => {
    if (zoom === "week") {
      setAnchorDate((prev) => addDays(toStartOfDay(prev || new Date()), direction * 7));
      return;
    }

    if (zoom === "quarter") {
      setAnchorDate((prev) => addMonths(toStartOfDay(prev || new Date()), direction * 3));
      return;
    }

    setAnchorDate((prev) => addMonths(toStartOfDay(prev || new Date()), direction));
  };

  if (!isOpen) return null;

  return (
    <div
      className="timeline-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="timeline-modal-shell" role="dialog" aria-modal="true" aria-label="Projects Timeline">
        <button type="button" className="timeline-close-btn" onClick={onClose} aria-label="Close timeline">
          <X size={18} strokeWidth={2.5} />
          <span className="timeline-close-fallback" aria-hidden="true">×</span>
        </button>

        <TimelineToolbar
          zoom={zoom}
          onToday={() => setAnchorDate(today)}
          onPrevious={() => shiftAnchorByZoom(-1)}
          onNext={() => shiftAnchorByZoom(1)}
          onZoomChange={(nextZoom) => setZoom(nextZoom)}
        />

        <TimelineLegend />

        <div className="timeline-scroll-area" ref={scrollAreaRef}>
          <div className="timeline-board" style={{ width: layout.labelColumnWidth + layout.chartWidth }}>
            <div className="timeline-axis-row" style={{ gridTemplateColumns: layout.rowTemplateColumns }}>
              <div className="timeline-item-header">Item</div>
              <TimelineHeader
                layout={layout}
                columns={columns}
                monthSegments={monthSegments}
                todayColumnIndex={todayColumnIndex}
              />
            </div>

            <div className="timeline-body">
              {todayColumnIndex >= 0 && (
                <TimelineTodayIndicator
                  mode="body"
                  show
                  left={layout.labelColumnWidth + ((todayColumnIndex + 0.5) * layout.columnWidth)}
                />
              )}

              <TimelineRows
                rows={timelineRows}
                layout={layout}
                columns={columns}
                collapsedProjectIds={collapsedProjectIds}
                onToggleProject={(projectId) => {
                  setCollapsedProjectIds((prev) => ({
                    ...prev,
                    [projectId]: !prev[projectId],
                  }));
                }}
                onRowClick={(clickedRow) => {
                  if (clickedRow.type === "project") {
                    onProjectClick(clickedRow.project);
                    return;
                  }
                  onTestPlanClick(clickedRow.project, clickedRow.plan);
                }}
                onHoverStart={(event, row) => {
                  setTooltip({
                    visible: true,
                    x: event.clientX,
                    y: event.clientY,
                    name: row.name,
                    startDate: formatDate(row.type === "project" ? row.project.startDate : row.plan.startDate),
                    endDate: formatDate(row.type === "project" ? row.project.endDate : row.plan.endDate),
                    status: row.type === "project" ? "Project" : row.status,
                    progress: row.progress,
                  });
                }}
                onHoverMove={(event) => {
                  setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
                }}
                onHoverEnd={() => setTooltip(null)}
              />

              {timelineRows.length === 0 && (
                <div className="timeline-empty-state">No projects match the current filters.</div>
              )}
            </div>
          </div>
        </div>

        <TimelineTooltip tooltip={tooltip} />
      </div>
    </div>
  );
}
